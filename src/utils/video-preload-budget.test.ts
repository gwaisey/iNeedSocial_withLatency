import { describe, expect, it, vi } from "vitest"
import {
  registerVideoPreloadCandidate,
  resetVideoPreloadBudgetForTests,
  unregisterVideoPreloadCandidate,
  updateVideoPreloadCandidate,
} from "./video-preload-budget"

describe("video preload budget", () => {
  it("preloads only the nearest forward videos and excludes above-viewport candidates while forward videos exist", () => {
    resetVideoPreloadBudgetForTests()

    const notifications = new Map<string, number | null>()

    const connectCandidate = (candidateId: string) => {
      registerVideoPreloadCandidate(candidateId, (preloadRank) => {
        notifications.set(candidateId, preloadRank)
      })
    }

    connectCandidate("video-a")
    connectCandidate("video-b")
    connectCandidate("video-c")
    connectCandidate("video-d")
    connectCandidate("video-e")
    connectCandidate("video-f")

    updateVideoPreloadCandidate("video-a", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("video-b", {
      canPrewarm: true,
      distancePx: 320,
      direction: "below",
    })
    updateVideoPreloadCandidate("video-c", {
      canPrewarm: true,
      distancePx: 24,
      direction: "above",
    })
    updateVideoPreloadCandidate("video-d", {
      canPrewarm: true,
      distancePx: 960,
      direction: "below",
    })
    updateVideoPreloadCandidate("video-e", {
      canPrewarm: true,
      distancePx: 1_280,
      direction: "below",
    })
    updateVideoPreloadCandidate("video-f", {
      canPrewarm: true,
      distancePx: 1_640,
      direction: "below",
    })

    expect(notifications.get("video-a")).toBeNull()
    expect(notifications.get("video-b")).toBe(0)
    expect(notifications.get("video-c")).toBeNull()
    expect(notifications.get("video-d")).toBe(1)
    expect(notifications.get("video-e")).toBe(2)
    expect(notifications.get("video-f")).toBe(3)

    unregisterVideoPreloadCandidate("video-a")

    expect(notifications.get("video-b")).toBe(0)
    expect(notifications.get("video-c")).toBeNull()
    expect(notifications.get("video-d")).toBe(1)
    expect(notifications.get("video-e")).toBe(2)
    expect(notifications.get("video-f")).toBe(3)
  })

  it("does not count visible candidates toward the forward preload budget", () => {
    resetVideoPreloadBudgetForTests()

    const notifications = new Map<string, number | null>()

    const connectCandidate = (candidateId: string) => {
      registerVideoPreloadCandidate(candidateId, (preloadRank) => {
        notifications.set(candidateId, preloadRank)
      })
    }

    connectCandidate("visible-a")
    connectCandidate("visible-b")
    connectCandidate("visible-c")
    connectCandidate("visible-d")
    connectCandidate("up-next-a")
    connectCandidate("up-next-b")
    connectCandidate("up-next-c")
    connectCandidate("up-next-d")
    connectCandidate("above-nearby")

    updateVideoPreloadCandidate("visible-a", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("visible-b", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("visible-c", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("visible-d", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("up-next-a", {
      canPrewarm: true,
      distancePx: 3_000,
      direction: "below",
    })
    updateVideoPreloadCandidate("up-next-b", {
      canPrewarm: true,
      distancePx: 4_400,
      direction: "below",
    })
    updateVideoPreloadCandidate("up-next-c", {
      canPrewarm: true,
      distancePx: 5_800,
      direction: "below",
    })
    updateVideoPreloadCandidate("up-next-d", {
      canPrewarm: true,
      distancePx: 7_400,
      direction: "below",
    })
    updateVideoPreloadCandidate("above-nearby", {
      canPrewarm: true,
      distancePx: 40,
      direction: "above",
    })

    expect(notifications.get("visible-a")).toBeNull()
    expect(notifications.get("visible-b")).toBeNull()
    expect(notifications.get("visible-c")).toBeNull()
    expect(notifications.get("visible-d")).toBeNull()
    expect(notifications.get("up-next-a")).toBe(0)
    expect(notifications.get("up-next-b")).toBe(1)
    expect(notifications.get("up-next-c")).toBe(2)
    expect(notifications.get("up-next-d")).toBe(3)
    expect(notifications.get("above-nearby")).toBeNull()
  })

  it("still allows above-viewport preloads when there are no forward candidates", () => {
    resetVideoPreloadBudgetForTests()

    const notifications = new Map<string, number | null>()

    const connectCandidate = (candidateId: string) => {
      registerVideoPreloadCandidate(candidateId, (preloadRank) => {
        notifications.set(candidateId, preloadRank)
      })
    }

    connectCandidate("visible")
    connectCandidate("above-nearby")
    connectCandidate("above-secondary")

    updateVideoPreloadCandidate("visible", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("above-nearby", {
      canPrewarm: true,
      distancePx: 40,
      direction: "above",
    })
    updateVideoPreloadCandidate("above-secondary", {
      canPrewarm: true,
      distancePx: 400,
      direction: "above",
    })

    expect(notifications.get("visible")).toBeNull()
    expect(notifications.get("above-nearby")).toBe(0)
    expect(notifications.get("above-secondary")).toBe(1)
  })

  it("excludes faraway or disabled candidates from the auto preload pool", () => {
    resetVideoPreloadBudgetForTests()

    const notifyNear = vi.fn()
    const notifyFar = vi.fn()

    registerVideoPreloadCandidate("near", notifyNear)
    registerVideoPreloadCandidate("far", notifyFar)

    updateVideoPreloadCandidate("near", {
      canPrewarm: true,
      distancePx: 200,
      direction: "below",
    })
    updateVideoPreloadCandidate("far", {
      canPrewarm: true,
      distancePx: 12_600,
      direction: "below",
    })

    expect(notifyNear).toHaveBeenLastCalledWith(0)
    expect(notifyFar).toHaveBeenLastCalledWith(null)

    updateVideoPreloadCandidate("near", {
      canPrewarm: false,
      distancePx: 0,
      direction: "below",
    })

    expect(notifyNear).toHaveBeenLastCalledWith(null)
  })
})
