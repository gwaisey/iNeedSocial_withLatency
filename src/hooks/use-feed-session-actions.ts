import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import type { FeedSessionStatus } from "../context/study-session-storage"
import { saveSessionData } from "../services/supabase"
import type { GenreTimes, SessionReportPayload } from "../types/social"
import { getUserFacingErrorMessage } from "../utils/error-utils"
import { buildSessionReport } from "../utils/feed-session"

type PersistSessionSnapshot = (options: {
  finalizedGenreTimes?: GenreTimes | null
  finalReport?: SessionReportPayload | null
  genreTimes: GenreTimes
  hasSubmitted?: boolean
  status?: FeedSessionStatus
  submissionHasError?: boolean
  submissionMessage?: string | null
}) => unknown

type UseFeedSessionActionsArgs = {
  appVersion: string
  finalReportRef: MutableRefObject<SessionReportPayload | null>
  finalizeAttributedTiming: () => GenreTimes
  finalizedGenreTimesRef: MutableRefObject<GenreTimes | null>
  genreTimesRef: MutableRefObject<GenreTimes>
  hasSubmittedRef: MutableRefObject<boolean>
  sessionStatusRef: MutableRefObject<FeedSessionStatus>
  persistSessionSnapshot: PersistSessionSnapshot
  setFinalReport: Dispatch<SetStateAction<SessionReportPayload | null>>
  setFinalizedGenreTimes: Dispatch<SetStateAction<GenreTimes | null>>
  setSessionStatus: Dispatch<SetStateAction<FeedSessionStatus>>
  setSubmissionHasError: Dispatch<SetStateAction<boolean>>
  setSubmissionMessage: Dispatch<SetStateAction<string | null>>
  studySessionId: string
  submissionHasErrorRef: MutableRefObject<boolean>
  submissionMessageRef: MutableRefObject<string | null>
}

export function useFeedSessionActions({
  appVersion,
  finalReportRef,
  finalizeAttributedTiming,
  finalizedGenreTimesRef,
  genreTimesRef,
  hasSubmittedRef,
  sessionStatusRef,
  persistSessionSnapshot,
  setFinalReport,
  setFinalizedGenreTimes,
  setSessionStatus,
  setSubmissionHasError,
  setSubmissionMessage,
  studySessionId,
  submissionHasErrorRef,
  submissionMessageRef,
}: UseFeedSessionActionsArgs) {
  const [isSavingSession, setIsSavingSession] = useState(false)
  const isSubmittingRef = useRef(false)

  const endSession = useCallback(async () => {
    const nextGenreTimes = finalReportRef.current
      ? finalizedGenreTimesRef.current ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report =
      finalReportRef.current ??
      buildSessionReport(studySessionId, nextGenreTimes, appVersion)

    if (!finalReportRef.current) {
      finalizedGenreTimesRef.current = nextGenreTimes
      finalReportRef.current = report
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    setSessionStatus("ended")
    sessionStatusRef.current = "ended"

    persistSessionSnapshot({
      finalReport: report,
      finalizedGenreTimes: nextGenreTimes,
      genreTimes: nextGenreTimes,
      status: "ended",
    })

    if (hasSubmittedRef.current || isSubmittingRef.current) {
      return report
    }

    isSubmittingRef.current = true
    setIsSavingSession(true)
    setSubmissionHasError(false)
    setSubmissionMessage("Menyimpan sesi...")
    submissionHasErrorRef.current = false
    submissionMessageRef.current = "Menyimpan sesi..."
    persistSessionSnapshot({
      finalReport: report,
      finalizedGenreTimes: nextGenreTimes,
      genreTimes: nextGenreTimes,
      status: "ended",
      submissionHasError: false,
      submissionMessage: "Menyimpan sesi...",
    })

    try {
      await saveSessionData(report)
      hasSubmittedRef.current = true
      setSubmissionHasError(false)
      setSubmissionMessage("Sesi berhasil disimpan.")
      submissionHasErrorRef.current = false
      submissionMessageRef.current = "Sesi berhasil disimpan."
      persistSessionSnapshot({
        finalReport: report,
        finalizedGenreTimes: nextGenreTimes,
        genreTimes: nextGenreTimes,
        hasSubmitted: true,
        status: "ended",
        submissionHasError: false,
        submissionMessage: "Sesi berhasil disimpan.",
      })
    } catch (error) {
      const nextMessage = getUserFacingErrorMessage(
        error,
        "Sesi tidak dapat disimpan.",
        "feed-session:save"
      )

      setSubmissionHasError(true)
      setSubmissionMessage(nextMessage)
      submissionHasErrorRef.current = true
      submissionMessageRef.current = nextMessage
      persistSessionSnapshot({
        finalReport: report,
        finalizedGenreTimes: nextGenreTimes,
        genreTimes: nextGenreTimes,
        hasSubmitted: false,
        status: "ended",
        submissionHasError: true,
        submissionMessage: nextMessage,
      })
    } finally {
      isSubmittingRef.current = false
      setIsSavingSession(false)
    }

    return report
  }, [
    appVersion,
    finalReportRef,
    finalizeAttributedTiming,
    finalizedGenreTimesRef,
    genreTimesRef,
    hasSubmittedRef,
    sessionStatusRef,
    persistSessionSnapshot,
    setFinalReport,
    setFinalizedGenreTimes,
    setSessionStatus,
    setSubmissionHasError,
    setSubmissionMessage,
    studySessionId,
    submissionHasErrorRef,
    submissionMessageRef,
  ])

  return {
    endSession,
    isSavingSession,
  }
}
