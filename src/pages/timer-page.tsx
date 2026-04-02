import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { BrandLogo } from "../components/brand-logo"
import { useStudyState } from "../context/study-context"

export function TimerPage() {
  const navigate = useNavigate()
  const { feedStartedAt } = useStudyState()

  // Snapshot elapsed time once at mount — useState initializer runs only once, value never changes
  const [elapsedMs] = useState(() =>
    feedStartedAt === null ? 0 : Date.now() - feedStartedAt
  )

  return (
    <div className="min-h-svh flex items-center justify-center bg-app-radial animate-fade-in">
      {/* Overlay */}
      <div className="absolute inset-0 bg-ink/90" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-xs mx-auto flex flex-col items-center gap-6 text-white text-center px-6">
        {/* Logo */}
        <BrandLogo color="#FFFFFF" width={52} />

        {/* Timer display */}
        <div className="mt-4">
          <p className="text-lg font-bold tracking-wide mb-4">
            Time You&apos;ve Spent
          </p>

          <p className="text-6xl font-bold tracking-widest tabular-nums leading-none">
            {formatTimer(elapsedMs)}
          </p>

          <div className="mt-4 flex justify-between px-4 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            <span>jam</span>
            <span>min</span>
            <span>sec</span>
          </div>
        </div>

        {/* Reminder */}
        <p className="text-sm font-semibold leading-relaxed text-[#FF516B] max-w-[260px]">
          Don&apos;t forget to screenshot this page and submit to our
          post-questionnaire!
        </p>

        {/* CTA */}
        <button
          aria-label="Continue to thank-you screen"
          className="
            mt-4 flex h-16 w-16 items-center justify-center
            rounded-full bg-white
            shadow-[0_20px_35px_rgba(18,17,25,0.35)]
            hover:scale-105 active:scale-95
            transition-transform
          "
          onClick={() => navigate("/thank-you")}
          type="button"
        >
          <BrandLogo color="#27262F" width={36} />
        </button>
      </div>
    </div>
  )
}

function formatTimer(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const hours   = String(Math.floor(totalSec / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSec % 60).padStart(2, "0")
  return `${hours} : ${minutes} : ${seconds}`
}
