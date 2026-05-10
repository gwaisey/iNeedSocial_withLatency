import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { getSupabaseStatusMessage } from "../services/supabase"
import type { FeedSessionStatus } from "../context/study-session-storage"
import type { Post } from "../types/social"
import { createEmptyGenreCounts, createEmptyGenreTimes } from "../utils/feed-session"
import { useFeedSessionActions } from "./use-feed-session-actions"
import { useFeedSessionSnapshot } from "./use-feed-session-snapshot"
import { useFeedTiming } from "./use-feed-timing"

type ScrollContainerRef = RefObject<HTMLDivElement | null>
type HeaderRef = RefObject<HTMLDivElement | null>

type UseFeedSessionArgs = {
  appVersion: string
  headerRef: HeaderRef
  isPaused?: boolean
  posts: Post[] | null
  scrollRef: ScrollContainerRef
  studySessionId: string
}

type PersistSessionOptions = {
  commitActivePost?: boolean
  now?: number
  finalizedGenreTimes?: ReturnType<typeof useFeedTiming>["genreTimes"] | null
  finalReport?: ReturnType<typeof useFeedSessionSnapshot>["finalReport"]
  hasSubmitted?: boolean
  status?: FeedSessionStatus
  submissionHasError?: boolean
  submissionMessage?: string | null
}

export function useFeedSession({
  appVersion,
  headerRef,
  isPaused = false,
  posts,
  scrollRef,
  studySessionId,
}: UseFeedSessionArgs) {
  const [isDocumentHidden, setIsDocumentHidden] = useState(() =>
    typeof document === "undefined" ? false : document.visibilityState === "hidden"
  )
  const snapshot = useFeedSessionSnapshot({
    configMessage: getSupabaseStatusMessage(),
    studySessionId,
  })

  const timing = useFeedTiming({
    headerRef,
    initialGenreCounts: snapshot.restoredSnapshot?.genreCounts ?? createEmptyGenreCounts(),
    initialGenreTimes: snapshot.restoredSnapshot?.genreTimes ?? createEmptyGenreTimes(),
    initialSeenPostIds: new Set(snapshot.restoredSnapshot?.seenPostIds ?? []),
    isLocked: Boolean(snapshot.finalReport),
    isPaused: isPaused || isDocumentHidden,
    posts,
    scrollRef,
  })

  const persistSessionSnapshot = useCallback(
    (options: PersistSessionOptions = {}) => {
      const nextGenreTimes = options.commitActivePost
        ? timing.commitActivePostDuration(options.now)
        : timing.genreTimesRef.current

      return snapshot.persistSnapshot({
        finalizedGenreTimes: options.finalizedGenreTimes,
        finalReport: options.finalReport,
        genreCounts: timing.genreCountsRef.current,
        genreTimes: nextGenreTimes,
        hasSubmitted: options.hasSubmitted,
        seenPostIds: Array.from(timing.seenPostIdsRef.current),
        status: options.status,
        submissionHasError: options.submissionHasError,
        submissionMessage: options.submissionMessage,
      })
    },
    [snapshot, timing]
  )
  const persistOnUnmountRef = useRef(persistSessionSnapshot)
  const hasFlushedLifecycleSnapshotRef = useRef(false)

  useEffect(() => {
    persistOnUnmountRef.current = persistSessionSnapshot
  }, [persistSessionSnapshot])

  const persistLifecycleSnapshot = useCallback((options: { pauseActivePost?: boolean } = {}) => {
    if (hasFlushedLifecycleSnapshotRef.current) {
      return timing.genreTimesRef.current
    }

    hasFlushedLifecycleSnapshotRef.current = true
    if (options.pauseActivePost) {
      timing.pauseActivePostTracking(Date.now() + 1)
      persistSessionSnapshot()
      return timing.genreTimesRef.current
    }

    // Date.now() has millisecond resolution; bump by 1ms so lifecycle flushes never lose time
    // when a scroll/frame update and pagehide happen within the same clock tick.
    return persistSessionSnapshot({ commitActivePost: true, now: Date.now() + 1 })
  }, [persistSessionSnapshot, timing])

  useEffect(() => {
    persistSessionSnapshot()
  }, [
    persistSessionSnapshot,
    snapshot.finalReport,
    snapshot.finalizedGenreTimes,
    snapshot.submissionHasError,
    snapshot.submissionMessage,
    timing.genreTimes,
  ])

  useEffect(() => {
    const handlePageHide = () => {
      persistLifecycleSnapshot()
    }
    const handleBeforeUnload = () => {
      persistLifecycleSnapshot()
    }
    const handlePageShow = () => {
      hasFlushedLifecycleSnapshotRef.current = false
      setIsDocumentHidden(document.visibilityState === "hidden")
    }
    const handleVisibilityChange = () => {
      const nextIsHidden = document.visibilityState === "hidden"
      setIsDocumentHidden(nextIsHidden)

      if (nextIsHidden) {
        persistLifecycleSnapshot({ pauseActivePost: true })
        return
      }

      hasFlushedLifecycleSnapshotRef.current = false
    }

    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [persistLifecycleSnapshot])

  useEffect(() => {
    return () => {
      if (hasFlushedLifecycleSnapshotRef.current) {
        return
      }

      hasFlushedLifecycleSnapshotRef.current = true
      persistOnUnmountRef.current({ commitActivePost: true, now: Date.now() + 1 })
    }
  }, [])

  const actions = useFeedSessionActions({
    appVersion,
    finalReportRef: snapshot.finalReportRef,
    finalizeAttributedTiming: timing.finalizeAttributedTiming,
    finalizedGenreTimesRef: snapshot.finalizedGenreTimesRef,
    genreCountsRef: timing.genreCountsRef,
    genreTimesRef: timing.genreTimesRef,
    hasSubmittedRef: snapshot.hasSubmittedRef,
    sessionStatusRef: snapshot.sessionStatusRef,
    persistSessionSnapshot: (options) => snapshot.persistSnapshot({
      ...options,
      genreCounts: timing.genreCountsRef.current,
      seenPostIds: Array.from(timing.seenPostIdsRef.current),
    }),
    setFinalReport: snapshot.setFinalReport,
    setFinalizedGenreTimes: snapshot.setFinalizedGenreTimes,
    setSessionStatus: snapshot.setSessionStatus,
    setSubmissionHasError: snapshot.setSubmissionHasError,
    setSubmissionMessage: snapshot.setSubmissionMessage,
    studySessionId,
    submissionHasErrorRef: snapshot.submissionHasErrorRef,
    submissionMessageRef: snapshot.submissionMessageRef,
  })

  return {
    commitActivePostDuration: timing.commitActivePostDuration,
    discardSessionSnapshot: snapshot.discardSnapshot,
    endSession: actions.endSession,
    finalReport: snapshot.finalReport,
    finalizedGenreTimes: snapshot.finalizedGenreTimes,
    genreTimes: timing.genreTimes,
    isSavingSession: actions.isSavingSession,
    persistSessionSnapshot,
    scheduleActivePostEvaluation: timing.scheduleActivePostEvaluation,
    submissionHasError: snapshot.submissionHasError,
    submissionMessage: snapshot.submissionMessage,
  }
}
