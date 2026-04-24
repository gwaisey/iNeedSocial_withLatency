import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearBufferedRuntimeIssues,
  getBufferedRuntimeIssues,
  installGlobalRuntimeMonitoring,
  reportRuntimeIssue,
  RUNTIME_MONITORING_EVENT_NAME,
  resetRuntimeMonitoringForTests,
} from "./runtime-monitoring"

describe("runtime monitoring", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetRuntimeMonitoringForTests()
  })

  it("logs and dispatches a normalized runtime monitoring event", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const capturedEvents: Event[] = []

    window.addEventListener(RUNTIME_MONITORING_EVENT_NAME, (event) => {
      capturedEvents.push(event)
    }, { once: true })

    const detail = reportRuntimeIssue({
      error: new Error("video blocked"),
      level: "warn",
      message: "Unexpected video autoplay failure.",
      metadata: {
        src: "/video.mp4",
      },
      scope: "video-playback",
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[monitoring:video-playback] Unexpected video autoplay failure.",
      detail
    )
    expect(capturedEvents).toHaveLength(1)

    const event = capturedEvents[0]
    expect(event).toBeInstanceOf(CustomEvent)
    expect((event as CustomEvent<typeof detail>).detail).toMatchObject({
      error: {
        message: "video blocked",
        name: "Error",
      },
      level: "warn",
      message: "Unexpected video autoplay failure.",
      metadata: {
        src: "/video.mp4",
      },
      scope: "video-playback",
    })
  })

  it("buffers runtime issues in sessionStorage and clears them on request", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    reportRuntimeIssue({
      error: "first warning",
      level: "warn",
      message: "Buffered media warning.",
      metadata: {
        stage: "prewarm",
      },
      scope: "video-playback",
    })

    expect(getBufferedRuntimeIssues()).toHaveLength(1)
    expect(window.sessionStorage.getItem("ineedsocial:runtime-monitoring")).toContain(
      "Buffered media warning."
    )

    clearBufferedRuntimeIssues()

    expect(getBufferedRuntimeIssues()).toEqual([])
    expect(window.sessionStorage.getItem("ineedsocial:runtime-monitoring")).toBeNull()
  })

  it("captures unhandled window errors and promise rejections once installed", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    installGlobalRuntimeMonitoring()

    window.dispatchEvent(
      new ErrorEvent("error", {
        colno: 9,
        error: new Error("kaboom"),
        filename: "/feed.js",
        lineno: 42,
        message: "kaboom",
      })
    )

    const rejectionEvent = new Event("unhandledrejection")
    Object.defineProperty(rejectionEvent, "reason", {
      configurable: true,
      value: new Error("async kaboom"),
    })
    window.dispatchEvent(rejectionEvent)

    const bufferedEvents = getBufferedRuntimeIssues()
    expect(bufferedEvents).toHaveLength(2)
    expect(bufferedEvents[0]).toMatchObject({
      error: {
        message: "kaboom",
        name: "Error",
      },
      message: "Unhandled window error reached the runtime monitor.",
      metadata: {
        colno: 9,
        filename: "/feed.js",
        lineno: 42,
      },
      scope: "window-error",
    })
    expect(bufferedEvents[1]).toMatchObject({
      error: {
        message: "async kaboom",
        name: "Error",
      },
      message: "Unhandled promise rejection reached the runtime monitor.",
      metadata: {
        hasReason: true,
      },
      scope: "window-unhandled-rejection",
    })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })
})
