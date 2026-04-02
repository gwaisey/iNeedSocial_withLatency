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
  const textSecondary = isDark ? "text-haze" : "text-haze"
  const divider = isDark ? "border-white/10" : "border-ink/10"
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-ink/5"

  return (
    <div className={`right-panel ${isDark ? "bg-page-dark" : "bg-page-light"}`}>
      {/* Suggested accounts */}
      <div className="mt-8">
        <p className={`text-xs font-semibold uppercase tracking-wide mb-4 ${textSecondary}`}>
          Saran untuk Anda
        </p>
        <div className={`space-y-1 divide-y ${divider}`}>
          {suggestedUsers.map((user) => (
            <div
              key={user.username}
              className={`flex items-center gap-3 py-3 px-2 rounded-xl cursor-pointer transition-colors ${hoverBg}`}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-violet flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">{user.avatar}</span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${textPrimary}`}>{user.name}</p>
                <p className={`text-xs truncate ${textSecondary}`}>@{user.username}</p>
              </div>
              {/* Follow button */}
              <button className="text-xs font-semibold text-violet hover:text-violet/70 transition-colors flex-shrink-0">
                Ikuti
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={`mt-8 text-xs ${textSecondary} space-y-1`}>
        <p>© 2024 iNeedSocial</p>
        <p>Dibuat untuk keperluan penelitian</p>
      </div>
    </div>
  )
}
