import { useEffect, useMemo, useState, type RefObject } from "react"
import type { Post } from "../types/social"
import {
  addFeedScrollListener,
  getFeedScrollMetrics,
} from "../utils/feed-scroll-container"

type ScrollContainerRef = RefObject<HTMLDivElement | null>

type UseFeedProgressiveRenderArgs = {
  isFeedReady: boolean
  posts: Post[] | null
  scrollRef: ScrollContainerRef
}

const INITIAL_RENDER_COUNT = 36
const RENDER_STEP = 30
const LOAD_MORE_OFFSET_PX = 5200
const ESTIMATED_POST_HEIGHT_PX = 960
const BACKGROUND_RENDER_DELAY_MS = 160

type WindowWithIdleCallback = Window & {
  cancelIdleCallback?: (handle: number) => void
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number
}

export function useFeedProgressiveRender({
  isFeedReady,
  posts,
  scrollRef,
}: UseFeedProgressiveRenderArgs) {
  const totalPostCount = posts?.length ?? 0
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (!totalPostCount) {
      setVisibleCount(0)
      return
    }

    setVisibleCount((current) => {
      if (current === 0) {
        return Math.min(totalPostCount, INITIAL_RENDER_COUNT)
      }

      return Math.min(current, totalPostCount)
    })
  }, [totalPostCount])

  useEffect(() => {
    if (!isFeedReady || !posts?.length) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    let animationFrameId: number | null = null

    const maybeLoadMore = () => {
      const metrics = getFeedScrollMetrics(container)
      const targetBottom = metrics.scrollTop + metrics.clientHeight + LOAD_MORE_OFFSET_PX
      const missingHeight = targetBottom - metrics.scrollHeight

      if (missingHeight <= 0) {
        return
      }

      setVisibleCount((current) => {
        if (current >= posts.length) {
          return current
        }

        const estimatedAdditionalPosts = Math.ceil(missingHeight / ESTIMATED_POST_HEIGHT_PX)
        const nextStep = Math.max(RENDER_STEP, estimatedAdditionalPosts)

        return Math.min(posts.length, current + nextStep)
      })
    }

    const scheduleLoadMoreCheck = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        maybeLoadMore()
      })
    }

    maybeLoadMore()
    const removeFeedScrollListener = addFeedScrollListener(container, scheduleLoadMoreCheck)
    window.addEventListener("resize", scheduleLoadMoreCheck)

    return () => {
      removeFeedScrollListener()
      window.removeEventListener("resize", scheduleLoadMoreCheck)
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isFeedReady, posts, scrollRef, visibleCount])

  useEffect(() => {
    if (!isFeedReady || !posts?.length || visibleCount >= posts.length) {
      return
    }

    const win = window as WindowWithIdleCallback
    let idleCallbackId: number | null = null
    let timeoutId: number | null = null

    const renderNextChunk = () => {
      setVisibleCount((current) => Math.min(posts.length, current + RENDER_STEP))
    }

    if (typeof win.requestIdleCallback === "function") {
      idleCallbackId = win.requestIdleCallback(renderNextChunk, { timeout: 500 })
    } else {
      timeoutId = window.setTimeout(renderNextChunk, BACKGROUND_RENDER_DELAY_MS)
    }

    return () => {
      if (idleCallbackId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleCallbackId)
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [isFeedReady, posts, visibleCount])

  const visiblePosts = useMemo(
    () => (posts ? posts.slice(0, visibleCount) : []),
    [posts, visibleCount]
  )

  return {
    hasMorePosts: visibleCount < totalPostCount,
    totalPostCount,
    visiblePosts,
  }
}
