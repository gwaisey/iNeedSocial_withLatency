import { afterEach, describe, expect, it, vi } from "vitest"
import * as runtimeMonitoring from "../utils/runtime-monitoring"
import {
  normalizeFeedPayload,
  resolveFeedPath,
  resolveFeedSource,
  validateFeedPayload,
} from "./feed-service"

describe("feed-service helpers", () => {
  const reportRuntimeIssueSpy = vi
    .spyOn(runtimeMonitoring, "reportRuntimeIssue")
    .mockImplementation((input) => ({
      error: input.error instanceof Error ? { message: input.error.message } : undefined,
      level: input.level,
      message: input.message,
      metadata: input.metadata,
      scope: input.scope,
      timestamp: "2026-04-20T00:00:00.000Z",
    }))

  afterEach(() => {
    reportRuntimeIssueSpy.mockClear()
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
    expect(reportRuntimeIssueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.anything(),
        level: "error",
        message: "Feed payload validation failed.",
        metadata: {
          issueCount: expect.any(Number),
        },
        scope: "feed-service",
      })
    )
  })

  it("rejects image posts that point at video media sources", () => {
    expect(() =>
      validateFeedPayload({
        posts: [
          {
            id: "post-video-image-mismatch",
            type: "image",
            username: "uji",
            likes: "10",
            caption: "uji",
            media: [{ src: "/content/videos/sample.mp4", alt: "uji" }],
            genre: "humor",
          },
        ],
      })
    ).toThrow("Format feed tidak valid.")
  })

  it("rejects video posts that point at non-video media sources", () => {
    expect(() =>
      validateFeedPayload({
        posts: [
          {
            id: "post-image-video-mismatch",
            type: "video",
            username: "uji",
            likes: "10",
            caption: "uji",
            media: [{ src: "/content/files/sample.jpg", alt: "uji" }],
            genre: "humor",
          },
        ],
      })
    ).toThrow("Format feed tidak valid.")
  })

  it("allows video posts backed by a Cloudflare Stream uid", () => {
    expect(() =>
      validateFeedPayload({
        posts: [
          {
            id: "post-stream-video",
            type: "video",
            username: "uji",
            likes: "10",
            caption: "uji",
            media: [
              {
                src: "/content/files/placeholder.jpg",
                alt: "uji",
                streamDelivery: "mp4",
                streamUid: "dad0deb02906401e5950bfe6816fb4a4",
              },
            ],
            genre: "humor",
          },
        ],
      })
    ).not.toThrow()
  })

  it("allows mixed-media carousels while rejecting single-item carousels", () => {
    expect(() =>
      validateFeedPayload({
        posts: [
          {
            id: "post-carousel-mixed",
            type: "carousel",
            username: "uji",
            likes: "10",
            caption: "uji",
            media: [
              { src: "/content/videos/sample.mp4", alt: "video" },
              { src: "/content/files/sample.jpg", alt: "image" },
            ],
            genre: "humor",
          },
        ],
      })
    ).not.toThrow()

    expect(() =>
      validateFeedPayload({
        posts: [
          {
            id: "post-carousel-single",
            type: "carousel",
            username: "uji",
            likes: "10",
            caption: "uji",
            media: [{ src: "/content/files/sample.jpg", alt: "image" }],
            genre: "humor",
          },
        ],
      })
    ).toThrow("Format feed tidak valid.")
  })

  it("rejects media items with empty alt text", () => {
    expect(() =>
      validateFeedPayload({
        posts: [
          {
            id: "post-image-empty-alt",
            type: "image",
            username: "uji",
            likes: "10",
            caption: "uji",
            media: [{ src: "/content/files/sample.jpg", alt: "   " }],
            genre: "humor",
          },
        ],
      })
    ).toThrow("Format feed tidak valid.")
  })
})
