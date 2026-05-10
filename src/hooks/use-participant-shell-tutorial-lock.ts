import { useEffect, type RefObject } from "react"

type UseParticipantShellTutorialLockArgs = {
  isLocked: boolean
  participantShellRef: RefObject<HTMLDivElement | null>
}

function lockDocumentScroll() {
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0
  const { body, documentElement } = document
  const previousBodyStyles = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
  }
  const previousDocumentOverflow = documentElement.style.overflow

  documentElement.style.overflow = "hidden"
  body.style.overflow = "hidden"
  body.style.position = "fixed"
  body.style.top = `-${scrollY}px`
  body.style.width = "100%"

  return () => {
    documentElement.style.overflow = previousDocumentOverflow
    body.style.overflow = previousBodyStyles.overflow
    body.style.position = previousBodyStyles.position
    body.style.top = previousBodyStyles.top
    body.style.width = previousBodyStyles.width
    window.scrollTo(0, scrollY)
  }
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

    let restoreDocumentScroll: (() => void) | undefined

    if (isLocked) {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && participantShell.contains(activeElement)) {
        activeElement.blur()
      }

      participantShell.inert = true
      participantShell.setAttribute("aria-hidden", "true")
      restoreDocumentScroll = lockDocumentScroll()
    } else {
      participantShell.inert = false
      participantShell.removeAttribute("aria-hidden")
    }

    return () => {
      restoreDocumentScroll?.()
      participantShell.inert = false
      participantShell.removeAttribute("aria-hidden")
    }
  }, [isLocked, participantShellRef])
}
