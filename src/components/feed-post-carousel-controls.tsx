import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react"

type MediaMuteButtonProps = {
  readonly isMuted: boolean
  readonly onClick: () => void
  readonly postId: string
}

type CarouselSlideCounterProps = {
  readonly activeIdx: number
  readonly postId: string
  readonly total: number
}

type CarouselDotsProps = {
  readonly activeIdx: number
  readonly mediaSources: string[]
}

type CarouselNavButtonProps = {
  readonly direction: "next" | "prev"
  readonly onClick: () => void
  readonly postId: string
}

export function MediaMuteButton({
  isMuted,
  onClick,
  postId,
}: MediaMuteButtonProps) {
  const Icon = isMuted ? VolumeX : Volume2

  return (
    <button
      aria-label={isMuted ? "Nyalakan suara" : "Matikan suara"}
      className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-transform active:scale-95"
      data-muted={isMuted ? "true" : "false"}
      data-testid={`mute-button-${postId}`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
    </button>
  )
}

export function CarouselSlideCounter({
  activeIdx,
  postId,
  total,
}: CarouselSlideCounterProps) {
  return (
    <span
      className="absolute right-3 top-2.5 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white"
      data-testid={`carousel-indicator-${postId}`}
    >
      {activeIdx + 1}/{total}
    </span>
  )
}

export function CarouselDots({ activeIdx, mediaSources }: CarouselDotsProps) {
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

export function CarouselNavButton({
  direction,
  onClick,
  postId,
}: CarouselNavButtonProps) {
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
