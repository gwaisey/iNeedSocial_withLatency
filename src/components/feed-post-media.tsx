import { useLayoutEffect, useRef, type RefObject, type SyntheticEvent } from "react"
import { type Post } from "../types/social"
import { useFeedCarousel } from "../hooks/use-feed-carousel"
import { AutoPlayVideo } from "./auto-play-video"
import {
  CarouselDots,
  CarouselNavButton,
  CarouselSlideCounter,
  MediaMuteButton,
} from "./feed-post-carousel-controls"
import { ProgressiveImage } from "./progressive-image"
import {
  buildKnownVideoAspectRatioHeight,
  buildVideoAspectRatioHeight,
  buildImageAspectRatioHeight,
  getMediaSurfaceTokens,
  isVideoMedia,
  type MediaSurfaceTokens,
} from "./feed-post-media-utils"

type FeedPostMediaProps = {
  readonly isDark: boolean
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
  readonly scrollRootRef?: RefObject<HTMLElement | null>
}

type FeedMediaItem = Post["media"][number]

const VIDEO_PLACEHOLDER_CLASS = "bg-black"
const VIDEO_SKELETON_CLASS = "video-skeleton"

function FeedVideoSurface({
  canPrewarm,
  className,
  isActive,
  isMuted,
  media,
  onLoadedMetadata,
  onPosterLoad,
  scrollRootRef,
  shellClassName,
  streamUid,
  streamDelivery,
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
  readonly streamDelivery?: FeedMediaItem["streamDelivery"]
  readonly streamUid?: string
}) {
  return (
    <AutoPlayVideo
      canPrewarm={canPrewarm}
      className={className}
      isActive={isActive}
      isMuted={isMuted}
      onLoadedMetadata={onLoadedMetadata}
      onPosterLoad={onPosterLoad}
      placeholderClassName={VIDEO_PLACEHOLDER_CLASS}
      poster={media?.poster}
      scrollRootRef={scrollRootRef}
      shellClassName={shellClassName}
      skeletonClassName={VIDEO_SKELETON_CLASS}
      src={media?.src}
      streamDelivery={streamDelivery ?? media?.streamDelivery}
      streamUid={streamUid ?? media?.streamUid}
    />
  )
}

function FeedImageSurface({
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

function FeedPostVideoMedia({
  isMuted,
  onToggleMute,
  post,
  scrollRootRef,
  tokens,
}: {
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly tokens: MediaSurfaceTokens
}) {
  const primaryMedia = post.media[0]

  return (
    <div className={`w-full overflow-hidden relative ${tokens.surface}`}>
      <FeedVideoSurface
        className="w-full h-auto"
        isMuted={isMuted}
        media={primaryMedia}
        scrollRootRef={scrollRootRef}
        shellClassName="w-full"
      />
      <MediaMuteButton isMuted={isMuted} onClick={onToggleMute} postId={post.id} />
    </div>
  )
}

function FeedPostCarouselMedia({
  isMuted,
  onToggleMute,
  post,
  scrollRootRef,
  tokens,
}: {
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly tokens: MediaSurfaceTokens
}) {
  const { media } = post
  const mediaHasVideo = media.some((item) => isVideoMedia(item))
  const {
    activeIdx,
    currentSlideHeight,
    handleTouchEnd,
    handleTouchStart,
    nextSlide,
    prevSlide,
    updateSlideHeight,
  } = useFeedCarousel({ mediaLength: media.length })
  const carouselRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) {
      return
    }

    const syncKnownVideoHeights = () => {
      const width = carousel.clientWidth
      if (width <= 0) {
        return
      }

      media.forEach((item, index) => {
        const knownHeight = buildKnownVideoAspectRatioHeight({
          poster: item.poster,
          src: item.src,
          width,
        })

        if (knownHeight !== null) {
          updateSlideHeight(index, knownHeight)
        }
      })
    }

    syncKnownVideoHeights()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncKnownVideoHeights)
      return () => {
        window.removeEventListener("resize", syncKnownVideoHeights)
      }
    }

    const resizeObserver = new ResizeObserver(syncKnownVideoHeights)
    resizeObserver.observe(carousel)

    return () => {
      resizeObserver.disconnect()
    }
  }, [media, updateSlideHeight])

  return (
    <div
      ref={carouselRef}
      className={`w-full overflow-hidden relative transition-[height] duration-300 ${tokens.surface}`}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      style={{ height: currentSlideHeight ? `${currentSlideHeight}px` : "auto" }}
    >
      <div
        className="flex will-change-transform transition-transform duration-300 ease-out"
        style={{
          height: currentSlideHeight ? `${currentSlideHeight}px` : "auto",
          transform: `translateX(-${activeIdx * 100}%)`,
        }}
      >
        {media.map((item, index) =>
          isVideoMedia(item) ? (
            <FeedVideoSurface
              key={item.src}
              canPrewarm={Math.abs(index - activeIdx) <= 1}
              className="w-full h-auto shrink-0"
              isActive={index === activeIdx}
              isMuted={isMuted}
              media={item}
              onLoadedMetadata={(event) => {
                updateSlideHeight(index, buildVideoAspectRatioHeight(event.currentTarget))
              }}
              onPosterLoad={(image) => {
                updateSlideHeight(index, buildImageAspectRatioHeight(image))
              }}
              scrollRootRef={scrollRootRef}
              shellClassName="w-full shrink-0"
            />
          ) : (
            <FeedImageSurface
              key={item.src}
              className="w-full h-auto shrink-0"
              media={item}
              onLoad={(image) => {
                updateSlideHeight(index, buildImageAspectRatioHeight(image))
              }}
              priority={Math.abs(index - activeIdx) <= 1 ? "high" : "low"}
              shellClassName="w-full shrink-0"
              tokens={tokens}
            />
          )
        )}
      </div>

      {mediaHasVideo && (
        <MediaMuteButton isMuted={isMuted} onClick={onToggleMute} postId={post.id} />
      )}

      {media.length > 1 && (
        <CarouselSlideCounter activeIdx={activeIdx} postId={post.id} total={media.length} />
      )}

      {media.length > 1 && (
        <CarouselDots activeIdx={activeIdx} mediaSources={media.map((item) => item.src)} />
      )}

      {activeIdx > 0 && (
        <CarouselNavButton direction="prev" onClick={prevSlide} postId={post.id} />
      )}

      {activeIdx < media.length - 1 && (
        <CarouselNavButton direction="next" onClick={nextSlide} postId={post.id} />
      )}
    </div>
  )
}

function FeedPostImageMedia({
  post,
  tokens,
}: {
  readonly post: Post
  readonly tokens: MediaSurfaceTokens
}) {
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
