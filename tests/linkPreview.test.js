import { fetchOgDataForUrl } from "../src/browser_action/modules/linkPreview";
import { findFirstLink } from "../src/browser_action/modules/facets";

const cardybOk = (payload) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(payload),
});

describe("fetchOgDataForUrl (via cardyb)", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test("hits the cardyb extract endpoint with the URL-encoded target", async () => {
    global.fetch.mockResolvedValueOnce(
      cardybOk({
        url: "https://example.com/",
        title: "Hello",
        description: "World",
        image: "https://cardyb.bsky.app/img/abc.jpg",
        error: "",
      })
    );

    await fetchOgDataForUrl("https://example.com/path?q=1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://cardyb.bsky.app/v1/extract?url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1"
    );
  });

  test("returns ogData-shaped object on success", async () => {
    global.fetch.mockResolvedValueOnce(
      cardybOk({
        url: "https://example.com/canonical",
        title: "Hello World",
        description: "A test page",
        image: "https://cardyb.bsky.app/img/abc.jpg",
        error: "",
      })
    );

    const data = await fetchOgDataForUrl("https://example.com/page");
    expect(data).toEqual({
      url: "https://example.com/canonical",
      title: "Hello World",
      description: "A test page",
      image: "https://cardyb.bsky.app/img/abc.jpg",
    });
  });

  test("returns null when cardyb reports an error in the payload", async () => {
    global.fetch.mockResolvedValueOnce(
      cardybOk({ url: "", title: "", description: "", image: "", error: "404 Not Found" })
    );
    expect(await fetchOgDataForUrl("https://example.com/missing")).toBeNull();
  });

  test("returns null when payload has no title, description, or image", async () => {
    global.fetch.mockResolvedValueOnce(
      cardybOk({ url: "https://example.com/", title: "", description: "", image: "", error: "" })
    );
    expect(await fetchOgDataForUrl("https://example.com/empty")).toBeNull();
  });

  test("omits image field when cardyb returns no image", async () => {
    global.fetch.mockResolvedValueOnce(
      cardybOk({
        url: "https://example.com/",
        title: "Title Only",
        description: "",
        image: "",
        error: "",
      })
    );
    const data = await fetchOgDataForUrl("https://example.com/");
    expect(data.title).toBe("Title Only");
    expect(data.image).toBeUndefined();
  });

  test("returns null on HTTP error from cardyb", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await fetchOgDataForUrl("https://example.com/")).toBeNull();
  });

  test("returns null on network error", async () => {
    global.fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchOgDataForUrl("https://example.com/")).toBeNull();
  });

  test("returns null for invalid or non-http(s) URLs without calling cardyb", async () => {
    expect(await fetchOgDataForUrl("")).toBeNull();
    expect(await fetchOgDataForUrl(null)).toBeNull();
    expect(await fetchOgDataForUrl("javascript:alert(1)")).toBeNull();
    expect(await fetchOgDataForUrl("ftp://example.com")).toBeNull();
    expect(await fetchOgDataForUrl("not a url")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("findFirstLink", () => {
  test("returns the first http(s) URL in text", () => {
    expect(findFirstLink("check https://example.com out")).toBe(
      "https://example.com"
    );
  });

  test("returns the first when multiple URLs are present", () => {
    expect(
      findFirstLink("see https://a.test and https://b.test")
    ).toBe("https://a.test");
  });

  test("returns null when no URL is present", () => {
    expect(findFirstLink("just plain text")).toBeNull();
  });

  test("returns null for non-string input", () => {
    expect(findFirstLink(null)).toBeNull();
    expect(findFirstLink(undefined)).toBeNull();
  });
});
