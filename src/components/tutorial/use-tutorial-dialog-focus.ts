import { useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react"

type UseTutorialDialogFocusArgs = {
  readonly primaryActionRef: RefObject<HTMLButtonElement | null>
  readonly skipActionRef: RefObject<HTMLButtonElement | null>
  readonly stepIndex: number
}

export function useTutorialDialogFocus({
  primaryActionRef,
  skipActionRef,
  stepIndex,
}: UseTutorialDialogFocusArgs) {
  useEffect(() => {
    let retryCount = 0
    let retryTimeoutId = 0

    const focusPrimaryAction = () => {
      const primaryAction = primaryActionRef.current
      if (!primaryAction) {
        return
      }

      primaryAction.focus()
      if (document.activeElement === primaryAction || retryCount >= 4) {
        return
      }

      retryCount += 1
      retryTimeoutId = window.setTimeout(focusPrimaryAction, 50)
    }

    focusPrimaryAction()
    const initialTimeoutId = window.setTimeout(focusPrimaryAction, 0)
    const focusFrame = window.requestAnimationFrame(focusPrimaryAction)

    return () => {
      window.clearTimeout(initialTimeoutId)
      window.clearTimeout(retryTimeoutId)
      window.cancelAnimationFrame(focusFrame)
    }
  }, [primaryActionRef, stepIndex])

  return useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return
    }

    const focusableButtons = [skipActionRef.current, primaryActionRef.current].filter(
      (button): button is HTMLButtonElement => Boolean(button)
    )

    if (focusableButtons.length === 0) {
      return
    }

    const firstButton = focusableButtons[0]
    const lastButton = focusableButtons[focusableButtons.length - 1]
    const activeElement = document.activeElement
    const focusIsInsideTutorial = focusableButtons.includes(activeElement as HTMLButtonElement)

    if (event.shiftKey) {
      if (!focusIsInsideTutorial || activeElement === firstButton) {
        event.preventDefault()
        lastButton.focus()
      }
      return
    }

    if (!focusIsInsideTutorial || activeElement === lastButton) {
      event.preventDefault()
      firstButton.focus()
    }
  }, [primaryActionRef, skipActionRef])
}
