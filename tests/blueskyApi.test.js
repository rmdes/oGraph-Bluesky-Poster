// Tests for the withAuthRetry higher-order wrapper that owns the
// "on 401, refresh once and retry" behavior. Direct unit tests beat
// integration tests here because we want to pin down branching:
// - happy path (no refresh)
// - 401 -> refresh succeeds -> retry
// - 401 -> refresh fails (various ways) -> unauthenticated
// - non-401 errors pass through untouched

import {
  withAuthRetry,
  refreshSession,
  withTransientRetry,
} from "../src/browser_action/modules/blueskyApi";

const PDS = "https://bsky.social";

const setupChromeStorageMock = () => {
  const store = {};
  global.chrome = {
    storage: {
      local: {
        set: jest.fn((entries, cb) => {
          Object.assign(store, entries);
          if (cb) cb();
        }),
        remove: jest.fn((keys, cb) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
          if (cb) cb();
        }),
        get: jest.fn((keys, cb) => {
          const result = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
            if (k in store) result[k] = store[k];
          });
          cb(result);
        }),
      },
    },
    runtime: {}, // chrome.runtime.lastError stays undefined (falsy) → no rejects
  };
  return store;
};

describe("withAuthRetry", () => {
  let store;

  beforeEach(() => {
    store = setupChromeStorageMock();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
    delete global.chrome;
  });

  test("returns the response unchanged when status is 200 (no refresh)", async () => {
    const okResponse = { status: 200 };
    const makeRequest = jest.fn().mockResolvedValue(okResponse);

    const result = await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(makeRequest).toHaveBeenCalledWith("old-access");
    expect(result.response).toBe(okResponse);
    expect(result.accessJwt).toBe("old-access");
    expect(result.unauthenticated).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("does not retry on non-401 errors (e.g. 500)", async () => {
    const serverErrorResponse = { status: 500 };
    const makeRequest = jest.fn().mockResolvedValue(serverErrorResponse);

    const result = await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(result.response).toBe(serverErrorResponse);
    expect(result.unauthenticated).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("refreshes the session and retries the request on 401", async () => {
    const unauthorized = { status: 401 };
    const retrySuccess = { status: 200 };
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(retrySuccess);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ accessJwt: "new-access", refreshJwt: "new-refresh" }),
    });

    const result = await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(makeRequest).toHaveBeenCalledTimes(2);
    expect(makeRequest).toHaveBeenNthCalledWith(1, "old-access");
    expect(makeRequest).toHaveBeenNthCalledWith(2, "new-access");
    expect(result.response).toBe(retrySuccess);
    expect(result.accessJwt).toBe("new-access");
    expect(result.unauthenticated).toBeUndefined();
  });

  test("persists the rotated tokens to chrome.storage after a successful refresh", async () => {
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ accessJwt: "new-access", refreshJwt: "new-refresh" }),
    });

    await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(store.accessJwt).toBe("new-access");
    expect(store.refreshJwt).toBe("new-refresh");
  });

  test("authenticates the refresh call with the refreshJwt as Bearer (not the accessJwt)", async () => {
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ accessJwt: "new-access", refreshJwt: "new-refresh" }),
    });

    await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "the-refresh-token" },
      makeRequest
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${PDS}/xrpc/com.atproto.server.refreshSession`,
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer the-refresh-token" },
      })
    );
  });

  test("returns unauthenticated and clears storage when refresh HTTP fails", async () => {
    // Pre-populate storage with a full session so we can assert it gets cleared.
    store.accessJwt = "old-access";
    store.refreshJwt = "old-refresh";
    store.did = "did:plc:test";
    store.handle = "alice.test";
    store.pdsUrl = PDS;

    const makeRequest = jest.fn().mockResolvedValue({ status: 401 });
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(makeRequest).toHaveBeenCalledTimes(1); // no retry attempted
    expect(result.unauthenticated).toBe(true);
    expect(store.accessJwt).toBeUndefined();
    expect(store.refreshJwt).toBeUndefined();
    expect(store.did).toBeUndefined();
    expect(store.handle).toBeUndefined();
    expect(store.pdsUrl).toBeUndefined();
  });

  test("returns unauthenticated when the refresh response is missing token fields", async () => {
    const makeRequest = jest.fn().mockResolvedValue({ status: 401 });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}), // no accessJwt/refreshJwt
    });

    const result = await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(result.unauthenticated).toBe(true);
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  test("returns unauthenticated when the refresh fetch throws (network failure)", async () => {
    const makeRequest = jest.fn().mockResolvedValue({ status: 401 });
    global.fetch.mockRejectedValueOnce(new Error("network down"));

    const result = await withAuthRetry(
      { pdsUrl: PDS, accessJwt: "old-access", refreshJwt: "old-refresh" },
      makeRequest
    );

    expect(result.unauthenticated).toBe(true);
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });
});

describe("refreshSession", () => {
  beforeEach(() => {
    setupChromeStorageMock();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
    delete global.chrome;
  });

  test("returns success: false on non-ok HTTP response", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400 });
    const result = await refreshSession(PDS, "ref");
    expect(result.success).toBe(false);
  });

  test("returns success: false when network throws", async () => {
    global.fetch.mockRejectedValueOnce(new Error("boom"));
    const result = await refreshSession(PDS, "ref");
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  test("returns new tokens on success", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ accessJwt: "A", refreshJwt: "R", extra: "ignored" }),
    });
    const result = await refreshSession(PDS, "ref");
    expect(result).toEqual({
      success: true,
      accessJwt: "A",
      refreshJwt: "R",
    });
  });
});

describe("withTransientRetry", () => {
  // Inject a no-op sleep so tests don't actually wait between attempts.
  const noSleep = () => Promise.resolve();

  test("returns immediately on a 200 response (no retry)", async () => {
    const makeRequest = jest.fn().mockResolvedValue({ status: 200 });
    const result = await withTransientRetry(makeRequest, { sleep: noSleep });
    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
  });

  test("returns immediately on a 4xx non-429 (no retry)", async () => {
    const makeRequest = jest.fn().mockResolvedValue({ status: 400 });
    const result = await withTransientRetry(makeRequest, { sleep: noSleep });
    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(400);
  });

  test("retries on 500 up to maxAttempts", async () => {
    const makeRequest = jest.fn().mockResolvedValue({ status: 503 });
    const result = await withTransientRetry(makeRequest, {
      maxAttempts: 3,
      sleep: noSleep,
    });
    expect(makeRequest).toHaveBeenCalledTimes(3);
    expect(result.status).toBe(503);
  });

  test("succeeds on retry after initial 503", async () => {
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });
    const result = await withTransientRetry(makeRequest, { sleep: noSleep });
    expect(makeRequest).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  test("honors Retry-After header on 429", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: (h) => (h === "Retry-After" ? "7" : null) },
      })
      .mockResolvedValueOnce({ status: 200 });

    await withTransientRetry(makeRequest, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  test("falls back to exponential backoff when Retry-After is missing", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const makeRequest = jest
      .fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({ status: 200 });

    await withTransientRetry(makeRequest, { sleep, baseDelayMs: 500 });
    expect(sleep).toHaveBeenNthCalledWith(1, 500); // 500 * 2^0
    expect(sleep).toHaveBeenNthCalledWith(2, 1000); // 500 * 2^1
  });

  test("uses exponential backoff for 5xx without Retry-After", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const makeRequest = jest.fn().mockResolvedValue({ status: 500 });
    await withTransientRetry(makeRequest, {
      sleep,
      baseDelayMs: 100,
      maxAttempts: 3,
    });
    // 2 sleeps between 3 attempts: 100, 200
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });
});
