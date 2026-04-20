import { ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  getSessionStorage,
  readTutorialState,
  writeTutorialState,
} from "../../context/study-session-storage"
import { useStudyState } from "../../context/study-context"

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
    body:
      "Hai! Selamat datang di iNeedSocial. Anggap saja ini beranda pribadi kamu. Silakan jelajahi kontennya dengan santai selama beberapa menit ke depan, ya!",
  },
  {
    emoji: "📸",
    title: "Postingan",
    body:
      "Banyak foto menarik dari pengguna lain di sini. Terus geser ke bawah untuk menemukan konten yang kamu suka!",
    selector: "[data-tutorial-id='tutorial-post']",
    side: "below",
  },
  {
    emoji: "❤️",
    title: "Tombol Suka",
    body: "Kalau menemukan foto yang menarik, jangan ragu untuk menekan ikon hati.",
    selector: "[aria-label='Suka postingan']",
    side: "above",
  },
  {
    emoji: "🌙",
    title: "Ganti Tema",
    body:
      "Mau tampilan terang atau gelap? Pilih yang paling nyaman di mata kamu saat menjelajahi feed.",
    selector: "[aria-label='Ganti tema']",
    side: "below",
  },
  {
    emoji: "🚀",
    title: "Siap Mulai!",
    body:
      "Yuk, mulai! Nikmati waktumu. Kalau nanti kamu merasa sudah cukup, tinggal tekan logo iNeedSocial di tengah bawah untuk mengakhiri sesi.",
  },
]

type SpotRect = { x: number; y: number; w: number; h: number }

interface TutorialOverlayProps {
  readonly onDone: () => void
}

