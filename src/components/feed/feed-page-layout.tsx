import type { CSSProperties, RefObject } from "react"
import { BrandLogo } from "../brand-logo"
import { CommentSheet } from "../comment-sheet"
import { FeedPost } from "../feed-post"
import { ThemeToggle } from "../theme-toggle"
import { TutorialDelayBlocker } from "../tutorial/TutorialDelayBlocker"
import { TutorialOverlay } from "../tutorial/TutorialOverlay"
import type { FeedPayload, Post } from "../../types/social"
import {
  ExitSessionDialog,
  FeedErrorState,
  FeedSkeleton,
  RevealPost,
} from "./feed-page-ui"

export function FeedPageHeader({
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

export function FeedEndSessionButton({
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
          className="feed-post-item"
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

export function FeedBody({
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

export function FeedPageOverlays({
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
