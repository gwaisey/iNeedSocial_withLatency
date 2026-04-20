import { useCallback, useEffect, useRef, useState, type SyntheticEvent, type TouchEvent } from "react"
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
} from "lucide-react"
import { type Post } from "../types/social"
import { ProfileBadge } from "./profile-badge"

type FeedPostProps = {
  readonly isDark: boolean
  readonly isLiked: boolean
  readonly isReposted: boolean
  readonly onComment: () => void
  readonly onLike: () => void
  readonly onRepost: () => void
  readonly post: Post
}

type AutoPlayVideoProps = {
  readonly className: string
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly placeholderClassName?: string
  readonly poster?: string
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly src?: string
}

type ProgressiveImageProps = {
  readonly alt: string
  readonly className: string
  readonly onLoad?: (image: HTMLImageElement) => void
  readonly placeholderClassName?: string
  readonly priority?: "high" | "low"
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly src?: string
}

const VIDEO_PRELOAD_ROOT_MARGIN = "2400px 0px"

function isVideoSource(src?: string) {
  return Boolean(src?.endsWith(".mp4"))
}

function MediaMuteButton({
  isMuted,
  onClick,
}: {
  readonly isMuted: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      aria-label={isMuted ? "Nyalakan suara" : "Matikan suara"}
      className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-[10px] font-semibold text-white"
      onClick={onClick}
      type="button"
    >
      {isMuted ? "Mati" : "Nyala"}
    </button>
  )
}

function CarouselSlideCounter({
  activeIdx,
  postId,
  total,
}: {
  readonly activeIdx: number
  readonly postId: string
  readonly total: number
}) {
  return (
    <span
      className="absolute top-2.5 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white"
      data-testid={`carousel-indicator-${postId}`}
    >
      {activeIdx + 1}/{total}
    </span>
  )
}

function CarouselDots({
  activeIdx,
  mediaSources,
}: {
  readonly activeIdx: number
  readonly mediaSources: string[]
}) {
  return (
    <div className="pointer-events-none absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
      {mediaSources.map((src, index) => (
        <span
          key={src}
          className={`rounded-full transition-all duration-300 ${
            index === activeIdx ? "h-1.5 w-4 bg-white" : "h-1.5 w-1.5 bg-white/50"
          }`}
        />
      ))}
    </div>
  )
}

