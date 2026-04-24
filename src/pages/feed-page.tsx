import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react"
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
  type FeedPayload,
  type Post,
  type ThemeMode,
} from "../types/social"

const APP_VERSION = "with_latency"

function resolveThemeMode(search: string): ThemeMode {
  const params = new URLSearchParams(search)
  return params.get("theme") === "dark" ? "dark" : "light"
}

function FeedPageHeader({
  borderClassName,
  headerRef,
  isDark,
  onToggleTheme,
}: {
  readonly borderClassName: string
  readonly headerRef: RefObject<HTMLDivElement | null>
  readonly isDark: boolean
  readonly onToggleTheme: () => void
}) {
  return (
    <div
      ref={headerRef}
      className={`sticky top-0 z-40 flex items-center px-4 py-3 border-b backdrop-blur-sm ${borderClassName} ${
        isDark ? "bg-ink/90" : "bg-mist/90"
      }`}
    >
      <div className="w-[42px] lg:hidden shrink-0" />
      <div className="flex-1 flex justify-center lg:invisible">
        <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={60} />
      </div>
      <ThemeToggle isDark={isDark} onClick={onToggleTheme} />
    </div>
  )
}

function FeedEndSessionButton({
  className,
  dataTestId,
  disabled,
  label,
  onClick,
  style,
  width,
}: {
  readonly className: string
  readonly dataTestId: string
  readonly disabled: boolean
  readonly label: string
  readonly onClick: () => void
  readonly style?: CSSProperties
  readonly width: number
}) {
  return (
    <button
      aria-label={label}
      data-testid={dataTestId}
      className={className}
      disabled={disabled}
      onClick={onClick}
      style={style}
      type="button"
    >
      <BrandLogo color="#27262F" width={width} />
    </button>
  )
}

function FeedPostList({
  dividerClassName,
  isDark,
  isVideoMutedByDefault,
  likedPosts,
  onComment,
  onLike,
  onRepost,
  onToggleVideoMute,
  posts,
  repostedPosts,
  scrollRootRef,
}: {
  readonly dividerClassName: string
  readonly isDark: boolean
  readonly isVideoMutedByDefault: boolean
  readonly likedPosts: Record<string, boolean>
  readonly onComment: (postId: string) => void
  readonly onLike: (postId: string) => void
  readonly onRepost: (postId: string) => void
  readonly onToggleVideoMute: () => void
  readonly posts: Post[]
  readonly repostedPosts: Record<string, boolean>
  readonly scrollRootRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className={`divide-y ${dividerClassName}`}>
      {posts.map((post, index) => (
        <div
          key={`${post.id}-${index}`}
          data-post-id={post.id}
          data-regular-post-id={post.id}
          className="feed-post-item"
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
              isVideoMuted={isVideoMutedByDefault}
              onComment={() => onComment(post.id)}
              onLike={() => onLike(post.id)}
              onRepost={() => onRepost(post.id)}
              onToggleVideoMute={onToggleVideoMute}
              post={post}
              scrollRootRef={scrollRootRef}
            />
          </RevealPost>
        </div>
      ))}
    </div>
  )
}

function FeedCompletionCta({
  borderClassName,
  completionCtaRef,
  isDark,
  isSavingSession,
  onEndSession,
}: {
  readonly borderClassName: string
  readonly completionCtaRef: RefObject<HTMLDivElement | null>
  readonly isDark: boolean
  readonly isSavingSession: boolean
  readonly onEndSession: () => void
}) {
  return (
    <div
      ref={completionCtaRef}
      className={`flex flex-col items-center gap-3 py-10 border-t ${borderClassName}`}
    >
      <p
        className={`text-[11px] font-medium tracking-widest uppercase ${
          isDark ? "text-white/35" : "text-ink/35"
        }`}
      >
        Sudah selesai melihat feed?
      </p>
      <FeedEndSessionButton
        className="
          flex h-14 w-14 items-center justify-center rounded-full
          bg-white shadow-[0_8px_24px_rgba(18,17,25,0.16)]
          active:scale-95 transition-transform disabled:opacity-70
        "
        dataTestId="timer-open-button"
        disabled={isSavingSession}
        label="Akhiri sesi"
        onClick={onEndSession}
        width={32}
      />
    </div>
  )
}

