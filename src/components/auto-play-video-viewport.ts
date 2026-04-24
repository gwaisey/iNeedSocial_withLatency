import { useEffect, useRef, useState, type RefObject } from "react"
import type { VideoPreloadDirection } from "../utils/video-preload-budget"
import {
  VIDEO_EARLY_LOAD_DISTANCE_PX,
  VIDEO_VIEWPORT_INTERSECTION_THRESHOLDS,
} from "./auto-play-video-config"
import {
  deriveVideoViewportState,
  getVideoPlaybackPriority,
  getViewportBounds,
  shouldPromoteForwardPlaybackHandoff,
  type VideoScrollDirection,
} from "./auto-play-video-state"

type ViewportSubscriber = () => void

type VideoViewportState = {
  readonly distanceToViewport: number
  readonly isForwardHandoffCandidate: boolean
  readonly isInViewport: boolean
  readonly isVisible: boolean
  readonly playbackPriority: number
  readonly preloadDirection: VideoPreloadDirection
  readonly visibleFraction: number
}

const INITIAL_VIDEO_VIEWPORT_STATE: VideoViewportState = {
  distanceToViewport: Number.POSITIVE_INFINITY,
  isForwardHandoffCandidate: false,
  isInViewport: false,
  isVisible: false,
  playbackPriority: Number.POSITIVE_INFINITY,
  preloadDirection: "below",
  visibleFraction: 0,
}

function getViewportPreloadDirection(
  rootTop: number,
  rootBottom: number,
  targetTop: number,
  targetBottom: number
): VideoPreloadDirection {
  if (targetBottom <= rootTop) {
    return "above"
  }

  if (targetTop >= rootBottom) {
    return "below"
  }

  return "visible"
}

function getRootScrollOffset(root: HTMLElement | null) {
  if (root) {
    return root.scrollTop
  }

  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

const viewportSubscribers = new Set<ViewportSubscriber>()
let viewportScrollHandler: (() => void) | null = null
let viewportAnimationFrame: number | null = null

function scheduleViewportSubscribers() {
  if (viewportAnimationFrame !== null) {
    return
  }

  viewportAnimationFrame = window.requestAnimationFrame(() => {
    viewportAnimationFrame = null
    viewportSubscribers.forEach((subscriber) => subscriber())
  })
}

function subscribeToViewportEvents(subscriber: ViewportSubscriber) {
  viewportSubscribers.add(subscriber)

  if (!viewportScrollHandler) {
    viewportScrollHandler = scheduleViewportSubscribers
    document.addEventListener("scroll", viewportScrollHandler, { passive: true, capture: true })
    window.addEventListener("scroll", viewportScrollHandler, { passive: true })
    window.addEventListener("resize", viewportScrollHandler)
  }

  return () => {
    viewportSubscribers.delete(subscriber)
    if (viewportSubscribers.size > 0 || !viewportScrollHandler) {
      return
    }

    document.removeEventListener("scroll", viewportScrollHandler, true)
    window.removeEventListener("scroll", viewportScrollHandler)
    window.removeEventListener("resize", viewportScrollHandler)
    viewportScrollHandler = null

    if (viewportAnimationFrame !== null) {
      window.cancelAnimationFrame(viewportAnimationFrame)
      viewportAnimationFrame = null
    }
  }
}

export function useMountedVideoViewportState({
  hasVideoSource,
  scrollRootRef,
  shellRef,
  shouldMountVideo,
}: {
  readonly hasVideoSource: boolean
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly shellRef: RefObject<HTMLDivElement | null>
  readonly shouldMountVideo: boolean
}) {
  const wasVisibleRef = useRef(false)
  const lastScrollOffsetRef = useRef<number | null>(null)
  const scrollDirectionRef = useRef<VideoScrollDirection>("none")
  const [viewportState, setViewportState] = useState(INITIAL_VIDEO_VIEWPORT_STATE)

  useEffect(() => {
    if (hasVideoSource && shouldMountVideo) {
      return
    }

    wasVisibleRef.current = false
    lastScrollOffsetRef.current = null
    scrollDirectionRef.current = "none"
    setViewportState(INITIAL_VIDEO_VIEWPORT_STATE)
  }, [hasVideoSource, shouldMountVideo])

  useEffect(() => {
    if (!hasVideoSource || !shouldMountVideo) {
      return
    }

    const shell = shellRef.current
    if (!shell) {
      return
    }

    const updateViewportState = () => {
      const root = scrollRootRef?.current ?? null
      const { top: rootTop, bottom: rootBottom } = getViewportBounds(root)
      const scrollOffset = getRootScrollOffset(root)
      const previousScrollOffset = lastScrollOffsetRef.current
      const shellRect = shell.getBoundingClientRect()
      const nextViewportState = deriveVideoViewportState({
        rootBottom,
        rootTop,
        targetBottom: shellRect.bottom,
        targetTop: shellRect.top,
        wasVisible: wasVisibleRef.current,
      })

      if (previousScrollOffset !== null) {
        if (scrollOffset > previousScrollOffset + 1) {
          scrollDirectionRef.current = "down"
        } else if (scrollOffset < previousScrollOffset - 1) {
          scrollDirectionRef.current = "up"
        }
      }

      lastScrollOffsetRef.current = scrollOffset
      wasVisibleRef.current = nextViewportState.isVisible
      const isForwardHandoffCandidate = shouldPromoteForwardPlaybackHandoff({
        isInViewport: nextViewportState.isInViewport,
        rootTop,
        scrollDirection: scrollDirectionRef.current,
        targetTop: shellRect.top,
        visibleFraction: nextViewportState.visibleFraction,
      })
      setViewportState({
        distanceToViewport: nextViewportState.distanceToViewport,
        isForwardHandoffCandidate,
        isInViewport: nextViewportState.isInViewport,
        isVisible: nextViewportState.isVisible,
        playbackPriority: getVideoPlaybackPriority({
          centerOffset: nextViewportState.centerOffset,
          isForwardHandoffCandidate,
          visibleFraction: nextViewportState.visibleFraction,
        }),
        preloadDirection: getViewportPreloadDirection(
          rootTop,
          rootBottom,
          shellRect.top,
          shellRect.bottom
        ),
        visibleFraction: nextViewportState.visibleFraction,
      })
    }

    updateViewportState()

    const intersectionObserver = new IntersectionObserver(() => {
      updateViewportState()
    }, {
      root: scrollRootRef?.current ?? null,
      threshold: VIDEO_VIEWPORT_INTERSECTION_THRESHOLDS,
    })

    intersectionObserver.observe(shell)

    const unsubscribe = subscribeToViewportEvents(updateViewportState)
    return () => {
      intersectionObserver.disconnect()
      unsubscribe()
    }
  }, [hasVideoSource, scrollRootRef, shellRef, shouldMountVideo])

  return {
    ...viewportState,
    isNearViewport: viewportState.distanceToViewport <= VIDEO_EARLY_LOAD_DISTANCE_PX,
  }
}
