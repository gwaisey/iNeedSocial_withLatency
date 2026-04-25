import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import type { ThemeMode } from "../types/social"
import {
  adjustFeedScrollTop,
  getFeedScrollTop,
  getFeedViewportRect,
  setFeedScrollTop,
} from "../utils/feed-scroll-container"

type ScrollContainerRef = RefObject<HTMLDivElement | null>
type HeaderRef = RefObject<HTMLDivElement | null>

type FeedScrollAnchor = {
  postId: string
  offset: number
}

type FeedScrollState = {
  scrollTop: number
  anchor: FeedScrollAnchor | null
  theme: ThemeMode
}

type UseFeedThemeScrollArgs = {
  headerRef: HeaderRef
  isFeedReady: boolean
  scheduleActivePostEvaluation: () => void
  scrollRef: ScrollContainerRef
  themeMode: ThemeMode
}

const REGULAR_POST_SELECTOR = "[data-regular-post-id]"

export function useFeedThemeScroll({
  headerRef,
  isFeedReady,
  scheduleActivePostEvaluation,
  scrollRef,
  themeMode,
}: UseFeedThemeScrollArgs) {
  const pendingScrollStateRef = useRef<FeedScrollState | null>(null)

  const getViewportMetrics = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const containerRect = getFeedViewportRect(container)
    const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? containerRect.top

    return {
      container,
      containerRect,
      viewportBottom: containerRect.bottom,
      viewportTop: Math.max(containerRect.top, headerBottom),
    }
  }, [headerRef, scrollRef])

  const findRegularPostElement = useCallback((postId: string) => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)
    for (const element of postElements) {
      if (element.getAttribute("data-regular-post-id") === postId) {
        return element
      }
    }

    return null
  }, [scrollRef])

  const captureScrollAnchor = useCallback((): FeedScrollAnchor | null => {
    const viewportMetrics = getViewportMetrics()
    if (!viewportMetrics) {
      return null
    }

    const { container, viewportBottom, viewportTop } = viewportMetrics
    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)

    for (const element of postElements) {
      const rect = element.getBoundingClientRect()
      const isVisible = rect.bottom > viewportTop && rect.top < viewportBottom

      if (!isVisible) {
        continue
      }

      const postId = element.getAttribute("data-regular-post-id")
      if (!postId) {
        continue
      }

      return {
        postId,
        offset: rect.top - viewportTop,
      }
    }

    return null
  }, [getViewportMetrics])

  const captureScrollState = useCallback((): FeedScrollState | null => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    return {
      anchor: captureScrollAnchor(),
      scrollTop: getFeedScrollTop(container),
      theme: themeMode,
    }
  }, [captureScrollAnchor, scrollRef, themeMode])

  const restoreScrollState = useCallback(
    (scrollState: FeedScrollState, preferAnchor: boolean) => {
      const container = scrollRef.current
      if (!container) {
        return false
      }

      if (!preferAnchor) {
        setFeedScrollTop(container, scrollState.scrollTop)
      }

      if (scrollState.anchor) {
        const element = findRegularPostElement(scrollState.anchor.postId)
        if (element) {
          const viewportMetrics = getViewportMetrics()
          if (!viewportMetrics) {
            return false
          }

          const elementRect = element.getBoundingClientRect()
          const delta = elementRect.top - viewportMetrics.viewportTop - scrollState.anchor.offset

          if (Math.abs(delta) > 0.5) {
            adjustFeedScrollTop(container, delta)
          }

          return true
        }
      }

      if (preferAnchor) {
        setFeedScrollTop(container, scrollState.scrollTop)
      }

      return true
    },
    [findRegularPostElement, getViewportMetrics, scrollRef]
  )

  useLayoutEffect(() => {
    const scrollState = pendingScrollStateRef.current
    const container = scrollRef.current

    if (!scrollState || !container || !isFeedReady) {
      return
    }

    pendingScrollStateRef.current = null
    const prefersAnchorFirst = scrollState.theme !== themeMode
    restoreScrollState(scrollState, prefersAnchorFirst)
    scheduleActivePostEvaluation()

    const animationFrame = window.requestAnimationFrame(() => {
      restoreScrollState(scrollState, true)
      scheduleActivePostEvaluation()
    })
    const timeoutId = window.setTimeout(() => {
      restoreScrollState(scrollState, true)
      scheduleActivePostEvaluation()
    }, 160)
    const lateTimeoutId = window.setTimeout(() => {
      restoreScrollState(scrollState, true)
      scheduleActivePostEvaluation()
    }, 360)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(timeoutId)
      window.clearTimeout(lateTimeoutId)
    }
  }, [
    isFeedReady,
    restoreScrollState,
    scheduleActivePostEvaluation,
    scrollRef,
    themeMode,
  ])

  const captureThemeToggleScrollState = useCallback(() => {
    pendingScrollStateRef.current = captureScrollState()
  }, [captureScrollState])

  return {
    captureThemeToggleScrollState,
  }
}
