import type { RefObject, SyntheticEvent } from "react"
import { AutoPlayVideo } from "./auto-play-video"
import type { FeedMediaItem } from "./feed-post-media-types"
import type { MediaSurfaceTokens } from "./feed-post-media-utils"
import { ProgressiveImage } from "./progressive-image"

export function FeedVideoSurface({
  canPrewarm,
  className,
  isActive,
  isMuted,
  media,
  onLoadedMetadata,
  onPosterLoad,
  scrollRootRef,
  shellClassName,
  tokens,
}: {
  readonly canPrewarm?: boolean
  readonly className: string
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly media: FeedMediaItem | undefined
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly onPosterLoad?: (image: HTMLImageElement) => void
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly shellClassName?: string
  readonly tokens: MediaSurfaceTokens
}) {
  return (
    <AutoPlayVideo
      canPrewarm={canPrewarm}
      className={className}
      isActive={isActive}
      isMuted={isMuted}
      onLoadedMetadata={onLoadedMetadata}
      onPosterLoad={onPosterLoad}
      placeholderClassName={tokens.placeholder}
      poster={media?.poster}
      scrollRootRef={scrollRootRef}
      shellClassName={shellClassName}
      skeletonClassName={tokens.skeletonTone}
      src={media?.src}
    />
  )
}

export function FeedImageSurface({
  className,
  media,
  onLoad,
  priority = "high",
  shellClassName,
  tokens,
}: {
  readonly className: string
  readonly media: FeedMediaItem | undefined
  readonly onLoad?: (image: HTMLImageElement) => void
  readonly priority?: "high" | "low"
  readonly shellClassName?: string
  readonly tokens: MediaSurfaceTokens
}) {
  return (
    <ProgressiveImage
      alt={media?.alt ?? ""}
      className={className}
      onLoad={onLoad}
      placeholderClassName={tokens.placeholder}
      priority={priority}
      shellClassName={shellClassName}
      skeletonClassName={tokens.skeletonTone}
      src={media?.src}
    />
  )
}
