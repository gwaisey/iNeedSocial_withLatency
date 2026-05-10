import { useEffect, useState, type RefObject } from "react"
import { getFeedScrollRoot } from "../utils/feed-scroll-container"

type UseFeedCompletionCtaVisibilityArgs = {
  readonly completionCtaRef: RefObject<HTMLDivElement | null>
  readonly feedError: string | null
  readonly hasMorePosts: boolean
  readonly payload: unknown
  readonly scrollRef: RefObject<HTMLDivElement | null>
}

export function useFeedCompletionCtaVisibility({
  completionCtaRef,
  feedError,
  hasMorePosts,
  payload,
  scrollRef,
}: UseFeedCompletionCtaVisibilityArgs) {
  const [isCompletionCtaVisible, setIsCompletionCtaVisible] = useState(false)

  useEffect(() => {
    if (!payload || feedError || hasMorePosts) {
      setIsCompletionCtaVisible(false)
      return
    }

    const target = completionCtaRef.current

    if (!target) {
      setIsCompletionCtaVisible(false)
      return
    }

    const root = getFeedScrollRoot(scrollRef.current)
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCompletionCtaVisible(entry?.isIntersecting ?? false)
      },
      {
        root,
        // Start the handoff slightly before the two CTAs would overlap visually.
        rootMargin: "0px 0px 104px 0px",
        threshold: 0,
      }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [completionCtaRef, feedError, hasMorePosts, payload, scrollRef])

  return isCompletionCtaVisible
}
