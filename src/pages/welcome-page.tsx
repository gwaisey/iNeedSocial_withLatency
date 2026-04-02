import { ChevronRight } from "lucide-react"
import { useNavigate } from "react-router-dom"

export function WelcomePage() {
  const navigate = useNavigate()

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
            <span className="font-semibold">Scrolling?</span>
          </p>
        </div>

        <div className="relative mt-6 space-y-1 text-haze">
          <p className="text-xl font-semibold italic">Welcome!</p>
          <p className="text-lg italic">
            <span className="font-light">Are you ready to&nbsp;</span>
            <span className="font-semibold">Scroll?</span>
          </p>
        </div>

        {/* CTA */}
        <div className="relative mt-12 flex justify-end">
          <button
            aria-label="Continue to feed"
            className="
              flex h-14 w-14 items-center justify-center
              rounded-full bg-ink text-white
              shadow-[0_14px_28px_rgba(18,17,25,0.25)]
              hover:bg-dusk transition-colors
              active:scale-95
            "
            onClick={() => navigate("/feed?theme=light")}
            type="button"
          >
            <ChevronRight size={24} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  )
}
