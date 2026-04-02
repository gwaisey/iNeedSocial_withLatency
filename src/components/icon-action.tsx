import { type ReactNode } from "react"

type IconActionProps = {
  readonly active: boolean
  readonly activeColor: string
  readonly color: string
  readonly icon: ReactNode
  readonly label: string
  readonly onClick: () => void
}

export function IconAction({
  active,
  activeColor,
  color,
  icon,
  label,
  onClick,
}: IconActionProps) {
  return (
    <button
      aria-label={label}
      className="
        flex items-center justify-center
        min-h-[44px] min-w-[44px]
        -m-2 p-2
        rounded-full
        active:scale-90 transition-transform duration-100
      "
      onClick={onClick}
      style={{ color: active ? activeColor : color }}
      type="button"
    >
      {icon}
    </button>
  )
}
