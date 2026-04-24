import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react"
import { type Post } from "../types/social"
import { ProfileBadge } from "./profile-badge"

export type FeedPostPalette = {
  iconBase: string
  textMuted: string
  textPrimary: string
}

type FeedPostHeaderProps = {
  readonly isDark: boolean
  readonly palette: FeedPostPalette
  readonly post: Post
}

type FeedPostActionsProps = {
  readonly iconBase: string
  readonly isLiked: boolean
  readonly isReposted: boolean
  readonly onComment: () => void
  readonly onLike: () => void
  readonly onRepost: () => void
  readonly post: Post
  readonly textMuted: string
}

type FeedPostCaptionProps = {
  readonly palette: FeedPostPalette
  readonly post: Post
}

export function FeedPostHeader({
  isDark,
  palette,
  post,
}: FeedPostHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
      <ProfileBadge hasStory isDark={isDark} username={post.username} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-semibold leading-none ${palette.textPrimary}`}>
          {post.username}
        </p>
        <p className={`mt-0.5 text-[11px] ${palette.textMuted}`}>Baru saja</p>
      </div>
      <button
        aria-label="Opsi lainnya"
        className={`-mr-1 rounded-full p-2 active:bg-black/5 ${palette.textMuted}`}
        type="button"
      >
        <MoreHorizontal size={18} strokeWidth={1.8} />
      </button>
    </div>
  )
}

export function FeedPostActions({
  iconBase,
  isLiked,
  isReposted,
  onComment,
  onLike,
  onRepost,
  post,
  textMuted,
}: FeedPostActionsProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-0.5">
      <button
        aria-label="Suka postingan"
        className="flex min-h-[44px] items-center gap-1 px-1.5 transition-transform active:scale-75"
        data-liked={isLiked ? "true" : "false"}
        data-testid={`like-button-${post.id}`}
        onClick={onLike}
        style={{ color: isLiked ? "#C83C53" : undefined }}
        type="button"
      >
        <Heart
          className={isLiked ? "" : iconBase}
          fill={isLiked ? "currentColor" : "none"}
          size={22}
          strokeWidth={isLiked ? 0 : 1.8}
        />
      </button>

      <button
        aria-label="Buka komentar"
        className={`flex min-h-[44px] items-center gap-1 px-1.5 transition-transform active:scale-75 ${iconBase}`}
        onClick={onComment}
        type="button"
      >
        <MessageCircle size={21} strokeWidth={1.8} />
      </button>

      <button
        aria-label="Bagikan postingan"
        className="flex min-h-[44px] items-center gap-1 px-1.5 transition-transform active:scale-75"
        onClick={onRepost}
        style={{ color: isReposted ? "#776DFF" : undefined }}
        type="button"
      >
        <Send
          className={isReposted ? "" : iconBase}
          size={20}
          strokeWidth={isReposted ? 2 : 1.8}
        />
      </button>

      <button
        aria-label="Simpan postingan"
        className={`ml-auto flex min-h-[44px] items-center gap-1 px-1.5 transition-transform active:scale-75 ${textMuted}`}
        type="button"
      >
        <Bookmark size={20} strokeWidth={1.8} />
      </button>
    </div>
  )
}

export function FeedPostCaption({ palette, post }: FeedPostCaptionProps) {
  return (
    <div className="px-3 pt-0.5 pb-4">
      <p className={`text-[13px] font-semibold ${palette.textPrimary}`}>{post.likes} suka</p>
      <p className={`mt-0.5 text-[13px] leading-snug ${palette.textPrimary}`}>
        <span className="font-semibold">{post.username}</span>
        <span className={`ml-1.5 ${palette.textMuted}`}>{post.caption}</span>
      </p>
    </div>
  )
}
