import { useEffect, useMemo, useState, type RefObject } from "react"
import type { Post } from "../types/social"

type ScrollContainerRef = RefObject<HTMLDivElement | null>

type UseFeedProgressiveRenderArgs = {
  isFeedReady: boolean
  posts: Post[] | null
  scrollRef: ScrollContainerRef
}

const INITIAL_RENDER_COUNT = 24
const RENDER_STEP = 18
const LOAD_MORE_OFFSET_PX = 2600
const ESTIMATED_POST_HEIGHT_PX = 960

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
      const targetBottom = container.scrollTop + container.clientHeight + LOAD_MORE_OFFSET_PX
      const missingHeight = targetBottom - container.scrollHeight

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
    container.addEventListener("scroll", scheduleLoadMoreCheck, { passive: true })
    window.addEventListener("resize", scheduleLoadMoreCheck)

    return () => {
      container.removeEventListener("scroll", scheduleLoadMoreCheck)
      window.removeEventListener("resize", scheduleLoadMoreCheck)
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isFeedReady, posts, scrollRef, visibleCount])

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
