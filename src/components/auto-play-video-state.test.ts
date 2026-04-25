import { describe, expect, it } from "vitest"
import {
  buildVideoAspectRatio,
  deriveVideoViewportState,
  getVideoPlaybackDecision,
  getVideoPlaybackPriority,
  shouldAttachVideoSource,
  shouldEarlyLoadNearViewport,
  shouldEnsureViewportData,
  shouldForceAutoPreload,
  shouldPromotePlaybackHandoff,
} from "./auto-play-video-state"

describe("auto-play video state", () => {
  it("allows the next video to become visibly active without a handoff dead zone", () => {
    const belowStartThreshold = deriveVideoViewportState({
      rootBottom: 800,
      rootTop: 0,
      targetBottom: 900,
      targetTop: 747,
      wasVisible: false,
    })
    expect(belowStartThreshold).toMatchObject({
      centerOffset: 423.5,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: false,
    })
    expect(belowStartThreshold.visibleFraction).toBeCloseTo(53 / 153)

    const aboveStartThreshold = deriveVideoViewportState({
      rootBottom: 800,
      rootTop: 0,
      targetBottom: 900,
      targetTop: 746,
      wasVisible: false,
    })
    expect(aboveStartThreshold).toMatchObject({
      centerOffset: 423,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: true,
    })
    expect(aboveStartThreshold.visibleFraction).toBeCloseTo(54 / 154)

    const aboveStopThreshold = deriveVideoViewportState({
      rootBottom: 800,
      rootTop: 0,
      targetBottom: 900,
      targetTop: 744,
      wasVisible: true,
    })
    expect(aboveStopThreshold).toMatchObject({
      centerOffset: 422,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: true,
    })
    expect(aboveStopThreshold.visibleFraction).toBeCloseTo(56 / 156)

    const belowStopThreshold = deriveVideoViewportState({
      rootBottom: 800,
      rootTop: 0,
      targetBottom: 900,
      targetTop: 760,
      wasVisible: true,
    })
    expect(belowStopThreshold).toMatchObject({
      centerOffset: 430,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: false,
    })
    expect(belowStopThreshold.visibleFraction).toBeCloseTo(40 / 140)
  })

  it("treats tall videos as visibly active when most of the viewport-capable area is covered", () => {
    const tallVideoState = deriveVideoViewportState({
      rootBottom: 800,
      rootTop: 0,
      targetBottom: 1_000,
      targetTop: -200,
      wasVisible: false,
    })

    expect(tallVideoState).toMatchObject({
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: true,
    })
    expect(tallVideoState.visibleFraction).toBe(1)
  })

  it("pauses or resets offscreen media and only plays active visible videos", () => {
    expect(
      getVideoPlaybackDecision({
        currentTime: 6,
        distanceToViewport: 0,
        isActive: false,
        isInViewport: true,
        isPlaybackOwner: false,
        isPaused: false,
        isVisible: true,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: true,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 4,
        distanceToViewport: 280,
        isActive: true,
        isInViewport: false,
        isPlaybackOwner: false,
        isPaused: true,
        isVisible: false,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: true,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 0,
        distanceToViewport: 0,
        isActive: true,
        isInViewport: true,
        isPlaybackOwner: false,
        isPaused: true,
        isVisible: false,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: false,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 0,
        distanceToViewport: 0,
        isActive: true,
        isInViewport: true,
        isPlaybackOwner: false,
        isPaused: false,
        isVisible: true,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: false,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 0,
        distanceToViewport: 0,
        isActive: true,
        isInViewport: true,
        isPlaybackOwner: true,
        isPaused: true,
        isVisible: true,
      })
    ).toEqual({
      shouldPause: false,
      shouldPlay: true,
      shouldReset: false,
    })
  })

  it("decides when viewport data and preload escalation are allowed", () => {
    expect(
      shouldEnsureViewportData({
        hasEnsuredViewportData: false,
        isInViewport: true,
        isPaused: true,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldEnsureViewportData({
        hasEnsuredViewportData: true,
        isInViewport: true,
        isPaused: true,
        readyState: 0,
      })
    ).toBe(false)

    expect(
      shouldForceAutoPreload({
        canUseAutoPreload: true,
        hasForcedPreload: false,
        isInViewport: false,
        isVisible: false,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldForceAutoPreload({
        canUseAutoPreload: true,
        hasForcedPreload: false,
        isInViewport: true,
        isVisible: true,
        readyState: 0,
      })
    ).toBe(false)

    expect(
      shouldAttachVideoSource({
        canUseAutoPreload: false,
        hasAttachedSource: false,
        isInViewport: false,
        isNearViewport: false,
        isVisible: false,
      })
    ).toBe(false)

    expect(
      shouldAttachVideoSource({
        canUseAutoPreload: true,
        hasAttachedSource: false,
        isInViewport: false,
        isNearViewport: false,
        isVisible: false,
      })
    ).toBe(true)

    expect(
      shouldAttachVideoSource({
        canUseAutoPreload: false,
        hasAttachedSource: false,
        isInViewport: false,
        isNearViewport: true,
        isVisible: false,
      })
    ).toBe(true)

    expect(
      shouldAttachVideoSource({
        canUseAutoPreload: false,
        hasAttachedSource: true,
        isInViewport: false,
        isNearViewport: false,
        isVisible: false,
      })
    ).toBe(true)

    expect(
      shouldEarlyLoadNearViewport({
        distanceToViewport: 240,
        hasLoadedFrame: false,
        isActive: true,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldEarlyLoadNearViewport({
        distanceToViewport: 5_000,
        hasLoadedFrame: false,
        isActive: true,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldEarlyLoadNearViewport({
        distanceToViewport: 5_400,
        hasLoadedFrame: false,
        isActive: true,
        readyState: 0,
      })
    ).toBe(false)
  })

  it("promotes the next partially visible video in the current scroll direction", () => {
    expect(
      shouldPromotePlaybackHandoff({
        isInViewport: true,
        rootBottom: 800,
        rootTop: 0,
        scrollDirection: "down",
        targetBottom: 920,
        targetTop: 620,
        visibleFraction: 0.18,
      })
    ).toBe(true)

    expect(
      shouldPromotePlaybackHandoff({
        isInViewport: true,
        rootBottom: 800,
        rootTop: 0,
        scrollDirection: "down",
        targetBottom: 920,
        targetTop: 620,
        visibleFraction: 0.1,
      })
    ).toBe(false)

    expect(
      shouldPromotePlaybackHandoff({
        isInViewport: true,
        rootBottom: 800,
        rootTop: 0,
        scrollDirection: "up",
        targetBottom: 180,
        targetTop: -120,
        visibleFraction: 0.18,
      })
    ).toBe(true)

    expect(
      shouldPromotePlaybackHandoff({
        isInViewport: true,
        rootBottom: 800,
        rootTop: 0,
        scrollDirection: "down",
        targetBottom: 180,
        targetTop: -120,
        visibleFraction: 0.4,
      })
    ).toBe(false)

    expect(
      shouldPromotePlaybackHandoff({
        isInViewport: true,
        rootBottom: 800,
        rootTop: 0,
        scrollDirection: "up",
        targetBottom: 920,
        targetTop: 620,
        visibleFraction: 0.4,
      })
    ).toBe(false)
  })

  it("prioritizes a forward handoff candidate once it reaches the normal play threshold", () => {
    expect(
      getVideoPlaybackPriority({
        centerOffset: 620,
        isForwardHandoffCandidate: true,
        visibleFraction: 0.4,
      })
    ).toBe(-1)

    expect(
      getVideoPlaybackPriority({
        centerOffset: 620,
        isForwardHandoffCandidate: true,
        visibleFraction: 0.2,
      })
    ).toBe(620)

    expect(
      getVideoPlaybackPriority({
        centerOffset: 120,
        isForwardHandoffCandidate: false,
        visibleFraction: 0.7,
      })
    ).toBe(120)
  })

  it("builds aspect ratios only from valid intrinsic sizes", () => {
    expect(
      buildVideoAspectRatio({
        videoHeight: 960,
        videoWidth: 540,
      })
    ).toBe("540 / 960")

    expect(
      buildVideoAspectRatio({
        videoHeight: 0,
        videoWidth: 540,
      })
    ).toBeNull()
  })
})
