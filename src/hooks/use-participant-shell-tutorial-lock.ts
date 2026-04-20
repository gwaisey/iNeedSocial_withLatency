import { useEffect, type RefObject } from "react"

type UseParticipantShellTutorialLockArgs = {
  isLocked: boolean
  participantShellRef: RefObject<HTMLDivElement | null>
}

export function useParticipantShellTutorialLock({
  isLocked,
  participantShellRef,
}: UseParticipantShellTutorialLockArgs) {
  useEffect(() => {
    const participantShell = participantShellRef.current
    if (!participantShell) {
      return
    }

    if (isLocked) {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && participantShell.contains(activeElement)) {
        activeElement.blur()
      }

      participantShell.inert = true
      participantShell.setAttribute("aria-hidden", "true")
    } else {
      participantShell.inert = false
      participantShell.removeAttribute("aria-hidden")
    }

    return () => {
      participantShell.inert = false
      participantShell.removeAttribute("aria-hidden")
    }
  }, [isLocked, participantShellRef])
}
