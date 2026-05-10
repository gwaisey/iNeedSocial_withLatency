import { MediaMuteButton } from "./feed-post-carousel-controls"
import type { FeedPostMediaSectionProps } from "./feed-post-media-types"
import { FeedVideoSurface } from "./feed-post-media-surfaces"

export function FeedPostVideoMedia({
  isMuted,
  onToggleMute,
  post,
  scrollRootRef,
  tokens,
}: FeedPostMediaSectionProps) {
  const primaryMedia = post.media[0]

  return (
    <div className={`w-full overflow-hidden relative ${tokens.surface}`}>
      <FeedVideoSurface
        className="w-full h-auto"
        isMuted={isMuted}
        media={primaryMedia}
        scrollRootRef={scrollRootRef}
        shellClassName="w-full"
        tokens={tokens}
      />
      <MediaMuteButton isMuted={isMuted} onClick={onToggleMute} postId={post.id} />
    </div>
  )
}