export function TutorialOverlay({ onDone }: TutorialOverlayProps) {
  const { sessionId } = useStudyState()
  const currentSessionId = sessionId ?? ""
  const [idx, setIdx] = useState(() =>
    readTutorialState(getSessionStorage(), currentSessionId).currentStep
  )
  const [spot, setSpot] = useState<SpotRect | null>(null)
  const [winH, setWinH] = useState(window.innerHeight)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const primaryActionRef = useRef<HTMLButtonElement | null>(null)
  const skipActionRef = useRef<HTMLButtonElement | null>(null)

  const step = STEPS[idx]
  const isSpotlightStep = Boolean(step.selector)
  const isLast = idx === STEPS.length - 1
  const pad = 12
  const gap = 14
  const titleId = `tutorial-title-${idx}`
  const descriptionId = `tutorial-description-${idx}`

  useEffect(() => {
    writeTutorialState(getSessionStorage(), currentSessionId, {
      completed: false,
      currentStep: idx,
    })
  }, [currentSessionId, idx])

  useEffect(() => {
    if (!step.selector) {
      setSpot(null)
      return
    }

    let animationFrame = 0

    const updateSpot = () => {
      const element = document.querySelector(step.selector as string)
      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      setSpot({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
      setWinH(window.innerHeight)
    }

    const scheduleUpdateSpot = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(updateSpot)
    }

    const timeoutId = window.setTimeout(scheduleUpdateSpot, 60)
    window.addEventListener("resize", scheduleUpdateSpot)
    document.addEventListener("scroll", scheduleUpdateSpot, true)

    return () => {
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", scheduleUpdateSpot)
      document.removeEventListener("scroll", scheduleUpdateSpot, true)
    }
  }, [idx, step.selector])

  useEffect(() => {
    let retryCount = 0
    let retryTimeoutId = 0

    const focusPrimaryAction = () => {
      const primaryAction = primaryActionRef.current
      if (!primaryAction) {
        return
      }

      primaryAction.focus()
      if (document.activeElement === primaryAction || retryCount >= 4) {
        return
      }

      retryCount += 1
      retryTimeoutId = window.setTimeout(focusPrimaryAction, 50)
    }

    focusPrimaryAction()
    const initialTimeoutId = window.setTimeout(focusPrimaryAction, 0)
    const focusFrame = window.requestAnimationFrame(focusPrimaryAction)

    return () => {
      window.clearTimeout(initialTimeoutId)
      window.clearTimeout(retryTimeoutId)
      window.cancelAnimationFrame(focusFrame)
    }
  }, [idx])

  const handleNext = useCallback(() => {
    if (isLast) {
      writeTutorialState(getSessionStorage(), currentSessionId, {
        completed: true,
        currentStep: idx,
      })
      onDone()
      return
    }

    setIdx((current) => current + 1)
  }, [currentSessionId, idx, isLast, onDone])

  const handleSkip = useCallback(() => {
    writeTutorialState(getSessionStorage(), currentSessionId, {
      completed: true,
      currentStep: idx,
    })
    onDone()
  }, [currentSessionId, idx, onDone])

  let tooltipTop: number | undefined
  let tooltipBottom: number | undefined

  if (spot) {
    const spotBottom = spot.y + spot.h + pad
    const spotTopGap = spot.y - pad

    if (step.side === "below") {
      tooltipTop = Math.min(spotBottom + gap, winH - 220)
    } else {
      tooltipBottom = Math.max(winH - spotTopGap + gap, 220)
    }
  }

  const dots = (
    <div className="flex items-center gap-1.5">
      {STEPS.map((_, index) => (
        <span
          key={index}
          className={`h-[5px] rounded-full transition-all duration-300 ${
            index === idx ? "w-5 bg-violet" : "w-[5px] bg-ink/20"
          }`}
        />
      ))}
    </div>
  )

  const handleDialogKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return
    }

    const focusableButtons = [skipActionRef.current, primaryActionRef.current].filter(
      (button): button is HTMLButtonElement => Boolean(button)
    )

    if (focusableButtons.length === 0) {
      return
    }

    const firstButton = focusableButtons[0]
    const lastButton = focusableButtons[focusableButtons.length - 1]
    const activeElement = document.activeElement
    const focusIsInsideTutorial = focusableButtons.includes(activeElement as HTMLButtonElement)

    if (event.shiftKey) {
      if (!focusIsInsideTutorial || activeElement === firstButton) {
        event.preventDefault()
        lastButton.focus()
      }
      return
    }

    if (!focusIsInsideTutorial || activeElement === lastButton) {
      event.preventDefault()
      firstButton.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[200] pointer-events-auto">
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.x - pad}
                y={spot.y - pad}
                width={spot.w + pad * 2}
                height={spot.h + pad * 2}
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
              x={spot.x - pad - 3}
              y={spot.y - pad - 3}
              width={spot.w + pad * 2 + 6}
              height={spot.h + pad * 2 + 6}
              rx="18"
              fill="none"
              stroke="rgba(119, 109, 255, 0.35)"
              strokeWidth="6"
            />
            <rect
              x={spot.x - pad}
              y={spot.y - pad}
              width={spot.w + pad * 2}
              height={spot.h + pad * 2}
              rx="16"
              fill="none"
              stroke="#776DFF"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {!isSpotlightStep && (
        <div className="pointer-events-auto absolute inset-0 flex items-end justify-center px-5 pb-16 sm:items-center sm:pb-0">
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_32px_64px_rgba(0,0,0,0.4)] animate-slide-up"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet/10 text-4xl">
              {step.emoji}
            </div>
            <h2 className="mb-2 text-xl font-bold text-ink" id={titleId}>
              {step.title}
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-haze" id={descriptionId}>
              {step.body}
            </p>
            <div className="flex items-center justify-between gap-4">
              {dots}
              <div className="flex items-center gap-3">
                {!isLast && (
                  <button
                    className="text-sm font-medium text-haze active:opacity-60"
                    data-testid="tutorial-skip-button"
                    onClick={handleSkip}
                    ref={skipActionRef}
                    type="button"
                  >
                    Lewati
                  </button>
                )}
                <button
                  autoFocus
                  className="flex items-center gap-2 rounded-full bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(119,109,255,0.45)] active:scale-95 transition-transform"
                  data-testid="tutorial-next-button"
                  onClick={handleNext}
                  ref={primaryActionRef}
                  type="button"
                >
                  {isLast ? "Mulai Menjelajah!" : "Selanjutnya"}
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isSpotlightStep && (
        <div
          className="pointer-events-none absolute animate-slide-up"
          style={{ left: 16, right: 16, top: tooltipTop, bottom: tooltipBottom ?? 24 }}
        >
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="pointer-events-auto overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <div className="h-1 bg-gradient-to-r from-violet to-signal" />
            <div className="p-5">
              <button
                aria-label="Lewati tutorial"
                className="absolute right-3 top-3 rounded-full p-1.5 text-haze/60 transition-colors hover:bg-ink/5"
                data-testid="tutorial-skip-button"
                onClick={handleSkip}
                ref={skipActionRef}
                type="button"
              >
                <X size={14} strokeWidth={2} />
              </button>
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet/10 text-xl">
                  {step.emoji}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold leading-tight text-ink" id={titleId}>
                    {step.title}
                  </h2>
                  <p className="mt-0.5 text-[13px] leading-snug text-haze" id={descriptionId}>
                    {step.body}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                {dots}
                <button
                  autoFocus
                  className="flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(119,109,255,0.4)] active:scale-95 transition-transform"
                  data-testid="tutorial-next-button"
                  onClick={handleNext}
                  ref={primaryActionRef}
                  type="button"
                >
                  {isLast ? "Selesai" : "Lanjut"}
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
