import { afterEach, describe, expect, it, vi } from "vitest"
import {
  normalizeFeedPayload,
  resolveFeedPath,
  resolveFeedSource,
  validateFeedPayload,
} from "./feed-service"

describe("feed-service helpers", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

  afterEach(() => {
    consoleErrorSpy.mockClear()
  })

  it("defaults feed source to mock unless explicitly set to api", () => {
    expect(resolveFeedSource(undefined)).toBe("mock")
    expect(resolveFeedSource("mock")).toBe("mock")
    expect(resolveFeedSource("anything-else")).toBe("mock")
    expect(resolveFeedSource("api")).toBe("api")
  })

  it("resolves feed paths against the configured Vite base path", () => {
    expect(resolveFeedPath("/content/feed.json", "/")).toBe("/content/feed.json")
    expect(resolveFeedPath("content/feed.json", "/study/")).toBe(
      "/study/content/feed.json"
    )
    expect(resolveFeedPath("/api/feed?theme=dark", "/study")).toBe(
      "/study/api/feed?theme=dark"
    )
  })

  it("normalizes unknown genres to humor", () => {
    const payload = normalizeFeedPayload("light", {
      posts: [
        {
          id: "post-1",
          type: "image",
          username: "uji",
          likes: "10",
          caption: "uji",
          media: [{ src: "/img.jpg", alt: "uji" }],
          genre: "tidak-valid",
        },
      ],
    })

    expect(payload.posts[0]?.genre).toBe("humor")
  })

  it("throws a localized validation error for malformed feed payloads", () => {
    expect(() => validateFeedPayload({ posts: [{ id: "post-1" }] })).toThrow(
      "Format feed tidak valid."
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[feed-service:validation]",
      expect.anything()
    )
  })
})
