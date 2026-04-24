import { describe, expect, it, vi } from "vitest"
import {
  registerVideoPlaybackCandidate,
  resetVideoPlaybackCoordinatorForTests,
  unregisterVideoPlaybackCandidate,
  updateVideoPlaybackCandidate,
} from "./video-playback-coordinator"

describe("video playback coordinator", () => {
  it("grants playback to only the closest eligible video", () => {
    resetVideoPlaybackCoordinatorForTests()

    const ownerA = vi.fn()
    const ownerB = vi.fn()
    const ownerC = vi.fn()

    registerVideoPlaybackCandidate("video-a", ownerA)
    registerVideoPlaybackCandidate("video-b", ownerB)
    registerVideoPlaybackCandidate("video-c", ownerC)

    updateVideoPlaybackCandidate("video-a", {
      priority: 240,
      shouldOwnPlayback: true,
      visibilityScore: 0.62,
    })
    updateVideoPlaybackCandidate("video-b", {
      priority: 120,
      shouldOwnPlayback: true,
      visibilityScore: 0.62,
    })
    updateVideoPlaybackCandidate("video-c", {
      priority: 420,
      shouldOwnPlayback: true,
      visibilityScore: 0.62,
    })

    expect(ownerA).toHaveBeenLastCalledWith(false)
    expect(ownerB).toHaveBeenLastCalledWith(true)
    expect(ownerC).toHaveBeenLastCalledWith(false)

    unregisterVideoPlaybackCandidate("video-b")

    expect(ownerA).toHaveBeenLastCalledWith(true)
    expect(ownerC).toHaveBeenLastCalledWith(false)
  })

  it("ignores candidates that are not allowed to own playback", () => {
    resetVideoPlaybackCoordinatorForTests()

    const ownerA = vi.fn()
    const ownerB = vi.fn()

    registerVideoPlaybackCandidate("video-a", ownerA)
    registerVideoPlaybackCandidate("video-b", ownerB)

    updateVideoPlaybackCandidate("video-a", {
      priority: 20,
      shouldOwnPlayback: false,
      visibilityScore: 0.8,
    })
    updateVideoPlaybackCandidate("video-b", {
      priority: 60,
      shouldOwnPlayback: true,
      visibilityScore: 0.75,
    })

    expect(ownerA).toHaveBeenLastCalledWith(false)
    expect(ownerB).toHaveBeenLastCalledWith(true)
  })

  it("prefers the most centered eligible video before the most visible one", () => {
    resetVideoPlaybackCoordinatorForTests()

    const ownerA = vi.fn()
    const ownerB = vi.fn()

    registerVideoPlaybackCandidate("video-a", ownerA)
    registerVideoPlaybackCandidate("video-b", ownerB)

    updateVideoPlaybackCandidate("video-a", {
      priority: 30,
      shouldOwnPlayback: true,
      visibilityScore: 0.45,
    })
    updateVideoPlaybackCandidate("video-b", {
      priority: 160,
      shouldOwnPlayback: true,
      visibilityScore: 0.82,
    })

    expect(ownerA).toHaveBeenLastCalledWith(true)
    expect(ownerB).toHaveBeenLastCalledWith(false)
  })
})