function CarouselNavButton({
  direction,
  onClick,
  postId,
}: {
  readonly direction: "next" | "prev"
  readonly onClick: () => void
  readonly postId: string
}) {
  const isNext = direction === "next"

  return (
    <button
      aria-label={isNext ? "Berikutnya" : "Sebelumnya"}
      className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-transform active:scale-90 ${
        isNext ? "right-2" : "left-2"
      }`}
      data-testid={`carousel-${direction}-${postId}`}
      onClick={onClick}
      type="button"
    >
      {isNext ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  )
}

function AutoPlayVideo({
  className,
  isActive = true,
  isMuted,
  onLoadedMetadata,
  placeholderClassName = "bg-ink/8",
  poster,
  shellClassName = "",
  skeletonClassName = "",
  src,
}: AutoPlayVideoProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const rootTop = entry.rootBounds?.top ?? 0
        const rootBottom = entry.rootBounds?.bottom ?? window.innerHeight
        const isInViewport =
          entry.boundingClientRect.bottom > rootTop && entry.boundingClientRect.top < rootBottom

        setIsNearViewport(entry.isIntersecting)
        setIsVisible(isInViewport && entry.intersectionRatio >= 0.2)
        if (entry.isIntersecting) {
          setShouldMountVideo(true)
        }
      },
      {
        rootMargin: VIDEO_PRELOAD_ROOT_MARGIN,
        threshold: [0, 0.2],
      }
    )

    observer.observe(shell)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    setHasLoadedFrame(false)
    setShouldMountVideo(false)
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.defaultMuted = isMuted
    video.muted = isMuted
    video.volume = isMuted ? 0 : 1
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isNearViewport) {
      return
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.load()
    }
  }, [isNearViewport, src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (isVisible && isActive) {
      video.play().catch(() => {})
      return
    }

    video.pause()
  }, [isActive, isVisible, src])

  return (
    <div
      ref={shellRef}
      className={`relative overflow-hidden ${placeholderClassName} ${shellClassName} ${hasLoadedFrame ? "" : "aspect-[4/5]"}`}
    >
      {!hasLoadedFrame && (
        <div className={`absolute inset-0 skeleton ${skeletonClassName} ${placeholderClassName}`} />
      )}
      {poster && !hasLoadedFrame && (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          src={poster}
        />
      )}
      {shouldMountVideo && (
        <video
          ref={videoRef}
          autoPlay
          className={`${className} transition-opacity duration-200 ${hasLoadedFrame ? "opacity-100" : "opacity-0"}`}
          loop
          muted={isMuted}
          onLoadedData={() => setHasLoadedFrame(true)}
          onLoadedMetadata={(event) => {
            setHasLoadedFrame(true)
            onLoadedMetadata?.(event)
          }}
          playsInline
          poster={poster}
          preload="auto"
          src={src}
        />
      )}
    </div>
  )
}

function ProgressiveImage({
  alt,
  className,
  onLoad,
  placeholderClassName = "bg-ink/8",
  priority = "low",
  shellClassName = "",
  skeletonClassName = "",
  src,
}: ProgressiveImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const hasReportedLoadRef = useRef(false)
  const [hasLoadedImage, setHasLoadedImage] = useState(false)

  const markImageReady = useCallback(
    (image: HTMLImageElement) => {
      if (!image.complete || image.naturalWidth === 0) {
        return
      }

      setHasLoadedImage(true)
      if (hasReportedLoadRef.current) {
        return
      }

      hasReportedLoadRef.current = true
      onLoad?.(image)
    },
    [onLoad]
  )

  useEffect(() => {
    setHasLoadedImage(false)
    hasReportedLoadRef.current = false
  }, [src])

  useEffect(() => {
    const image = imageRef.current
    if (!image) {
      return
    }

    if (image.complete && image.naturalWidth > 0) {
      markImageReady(image)
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (imageRef.current) {
        markImageReady(imageRef.current)
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [markImageReady, src])

  return (
    <div
      className={`relative overflow-hidden ${placeholderClassName} ${shellClassName} ${hasLoadedImage ? "" : "aspect-[4/5]"}`}
    >
      {!hasLoadedImage && (
        <div className={`absolute inset-0 skeleton ${skeletonClassName} ${placeholderClassName}`} />
      )}
      {src && (
        <img
          ref={imageRef}
          alt={alt}
          className={`${className} transition-opacity duration-200 ${hasLoadedImage ? "opacity-100" : "opacity-0"}`}
          decoding="async"
          fetchPriority={priority}
          loading={priority === "high" ? "eager" : "lazy"}
          onLoad={(event) => markImageReady(event.currentTarget)}
          src={src}
        />
      )}
    </div>
  )
}

export function FeedPost({
  isDark,
  isLiked,
  isReposted,
  onComment,
  onLike,
  onRepost,
  post,
}: FeedPostProps) {
  const textPrimary = isDark ? "text-white" : "text-ink"
  const textMuted = isDark ? "text-white/50" : "text-haze"
  const iconBase = isDark ? "text-white" : "text-ink"
  const mediaSurface = isDark ? "bg-white/8" : "bg-ink/8"
  const mediaPlaceholder = isDark ? "bg-white/8" : "bg-ink/8"
  const mediaSkeletonTone = isDark ? "skeleton-dark" : ""
  const [isMuted, setIsMuted] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [slideHeights, setSlideHeights] = useState<number[]>([])

  const { media, type } = post
  const primaryMedia = media[0]
  const mediaHasVideo = media.some((item) => isVideoSource(item.src))
  const currentSlideHeight = slideHeights[activeIdx]

  const prevSlide = () => setActiveIdx((index) => Math.max(0, index - 1))
  const nextSlide = () => setActiveIdx((index) => Math.min(media.length - 1, index + 1))
  const toggleMute = () => setIsMuted((current) => !current)
  const updateSlideHeight = useCallback((index: number, height: number) => {
    setSlideHeights((current) => {
      const next = [...current]
      next[index] = height
      return next
    })
  }, [])

  const handleTouchStart = (event: TouchEvent) => {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartX === null) {
      return
    }

    const diff = touchStartX - event.changedTouches[0].clientX
    if (diff > 40) {
      nextSlide()
    } else if (diff < -40) {
      prevSlide()
    }

    setTouchStartX(null)
  }

  return (
    <article className="w-full">
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <ProfileBadge hasStory isDark={isDark} username={post.username} />
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-none truncate ${textPrimary}`}>
            {post.username}
          </p>
          <p className={`text-[11px] mt-0.5 ${textMuted}`}>Baru saja</p>
        </div>
        <button
          aria-label="Opsi lainnya"
          className={`p-2 -mr-1 rounded-full active:bg-black/5 ${textMuted}`}
          type="button"
        >
          <MoreHorizontal size={18} strokeWidth={1.8} />
        </button>
      </div>

      {type === "video" && (
        <div className={`w-full overflow-hidden relative ${mediaSurface}`}>
          <AutoPlayVideo
            className="w-full h-auto"
            isMuted={isMuted}
            placeholderClassName={mediaPlaceholder}
            poster={primaryMedia?.poster}
            shellClassName="w-full"
            skeletonClassName={mediaSkeletonTone}
            src={primaryMedia?.src}
          />
          <MediaMuteButton isMuted={isMuted} onClick={toggleMute} />
        </div>
      )}

      {type === "carousel" && (
        <div
          className={`w-full overflow-hidden relative transition-[height] duration-300 ${mediaSurface}`}
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
              isVideoSource(item.src) ? (
                <AutoPlayVideo
                  key={item.src}
                  className="w-full h-auto shrink-0"
                  isActive={index === activeIdx}
                  isMuted={isMuted}
                  placeholderClassName={mediaPlaceholder}
                  skeletonClassName={mediaSkeletonTone}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget
                    const height = video.clientWidth * video.videoHeight / video.videoWidth
                    updateSlideHeight(index, height)
                  }}
                  poster={item.poster}
                  shellClassName="w-full shrink-0"
                  src={item.src}
                />
              ) : (
                <ProgressiveImage
                  key={item.src}
                  alt={item.alt}
                  className="w-full h-auto shrink-0"
                  priority={Math.abs(index - activeIdx) <= 1 ? "high" : "low"}
                  placeholderClassName={mediaPlaceholder}
                  shellClassName="w-full shrink-0"
                  skeletonClassName={mediaSkeletonTone}
                  onLoad={(image) => {
                    const height = image.clientWidth * image.naturalHeight / image.naturalWidth
                    updateSlideHeight(index, height)
                  }}
                  src={item.src}
                />
              )
            )}
          </div>

          {mediaHasVideo && <MediaMuteButton isMuted={isMuted} onClick={toggleMute} />}

          {media.length > 1 && <CarouselSlideCounter activeIdx={activeIdx} postId={post.id} total={media.length} />}

          {media.length > 1 && <CarouselDots activeIdx={activeIdx} mediaSources={media.map((item) => item.src)} />}

          {activeIdx > 0 && <CarouselNavButton direction="prev" onClick={prevSlide} postId={post.id} />}

          {activeIdx < media.length - 1 && (
            <CarouselNavButton direction="next" onClick={nextSlide} postId={post.id} />
          )}
        </div>
      )}

      {type === "image" && (
        <div className={`w-full overflow-hidden ${mediaSurface}`}>
          <ProgressiveImage
            alt={primaryMedia?.alt}
            className="w-full h-auto"
            placeholderClassName={mediaPlaceholder}
            priority="high"
            shellClassName="w-full"
            skeletonClassName={mediaSkeletonTone}
            src={primaryMedia?.src}
          />
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-0.5">
        <button
          aria-label="Suka postingan"
          className="flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform"
          data-testid={`like-button-${post.id}`}
          data-liked={isLiked ? "true" : "false"}
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
          className={`flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform ${iconBase}`}
          onClick={onComment}
          type="button"
        >
          <MessageCircle size={21} strokeWidth={1.8} />
        </button>

        <button
          aria-label="Bagikan postingan"
          className="flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform"
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
          className={`flex items-center gap-1 min-h-[44px] px-1.5 ml-auto active:scale-75 transition-transform ${textMuted}`}
          type="button"
        >
          <Bookmark size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className="px-3 pt-0.5 pb-4">
        <p className={`text-[13px] font-semibold ${textPrimary}`}>{post.likes} suka</p>
        <p className={`text-[13px] mt-0.5 leading-snug ${textPrimary}`}>
          <span className="font-semibold">{post.username}</span>
          <span className={`ml-1.5 ${textMuted}`}>{post.caption}</span>
        </p>
      </div>
    </article>
  )
}
