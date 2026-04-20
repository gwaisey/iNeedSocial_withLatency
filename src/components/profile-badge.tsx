interface ProfileBadgeProps {
  readonly isDark: boolean
  readonly username?: string
  /** Show gradient story-ring around avatar */
  readonly hasStory?: boolean
}

export function ProfileBadge({ isDark, username = "123", hasStory = false }: ProfileBadgeProps) {
  const initials =
    username
      .replace(/[^a-zA-Z0-9]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join("") || "G"

  const ringOffset = isDark ? "ring-offset-dusk" : "ring-offset-white"
  const ringClass = hasStory ? `ring-2 ring-offset-1 ${ringOffset}` : ""
  const avatarBg = isDark
    ? "bg-gradient-to-br from-white/20 to-white/10 text-white border border-white/20"
    : "bg-gradient-to-br from-ink to-dusk text-white"

  return (
    <div
      className={`
        relative flex-shrink-0
        ${hasStory ? "p-[2px] rounded-full bg-gradient-to-tr from-violet via-signal to-violet" : ""}
      `}
    >
      <div
        className={`
          flex items-center justify-center
          h-9 w-9 rounded-full
          text-[11px] font-bold tracking-wide
          ${ringClass}
          ${avatarBg}
        `}
      >
        {initials}
      </div>
    </div>
  )
}
