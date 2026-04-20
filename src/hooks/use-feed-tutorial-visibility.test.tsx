import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getSessionStorage,
  writeTutorialState,
} from "../context/study-session-storage"
import type { FeedPayload } from "../types/social"
import { useFeedTutorialVisibility } from "./use-feed-tutorial-visibility"

const READY_PAYLOAD = {
  posts: [],
  theme: "light",
} satisfies FeedPayload

function seedTutorialState(
  sessionId: string,
  { completed = false, currentStep = 0 }: { completed?: boolean; currentStep?: number } = {}
) {
  const storage = getSessionStorage()
  if (!storage) {
    throw new Error("sessionStorage is required for tutorial visibility tests")
  }

  storage.setItem("ineedsocial:study:active-session", sessionId)
  writeTutorialState(storage, sessionId, {
    completed,
    currentStep,
  })
}

describe("useFeedTutorialVisibility", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("blocks immediately for an unfinished tutorial even before the payload is ready", () => {
    seedTutorialState("study_unfinished")

    const { result } = renderHook(() =>
      useFeedTutorialVisibility({
        feedError: null,
        payload: null,
        sessionId: "study_unfinished",
      })
    )

    expect(result.current.isTutorialBlocking).toBe(true)
    expect(result.current.showTutorialDelayBlocker).toBe(true)
    expect(result.current.showTutorial).toBe(false)
  })

  it("keeps the delay blocker visible before showing the tutorial card after 350ms", () => {
    seedTutorialState("study_ready")

    const { result } = renderHook(() =>
      useFeedTutorialVisibility({
        feedError: null,
        payload: READY_PAYLOAD,
        sessionId: "study_ready",
      })
    )

    expect(result.current.isTutorialBlocking).toBe(true)
    expect(result.current.showTutorialDelayBlocker).toBe(true)
    expect(result.current.showTutorial).toBe(false)

    act(() => {
      vi.advanceTimersByTime(349)
    })
    expect(result.current.showTutorialDelayBlocker).toBe(true)
    expect(result.current.showTutorial).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.showTutorialDelayBlocker).toBe(false)
    expect(result.current.showTutorial).toBe(true)
  })

  it("drops all tutorial UI when the feed enters an error state", () => {
    seedTutorialState("study_error")

    const { result, rerender } = renderHook(
      ({ feedError }) =>
        useFeedTutorialVisibility({
          feedError,
          payload: READY_PAYLOAD,
          sessionId: "study_error",
        }),
      {
        initialProps: {
          feedError: null as string | null,
        },
      }
    )

    act(() => {
      vi.advanceTimersByTime(200)
    })
    rerender({ feedError: "Format feed tidak valid." })

    expect(result.current.isTutorialBlocking).toBe(false)
    expect(result.current.showTutorialDelayBlocker).toBe(false)
    expect(result.current.showTutorial).toBe(false)
  })

  it("restarts the 350ms delay after an error clears and the feed becomes ready again", () => {
    seedTutorialState("study_retry")

    const { result, rerender } = renderHook(
      ({ feedError, payload }) =>
        useFeedTutorialVisibility({
          feedError,
          payload,
          sessionId: "study_retry",
        }),
      {
        initialProps: {
          feedError: "Format feed tidak valid." as string | null,
          payload: null as FeedPayload | null,
        },
      }
    )

    expect(result.current.isTutorialBlocking).toBe(false)
    expect(result.current.showTutorialDelayBlocker).toBe(false)
    expect(result.current.showTutorial).toBe(false)

    rerender({
      feedError: null,
      payload: READY_PAYLOAD,
    })

    expect(result.current.isTutorialBlocking).toBe(true)
    expect(result.current.showTutorialDelayBlocker).toBe(true)
    expect(result.current.showTutorial).toBe(false)

    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(result.current.showTutorial).toBe(true)
    expect(result.current.showTutorialDelayBlocker).toBe(false)
  })

  it("does not show tutorial UI for a completed tutorial state", () => {
    seedTutorialState("study_completed", { completed: true })

    const { result } = renderHook(() =>
      useFeedTutorialVisibility({
        feedError: null,
        payload: READY_PAYLOAD,
        sessionId: "study_completed",
      })
    )

    expect(result.current.isTutorialBlocking).toBe(false)
    expect(result.current.showTutorialDelayBlocker).toBe(false)
    expect(result.current.showTutorial).toBe(false)
  })

  it("clears a pending delay when the active session changes", () => {
    seedTutorialState("study_a")
    seedTutorialState("study_b")

    const { result, rerender } = renderHook(
      ({ sessionId }) =>
        useFeedTutorialVisibility({
          feedError: null,
          payload: READY_PAYLOAD,
          sessionId,
        }),
      {
        initialProps: {
          sessionId: "study_a" as string | null,
        },
      }
    )

    act(() => {
      vi.advanceTimersByTime(200)
    })

    rerender({
      sessionId: "study_b",
    })

    expect(result.current.isTutorialBlocking).toBe(true)
    expect(result.current.showTutorialDelayBlocker).toBe(true)
    expect(result.current.showTutorial).toBe(false)

    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(result.current.showTutorial).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.showTutorial).toBe(false)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.showTutorial).toBe(true)
    expect(result.current.showTutorialDelayBlocker).toBe(false)
  })
})
