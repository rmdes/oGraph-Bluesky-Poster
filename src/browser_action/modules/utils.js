export function getImageWidth(imageUrl) {
  return new Promise(function (resolve, reject) {
    if (!imageUrl || !imageUrl?.trim()?.length) {
      reject();
    }
    const img = new Image();
    img.onload = function () {
      resolve({ width: this.naturalWidth, height: this.naturalHeight });
    };
    img.onerror = function () {
      reject();
    };
    img.src = imageUrl;
  });
}

export function parseOGData() {
  // Twitter-card meta uses `name="twitter:..."` (not `property=`). Many sites
  // emit only one of og:* or twitter:*. We prefer og:* and fall back to the
  // twitter:* equivalent for the keys Bluesky's embed card actually uses.
  const data = {};

  document.querySelectorAll('meta[property^="og:"]').forEach((tag) => {
    const key = tag.getAttribute("property").substring(3); // strip "og:"
    const value = tag.getAttribute("content");
    if (key && value) data[key] = value;
  });

  // Map twitter:* → og:* equivalents, only filling in keys that are missing.
  const TWITTER_TO_OG = {
    "twitter:title": "title",
    "twitter:description": "description",
    "twitter:image": "image",
    "twitter:image:src": "image",
    "twitter:url": "url",
  };
  document.querySelectorAll('meta[name^="twitter:"]').forEach((tag) => {
    const twitterKey = tag.getAttribute("name");
    const ogKey = TWITTER_TO_OG[twitterKey];
    if (!ogKey || data[ogKey]) return; // og:* wins when both exist
    const value = tag.getAttribute("content");
    if (value) data[ogKey] = value;
  });

  // Final URL fallback so the embed card always has somewhere to link to.
  if (!data.url) data.url = window.location.href;

  return data;
}

// currentWindow targets the window the extension is running in (the popup's
// owning window) rather than chasing focus across monitors, which avoided
// occasional "posted about the wrong tab" bugs on multi-monitor setups.
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const RESTRICTED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "chrome-search://",
  "chrome-untrusted://",
  "devtools://",
  "edge://",
  "about:",
  "view-source:",
  "https://chrome.google.com/webstore",
  "https://chromewebstore.google.com",
];

export function isRestrictedUrl(url) {
  if (typeof url !== "string") return true;
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}
