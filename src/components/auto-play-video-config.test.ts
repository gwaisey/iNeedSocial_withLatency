import { describe, expect, it } from "vitest"
import {
  getKnownVideoAspectRatio,
  getResolvedVideoSource,
  getVideoPosterSource,
} from "./auto-play-video-config"

describe("auto-play video config", () => {
  it("prefers explicit posters but can derive a static poster path from a video source", () => {
    expect(getVideoPosterSource("/content/videos/pinata.mp4", "/custom/poster.jpg")).toBe(
      "/custom/poster.jpg"
    )

    expect(getVideoPosterSource("/content/videos/pinata.mp4")).toBe(
      "/content/video-posters/pinata.jpg"
    )

    expect(getVideoPosterSource("/content/files/photo.jpg")).toBeUndefined()
  })

  it("resolves video source to local path", () => {
    expect(getResolvedVideoSource("/content/videos/pinata.mp4")).toBe("/content/videos/pinata.mp4")
    expect(getResolvedVideoSource("  /content/videos/pinata.mp4  ")).toBe("/content/videos/pinata.mp4")
    expect(getResolvedVideoSource("")).toBeUndefined()
    expect(getResolvedVideoSource(undefined)).toBeUndefined()
  })

  it("derives a stable aspect ratio from known poster dimensions", () => {
    expect(getKnownVideoAspectRatio("/content/videos/captain-america.mp4")).toBe("720 / 400")
    expect(getKnownVideoAspectRatio("/content/videos/pinata.mp4")).toBe("480 / 854")
    expect(getKnownVideoAspectRatio("/content/files/photo.jpg")).toBeUndefined()
  })
})
