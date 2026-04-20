import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useStudyState } from "../context/study-context"
import { getSessionStorage, isStudySessionResumable } from "../context/study-session-storage"

export function WelcomePage() {
  const navigate = useNavigate()
  const { sessionId, startStudySession } = useStudyState()
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const hasResumableSession = isStudySessionResumable(getSessionStorage(), sessionId)

  const handleStartSession = () => {
    setShowRestartConfirm(false)
    startStudySession()
    navigate("/feed?theme=light")
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-app-radial p-6 animate-fade-in">
      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-phone overflow-hidden px-8 py-14 text-ink">
        {/* Decorative top bubble */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-mist/60 pointer-events-none" />
        <div className="absolute -top-12 -right-20 w-56 h-56 rounded-full bg-violet/10 pointer-events-none" />

        {/* Content */}
        <div className="relative space-y-1">
          <h1 className="text-4xl font-medium leading-tight">Selamat Datang!</h1>
          <p className="text-2xl italic">
            <span className="font-light">Siap untuk&nbsp;</span>
            <span className="font-semibold">menjelajah feed?</span>
          </p>
        </div>

        {/* CTA */}
        <div className="relative mt-12 flex justify-end">
          <button
            aria-label="Lanjut ke feed"
            data-testid="start-study-button"
            className="
              flex h-14 w-14 items-center justify-center
              rounded-full bg-ink text-white
              shadow-[0_14px_28px_rgba(18,17,25,0.25)]
              hover:bg-dusk transition-colors
              active:scale-95
            "
            onClick={() => {
              if (hasResumableSession) {
                setShowRestartConfirm(true)
                return
              }

              handleStartSession()
            }}
            type="button"
          >
            <ChevronRight size={24} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      {showRestartConfirm && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/55 px-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-ink shadow-[0_28px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-bold leading-tight">Mulai sesi baru?</h2>
            <p className="mt-3 text-sm leading-relaxed text-haze">
              Sesi sebelumnya belum selesai. Jika Anda melanjutkan, progres sesi sebelumnya akan
              diganti dengan sesi baru.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-full px-4 py-2 text-sm font-semibold text-haze transition hover:bg-ink/5"
                data-testid="restart-session-cancel-button"
                onClick={() => setShowRestartConfirm(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(18,17,25,0.18)] transition active:scale-95"
                data-testid="restart-session-confirm-button"
                onClick={handleStartSession}
                type="button"
              >
                Mulai sesi baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
