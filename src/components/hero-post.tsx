import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react"
import { type HeroSlide } from "../types/social"
import { ProfileBadge } from "./profile-badge"

type HeroPostProps = {
  readonly activeIndex: number
  readonly isLiked: boolean
  readonly isReposted: boolean
  readonly onComment: () => void
  readonly onLike: () => void
  readonly onRepost: () => void
  readonly slides: HeroSlide[]
}

export function HeroPost({
  activeIndex,
  isLiked,
  isReposted,
  onComment,
  onLike,
  onRepost,
  slides,
}: HeroPostProps) {
  return (
    <article className="w-full">

      {/* ── Post header ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <ProfileBadge isDark username="iNeedSocial" hasStory />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-none text-white">
            iNeedSocial
          </p>
          <p className="text-[11px] mt-0.5 text-white/50">Baru saja</p>
        </div>
        <button
          aria-label="More options"
          className="p-2 -mr-1 rounded-full active:bg-white/10 text-white/50"
          type="button"
        >
          <MoreHorizontal size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Full-width carousel ───────────────────────────────── */}
      <div className="w-full relative aspect-[4/5] overflow-hidden">
        {/* Slides */}
        <div
          className="flex h-full will-change-transform transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide) => (
            <img
              key={slide.id}
              alt={slide.alt}
              className="w-full h-full shrink-0 object-cover"
              loading="lazy"
              src={slide.src}
            />
          ))}
        </div>

        {/* Slide indicators – bottom center */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
            {slides.map((slide, i) => (
              <span
                key={slide.id}
                className={`
                  rounded-full transition-all duration-300
                  ${i === activeIndex
                    ? "w-4 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/45"
                  }
                `}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Action row (horizontal, below carousel) ───────────── */}
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
            className={isLiked ? "" : "text-white"}
            fill={isLiked ? "currentColor" : "none"}
            size={22}
            strokeWidth={isLiked ? 0 : 1.8}
          />
          <span className="text-[11px] font-semibold text-white/50">456</span>
        </button>

        {/* Comment */}
        <button
          aria-label="Buka komentar"
          className="flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform text-white"
          onClick={onComment}
          type="button"
        >
          <MessageCircle size={21} strokeWidth={1.8} />
          <span className="text-[11px] font-semibold text-white/50">12</span>
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
            className={isReposted ? "" : "text-white"}
            size={20}
            strokeWidth={isReposted ? 2 : 1.8}
          />
        </button>

        {/* Bookmark */}
        <button
          aria-label="Simpan postingan"
          className="flex items-center gap-1 min-h-[44px] px-1.5 ml-auto active:scale-75 transition-transform text-white/50"
          type="button"
        >
          <Bookmark size={20} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Like count + caption ─────────────────────────────── */}
      <div className="px-3 pt-2 pb-4 text-white">
        <p className="text-[13px] font-semibold">iNeedSocial suka</p>
        <p className="text-[13px] mt-0.5 leading-snug">
          <span className="font-semibold">iNeedSocial</span>
          <span className="ml-1.5 text-white/60">Explore the feed 🌙</span>
        </p>
      </div>

    </article>
  )
}
