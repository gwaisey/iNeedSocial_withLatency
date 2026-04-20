import { useCallback, useEffect, useRef, type RefObject } from "react"
import { getSupabaseStatusMessage } from "../services/supabase"
import type { FeedSessionStatus } from "../context/study-session-storage"
import type { Post } from "../types/social"
import { createEmptyGenreTimes } from "../utils/feed-session"
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
  const snapshot = useFeedSessionSnapshot({
    configMessage: getSupabaseStatusMessage(),
    studySessionId,
  })

  const timing = useFeedTiming({
    headerRef,
    initialGenreTimes: snapshot.restoredSnapshot?.genreTimes ?? createEmptyGenreTimes(),
    isLocked: Boolean(snapshot.finalReport),
    isPaused,
    posts,
    scrollRef,
  })

  const persistSessionSnapshot = useCallback(
    (options: PersistSessionOptions = {}) => {
      const nextGenreTimes = options.commitActivePost
        ? timing.commitActivePostDuration()
        : timing.genreTimesRef.current

      return snapshot.persistSnapshot({
        finalizedGenreTimes: options.finalizedGenreTimes,
        finalReport: options.finalReport,
        genreTimes: nextGenreTimes,
        hasSubmitted: options.hasSubmitted,
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

  const persistLifecycleSnapshot = useCallback(() => {
    if (hasFlushedLifecycleSnapshotRef.current) {
      return timing.genreTimesRef.current
    }

    hasFlushedLifecycleSnapshotRef.current = true
    return persistSessionSnapshot({ commitActivePost: true })
  }, [persistSessionSnapshot, timing.genreTimesRef])

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
    const handlePageShow = () => {
      hasFlushedLifecycleSnapshotRef.current = false
    }

    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("pageshow", handlePageShow)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("pageshow", handlePageShow)
    }
  }, [persistLifecycleSnapshot])

  useEffect(() => {
    return () => {
      if (hasFlushedLifecycleSnapshotRef.current) {
        return
      }

      hasFlushedLifecycleSnapshotRef.current = true
      persistOnUnmountRef.current({ commitActivePost: true })
    }
  }, [])

  const actions = useFeedSessionActions({
    appVersion,
    finalReportRef: snapshot.finalReportRef,
    finalizeAttributedTiming: timing.finalizeAttributedTiming,
    finalizedGenreTimesRef: snapshot.finalizedGenreTimesRef,
    genreTimesRef: timing.genreTimesRef,
    hasSubmittedRef: snapshot.hasSubmittedRef,
    sessionStatusRef: snapshot.sessionStatusRef,
    persistSessionSnapshot: (options) => snapshot.persistSnapshot(options),
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
