import type { ReactNode } from "react"
import type { ThemeMode } from "../../types/social"
import { BrandLogo } from "../brand-logo"

interface TopBarProps {
  readonly theme: ThemeMode
  readonly right?: ReactNode
}

export function TopBar({ theme, right }: TopBarProps) {
  const isDark = theme === "dark"

  const bg = isDark
    ? "bg-[#27262f]/90 backdrop-blur-2xl border-b border-white/8"
    : "bg-white/90 backdrop-blur-2xl border-b border-ink/8"

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between px-4 lg:hidden ${bg}`}
      style={{ height: 54 }}
    >
      {/* Logo — left-aligned, native app style */}
      <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={60} />

      {/* Right slot (theme toggle, notification icon, etc.) */}
      {right && (
        <div className="flex items-center gap-1">
          {right}
        </div>
      )}
    </header>
  )
}
