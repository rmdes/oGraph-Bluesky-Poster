import {
  resolveHandleToDid,
  fetchDidDocument,
  extractPdsEndpoint,
  discoverPds,
} from "../src/browser_action/modules/identity";

describe("resolveHandleToDid", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test("returns DID on successful resolution", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: "did:plc:abc123" }),
    });
    const did = await resolveHandleToDid("alice.bsky.social");
    expect(did).toBe("did:plc:abc123");
  });

  test("uses the public AppView by default", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: "did:plc:x" }),
    });
    await resolveHandleToDid("alice.bsky.social");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.bsky.social"
    );
  });

  test("returns null on HTTP error", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400 });
    expect(await resolveHandleToDid("nope.test")).toBeNull();
  });

  test("returns null on network error", async () => {
    global.fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await resolveHandleToDid("alice.bsky.social")).toBeNull();
  });

  test("returns null for empty/non-string handle", async () => {
    expect(await resolveHandleToDid("")).toBeNull();
    expect(await resolveHandleToDid(null)).toBeNull();
    expect(await resolveHandleToDid(undefined)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("fetchDidDocument", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test("fetches did:plc:* from plc.directory", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "did:plc:abc" }),
    });
    await fetchDidDocument("did:plc:abc");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://plc.directory/did%3Aplc%3Aabc"
    );
  });

  test("fetches did:web:domain from .well-known", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await fetchDidDocument("did:web:example.com");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/.well-known/did.json"
    );
  });

  test("fetches did:web:domain:path from the custom path", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await fetchDidDocument("did:web:example.com:user:alice");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/user/alice/did.json"
    );
  });

  test("returns null for unknown DID methods", async () => {
    expect(await fetchDidDocument("did:other:xxx")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("returns null on HTTP error", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchDidDocument("did:plc:x")).toBeNull();
  });
});

describe("extractPdsEndpoint", () => {
  test("returns the endpoint when an AtprotoPersonalDataServer service is present", () => {
    const doc = {
      service: [
        { type: "Other", serviceEndpoint: "https://other.example" },
        {
          type: "AtprotoPersonalDataServer",
          serviceEndpoint: "https://bsky.social",
        },
      ],
    };
    expect(extractPdsEndpoint(doc)).toBe("https://bsky.social");
  });

  test("returns null when no PDS service is listed", () => {
    expect(
      extractPdsEndpoint({
        service: [{ type: "Other", serviceEndpoint: "https://x" }],
      })
    ).toBeNull();
  });

  test("returns null when service array is missing or malformed", () => {
    expect(extractPdsEndpoint(null)).toBeNull();
    expect(extractPdsEndpoint({})).toBeNull();
    expect(extractPdsEndpoint({ service: "not-an-array" })).toBeNull();
  });
});

describe("discoverPds", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test("resolves handle -> DID -> DID doc -> PDS endpoint end-to-end", async () => {
    global.fetch
      // resolveHandleToDid
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: "did:plc:abc" }),
      })
      // fetchDidDocument
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            service: [
              {
                type: "AtprotoPersonalDataServer",
                serviceEndpoint: "https://shiitake.us-east.host.bsky.network",
              },
            ],
          }),
      });

    const pds = await discoverPds("alice.bsky.social");
    expect(pds).toBe("https://shiitake.us-east.host.bsky.network");
  });

  test("returns null if handle resolution fails", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    expect(await discoverPds("nope.test")).toBeNull();
  });

  test("returns null if DID document fetch fails", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: "did:plc:abc" }),
      })
      .mockResolvedValueOnce({ ok: false });
    expect(await discoverPds("alice.bsky.social")).toBeNull();
  });
});
