import { useState } from "react"
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react"
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
  const textMuted   = isDark ? "text-white/50" : "text-haze"
  const iconBase    = isDark ? "text-white" : "text-ink"
  const [isMuted, setIsMuted] = useState(true)

  // Carousel active slide index
  const [activeIdx, setActiveIdx] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [slideHeights, setSlideHeights] = useState<number[]>([])

  const { type, media } = post

  const prevSlide = () => setActiveIdx((i) => Math.max(0, i - 1))
  const nextSlide = () => setActiveIdx((i) => Math.min(media.length - 1, i + 1))

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX)
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const diff = touchStartX - e.changedTouches[0].clientX
    if (diff > 40) nextSlide()
    else if (diff < -40) prevSlide()
    setTouchStartX(null)
  }

  return (
    <article className="w-full">

      {/* ── Post header ───────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <ProfileBadge isDark={isDark} username={post.username} hasStory />
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-none truncate ${textPrimary}`}>
            {post.username}
          </p>
          <p className={`text-[11px] mt-0.5 ${textMuted}`}>Baru saja</p>
        </div>
        <button
          aria-label="More options"
          className={`p-2 -mr-1 rounded-full active:bg-black/5 ${textMuted}`}
          type="button"
        >
          <MoreHorizontal size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Media ─────────────────────────────────────────────── */}

      {type === "video" && (
        <div className="w-full bg-black overflow-hidden relative">
          <video
            ref={(el) => {
              if (!el) return
              el.muted = isMuted
              const observer = new IntersectionObserver(
                ([entry]) => {
                  if (!entry.isIntersecting) {
                    el.pause()
                  } else {
                    el.play().catch(() => {})
                  }
                },
                { threshold: 0.2 }
              )
              observer.observe(el)
            }}
            className="w-full h-auto"
            autoPlay
            loop
            playsInline
            src={media[0]?.src}
          />
          <button
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white z-10"
            onClick={() => setIsMuted((m) => !m)}
            type="button"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      )}

      {type === "carousel" && (
        <div
          className="w-full overflow-hidden relative transition-[height] duration-300"
          style={{ height: slideHeights[activeIdx] ? `${slideHeights[activeIdx]}px` : "auto" }}
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
        >
          {/* Slides */}
          <div
            className="flex will-change-transform transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeIdx * 100}%)`, height: slideHeights[activeIdx] ? `${slideHeights[activeIdx]}px` : "auto" }}
          >
            {media.map((item, idx) => (
              item.src.endsWith(".mp4") ? (
                <video
                  key={item.src}
                  className="w-full h-auto shrink-0"
                  autoPlay
                  loop
                  ref={(el) => {
                    if (!el) return
                    el.muted = isMuted
                    const observer = new IntersectionObserver(
                      ([entry]) => {
                        if (!entry.isIntersecting) {
                          el.pause()
                        } else {
                          el.play().catch(() => {})
                        }
                      },
                      { threshold: 0.2 }
                    )
                    observer.observe(el)
                  }}
                  playsInline
                  src={item.src}
                  onLoadedMetadata={(e) => {
                    const v = e.target as HTMLVideoElement
                    const h = v.clientWidth * v.videoHeight / v.videoWidth
                    setSlideHeights((prev) => {
                      const next = [...prev]
                      next[idx] = h
                      return next
                    })
                  }}
                />
              ) : (
                <img
                  key={item.src}
                  alt={item.alt}
                  className="w-full h-auto shrink-0"
                  loading="lazy"
                  src={item.src}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement
                    const h = img.clientWidth * img.naturalHeight / img.naturalWidth
                    setSlideHeights((prev) => {
                      const next = [...prev]
                      next[idx] = h
                      return next
                    })
                  }}
                />
              )
            ))}
          </div>

          {/* Mute/Unmute button */}
          {media.some((item) => item.src.endsWith(".mp4")) && (
            <button
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white z-10"
              onClick={() => setIsMuted((m) => !m)}
              type="button"
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          )}
          
          {/* Slide counter — top right */}
          {media.length > 1 && (
            <span className="absolute top-2.5 right-3 bg-black/50 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
              {activeIdx + 1}/{media.length}
            </span>
          )}

          {/* Dot indicators — bottom center */}
          {media.length > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
              {media.map((item, i) => (
                <span
                  key={item.src}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Prev arrow */}
          {activeIdx > 0 && (
            <button
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white active:scale-90 transition-transform"
              onClick={prevSlide}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Next arrow */}
          {activeIdx < media.length - 1 && (
            <button
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white active:scale-90 transition-transform"
              onClick={nextSlide}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {type === "image" && (
        <div className="w-full overflow-hidden">
          <img
            alt={media[0]?.alt}
            className="w-full h-auto"
            loading="lazy"
            src={media[0]?.src}
          />
        </div>
      )}

      {/* ── Action row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-0.5">
        {/* Like */}
        <button
          aria-label="Suka postingan"
          className="flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform"
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

        {/* Comment */}
        <button
          aria-label="Buka komentar"
          className={`flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform ${iconBase}`}
          onClick={onComment}
          type="button"
        >
          <MessageCircle size={21} strokeWidth={1.8} />
        </button>

        {/* Share */}
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

        {/* Bookmark */}
        <button
          aria-label="Simpan postingan"
          className={`flex items-center gap-1 min-h-[44px] px-1.5 ml-auto active:scale-75 transition-transform ${textMuted}`}
          type="button"
        >
          <Bookmark size={20} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Like count + caption ───────────────────────────────── */}
      <div className="px-3 pt-0.5 pb-4">
        <p className={`text-[13px] font-semibold ${textPrimary}`}>
          {post.likes} suka
        </p>
        <p className={`text-[13px] mt-0.5 leading-snug ${textPrimary}`}>
          <span className="font-semibold">{post.username}</span>
          <span className={`ml-1.5 ${textMuted}`}>{post.caption}</span>
        </p>
      </div>

    </article>
  )
}
