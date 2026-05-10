import type { FeedPostImageMediaProps } from "./feed-post-media-types"
import { FeedImageSurface } from "./feed-post-media-surfaces"

export function FeedPostImageMedia({ post, tokens }: FeedPostImageMediaProps) {
  const primaryMedia = post.media[0]

  return (
    <div className={`w-full overflow-hidden ${tokens.surface}`}>
      <FeedImageSurface
        className="w-full h-auto"
        media={primaryMedia}
        priority="high"
        shellClassName="w-full"
        tokens={tokens}
      />
    </div>
  )
}
