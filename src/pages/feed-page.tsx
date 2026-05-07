import { useLayoutEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  FeedBody,
  FeedEndSessionButton,
  FeedPageHeader,
  FeedPageOverlays,
} from "../components/feed/feed-page-layout"
import { RightPanel } from "../components/layout/RightPanel"
import { Sidebar } from "../components/layout/Sidebar"
import { VideoDebugPanel } from "../components/video-debug-panel"
import { useStudyState } from "../context/study-context"
import { useFeedCompletionCtaVisibility } from "../hooks/use-feed-completion-cta-visibility"
import { useFeedLoader } from "../hooks/use-feed-loader"
import { useFeedProgressiveRender } from "../hooks/use-feed-progressive-render"
import { useFeedSession } from "../hooks/use-feed-session"
import { useFeedPageActions } from "../hooks/use-feed-page-actions"
import { useFeedThemeScroll } from "../hooks/use-feed-theme-scroll"
import { useFeedTutorialVisibility } from "../hooks/use-feed-tutorial-visibility"
import { useParticipantShellTutorialLock } from "../hooks/use-participant-shell-tutorial-lock"
import { type ThemeMode } from "../types/social"
import { setFeedScrollTop } from "../utils/feed-scroll-container"

const APP_VERSION = "without_latency"

function resolveThemeMode(search: string): ThemeMode {
  const params = new URLSearchParams(search)
  return params.get("theme") === "dark" ? "dark" : "light"
}

export function FeedPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)

  const participantShellRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const completionCtaRef = useRef<HTMLDivElement | null>(null)

  const {
    commentSheet,
    discardStudySession,
    isVideoMutedByDefault,
    likedPosts,
    repostedPosts,
    sessionId,
    closeCommentSheet,
    openCommentSheet,
    setVideoMutedPreference,
    toggleLiked,
    toggleReposted,
  } = useStudyState()

  const themeMode = resolveThemeMode(location.search)
  const isDark = themeMode === "dark"
  const { feedError, isLoading, payload, retryFeed } = useFeedLoader({ themeMode })
  const { hasMorePosts, visiblePosts } = useFeedProgressiveRender({
    isFeedReady: Boolean(payload) && !feedError,
    posts: payload?.posts ?? null,
    scrollRef,
  })
  const { hideTutorial, isTutorialBlocking, showTutorial, showTutorialDelayBlocker } =
    useFeedTutorialVisibility({
      feedError,
      payload,
      sessionId,
    })
  const {
    discardSessionSnapshot,
    endSession,
    isSavingSession,
    persistSessionSnapshot,
    scheduleActivePostEvaluation,
  } = useFeedSession({
    appVersion: APP_VERSION,
    headerRef,
    isPaused: isTutorialBlocking,
    posts: payload?.posts ?? null,
    scrollRef,
    studySessionId: sessionId ?? "",
  })
  const { captureThemeToggleScrollState } = useFeedThemeScroll({
    headerRef,
    isFeedReady: Boolean(payload) && !isLoading && !feedError,
    scheduleActivePostEvaluation,
    scrollRef,
    themeMode,
  })
  const isTutorialUiActive = showTutorialDelayBlocker || showTutorial

  useParticipantShellTutorialLock({
    isLocked: isTutorialUiActive,
    participantShellRef,
  })

  useLayoutEffect(() => {
    if (!scrollRef.current) {
      return
    }

    setFeedScrollTop(scrollRef.current, 0)
  }, [])

  const isCompletionCtaVisible = useFeedCompletionCtaVisibility({
    completionCtaRef,
    feedError,
    hasMorePosts,
    payload,
    scrollRef,
  })

  const { handleConfirmExitSession, handleEndSession, handleThemeToggle } = useFeedPageActions({
    captureThemeToggleScrollState,
    closeCommentSheet,
    discardSessionSnapshot,
    discardStudySession,
    endSession,
    isDark,
    location,
    navigate,
    persistSessionSnapshot,
  })

  const bgClass = isDark ? "bg-page-dark" : "bg-page-light"
  const textColor = isDark ? "text-white" : "text-ink"
  const dividerCls = isDark ? "divide-transparent" : "divide-ink/6"
  const borderCls = isDark ? "border-white/8" : "border-ink/8"

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : ""}`}>
      <div
        ref={participantShellRef}
        className="w-full lg:flex lg:h-full"
        data-testid="participant-shell"
      >
        <Sidebar
          isEndingSession={isSavingSession}
          onEndSession={() => {
            void handleEndSession()
          }}
          onExitSession={() => setIsExitConfirmOpen(true)}
          theme={themeMode}
        />

        <main
          ref={scrollRef}
          className={`main-content no-scrollbar ${bgClass} ${textColor}`}
          data-testid="feed-scroll-container"
        >
          <FeedPageHeader
            borderClassName={borderCls}
            headerRef={headerRef}
            isDark={isDark}
            onToggleTheme={handleThemeToggle}
          />

          <FeedBody
            borderClassName={borderCls}
            completionCtaRef={completionCtaRef}
            dividerClassName={dividerCls}
            feedError={feedError}
            hasMorePosts={hasMorePosts}
            isDark={isDark}
            isLoading={isLoading}
            isSavingSession={isSavingSession}
            isVideoMutedByDefault={isVideoMutedByDefault}
            likedPosts={likedPosts}
            onComment={openCommentSheet}
            onEndSession={() => {
              void handleEndSession()
            }}
            onLike={toggleLiked}
            onRepost={toggleReposted}
            onRetry={retryFeed}
            onToggleVideoMute={() => setVideoMutedPreference(!isVideoMutedByDefault)}
            payload={payload}
            repostedPosts={repostedPosts}
            scrollRootRef={scrollRef}
            visiblePosts={visiblePosts}
          />
        </main>

        <RightPanel theme={themeMode} />

        {!isCompletionCtaVisible && (
          <FeedEndSessionButton
            className="
              md:hidden fixed left-1/2 -translate-x-1/2 z-50
              flex h-14 w-14 items-center justify-center rounded-full
              bg-white shadow-[0_8px_28px_rgba(18,17,25,0.22)]
              active:scale-90 transition-transform disabled:opacity-70
            "
            dataTestId="timer-open-button-mobile"
            disabled={isSavingSession}
            label="Akhiri sesi"
            onClick={() => {
              void handleEndSession()
            }}
            style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            width={30}
          />
        )}
      </div>
      <FeedPageOverlays
        commentSheet={commentSheet}
        handleConfirmExitSession={handleConfirmExitSession}
        hideTutorial={hideTutorial}
        isDark={isDark}
        isExitConfirmOpen={isExitConfirmOpen}
        onCloseCommentSheet={closeCommentSheet}
        onCloseExitDialog={() => setIsExitConfirmOpen(false)}
        scheduleActivePostEvaluation={scheduleActivePostEvaluation}
        showTutorial={showTutorial}
        showTutorialDelayBlocker={showTutorialDelayBlocker}
      />
      <VideoDebugPanel />
    </div>
  )
}

