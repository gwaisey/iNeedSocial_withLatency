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
    vi.unstubAllGlobals()
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

  it("maps compact video variants to the primary public media origin on coarse-pointer devices", () => {
    vi.stubEnv("VITE_VIDEO_PUBLIC_BASE_URL", "https://pub-media-example.r2.dev")
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === "(pointer: coarse)",
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }))

    expect(getResolvedVideoSource("/content/videos-default/pulu2.mp4")).toBe(
      "https://pub-media-example.r2.dev/content/videos/pulu2.mp4"
    )
  })

  it("can map compact video variants to a configured compact media origin", () => {
    vi.stubEnv("VITE_VIDEO_PUBLIC_BASE_URL", "https://pub-media-example.r2.dev")
    vi.stubEnv("VITE_VIDEO_COMPACT_PUBLIC_BASE_URL", "https://compact-media-example.r2.dev")
    vi.stubGlobal("navigator", {
      connection: {
        downlink: 1.4,
        effectiveType: "3g",
        saveData: false,
      },
    })

    expect(getResolvedVideoSource("/content/videos-default/pulu2.mp4")).toBe(
      "https://compact-media-example.r2.dev/content/videos/pulu2.mp4"
    )
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
