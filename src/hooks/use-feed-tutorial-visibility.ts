import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getSessionStorage,
  readTutorialState,
} from "../context/study-session-storage"
import type { FeedPayload } from "../types/social"

type UseFeedTutorialVisibilityArgs = {
  feedError: string | null
  payload: FeedPayload | null
  sessionId: string | null
}

export function useFeedTutorialVisibility({
  feedError,
  payload,
  sessionId,
}: UseFeedTutorialVisibilityArgs) {
  const [showTutorial, setShowTutorial] = useState(false)
  const tutorialDelayTimeoutRef = useRef<number | null>(null)
  const tutorialState =
    sessionId
      ? readTutorialState(getSessionStorage(), sessionId)
      : null
  const isTutorialCompleted = tutorialState?.completed ?? true
  const hasPayload = Boolean(payload)
  const hasFeedError = Boolean(feedError)
  const shouldBlockForTutorial = Boolean(sessionId) && !isTutorialCompleted && !feedError
  const canShowTutorial = hasPayload && shouldBlockForTutorial
  const isTutorialBlocking = shouldBlockForTutorial
  const showTutorialDelayBlocker = shouldBlockForTutorial && !showTutorial
  const tutorialVisibilityKey = useMemo(
    () =>
      JSON.stringify({
        completed: isTutorialCompleted,
        hasFeedError,
        hasPayload,
        sessionId,
      }),
    [hasFeedError, hasPayload, isTutorialCompleted, sessionId]
  )

  useEffect(() => {
    if (tutorialDelayTimeoutRef.current !== null) {
      window.clearTimeout(tutorialDelayTimeoutRef.current)
      tutorialDelayTimeoutRef.current = null
    }

    setShowTutorial(false)
  }, [tutorialVisibilityKey])

  useEffect(() => {
    if (!canShowTutorial) {
      setShowTutorial(false)
      return
    }

    tutorialDelayTimeoutRef.current = window.setTimeout(() => {
      tutorialDelayTimeoutRef.current = null
      setShowTutorial(true)
    }, 350)

    return () => {
      if (tutorialDelayTimeoutRef.current !== null) {
        window.clearTimeout(tutorialDelayTimeoutRef.current)
        tutorialDelayTimeoutRef.current = null
      }
    }
  }, [canShowTutorial, tutorialVisibilityKey])

  return {
    hideTutorial: useCallback(() => setShowTutorial(false), []),
    isTutorialBlocking,
    showTutorial,
    showTutorialDelayBlocker,
  }
}
