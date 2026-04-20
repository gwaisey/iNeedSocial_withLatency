import { useCallback } from "react"
import type { Location, NavigateFunction } from "react-router-dom"
import type { ThemeMode } from "../types/social"

type UseFeedPageActionsArgs = {
  captureThemeToggleScrollState: () => void
  closeCommentSheet: () => void
  discardSessionSnapshot: () => void
  discardStudySession: () => void
  endSession: () => Promise<unknown>
  isDark: boolean
  location: Pick<Location, "pathname">
  navigate: NavigateFunction
  persistSessionSnapshot: (options: { commitActivePost?: boolean }) => void
}

export function useFeedPageActions({
  captureThemeToggleScrollState,
  closeCommentSheet,
  discardSessionSnapshot,
  discardStudySession,
  endSession,
  isDark,
  location,
  navigate,
  persistSessionSnapshot,
}: UseFeedPageActionsArgs) {
  const handleEndSession = useCallback(async () => {
    await endSession()
    navigate("/thank-you", { replace: true })
  }, [endSession, navigate])

  const handleConfirmExitSession = useCallback(() => {
    discardSessionSnapshot()
    discardStudySession()
    navigate("/splash", { replace: true })
  }, [discardSessionSnapshot, discardStudySession, navigate])

  const handleThemeToggle = useCallback(() => {
    const nextThemeMode: ThemeMode = isDark ? "light" : "dark"
    captureThemeToggleScrollState()
    persistSessionSnapshot({
      commitActivePost: true,
    })
    closeCommentSheet()
    navigate(
      {
        pathname: location.pathname,
        search: `?theme=${nextThemeMode}`,
      },
      { replace: true }
    )
  }, [
    captureThemeToggleScrollState,
    closeCommentSheet,
    isDark,
    location.pathname,
    navigate,
    persistSessionSnapshot,
  ])

  return {
    handleConfirmExitSession,
    handleEndSession,
    handleThemeToggle,
  }
}
