import React, { useEffect, useRef, useState } from "react"
import { getProgressiveLatency } from "../../config/latency"

export function ExitSessionDialog({
  onCancel,
  onConfirm,
}: {
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/55 px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-ink shadow-[0_28px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-bold leading-tight">Keluar dari sesi?</h2>
        <p className="mt-3 text-sm leading-relaxed text-haze">
          Progres sesi yang belum selesai akan dibuang dan tidak disimpan ke sistem.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-full px-4 py-2 text-sm font-semibold text-haze transition hover:bg-ink/5"
            data-testid="exit-session-cancel-button"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(18,17,25,0.18)] transition active:scale-95"
            data-testid="exit-session-confirm-button"
            onClick={onConfirm}
            type="button"
          >
            Keluar tanpa menyimpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function FeedErrorState({
  isDark,
  message,
  onRetry,
}: {
  readonly isDark: boolean
  readonly message: string
  readonly onRetry: () => void
}) {
  return (
    <div className={`px-4 py-10 ${isDark ? "text-white" : "text-ink"}`}>
      <div
        className={`rounded-3xl border px-5 py-6 text-center ${
          isDark ? "border-white/10 bg-white/5" : "border-ink/8 bg-white"
        }`}
      >
        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-ink"}`}>
          Feed tidak dapat dimuat.
        </p>
        <p className={`mt-2 text-sm leading-relaxed ${isDark ? "text-white/70" : "text-haze"}`}>
          {message}
        </p>
        <button
          className="mt-5 inline-flex items-center justify-center rounded-full bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(119,109,255,0.35)] active:scale-95 transition-transform"
          data-testid="feed-error-retry"
          onClick={onRetry}
          type="button"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}

function SinglePostSkeleton({ isDark }: { isDark: boolean }) {
  const skeletonClass = isDark ? "bg-white/10" : "bg-ink/8"

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className={`h-9 w-9 rounded-full animate-pulse ${skeletonClass}`} />
        <div className="space-y-1.5 flex-1">
          <div className={`h-3 w-24 rounded-full animate-pulse ${skeletonClass}`} />
          <div className={`h-2.5 w-14 rounded-full animate-pulse ${skeletonClass}`} />
        </div>
      </div>
      <div className={`w-full aspect-[4/5] animate-pulse ${skeletonClass}`} />
      <div className="flex items-center gap-3 px-3 py-2">
        <div className={`h-5 w-12 rounded-full animate-pulse ${skeletonClass}`} />
        <div className={`h-5 w-12 rounded-full animate-pulse ${skeletonClass}`} />
        <div className={`h-5 w-8 rounded-full animate-pulse ${skeletonClass}`} />
      </div>
      <div className="px-3 py-3 space-y-2">
        <div className={`h-3 w-20 rounded-full animate-pulse ${skeletonClass}`} />
        <div className={`h-3 w-48 rounded-full animate-pulse ${skeletonClass}`} />
      </div>
    </div>
  )
}

export function FeedSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`divide-y ${isDark ? "divide-white/8" : "divide-ink/6"}`}>
      {Array.from({ length: 3 }).map((_, index) => (
        <SinglePostSkeleton key={index} isDark={isDark} />
      ))}
    </div>
  )
}

export function RevealPost({
  children,
  isDark,
  index = 0,
  tutorialId,
}: {
  readonly children: React.ReactNode
  readonly isDark: boolean
  readonly index?: number
  readonly tutorialId?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (revealed) return
    const el = ref.current
    if (!el) return
    let timer: number
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = window.setTimeout(() => setRevealed(true), getProgressiveLatency(index))
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [revealed, index])

  return (
    <div
      ref={ref}
      className="feed-post-shell"
      data-revealed={revealed}
      {...(tutorialId ? { "data-tutorial-id": tutorialId } : {})}
    >
      {children}
    </div>
  )
}
