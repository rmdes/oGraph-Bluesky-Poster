// blueskyApi.js
// Thin atproto XRPC client for the popup.
// Auth strategy: try with current accessJwt; on 401, refresh once and retry.
// Transient strategy: retry up to 3 times on 429 (Retry-After honored) and 5xx.

import { saveMany, clearMany } from "./storage";
import { buildFacets } from "./facets";

const SESSION_KEYS = ["accessJwt", "refreshJwt", "did", "handle", "pdsUrl"];
// Bluesky's uploadBlob limit. Larger blobs are rejected by the PDS.
const MAX_BLOB_BYTES = 1_000_000;

// Pick the primary language subtag for the langs field on posts. Falls back to
// English. Bluesky uses these for content filtering and translation hints.
function defaultLang() {
  const raw =
    (typeof navigator !== "undefined" && navigator.language) || "en";
  return String(raw).split("-")[0].toLowerCase();
}

// Returns the image blob on success, or null on any failure (bad URL, network
// error, non-2xx, non-http scheme). Returning null lets createPost fall back
// to a card without a thumbnail instead of failing the whole post.
async function fetchImageBlob(imageUrl) {
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") return null;

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export async function authenticate(pdsUrl, handle, password) {
  try {
    const response = await fetch(
      `${pdsUrl}/xrpc/com.atproto.server.createSession`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: handle, password }),
      }
    );

    const data = await response.json();

    if (data.accessJwt && data.refreshJwt && data.did) {
      return {
        success: true,
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
        did: data.did,
      };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error };
  }
}

// atproto convention: refreshSession is authenticated with the refreshJwt,
// not the accessJwt.
export async function refreshSession(pdsUrl, refreshJwt) {
  try {
    const response = await fetch(
      `${pdsUrl}/xrpc/com.atproto.server.refreshSession`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${refreshJwt}` },
      }
    );

    if (!response.ok) return { success: false };

    const data = await response.json();
    if (data.accessJwt && data.refreshJwt) {
      return {
        success: true,
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
      };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error };
  }
}

// Retry on 429 (rate-limited) and 5xx. Honors Retry-After header on 429.
// `sleep` is injected to keep tests timer-free.
export async function withTransientRetry(makeRequest, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;

  let response;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    response = await makeRequest();
    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable) return response;
    if (attempt === maxAttempts - 1) break;

    let delayMs = baseDelayMs * Math.pow(2, attempt);
    if (response.status === 429 && response.headers?.get) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) {
        delayMs = seconds * 1000;
      }
    }
    await sleep(delayMs);
  }
  return response;
}

// Try `makeRequest(accessJwt)`; if it 401s, refresh once and retry.
// On refresh failure, returns { unauthenticated: true } so callers can force logout.
export async function withAuthRetry({ pdsUrl, accessJwt, refreshJwt }, makeRequest) {
  let response = await makeRequest(accessJwt);
  if (response.status !== 401) return { response, accessJwt };

  const fresh = await refreshSession(pdsUrl, refreshJwt);
  if (!fresh.success) {
    await clearMany(SESSION_KEYS);
    return { response, accessJwt, unauthenticated: true };
  }

  await saveMany({
    accessJwt: fresh.accessJwt,
    refreshJwt: fresh.refreshJwt,
  });

  response = await makeRequest(fresh.accessJwt);
  return { response, accessJwt: fresh.accessJwt };
}

export async function uploadFile(
  pdsUrl,
  accessJwt,
  refreshJwt,
  imgBytes,
  mimeType
) {
  const { response, unauthenticated } = await withAuthRetry(
    { pdsUrl, accessJwt, refreshJwt },
    (jwt) =>
      withTransientRetry(() =>
        fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
          method: "POST",
          headers: {
            "Content-Type": mimeType,
            Authorization: `Bearer ${jwt}`,
          },
          body: imgBytes,
        })
      )
  );

  if (unauthenticated) return { success: false, unauthenticated: true };

  const data = await response.json();
  return data.blob
    ? { success: true, blob: data.blob }
    : { success: false };
}

export async function createPost(
  pdsUrl,
  accessJwt,
  refreshJwt,
  did,
  ogData,
  userText,
  useOpenGraphData
) {
  const post = {
    $type: "app.bsky.feed.post",
    text: userText || "",
    createdAt: new Date().toISOString(),
    langs: [defaultLang()],
  };

  // Rich-text facets: clickable links, mentions, hashtags inside user text.
  // Unresolved mentions are silently dropped; the post still goes out.
  if (post.text.length > 0) {
    const facets = await buildFacets(post.text, pdsUrl);
    if (facets.length > 0) {
      post.facets = facets;
    }
  }

  if (useOpenGraphData && ogData && ogData.url) {
    const embedExternal = {
      $type: "app.bsky.embed.external",
      external: {
        uri: ogData.url,
        title: ogData.title || "",
        description: ogData.description || "",
      },
    };

    if (ogData.image) {
      const imgBlob = await fetchImageBlob(ogData.image);
      // imgBlob is null on any image-fetch failure; the post still goes out,
      // just without a thumbnail attached to the card. Same treatment for
      // oversized images — Bluesky enforces a hard 1MB blob limit.
      if (imgBlob && imgBlob.size <= MAX_BLOB_BYTES) {
        const mimeType = imgBlob.type || "image/jpeg";
        const upload = await uploadFile(
          pdsUrl,
          accessJwt,
          refreshJwt,
          imgBlob,
          mimeType
        );
        if (upload.unauthenticated) {
          return { success: false, unauthenticated: true };
        }
        if (upload.success) {
          embedExternal.external.thumb = upload.blob;
        }
      }
    }

    post.embed = embedExternal;
  } else if (!userText) {
    return { success: false, reason: "empty_post" };
  }

  const { response, unauthenticated } = await withAuthRetry(
    { pdsUrl, accessJwt, refreshJwt },
    (jwt) =>
      withTransientRetry(() =>
        fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            repo: did,
            collection: "app.bsky.feed.post",
            record: post,
          }),
        })
      )
  );

  if (unauthenticated) return { success: false, unauthenticated: true };

  const data = await response.json();
  return data.cid
    ? { success: true, cid: data.cid }
    : { success: false };
}
