import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getCloudflareStreamDownloadUrl,
  getCloudflareStreamManifestUrl,
  getCloudflareStreamOrigin,
  getKnownVideoAspectRatio,
  getResolvedVideoSource,
  getVideoPosterSource,
} from "./auto-play-video-config"

describe("auto-play video config", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers explicit posters but can derive a static poster path from a video source", () => {
    expect(getVideoPosterSource("/content/videos/pinata.mp4", "/custom/poster.jpg")).toBe(
      "/custom/poster.jpg"
    )

    expect(getVideoPosterSource("/content/videos/pinata.mp4")).toBe(
      "/content/video-posters/pinata.jpg"
    )

    expect(getVideoPosterSource("/content/files/photo.jpg")).toBeUndefined()
  })

  it("resolves Cloudflare Stream playback urls when the customer code and stream uid exist", () => {
    vi.stubEnv("VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE", "mjiwvs3h8hhcy2t8")

    expect(getCloudflareStreamManifestUrl("dad0deb02906401e5950bfe6816fb4a4")).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/manifest/video.m3u8"
    )
    expect(getCloudflareStreamDownloadUrl("dad0deb02906401e5950bfe6816fb4a4")).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/downloads/default.mp4"
    )
    expect(getCloudflareStreamOrigin()).toBe("https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com")
    expect(
      getResolvedVideoSource(
        "/content/videos/pinata.mp4",
        "dad0deb02906401e5950bfe6816fb4a4",
        "mp4"
      )
    ).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/downloads/default.mp4"
    )
    expect(
      getResolvedVideoSource(
        "/content/videos/pinata.mp4",
        "dad0deb02906401e5950bfe6816fb4a4",
        "hls"
      )
    ).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/manifest/video.m3u8"
    )
    expect(
      getVideoPosterSource("/content/videos/pinata.mp4", undefined, "dad0deb02906401e5950bfe6816fb4a4")
    ).toBe(
      "/content/video-posters/pinata.jpg"
    )
    expect(getResolvedVideoSource("/content/videos/pinata.mp4")).toBe("/content/videos/pinata.mp4")
  })

  it("derives a stable aspect ratio from known poster dimensions", () => {
    expect(getKnownVideoAspectRatio("/content/videos/captain-america.mp4")).toBe("720 / 400")
    expect(getKnownVideoAspectRatio("/content/videos/pinata.mp4")).toBe("480 / 854")
    expect(getKnownVideoAspectRatio("/content/files/photo.jpg")).toBeUndefined()
  })
})
