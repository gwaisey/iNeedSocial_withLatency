import { type RefObject } from "react"
import { type Post } from "../types/social"
import { FeedPostCarouselMedia } from "./feed-post-carousel-media"
import { FeedPostImageMedia } from "./feed-post-image-media"
import { getMediaSurfaceTokens } from "./feed-post-media-utils"
import { FeedPostVideoMedia } from "./feed-post-video-media"

type FeedPostMediaProps = {
  readonly isDark: boolean
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
  readonly scrollRootRef?: RefObject<HTMLElement | null>
}

export function FeedPostMedia({
  isDark,
  isMuted,
  onToggleMute,
  post,
  scrollRootRef,
}: FeedPostMediaProps) {
  const tokens = getMediaSurfaceTokens(isDark)

  switch (post.type) {
    case "video":
      return (
        <FeedPostVideoMedia
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          post={post}
          scrollRootRef={scrollRootRef}
          tokens={tokens}
        />
      )
    case "carousel":
      return (
        <FeedPostCarouselMedia
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          post={post}
          scrollRootRef={scrollRootRef}
          tokens={tokens}
        />
      )
    case "image":
    default:
      return <FeedPostImageMedia post={post} tokens={tokens} />
  }
}
