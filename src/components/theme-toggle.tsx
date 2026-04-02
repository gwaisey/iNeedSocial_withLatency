import { MoonStar, SunMedium } from "lucide-react"

export function ThemeToggle({
  isDark,
  onClick,
}: {
  isDark: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-label="Toggle theme"
      className={`relative flex h-[33px] w-[42px] items-center rounded-full px-[5px] transition ${
        isDark ? "justify-start bg-white text-ink" : "justify-end bg-ink text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {isDark ? (
        <SunMedium size={15} strokeWidth={2.2} />
      ) : (
        <MoonStar size={15} strokeWidth={2.2} />
      )}
      <span
        className={`absolute top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full ${
          isDark ? "right-[5px] bg-ink" : "left-[5px] bg-white"
        }`}
      />
    </button>
  )
}
