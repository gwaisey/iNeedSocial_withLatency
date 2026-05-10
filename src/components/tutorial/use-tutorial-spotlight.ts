import { useEffect, useState } from "react"

export type TutorialSpotRect = { x: number; y: number; w: number; h: number }

export function useTutorialSpotlight(selector?: string) {
  const [spot, setSpot] = useState<TutorialSpotRect | null>(null)
  const [windowHeight, setWindowHeight] = useState(window.innerHeight)

  useEffect(() => {
    if (!selector) {
      setSpot(null)
      return
    }

    let animationFrame = 0

    const updateSpot = () => {
      const element = document.querySelector(selector)
      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      setSpot({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
      setWindowHeight(window.innerHeight)
    }

    const scheduleUpdateSpot = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(updateSpot)
    }

    const timeoutId = window.setTimeout(scheduleUpdateSpot, 60)
    window.addEventListener("resize", scheduleUpdateSpot)
    document.addEventListener("scroll", scheduleUpdateSpot, true)

    return () => {
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", scheduleUpdateSpot)
      document.removeEventListener("scroll", scheduleUpdateSpot, true)
    }
  }, [selector])

  return { spot, windowHeight }
}

export function getTutorialTooltipPosition({
  gap,
  pad,
  side,
  spot,
  windowHeight,
}: {
  readonly gap: number
  readonly pad: number
  readonly side?: "above" | "below"
  readonly spot: TutorialSpotRect | null
  readonly windowHeight: number
}) {
  if (!spot) {
    return { tooltipBottom: undefined, tooltipTop: undefined }
  }

  const spotBottom = spot.y + spot.h + pad
  const spotTopGap = spot.y - pad

  if (side === "below") {
    return {
      tooltipBottom: undefined,
      tooltipTop: Math.min(spotBottom + gap, windowHeight - 220),
    }
  }

  return {
    tooltipBottom: Math.max(windowHeight - spotTopGap + gap, 220),
    tooltipTop: undefined,
  }
}
