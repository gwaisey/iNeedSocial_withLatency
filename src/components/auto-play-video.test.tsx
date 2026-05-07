import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AutoPlayVideo } from "./auto-play-video"
import { VIDEO_FOCUSED_PLAYBACK_RESCUE_DELAY_MS } from "./auto-play-video-config"
import { resetVideoWarmupState } from "./auto-play-video-warmup"
import { resetVideoPlaybackCoordinatorForTests } from "./video-playback-coordinator"
import { resetVideoPreloadBudgetForTests } from "../utils/video-preload-budget"
const intersectionObserverInstances: IntersectionObserver[] = []

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly thresholds: ReadonlyArray<number>

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? "0px"
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0]
    intersectionObserverInstances.push(this)
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

    intersectionObserverInstances.length = 0
    window.IntersectionObserver = MockIntersectionObserver
    vi.stubEnv("VITE_VIDEO_PUBLIC_BASE_URL", "https://pub-media-example.r2.dev")
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })

  afterEach(() => {
    cleanup()
    resetVideoPlaybackCoordinatorForTests()
    resetVideoPreloadBudgetForTests()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    window.IntersectionObserver = originalIntersectionObserver
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    HTMLMediaElement.prototype.load = originalLoad
    resetVideoWarmupState()

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

    vi.unstubAllGlobals()
  })

  it("does not render a video element when src is missing", () => {
    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} poster="/poster.jpg" />
    )

    expect(container.querySelector("video")).toBeNull()
  })

  it("uses a static fallback layer without shimmer animation when poster is missing", async () => {
    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/external/video.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const fallbackLayer = container.querySelector("div.absolute.inset-0")
    expect(fallbackLayer).not.toBeNull()
    expect(fallbackLayer?.className).not.toContain("skeleton")
  })

  it("uses the controlled poster layer instead of the native video poster", async () => {
    const { container } = render(
      <AutoPlayVideo
        className="video"
        isMuted={true}
        poster="/poster.jpg"
        src="/content/videos-default/pinata.mp4"
      />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    expect(container.querySelector('img[aria-hidden="true"]')).not.toBeNull()
    expect(container.querySelector("video")).not.toHaveAttribute("poster")
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
        src="/content/videos-default/pinata.mp4"
      />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const video = container.querySelector("video")
    expect(video?.getAttribute("src")).toBeNull()
    expect(video).toHaveAttribute("preload", "none")
  })

  it("mounts and loads a near video from scroll geometry even when prewarm observation is late", async () => {
    class NonIntersectingIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null
      readonly rootMargin: string
      readonly thresholds: ReadonlyArray<number>

      constructor(
        private readonly callback: IntersectionObserverCallback,
        options: IntersectionObserverInit = {}
      ) {
        this.root = options.root ?? null
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
              intersectionRatio: 0,
              intersectionRect: target.getBoundingClientRect(),
              isIntersecting: false,
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

    window.IntersectionObserver = NonIntersectingIntersectionObserver

    let rect = {
      bottom: 20_600,
      height: 600,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 20_000,
      width: 360,
      x: 0,
      y: 20_000,
    } as DOMRect
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rect)

    const { container } = render(
      <AutoPlayVideo
        canPrewarm={true}
        className="video"
        isMuted={true}
        poster="/poster.jpg"
        src="/content/videos-default/pinata.mp4"
      />
    )

    expect(container.querySelector("video")).not.toBeNull()
    expect(container.querySelector("video")?.getAttribute("src")).toBeNull()

    rect = {
      bottom: 5_600,
      height: 600,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 5_000,
      width: 360,
      x: 0,
      y: 5_000,
    } as DOMRect

    document.dispatchEvent(new Event("scroll"))

    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(
        "https://pub-media-example.r2.dev/content/videos-default/pinata.mp4"
      )
    })
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
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
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
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
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
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
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
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/captain-america.mp4" />
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

  it("uses the feed scroll root for early prewarm observation", async () => {
    const scrollRoot = document.createElement("div")
    const scrollRootRef = { current: scrollRoot }

    render(
      <AutoPlayVideo
        className="video"
        isMuted={true}
        scrollRootRef={scrollRootRef}
        src="/content/videos-default/pinata.mp4"
      />
    )

    await waitFor(() => {
      expect(
        intersectionObserverInstances.some(
          (observer) =>
            observer.root === scrollRoot && observer.rootMargin === "14000px 0px"
        )
      ).toBe(true)
    })
  })

  it("ignores interrupted autoplay promises without leaking an unhandled rejection", async () => {
    const autoplayError = new Error("The play() request was interrupted by a call to pause().")
    autoplayError.name = "AbortError"
    HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(autoplayError)
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
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
    )

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it("retries a focused visible video once when playback has not progressed", async () => {
    vi.useFakeTimers()
    const playSpy = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.play = playSpy
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

    render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(playSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(VIDEO_FOCUSED_PLAYBACK_RESCUE_DELAY_MS)
      await Promise.resolve()
    })

    expect(playSpy).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(VIDEO_FOCUSED_PLAYBACK_RESCUE_DELAY_MS * 2)
      await Promise.resolve()
    })

    expect(playSpy).toHaveBeenCalledTimes(2)
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
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
    )

    expect(
      document.head.querySelector('link[rel="preconnect"][data-direct-video-warmup="true"]')
    ).not.toBeNull()

    expect(document.head.querySelector('link[rel="preload"][as="video"]')).toBeNull()

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const r2PinataUrl = "https://pub-media-example.r2.dev/content/videos-default/pinata.mp4"

    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(r2PinataUrl)
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("range-warms compact R2 video bytes on coarse-pointer devices", async () => {
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

    const fetchSpy = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
      ok: true,
    } as unknown as Response)
    globalThis.fetch = fetchSpy as typeof fetch

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
    )

    const compactPinataUrl = "https://pub-media-example.r2.dev/content/videos/pinata.mp4"

    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(compactPinataUrl)
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        compactPinataUrl,
        expect.objectContaining({
          cache: "force-cache",
          credentials: "omit",
          headers: {
            Range: "bytes=0-393215",
          },
          mode: "cors",
        })
      )
    })
  })

  it("keeps nearby offscreen sources attached and unloads them after they are far away", async () => {
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
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos-default/pinata.mp4" />
    )

    const r2PinataUrl = "https://pub-media-example.r2.dev/content/videos-default/pinata.mp4"

    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(r2PinataUrl)
    })

    vi.useFakeTimers()

    rect = {
      bottom: -6_000,
      height: 600,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: -6_600,
      width: 480,
      x: 0,
      y: -6_600,
    } as DOMRect

    fireEvent.scroll(document)

    await act(async () => {
      flushAnimationFrames()
      await Promise.resolve()
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBe(r2PinataUrl)

    await act(async () => {
      vi.advanceTimersByTime(4_499)
      await Promise.resolve()
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBe(r2PinataUrl)

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBe(r2PinataUrl)

    rect = {
      bottom: -19_000,
      height: 600,
      left: 0,
      right: 480,
      toJSON: () => ({}),
      top: -19_600,
      width: 480,
      x: 0,
      y: -19_600,
    } as DOMRect

    fireEvent.scroll(document)

    await act(async () => {
      flushAnimationFrames()
      await Promise.resolve()
    })

    expect(container.querySelector("video")?.getAttribute("src")).toBeNull()

    vi.useRealTimers()
  })
})
