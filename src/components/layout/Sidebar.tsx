import { Home, Timer, User, LogOut } from "lucide-react"
import { NavLink } from "react-router-dom"
import { BrandLogo } from "../brand-logo"
import type { ThemeMode } from "../../types/social"

interface SidebarProps {
  isEndingSession?: boolean
  onEndSession: () => void
  onExitSession: () => void
  theme: ThemeMode
}

const navItems = [
  { to: "/feed", icon: Home, label: "Beranda" },
]

export function Sidebar({
  isEndingSession = false,
  onEndSession,
  onExitSession,
  theme,
}: SidebarProps) {
  const isDark = theme === "dark"

  const textColor = isDark ? "text-mist" : "text-ink"
  const hoverBg = isDark ? "hover:bg-white/10" : "hover:bg-violet/10"
  const activeBg = isDark ? "bg-white/15 text-white" : "bg-violet/15 text-violet"
  const borderColor = isDark ? "border-white/10" : "border-ink/10"
  const bg = isDark ? "bg-dusk/80 backdrop-blur-xl" : "bg-white/80 backdrop-blur-xl"

  return (
    <aside className={`sidebar ${bg} border-r ${borderColor} shadow-sidebar`}>
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={80} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? activeBg
                  : `${textColor} ${hoverBg}`
              }`
            }
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
        
        {/* End-session button */}
        <button
          data-testid="sidebar-timer-open-button"
          disabled={isEndingSession}
          onClick={onEndSession}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-70 ${textColor} ${hoverBg}`}
        >
          <Timer size={20} strokeWidth={1.8} />
          <span>Akhiri sesi</span>
        </button>
      </nav>

      {/* Profile & logout */}
      <div className={`px-3 pb-6 border-t ${borderColor} pt-4 space-y-1`}>
        <button
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${textColor} ${hoverBg}`}
        >
          <User size={20} strokeWidth={1.8} />
          <span>Profil</span>
        </button>
        <button
          data-testid="sidebar-exit-button"
          onClick={onExitSession}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${textColor} ${hoverBg}`}
        >
          <LogOut size={20} strokeWidth={1.8} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
