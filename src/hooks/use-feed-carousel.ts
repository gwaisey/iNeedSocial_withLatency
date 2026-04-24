import { useCallback, useState, type TouchEvent } from "react"

type UseFeedCarouselArgs = {
  mediaLength: number
}

export function useFeedCarousel({ mediaLength }: UseFeedCarouselArgs) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [slideHeights, setSlideHeights] = useState<number[]>([])

  const prevSlide = useCallback(() => {
    setActiveIdx((index) => Math.max(0, index - 1))
  }, [])

  const nextSlide = useCallback(() => {
    setActiveIdx((index) => Math.min(mediaLength - 1, index + 1))
  }, [mediaLength])

  const updateSlideHeight = useCallback((index: number, height: number) => {
    setSlideHeights((current) => {
      const next = [...current]
      next[index] = height
      return next
    })
  }, [])

  const handleTouchStart = useCallback((event: TouchEvent) => {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }, [])

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (touchStartX === null) {
      return
    }

    const diff = touchStartX - event.changedTouches[0].clientX
    if (diff > 40) {
      nextSlide()
    } else if (diff < -40) {
      prevSlide()
    }

    setTouchStartX(null)
  }, [nextSlide, prevSlide, touchStartX])

  return {
    activeIdx,
    currentSlideHeight: slideHeights[activeIdx],
    handleTouchEnd,
    handleTouchStart,
    nextSlide,
    prevSlide,
    updateSlideHeight,
  }
}
