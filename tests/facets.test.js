import {
  buildFacets,
  countGraphemes,
  POST_MAX_GRAPHEMES,
} from "../src/browser_action/modules/facets";

// All offsets in these tests are HAND-VERIFIED against the actual UTF-8 byte
// encoding of the input string. The whole point of facets is byte precision.

describe("buildFacets — links", () => {
  test("detects a single https link with correct byte offsets", async () => {
    const text = "Read https://example.com today";
    //           0123456789012345678901234567890
    //           "Read " = 5 bytes, "https://example.com" = 19 bytes
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets).toHaveLength(1);
    expect(facets[0].index).toEqual({ byteStart: 5, byteEnd: 24 });
    expect(facets[0].features[0]).toEqual({
      $type: "app.bsky.richtext.facet#link",
      uri: "https://example.com",
    });
  });

  test("strips trailing punctuation from the link", async () => {
    const text = "See https://example.com.";
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets).toHaveLength(1);
    expect(facets[0].features[0].uri).toBe("https://example.com");
  });

  test("computes byte offsets correctly with multi-byte UTF-8 characters before the link", async () => {
    const text = "café https://example.com"; // é = 2 bytes in UTF-8
    //           "café " = 6 bytes, link starts at byte 6
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets[0].index).toEqual({ byteStart: 6, byteEnd: 25 });
  });

  test("computes byte offsets correctly with emoji before the link", async () => {
    const text = "🎉 https://example.com"; // 🎉 = 4 bytes (surrogate pair → 4 UTF-8)
    //           "🎉 " = 5 bytes
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets[0].index).toEqual({ byteStart: 5, byteEnd: 24 });
  });
});

describe("buildFacets — hashtags", () => {
  test("detects a hashtag at start of post", async () => {
    const text = "#bluesky launch";
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets).toHaveLength(1);
    expect(facets[0].index).toEqual({ byteStart: 0, byteEnd: 8 });
    expect(facets[0].features[0]).toEqual({
      $type: "app.bsky.richtext.facet#tag",
      tag: "bluesky",
    });
  });

  test("detects a hashtag after whitespace", async () => {
    const text = "hello #world";
    //           "hello " = 6 bytes, "#world" = 6 bytes
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets).toHaveLength(1);
    expect(facets[0].index).toEqual({ byteStart: 6, byteEnd: 12 });
    expect(facets[0].features[0].tag).toBe("world");
  });

  test("does not detect # inside a word (e.g., URL fragments)", async () => {
    const text = "page#section";
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets).toHaveLength(0);
  });

  test("supports unicode hashtag content", async () => {
    const text = "#日本語";
    const facets = await buildFacets(text, "https://bsky.social", async () => null);
    expect(facets).toHaveLength(1);
    expect(facets[0].features[0].tag).toBe("日本語");
  });
});

describe("buildFacets — mentions", () => {
  test("detects a mention and uses resolver to fetch DID", async () => {
    const text = "hello @alice.bsky.social";
    //           "hello " = 6 bytes, "@alice.bsky.social" = 18 bytes
    const resolver = jest.fn().mockResolvedValue("did:plc:abc123");
    const facets = await buildFacets(text, "https://bsky.social", resolver);

    expect(resolver).toHaveBeenCalledWith("https://bsky.social", "alice.bsky.social");
    expect(facets).toHaveLength(1);
    expect(facets[0].index).toEqual({ byteStart: 6, byteEnd: 24 });
    expect(facets[0].features[0]).toEqual({
      $type: "app.bsky.richtext.facet#mention",
      did: "did:plc:abc123",
    });
  });

  test("drops mention silently if the handle does not resolve", async () => {
    const text = "hello @ghost.bsky.social";
    const resolver = jest.fn().mockResolvedValue(null);
    const facets = await buildFacets(text, "https://bsky.social", resolver);
    expect(facets).toHaveLength(0);
  });

  test("does not match @ inside an email-like string", async () => {
    const text = "email me at user@example.com";
    const resolver = jest.fn().mockResolvedValue("did:plc:xyz");
    const facets = await buildFacets(text, "https://bsky.social", resolver);
    // The "user@example.com" should not be a mention because @ is preceded by 'r'.
    expect(resolver).not.toHaveBeenCalled();
    expect(facets.filter((f) => f.features[0].$type.endsWith("#mention"))).toHaveLength(0);
  });

  test("resolves multiple mentions in parallel", async () => {
    const text = "@a.test and @b.test";
    const resolver = jest.fn()
      .mockResolvedValueOnce("did:plc:aaa")
      .mockResolvedValueOnce("did:plc:bbb");
    const facets = await buildFacets(text, "https://bsky.social", resolver);
    const mentionFacets = facets.filter((f) =>
      f.features[0].$type.endsWith("#mention")
    );
    expect(mentionFacets).toHaveLength(2);
    expect(mentionFacets[0].features[0].did).toBe("did:plc:aaa");
    expect(mentionFacets[1].features[0].did).toBe("did:plc:bbb");
  });
});

describe("buildFacets — combinations and ordering", () => {
  test("returns all facet types together, sorted by byteStart", async () => {
    const text = "@alice.bsky.social check #cool https://example.com";
    const resolver = jest.fn().mockResolvedValue("did:plc:alice");
    const facets = await buildFacets(text, "https://bsky.social", resolver);
    expect(facets).toHaveLength(3);
    expect(facets[0].features[0].$type).toBe("app.bsky.richtext.facet#mention");
    expect(facets[1].features[0].$type).toBe("app.bsky.richtext.facet#tag");
    expect(facets[2].features[0].$type).toBe("app.bsky.richtext.facet#link");
    expect(facets[0].index.byteStart).toBeLessThan(facets[1].index.byteStart);
    expect(facets[1].index.byteStart).toBeLessThan(facets[2].index.byteStart);
  });

  test("returns empty array for empty or non-string input", async () => {
    expect(await buildFacets("", "https://bsky.social", async () => null)).toEqual([]);
    expect(await buildFacets(null, "https://bsky.social", async () => null)).toEqual([]);
    expect(await buildFacets(undefined, "https://bsky.social", async () => null)).toEqual([]);
  });
});

describe("countGraphemes", () => {
  test("counts ASCII chars correctly", () => {
    expect(countGraphemes("hello")).toBe(5);
  });

  test("counts a multi-codepoint emoji cluster as one grapheme", () => {
    // 👨‍👩‍👧 is man + ZWJ + woman + ZWJ + girl = 5 codepoints, 1 grapheme.
    // (Only works correctly with Intl.Segmenter)
    expect(countGraphemes("👨‍👩‍👧")).toBe(1);
  });

  test("counts mixed text + emoji correctly", () => {
    expect(countGraphemes("hi 🎉")).toBe(4); // h, i, space, 🎉
  });

  test("returns 0 for non-string input", () => {
    expect(countGraphemes(null)).toBe(0);
    expect(countGraphemes(undefined)).toBe(0);
    expect(countGraphemes(123)).toBe(0);
  });

  test("POST_MAX_GRAPHEMES matches Bluesky lexicon limit", () => {
    expect(POST_MAX_GRAPHEMES).toBe(300);
  });
});
