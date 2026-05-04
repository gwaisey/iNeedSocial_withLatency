import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getKnownVideoAspectRatio,
  getVideoPublicOrigin,
  getResolvedVideoSource,
  getVideoPosterSource,
  isDirectVideoFileSource,
} from "./auto-play-video-config"

describe("auto-play video config", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers explicit posters but can derive a static poster path from a video source", () => {
    expect(getVideoPosterSource("/content/videos-default/pinata.mp4", "/custom/poster.jpg")).toBe(
      "/custom/poster.jpg"
    )

    expect(getVideoPosterSource("/content/videos-default/pinata.mp4")).toBe(
      "/content/video-posters/pinata.jpg"
    )

    expect(getVideoPosterSource("/content/files/photo.jpg")).toBeUndefined()
  })

  it("keeps local video references local when no public origin is configured", () => {
    vi.stubEnv("VITE_VIDEO_PUBLIC_BASE_URL", "")
    expect(getResolvedVideoSource("/content/videos-default/pinata.mp4")).toBe(
      "/content/videos-default/pinata.mp4"
    )
    expect(isDirectVideoFileSource("/content/videos-default/pinata.mp4")).toBe(true)
  })

  it("maps local video references to a configured public media origin first", () => {
    vi.stubEnv("VITE_VIDEO_PUBLIC_BASE_URL", "https://pub-media-example.r2.dev")

    const r2PinataUrl = "https://pub-media-example.r2.dev/content/videos-default/pinata.mp4"

    expect(getVideoPublicOrigin()).toBe("https://pub-media-example.r2.dev")
    expect(getResolvedVideoSource("/content/videos-default/pinata.mp4")).toBe(r2PinataUrl)
    expect(isDirectVideoFileSource(r2PinataUrl)).toBe(true)
  })

  it("normalizes legacy local video paths before mapping", () => {
    vi.stubEnv("VITE_VIDEO_PUBLIC_BASE_URL", "https://pub-media-example.r2.dev")
    expect(getResolvedVideoSource("/content/videos/pinata.mp4")).toBe(
      "https://pub-media-example.r2.dev/content/videos-default/pinata.mp4"
    )
  })

  it("derives a stable aspect ratio from known poster dimensions", () => {
    expect(getKnownVideoAspectRatio("/content/videos-default/captain-america.mp4")).toBe("720 / 400")
    expect(getKnownVideoAspectRatio("/content/videos-default/pinata.mp4")).toBe("480 / 854")
    expect(getKnownVideoAspectRatio("/content/files/photo.jpg")).toBeUndefined()
  })
})
