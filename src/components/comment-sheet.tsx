import { X } from "lucide-react"

type CommentSheetProps = {
  onClose: () => void
}

export function CommentSheet({ onClose }: CommentSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <button
        aria-label="Close comment overlay"
        className="fixed inset-0 z-50 bg-black/40 animate-fade-in"
        onClick={onClose}
        type="button"
      />

      {/* Sheet – slides up from bottom, max-width centered on desktop */}
      <div
        className="
          fixed bottom-0 left-0 right-0 z-50
          mx-auto max-w-lg
          rounded-t-3xl bg-white text-ink
          shadow-[0_-24px_50px_rgba(18,17,25,0.2)]
          animate-slide-up
          pb-safe
        "
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-ink/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-ink/8">
          <h2 className="text-sm font-semibold">Komentar</h2>
          <button
            aria-label="Close"
            className="p-1 rounded-full hover:bg-ink/5 transition-colors"
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center py-16 px-6 gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/35">
            Komentar
          </p>
          <p className="text-2xl font-semibold tracking-wide text-ink">
            Belum ada komentar.
          </p>
        </div>
      </div>
    </>
  )
}
