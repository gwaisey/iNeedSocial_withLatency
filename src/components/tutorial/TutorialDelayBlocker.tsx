type TutorialDelayBlockerProps = {
  readonly isDark: boolean
}

export function TutorialDelayBlocker({ isDark }: TutorialDelayBlockerProps) {
  return (
    <div
      className="fixed inset-0 z-[190] pointer-events-auto"
      data-testid="tutorial-delay-blocker"
      onTouchMove={(event) => event.preventDefault()}
      onWheel={(event) => event.preventDefault()}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-colors duration-200 ${
          isDark ? "bg-black/50 backdrop-blur-[2px]" : "bg-ink/12 backdrop-blur-[2px]"
        }`}
      />
      <div
        aria-live="polite"
        className="sr-only"
        data-testid="tutorial-delay-status"
        role="status"
      >
        Tutorial akan dimulai.
      </div>
    </div>
  )
}
