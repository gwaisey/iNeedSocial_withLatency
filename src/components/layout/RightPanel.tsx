import type { ThemeMode } from "../../types/social"

interface RightPanelProps {
  theme: ThemeMode
}

const suggestedUsers = [
  { username: "anisa_r", name: "Anisa Rahayu", avatar: "AR" },
  { username: "budi_s", name: "Budi Santoso", avatar: "BS" },
  { username: "cinta_d", name: "Cinta Dewi", avatar: "CD" },
  { username: "dimas_p", name: "Dimas Pratama", avatar: "DP" },
]

export function RightPanel({ theme }: RightPanelProps) {
  const isDark = theme === "dark"

  const textPrimary = isDark ? "text-mist" : "text-ink"
  const textSecondary = "text-haze"
  const divider = isDark ? "border-white/10" : "border-ink/10"
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-ink/5"

  return (
    <div className={`right-panel ${isDark ? "bg-page-dark" : "bg-page-light"}`}>
      <div className="mt-8">
        <p className={`mb-4 text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>
          Saran untuk Anda
        </p>
        <div className={`space-y-1 divide-y ${divider}`}>
          {suggestedUsers.map((user) => (
            <div
              key={user.username}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-3 transition-colors ${hoverBg}`}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet">
                <span className="text-xs font-semibold text-white">{user.avatar}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${textPrimary}`}>{user.name}</p>
                <p className={`truncate text-xs ${textSecondary}`}>@{user.username}</p>
              </div>
              <button className="flex-shrink-0 text-xs font-semibold text-violet transition-colors hover:text-violet/70">
                Ikuti
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-8 space-y-1 text-xs ${textSecondary}`}>
        <p>(c) 2024 iNeedSocial</p>
        <p>Dibuat untuk keperluan penelitian</p>
      </div>
    </div>
  )
}
