import { useLayoutEffect, useRef } from "react"
import { useFeedCarousel } from "../hooks/use-feed-carousel"
import {
  CarouselDots,
  CarouselNavButton,
  CarouselSlideCounter,
  MediaMuteButton,
} from "./feed-post-carousel-controls"
import type { FeedPostMediaSectionProps } from "./feed-post-media-types"
import { FeedImageSurface, FeedVideoSurface } from "./feed-post-media-surfaces"
import {
  buildImageAspectRatioHeight,
  buildKnownImageAspectRatioHeight,
  buildKnownVideoAspectRatioHeight,
  buildVideoAspectRatioHeight,
  isVideoMedia,
} from "./feed-post-media-utils"

export function FeedPostCarouselMedia({
  isMuted,
  onToggleMute,
  post,
  scrollRootRef,
  tokens,
}: FeedPostMediaSectionProps) {
  const { media } = post
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
  const activeMedia = media[activeIdx]
  const activeSlideHasVideo = isVideoMedia(activeMedia)

  useLayoutEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) {
      return
    }

    const syncKnownMediaHeights = () => {
      const width = carousel.clientWidth
      if (width <= 0) {
        return
      }

      media.forEach((item, index) => {
        const knownHeight = buildKnownVideoAspectRatioHeight({
          poster: item.poster,
          src: item.src,
          width,
        }) ?? buildKnownImageAspectRatioHeight({ src: item.src, width })

        if (knownHeight !== null) {
          updateSlideHeight(index, knownHeight)
        }
      })
    }

    syncKnownMediaHeights()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncKnownMediaHeights)
      return () => {
        window.removeEventListener("resize", syncKnownMediaHeights)
      }
    }

    const resizeObserver = new ResizeObserver(syncKnownMediaHeights)
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
              canPrewarm={Math.abs(index - activeIdx) <= 2}
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
              tokens={tokens}
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

      {activeSlideHasVideo && (
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
