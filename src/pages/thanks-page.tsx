import { RotateCcw } from "lucide-react"
import { useNavigate } from "react-router-dom"

export function ThanksPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh flex items-center justify-center bg-app-radial p-6 animate-fade-in">
      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-phone overflow-hidden px-8 py-14 text-ink">
        {/* Decorative bubbles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-mist/60 pointer-events-none" />
        <div className="absolute -top-12 -right-20 w-56 h-56 rounded-full bg-violet/10 pointer-events-none" />

        {/* Content */}
        <div className="relative space-y-2">
          <h1 className="text-4xl font-medium leading-tight">Terima Kasih!</h1>
          <p className="text-xl font-semibold italic text-haze">Thank You!</p>
        </div>

        <p className="relative mt-6 text-base text-haze leading-relaxed">
          Partisipasi Anda sangat berarti bagi penelitian kami.
          <br />
          <span className="italic">Your participation means a lot to our research.</span>
        </p>

        {/* CTA */}
        <div className="relative mt-12 flex justify-end">
          <button
            aria-label="Restart experience"
            className="
              flex h-14 w-14 items-center justify-center
              rounded-full bg-ink text-white
              shadow-[0_14px_28px_rgba(18,17,25,0.25)]
              hover:bg-dusk transition-colors
              active:scale-95
            "
            onClick={() => navigate("/splash")}
            type="button"
          >
            <RotateCcw size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  )
}