function FeedBody({
  borderClassName,
  completionCtaRef,
  dividerClassName,
  feedError,
  hasMorePosts,
  isDark,
  isLoading,
  isSavingSession,
  isVideoMutedByDefault,
  likedPosts,
  onComment,
  onEndSession,
  onLike,
  onRepost,
  onRetry,
  onToggleVideoMute,
  payload,
  repostedPosts,
  scrollRootRef,
  visiblePosts,
}: {
  readonly borderClassName: string
  readonly completionCtaRef: RefObject<HTMLDivElement | null>
  readonly dividerClassName: string
  readonly feedError: string | null
  readonly hasMorePosts: boolean
  readonly isDark: boolean
  readonly isLoading: boolean
  readonly isSavingSession: boolean
  readonly isVideoMutedByDefault: boolean
  readonly likedPosts: Record<string, boolean>
  readonly onComment: (postId: string) => void
  readonly onEndSession: () => void
  readonly onLike: (postId: string) => void
  readonly onRepost: (postId: string) => void
  readonly onRetry: () => void
  readonly onToggleVideoMute: () => void
  readonly payload: FeedPayload | null
  readonly repostedPosts: Record<string, boolean>
  readonly scrollRootRef: RefObject<HTMLDivElement | null>
  readonly visiblePosts: Post[]
}) {
  return (
    <div className="feed-wrapper">
      {isLoading && !payload && <FeedSkeleton isDark={isDark} />}

      {!isLoading && feedError && (
        <FeedErrorState
          isDark={isDark}
          message={feedError}
          onRetry={onRetry}
        />
      )}

      {payload && !feedError && (
        <FeedPostList
          dividerClassName={dividerClassName}
          isDark={isDark}
          isVideoMutedByDefault={isVideoMutedByDefault}
          likedPosts={likedPosts}
          onComment={onComment}
          onLike={onLike}
          onRepost={onRepost}
          onToggleVideoMute={onToggleVideoMute}
          posts={visiblePosts}
          repostedPosts={repostedPosts}
          scrollRootRef={scrollRootRef}
        />
      )}

      {payload && !feedError && !hasMorePosts && (
        <FeedCompletionCta
          borderClassName={borderClassName}
          completionCtaRef={completionCtaRef}
          isDark={isDark}
          isSavingSession={isSavingSession}
          onEndSession={onEndSession}
        />
      )}
    </div>
  )
}

function FeedPageOverlays({
  commentSheet,
  handleConfirmExitSession,
  hideTutorial,
  isDark,
  isExitConfirmOpen,
  onCloseCommentSheet,
  onCloseExitDialog,
  scheduleActivePostEvaluation,
  showTutorial,
  showTutorialDelayBlocker,
}: {
  readonly commentSheet: string | null
  readonly handleConfirmExitSession: () => void
  readonly hideTutorial: () => void
  readonly isDark: boolean
  readonly isExitConfirmOpen: boolean
  readonly onCloseCommentSheet: () => void
  readonly onCloseExitDialog: () => void
  readonly scheduleActivePostEvaluation: () => void
  readonly showTutorial: boolean
  readonly showTutorialDelayBlocker: boolean
}) {
  return (
    <>
      {commentSheet && <CommentSheet onClose={onCloseCommentSheet} />}
      {isExitConfirmOpen && (
        <ExitSessionDialog
          onCancel={onCloseExitDialog}
          onConfirm={handleConfirmExitSession}
        />
      )}
      {showTutorialDelayBlocker && <TutorialDelayBlocker isDark={isDark} />}
      {showTutorial && (
        <TutorialOverlay
          onDone={() => {
            hideTutorial()
            scheduleActivePostEvaluation()
          }}
        />
      )}
    </>
  )
}

export function FeedPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)
  const [isCompletionCtaVisible, setIsCompletionCtaVisible] = useState(false)

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

    scrollRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    if (!payload || feedError || hasMorePosts) {
      setIsCompletionCtaVisible(false)
      return
    }

    const root = scrollRef.current
    const target = completionCtaRef.current

    if (!root || !target) {
      setIsCompletionCtaVisible(false)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCompletionCtaVisible(entry?.isIntersecting ?? false)
      },
      {
        root,
        // Start the handoff slightly before the two CTAs would overlap visually.
        rootMargin: "0px 0px 104px 0px",
        threshold: 0,
      }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [feedError, hasMorePosts, payload])

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
    </div>
  )
}
