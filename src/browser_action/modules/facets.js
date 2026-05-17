// facets.js
// Detect rich-text facets (links, mentions, hashtags) in post text and
// return atproto app.bsky.richtext.facet records.
//
// Critical detail: facet indices are UTF-8 BYTE offsets into the text,
// not char/codepoint/grapheme offsets. We use TextEncoder to compute them.

// Tagged URLs: require a scheme to avoid grabbing trailing punctuation like
// "see example.com." Includes a small set of trailing chars to strip.
const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;

// Returns the first http(s) URL found in the text, or null. Useful for the
// auto-card flow that wants to know "does this post mention something I
// should try to embed?"
export function findFirstLink(text) {
  if (typeof text !== "string") return null;
  const match = text.match(URL_RE);
  return match ? match[0] : null;
}

// Bluesky handles: alphanumeric + hyphen, at least one dot, ascii-only.
// Anchored to a leading @ that isn't preceded by another word char (so
// "user@host" inside an email isn't matched).
const MENTION_RE = /(^|[\s(])@([a-zA-Z0-9][a-zA-Z0-9-]{0,62}(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})+)\b/g;

// Hashtags: word chars after a #, not preceded by another word char.
const HASHTAG_RE = /(^|[\s(])#([\p{L}\p{N}_]+)/gu;

const utf8 = new TextEncoder();

// Convert a JS string-index range to a UTF-8 byte-index range.
function byteOffsets(text, charStart, charEnd) {
  return {
    byteStart: utf8.encode(text.slice(0, charStart)).length,
    byteEnd: utf8.encode(text.slice(0, charEnd)).length,
  };
}

function findLinkSpans(text) {
  const spans = [];
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index;
    const end = start + match[0].length;
    spans.push({ type: "link", start, end, value: match[0] });
  }
  return spans;
}

function findMentionSpans(text) {
  const spans = [];
  for (const match of text.matchAll(MENTION_RE)) {
    // match[1] is the leading whitespace/paren; the @ starts right after.
    const start = match.index + match[1].length;
    const end = start + 1 + match[2].length; // +1 for the @
    spans.push({ type: "mention", start, end, value: match[2] });
  }
  return spans;
}

function findHashtagSpans(text) {
  const spans = [];
  for (const match of text.matchAll(HASHTAG_RE)) {
    const start = match.index + match[1].length;
    const end = start + 1 + match[2].length; // +1 for the #
    spans.push({ type: "tag", start, end, value: match[2] });
  }
  return spans;
}

// Resolve a Bluesky handle to a DID via the PDS's identity XRPC.
// Returns the DID string or null on failure. Public endpoint, no auth needed.
export async function resolveHandle(pdsUrl, handle) {
  try {
    const url = `${pdsUrl}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.did === "string" ? data.did : null;
  } catch {
    return null;
  }
}

// Build the facets array for a post.
// `resolveHandleFn` is injected so tests can stub it (defaults to live resolver).
export async function buildFacets(text, pdsUrl, resolveHandleFn = resolveHandle) {
  if (typeof text !== "string" || text === "") return [];

  const linkSpans = findLinkSpans(text);
  const hashtagSpans = findHashtagSpans(text);
  const mentionSpans = findMentionSpans(text);

  const facets = [];

  for (const span of linkSpans) {
    facets.push({
      index: byteOffsets(text, span.start, span.end),
      features: [{ $type: "app.bsky.richtext.facet#link", uri: span.value }],
    });
  }

  for (const span of hashtagSpans) {
    facets.push({
      index: byteOffsets(text, span.start, span.end),
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: span.value }],
    });
  }

  // Resolve mention DIDs in parallel; drop ones that don't resolve.
  const mentionResolutions = await Promise.all(
    mentionSpans.map((span) => resolveHandleFn(pdsUrl, span.value))
  );
  mentionSpans.forEach((span, i) => {
    const did = mentionResolutions[i];
    if (!did) return; // unresolved handles silently lose their facet
    facets.push({
      index: byteOffsets(text, span.start, span.end),
      features: [{ $type: "app.bsky.richtext.facet#mention", did }],
    });
  });

  // Sort by byteStart so the array is in document order (Bluesky doesn't
  // require this, but it makes the records easier to inspect).
  facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
  return facets;
}

// Count graphemes using Intl.Segmenter (the only correct way to count
// "user-perceived characters" in JS). Falls back to codepoint count if
// Segmenter isn't available (very old browsers).
export function countGraphemes(text) {
  if (typeof text !== "string") return 0;
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let count = 0;
    for (const _ of segmenter.segment(text)) count++;
    return count;
  }
  return Array.from(text).length;
}

export const POST_MAX_GRAPHEMES = 300;
