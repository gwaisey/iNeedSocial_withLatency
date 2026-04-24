import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AutoPlayVideo } from "./auto-play-video"
import { resetCloudflareStreamWarmupState } from "./auto-play-video-stream-warmup"

const hlsAttachMediaSpy = vi.fn()
const hlsLoadSourceSpy = vi.fn()
const hlsDestroySpy = vi.fn()

vi.mock("hls.js", () => {
  class MockHls {
    static isSupported = vi.fn(() => true)

    attachMedia = hlsAttachMediaSpy
    destroy = hlsDestroySpy
    loadSource = hlsLoadSourceSpy
  }

  return {
    default: MockHls,
  }
})

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin: string
  readonly thresholds: ReadonlyArray<number>

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.rootMargin = options.rootMargin ?? "0px"
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0]
  }

  disconnect() {}

  observe(target: Element) {
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0,
        },
      ],
      this
    )
  }

  takeRecords() {
    return []
  }

  unobserve() {}
}

describe("AutoPlayVideo", () => {
  let originalIntersectionObserver: typeof window.IntersectionObserver
  let originalPlay: typeof HTMLMediaElement.prototype.play
  let originalPause: typeof HTMLMediaElement.prototype.pause
  let originalLoad: typeof HTMLMediaElement.prototype.load
  let originalRequestVideoFrameCallback: unknown
  let originalCancelVideoFrameCallback: unknown
  let originalFetch: typeof globalThis.fetch | undefined

  beforeEach(() => {
    originalIntersectionObserver = window.IntersectionObserver
    originalPlay = HTMLMediaElement.prototype.play
    originalPause = HTMLMediaElement.prototype.pause
    originalLoad = HTMLMediaElement.prototype.load
    originalRequestVideoFrameCallback = Reflect.get(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback"
    )
    originalCancelVideoFrameCallback = Reflect.get(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback"
    )
    originalFetch = globalThis.fetch

    window.IntersectionObserver = MockIntersectionObserver
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    window.IntersectionObserver = originalIntersectionObserver
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    HTMLMediaElement.prototype.load = originalLoad
    resetCloudflareStreamWarmupState()

    if (typeof originalRequestVideoFrameCallback === "undefined") {
      Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback")
    } else {
      Reflect.set(
        HTMLVideoElement.prototype,
        "requestVideoFrameCallback",
        originalRequestVideoFrameCallback
      )
    }

    if (typeof originalCancelVideoFrameCallback === "undefined") {
      Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback")
    } else {
      Reflect.set(
        HTMLVideoElement.prototype,
        "cancelVideoFrameCallback",
        originalCancelVideoFrameCallback
      )
    }

    if (typeof originalFetch === "undefined") {
      Reflect.deleteProperty(globalThis, "fetch")
    } else {
      globalThis.fetch = originalFetch
    }

    hlsAttachMediaSpy.mockReset()
    hlsDestroySpy.mockReset()
    hlsLoadSourceSpy.mockReset()
  })

  it("does not render a video element when src is missing", () => {
    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} poster="/poster.jpg" />
    )

    expect(container.querySelector("video")).toBeNull()
  })

  it("mounts the shell without attaching a real src while the video stays offscreen and out of the preload pool", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 20_600,
      height: 600,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 20_000,
      width: 360,
      x: 0,
      y: 20_000,
    } as DOMRect)

    const { container } = render(
      <AutoPlayVideo
        canPrewarm={true}
        className="video"
        isMuted={true}
        poster="/poster.jpg"
        src="/content/videos/pinata.mp4"
      />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const video = container.querySelector("video")
    expect(video?.getAttribute("src")).toBeNull()
    expect(video).toHaveAttribute("preload", "none")
  })

  it("waits for requestVideoFrameCallback before revealing the video when available", async () => {
    let frameCallback: (() => void) | null = null

    Reflect.set(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      vi.fn((callback: () => void) => {
        frameCallback = callback
        return 1
      })
    )
    Reflect.set(HTMLVideoElement.prototype, "cancelVideoFrameCallback", vi.fn())

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })
    const video = container.querySelector("video")

    video!.currentTime = 0.04
    fireEvent.loadedData(video!)
    expect(video).toHaveClass("opacity-0")
    expect(frameCallback).not.toBeNull()

    const queuedFrameCallback = frameCallback as (() => void) | null
    if (!queuedFrameCallback) {
      throw new Error("Expected requestVideoFrameCallback to be queued.")
    }

    queuedFrameCallback()

    await waitFor(() => {
      expect(video).toHaveClass("opacity-100")
    })
  })

  it("keeps the poster in place until requestVideoFrameCallback fires", async () => {
    let frameCallback: (() => void) | null = null

    Reflect.set(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      vi.fn((callback: () => void) => {
        frameCallback = callback
        return 1
      })
    )
    Reflect.set(HTMLVideoElement.prototype, "cancelVideoFrameCallback", vi.fn())

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    vi.useFakeTimers()
    const video = container.querySelector("video")
    video!.currentTime = 0.04
    fireEvent.loadedData(video!)

    act(() => {
      vi.advanceTimersByTime(899)
    })

    expect(video).toHaveClass("opacity-0")

    const queuedFrameCallback = frameCallback as (() => void) | null
    if (!queuedFrameCallback) {
      throw new Error("Expected requestVideoFrameCallback to be queued.")
    }

    act(() => {
      queuedFrameCallback()
    })

    expect(video).toHaveClass("opacity-100")
    vi.useRealTimers()
  })

  it("falls back to immediate readiness when requestVideoFrameCallback is unavailable", async () => {
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback")
    Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback")

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })
    const video = container.querySelector("video")

    video!.currentTime = 0.04
    fireEvent.loadedData(video!)

    await waitFor(() => {
      expect(video).toHaveClass("opacity-100")
    })
  })

  it("uses the poster-derived ratio immediately and keeps it stable after metadata loads", async () => {
    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/captain-america.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const video = container.querySelector("video") as HTMLVideoElement
    const shell = video.parentElement as HTMLDivElement

    expect(shell.style.aspectRatio).toBe("720 / 400")

    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: 432,
    })
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: 768,
    })

    fireEvent.loadedMetadata(video)

    expect(shell.style.aspectRatio).toBe("720 / 400")
  })

  it("uses hls.js for Cloudflare Stream manifests when native HLS is unavailable", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE", "mjiwvs3h8hhcy2t8")
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("")
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 854,
      height: 854,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: 0,
      width: 480,
      x: 0,
      y: 0,
    } as DOMRect)

    const { container } = render(
      <AutoPlayVideo
        className="video"
        isMuted={true}
        src="/content/videos/pinata.mp4"
        streamDelivery="hls"
        streamUid="dad0deb02906401e5950bfe6816fb4a4"
      />
    )

    await waitFor(() => {
      expect(hlsLoadSourceSpy).toHaveBeenCalledWith(
        "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/manifest/video.m3u8"
      )
    })

    expect(hlsAttachMediaSpy).toHaveBeenCalledWith(container.querySelector("video"))
  })

  it("warms Cloudflare Stream playback with preconnect links and a manifest fetch", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE", "mjiwvs3h8hhcy2t8")
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("")

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true } as Response)
    globalThis.fetch = fetchSpy as typeof fetch

    render(
      <AutoPlayVideo
        className="video"
        isMuted={true}
        src="/content/videos/pinata.mp4"
        streamDelivery="hls"
        streamUid="dad0deb02906401e5950bfe6816fb4a4"
      />
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/manifest/video.m3u8",
        {
          cache: "force-cache",
          credentials: "omit",
          mode: "cors",
        }
      )
    })

    expect(
      document.head.querySelector(
        'link[rel="dns-prefetch"][href="https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com"]'
      )
    ).not.toBeNull()
    expect(
      document.head.querySelector(
        'link[rel="preconnect"][href="https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com"]'
      )
    ).not.toBeNull()
  })

  it("preconnects and attaches the next direct MP4 candidate without duplicate preload fetches", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 2_236,
      height: 836,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 1_400,
      width: 360,
      x: 0,
      y: 1_400,
    } as DOMRect)

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true } as Response)
    globalThis.fetch = fetchSpy as typeof fetch

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    expect(
      document.head.querySelector('link[rel="preconnect"][data-direct-video-warmup="true"]')
    ).not.toBeNull()

    expect(document.head.querySelector('link[rel="preload"][as="video"]')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(
        "/content/videos/pinata.mp4"
      )
    })
  })

  it("keeps an offscreen source attached briefly before unloading it", async () => {
    HTMLMediaElement.prototype.play = vi.fn(() => new Promise<void>(() => {}))

    let rect = {
      bottom: 854,
      height: 854,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: 0,
      width: 480,
      x: 0,
      y: 0,
    } as DOMRect

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rect)
    const animationFrameCallbacks: FrameRequestCallback[] = []
    const flushAnimationFrames = () => {
      const callbacks = animationFrameCallbacks.splice(0)
      callbacks.forEach((callback) => callback(0))
    }

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback)
      return animationFrameCallbacks.length
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(
        "/content/videos/pinata.mp4"
      )
    })

    vi.useFakeTimers()

    rect = {
      bottom: -1_200,
      height: 600,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: -1_800,
      width: 480,
      x: 0,
      y: -1_800,
    } as DOMRect

    fireEvent.scroll(document)

    await act(async () => {
      flushAnimationFrames()
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "/content/videos/pinata.mp4"
    )

    act(() => {
      vi.advanceTimersByTime(4_499)
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "/content/videos/pinata.mp4"
    )

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBeNull()

    vi.useRealTimers()
  })
})
