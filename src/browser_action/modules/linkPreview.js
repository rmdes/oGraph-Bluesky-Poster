// linkPreview.js
// Fetch OG card data for an arbitrary URL via Bluesky's cardyb service.
//
// Why cardyb instead of fetching the page directly:
//   - cardyb is what bsky.app itself uses for embed cards
//   - it sends CORS headers, so the popup can read its responses
//   - this removes the need for host_permissions in the manifest
//   - cached thumbnails are served from cardyb.bsky.app with CORS as well,
//     so the subsequent uploadBlob step works without extra permission
//
// Response shape (https://cardyb.bsky.app/v1/extract?url=...):
//   { url, title, description, image, error }
// Where `image` is a cardyb-hosted thumbnail URL or an empty string, and
// `error` is "" on success or a human-readable message on failure.

const CARDYB_ENDPOINT = "https://cardyb.bsky.app/v1/extract";

// Fetch the OG card via cardyb. Returns an ogData-shaped object that matches
// what utils.js#parseOGData returns, or null if the lookup failed or returned
// no usable content.
export async function fetchOgDataForUrl(url) {
  if (typeof url !== "string" || url.trim() === "") return null;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  let payload;
  try {
    const response = await fetch(
      `${CARDYB_ENDPOINT}?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) return null;
    payload = await response.json();
  } catch {
    return null;
  }

  if (!payload || payload.error) return null;

  const hasUsableContent =
    payload.title || payload.description || payload.image;
  if (!hasUsableContent) return null;

  // Shape the response to match the existing ogData contract used by createPost.
  const data = {
    url: payload.url || url,
    title: payload.title || "",
    description: payload.description || "",
  };
  if (payload.image) data.image = payload.image;
  return data;
}
