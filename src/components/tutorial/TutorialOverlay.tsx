import { ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

// ── Persistence ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "gaby:tutorial_v1"

export function isTutorialDone(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1" } catch { return false }
}

function markDone() {
  try { localStorage.setItem(STORAGE_KEY, "1") } catch { /* private mode */ }
}

// ── Steps definition ─────────────────────────────────────────────────────────
type Side = "above" | "below"

type TutorialStep = {
  readonly emoji: string
  readonly title: string
  readonly body: string
  readonly selector?: string
  readonly side?: Side
}

const STEPS: TutorialStep[] = [
  {
    emoji: "👋",
    title: "Selamat Datang!",
    body: "Hai! Selamat datang di iNeedSocial. Anggap saja ini feed pribadi kamu. Silakan scroll santai dan nikmati konten yang ada selama beberapa menit ke depan, ya!",
  },
  {
    emoji: "📸",
    title: "Postingan",
    body: "Banyak foto menarik dari pengguna lain di sini. Scroll terus ke bawah untuk cari yang kamu suka!",
    selector: "[data-tutorial-id='tutorial-post']",
    side: "below",
  },
  {
    emoji: "❤️",
    title: "Tombol Suka",
    body: "Ketemu foto yang keren? Jangan ragu buat tap ikon hatinya!",
    selector: "[aria-label='Suka postingan']",
    side: "above",
  },
  {
    emoji: "🌙",
    title: "Ganti Tema",
    body: "Mau tampilan terang atau gelap? Pilih yang paling nyaman di mata kamu saat scrolling.",
    selector: "[aria-label='Toggle theme']",
    side: "below",
  },
  {
    emoji: "🚀",
    title: "Siap Mulai!",
    body: "Yuk, Mulai! Enjoy your time! Kalau nanti kamu merasa sudah cukup, tinggal tap logo iNeedSocial di tengah bawah untuk mengakhiri sesi.",
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────
type SpotRect = { x: number; y: number; w: number; h: number }

interface TutorialOverlayProps {
  readonly onDone: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TutorialOverlay({ onDone }: TutorialOverlayProps) {
  const [idx, setIdx] = useState(0)
  const [spot, setSpot] = useState<SpotRect | null>(null)
  const [winH, setWinH] = useState(window.innerHeight)

  const step = STEPS[idx]
  const isLast = idx === STEPS.length - 1
  const PAD = 12
  const GAP = 14

  useEffect(() => {
    if (!step.selector) { setSpot(null); return }
    const t = setTimeout(() => {
      const el = document.querySelector(step.selector as string)
      if (!el) { setSpot(null); return }
      const r = el.getBoundingClientRect()
      setSpot({ x: r.left, y: r.top, w: r.width, h: r.height })
      setWinH(window.innerHeight)
    }, 60)
    return () => clearTimeout(t)
  }, [idx, step.selector])

  const handleNext = useCallback(() => {
    if (isLast) { markDone(); onDone() }
    else setIdx((i) => i + 1)
  }, [isLast, onDone])

  const handleSkip = useCallback(() => { markDone(); onDone() }, [onDone])

  let tooltipTop: number | undefined
  let tooltipBottom: number | undefined

  if (spot) {
    const spotBottom = spot.y + spot.h + PAD
    const spotTopGap = spot.y - PAD
    if (step.side === "below") {
      tooltipTop = Math.min(spotBottom + GAP, winH - 220)
    } else {
      tooltipBottom = Math.max(winH - spotTopGap + GAP, 220)
    }
  }

  function Dots() {
    return (
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-[5px] rounded-full transition-all duration-300 ${
              i === idx ? "w-5 bg-violet" : "w-[5px] bg-ink/20"
            }`}
          />
        ))}
      </div>
    )
  }

  function FullModal() {
    return (
      <div className="absolute inset-0 flex items-end justify-center px-5 pb-16 sm:items-center sm:pb-0">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-[0_32px_64px_rgba(0,0,0,0.4)] animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-violet/10 flex items-center justify-center text-4xl mb-6">
            {step.emoji}
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">{step.title}</h2>
          <p className="text-sm text-haze leading-relaxed mb-8">{step.body}</p>
          <div className="flex items-center justify-between gap-4">
            <Dots />
            <div className="flex items-center gap-3">
              {!isLast && (
                <button
                  className="text-sm font-medium text-haze active:opacity-60"
                  onClick={handleSkip}
                  type="button"
                >
                  Lewati
                </button>
              )}
              <button
                className="
                  flex items-center gap-2 px-5 py-2.5
                  bg-violet text-white rounded-full
                  text-sm font-semibold
                  shadow-[0_8px_20px_rgba(119,109,255,0.45)]
                  active:scale-95 transition-transform
                "
                onClick={handleNext}
                type="button"
              >
                {isLast ? "Mulai Scrolling!" : "Selanjutnya"}
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function SpotTooltip() {
    return (
      <div
        className="absolute animate-slide-up"
        style={{ left: 16, right: 16, top: tooltipTop, bottom: tooltipBottom }}
      >
        <div className="bg-white rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet to-signal" />
          <div className="p-5">
            <button
              aria-label="Lewati tutorial"
              className="absolute top-3 right-3 p-1.5 rounded-full text-haze/60 hover:bg-ink/5 transition-colors"
              onClick={handleSkip}
              type="button"
            >
              <X size={14} strokeWidth={2} />
            </button>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet/10 flex items-center justify-center text-xl flex-shrink-0">
                {step.emoji}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink leading-tight">{step.title}</p>
                <p className="text-[13px] text-haze leading-snug mt-0.5">{step.body}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Dots />
              <button
                className="
                  flex items-center gap-1.5
                  px-4 py-2 rounded-full
                  bg-violet text-white
                  text-xs font-bold
                  shadow-[0_4px_12px_rgba(119,109,255,0.4)]
                  active:scale-95 transition-transform
                "
                onClick={handleNext}
                type="button"
              >
                {isLast ? "Selesai" : "Lanjut"}
                <ChevronRight size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200]">
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.x - PAD}
                y={spot.y - PAD}
                width={spot.w + PAD * 2}
                height={spot.h + PAD * 2}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.82)"
          mask="url(#tutorial-mask)"
        />
        {spot && (
          <>
            <rect
              x={spot.x - PAD - 3}
              y={spot.y - PAD - 3}
              width={spot.w + PAD * 2 + 6}
              height={spot.h + PAD * 2 + 6}
              rx="18"
              fill="none"
              stroke="rgba(119, 109, 255, 0.35)"
              strokeWidth="6"
            />
            <rect
              x={spot.x - PAD}
              y={spot.y - PAD}
              width={spot.w + PAD * 2}
              height={spot.h + PAD * 2}
              rx="16"
              fill="none"
              stroke="#776DFF"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      {spot && (
        <div
          className="absolute inset-0"
          onClick={handleNext}
          role="presentation"
        />
      )}
      {!spot && <FullModal />}
      {spot && <SpotTooltip />}
    </div>
  )
}
