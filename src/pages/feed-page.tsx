import React, { useLayoutEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { BrandLogo } from "../components/brand-logo"
import { CommentSheet } from "../components/comment-sheet"
import {
  ExitSessionDialog,
  FeedErrorState,
  FeedSkeleton,
  RevealPost,
} from "../components/feed/feed-page-ui"
import { FeedPost } from "../components/feed-post"
import { RightPanel } from "../components/layout/RightPanel"
import { Sidebar } from "../components/layout/Sidebar"
import { ThemeToggle } from "../components/theme-toggle"
import { TutorialDelayBlocker } from "../components/tutorial/TutorialDelayBlocker"
import { TutorialOverlay } from "../components/tutorial/TutorialOverlay"
import { useStudyState } from "../context/study-context"
import { useFeedLoader } from "../hooks/use-feed-loader"
import { useFeedProgressiveRender } from "../hooks/use-feed-progressive-render"
import { useFeedSession } from "../hooks/use-feed-session"
import { useFeedPageActions } from "../hooks/use-feed-page-actions"
import { useFeedThemeScroll } from "../hooks/use-feed-theme-scroll"
import { useFeedTutorialVisibility } from "../hooks/use-feed-tutorial-visibility"
import { useParticipantShellTutorialLock } from "../hooks/use-participant-shell-tutorial-lock"
import {
  type ThemeMode,
} from "../types/social"

const APP_VERSION = "with_latency"

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

  const {
    commentSheet,
    discardStudySession,
    likedPosts,
    repostedPosts,
    sessionId,
    closeCommentSheet,
    openCommentSheet,
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

    scrollRef.current.scrollTop = 0
  }, [])

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
  const dividerCls = isDark ? "divide-white/8" : "divide-ink/6"
  const borderCls = isDark ? "border-white/8" : "border-ink/8"

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : ""}`}>
      <div
        ref={participantShellRef}
        className="flex h-full w-full"
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
          <div
            ref={headerRef}
            className={`sticky top-0 z-40 flex items-center px-4 py-3 border-b backdrop-blur-sm ${borderCls} ${
              isDark ? "bg-ink/90" : "bg-mist/90"
            }`}
          >
            <div className="w-[42px] lg:hidden shrink-0" />
            <div className="flex-1 flex justify-center lg:invisible">
              <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={60} />
            </div>
            <ThemeToggle isDark={isDark} onClick={handleThemeToggle} />
          </div>

          <div className="feed-wrapper">
            {isLoading && !payload && <FeedSkeleton isDark={isDark} />}

            {!isLoading && feedError && (
              <FeedErrorState
                isDark={isDark}
                message={feedError}
                onRetry={retryFeed}
              />
            )}

            {payload && !feedError && (
              <div className={`divide-y ${dividerCls}`}>
                {visiblePosts.map((post, index) => (
                  <div
                    key={`${post.id}-${index}`}
                    data-post-id={post.id}
                    data-regular-post-id={post.id}
                  >
                    <RevealPost
                      index={index}
                      isDark={isDark}
                      tutorialId={!isDark && index === 0 ? "tutorial-post" : undefined}
                    >
                      <FeedPost
                        isDark={isDark}
                        isLiked={Boolean(likedPosts[post.id])}
                        isReposted={Boolean(repostedPosts[post.id])}
                        onComment={() => openCommentSheet(post.id)}
                        onLike={() => toggleLiked(post.id)}
                        onRepost={() => toggleReposted(post.id)}
                        post={post}
                      />
                    </RevealPost>
                  </div>
                ))}
              </div>
            )}

            {payload && !feedError && !hasMorePosts && (
              <div className={`flex flex-col items-center gap-3 py-10 border-t ${borderCls}`}>
                <p
                  className={`text-[11px] font-medium tracking-widest uppercase ${
                    isDark ? "text-white/35" : "text-ink/35"
                  }`}
                >
                  Sudah selesai melihat feed?
                </p>
                <button
                  aria-label="Akhiri sesi"
                  data-testid="timer-open-button"
                  className="
                    flex h-14 w-14 items-center justify-center rounded-full
                    bg-white shadow-[0_8px_24px_rgba(18,17,25,0.16)]
                    active:scale-95 transition-transform disabled:opacity-70
                  "
                  disabled={isSavingSession}
                  onClick={() => {
                    void handleEndSession()
                  }}
                  type="button"
                >
                  <BrandLogo color="#27262F" width={32} />
                </button>
              </div>
            )}
          </div>
        </main>

        <RightPanel theme={themeMode} />

        <button
          aria-label="Akhiri sesi"
          data-testid="timer-open-button-mobile"
          className="
            md:hidden fixed left-1/2 -translate-x-1/2 z-50
            flex h-14 w-14 items-center justify-center rounded-full
            bg-white shadow-[0_8px_28px_rgba(18,17,25,0.22)]
            active:scale-90 transition-transform disabled:opacity-70
          "
          disabled={isSavingSession}
          onClick={() => {
            void handleEndSession()
          }}
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          type="button"
        >
          <BrandLogo color="#27262F" width={30} />
        </button>

        {commentSheet && <CommentSheet onClose={closeCommentSheet} />}
        {isExitConfirmOpen && (
          <ExitSessionDialog
            onCancel={() => setIsExitConfirmOpen(false)}
            onConfirm={handleConfirmExitSession}
          />
        )}
      </div>
      {showTutorialDelayBlocker && <TutorialDelayBlocker isDark={isDark} />}
      {showTutorial && (
        <TutorialOverlay
          onDone={() => {
            hideTutorial()
            scheduleActivePostEvaluation()
          }}
        />
      )}
    </div>
  )
}

