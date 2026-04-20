import { useCallback, useEffect, useRef, useState } from "react"
import {
  getSessionStorage,
  readFeedSessionSnapshot,
  writeFeedSessionSnapshot,
  type FeedSessionStatus,
  type FeedSessionSnapshot,
} from "../context/study-session-storage"
import type { GenreTimes, SessionReportPayload } from "../types/social"

type PersistFeedSessionSnapshotArgs = {
  finalizedGenreTimes?: GenreTimes | null
  finalReport?: SessionReportPayload | null
  genreTimes: GenreTimes
  hasSubmitted?: boolean
  status?: FeedSessionStatus
  submissionHasError?: boolean
  submissionMessage?: string | null
}

type UseFeedSessionSnapshotArgs = {
  configMessage: string | null
  studySessionId: string
}

export function useFeedSessionSnapshot({
  configMessage,
  studySessionId,
}: UseFeedSessionSnapshotArgs) {
  const storageRef = useRef(getSessionStorage())
  const studySessionIdRef = useRef(studySessionId)
  const restoredSnapshotRef = useRef(
    readFeedSessionSnapshot(storageRef.current, studySessionIdRef.current)
  )
  const restoredSnapshot = restoredSnapshotRef.current

  const [finalizedGenreTimes, setFinalizedGenreTimes] = useState<GenreTimes | null>(
    () => restoredSnapshot?.finalizedGenreTimes ?? null
  )
  const [finalReport, setFinalReport] = useState<SessionReportPayload | null>(
    () => restoredSnapshot?.finalReport ?? null
  )
  const [sessionStatus, setSessionStatus] = useState<FeedSessionStatus>(
    restoredSnapshot?.status ?? "active"
  )
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    restoredSnapshot?.submissionMessage ?? configMessage
  )
  const [submissionHasError, setSubmissionHasError] = useState(
    restoredSnapshot?.submissionHasError ?? Boolean(configMessage)
  )

  const finalizedGenreTimesRef = useRef<GenreTimes | null>(finalizedGenreTimes)
  const finalReportRef = useRef<SessionReportPayload | null>(finalReport)
  const submissionMessageRef = useRef<string | null>(submissionMessage)
  const submissionHasErrorRef = useRef(submissionHasError)
  const sessionStatusRef = useRef<FeedSessionStatus>(sessionStatus)
  const hasSubmittedRef = useRef(restoredSnapshot?.hasSubmitted ?? false)
  const persistenceEnabledRef = useRef(true)

  useEffect(() => {
    finalizedGenreTimesRef.current = finalizedGenreTimes
  }, [finalizedGenreTimes])

  useEffect(() => {
    finalReportRef.current = finalReport
  }, [finalReport])

  useEffect(() => {
    submissionMessageRef.current = submissionMessage
  }, [submissionMessage])

  useEffect(() => {
    submissionHasErrorRef.current = submissionHasError
  }, [submissionHasError])

  useEffect(() => {
    sessionStatusRef.current = sessionStatus
  }, [sessionStatus])

  const persistSnapshot = useCallback(
    ({
      finalizedGenreTimes: nextFinalizedGenreTimes = finalizedGenreTimesRef.current,
      finalReport: nextFinalReport = finalReportRef.current,
      genreTimes,
      hasSubmitted = hasSubmittedRef.current,
      status = sessionStatusRef.current,
      submissionHasError: nextSubmissionHasError = submissionHasErrorRef.current,
      submissionMessage: nextSubmissionMessage = submissionMessageRef.current,
    }: PersistFeedSessionSnapshotArgs) => {
      if (!persistenceEnabledRef.current) {
        return null
      }

      const snapshot: FeedSessionSnapshot = {
        status,
        genreTimes,
        finalizedGenreTimes: nextFinalizedGenreTimes,
        finalReport: nextFinalReport,
        hasSubmitted,
        submissionHasError: nextSubmissionHasError,
        submissionMessage: nextSubmissionMessage,
      }

      writeFeedSessionSnapshot(storageRef.current, studySessionIdRef.current, snapshot)
      return snapshot
    },
    []
  )

  const discardSnapshot = useCallback(() => {
    persistenceEnabledRef.current = false
    writeFeedSessionSnapshot(storageRef.current, studySessionIdRef.current, null)
  }, [])

  return {
    discardSnapshot,
    finalReport,
    finalReportRef,
    finalizedGenreTimes,
    finalizedGenreTimesRef,
    hasSubmittedRef,
    persistSnapshot,
    restoredSnapshot,
    setFinalReport,
    setFinalizedGenreTimes,
    setSessionStatus,
    setSubmissionHasError,
    setSubmissionMessage,
    sessionStatus,
    sessionStatusRef,
    submissionHasError,
    submissionHasErrorRef,
    submissionMessage,
    submissionMessageRef,
  }
}
