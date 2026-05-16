// identity.js
// atproto identity resolution: handle -> DID -> PDS endpoint.
//
// Two-hop chain:
//   1. Resolve handle to DID via the public AppView's resolveHandle XRPC.
//   2. Fetch the DID document (plc.directory for did:plc, .well-known for
//      did:web) and pull out the AtprotoPersonalDataServer service endpoint.

const APPVIEW_DEFAULT = "https://public.api.bsky.app";
const PLC_DIRECTORY = "https://plc.directory";

const ATPROTO_PDS_SERVICE_TYPE = "AtprotoPersonalDataServer";

// Resolve a handle to its current DID using the public AppView.
// Returns the DID string on success, null otherwise.
export async function resolveHandleToDid(handle, appviewUrl = APPVIEW_DEFAULT) {
  if (typeof handle !== "string" || handle.trim() === "") return null;
  try {
    const url = `${appviewUrl}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.did === "string" ? data.did : null;
  } catch {
    return null;
  }
}

// Fetch the DID document for a given DID. Method depends on the DID method:
//   did:plc:* -> https://plc.directory/<did>
//   did:web:domain -> https://domain/.well-known/did.json
// Returns the parsed JSON or null on failure.
export async function fetchDidDocument(did) {
  if (typeof did !== "string") return null;
  let url;
  if (did.startsWith("did:plc:")) {
    url = `${PLC_DIRECTORY}/${encodeURIComponent(did)}`;
  } else if (did.startsWith("did:web:")) {
    // did:web:example.com         -> https://example.com/.well-known/did.json
    // did:web:example.com:user:a  -> https://example.com/user/a/did.json
    const identifier = did.slice("did:web:".length);
    const parts = identifier.split(":");
    const domain = parts[0];
    const path =
      parts.length > 1
        ? `/${parts.slice(1).join("/")}/did.json`
        : "/.well-known/did.json";
    url = `https://${domain}${path}`;
  } else {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Extract the atproto PDS endpoint from a DID document's `service` array.
export function extractPdsEndpoint(didDoc) {
  if (!didDoc || !Array.isArray(didDoc.service)) return null;
  for (const service of didDoc.service) {
    if (service && service.type === ATPROTO_PDS_SERVICE_TYPE) {
      const endpoint = service.serviceEndpoint;
      if (typeof endpoint === "string") return endpoint;
    }
  }
  return null;
}

// One-shot: handle -> PDS URL. Returns the PDS URL on success, null on any
// failure in the resolution chain.
export async function discoverPds(handle) {
  const did = await resolveHandleToDid(handle);
  if (!did) return null;
  const didDoc = await fetchDidDocument(did);
  if (!didDoc) return null;
  return extractPdsEndpoint(didDoc);
}
