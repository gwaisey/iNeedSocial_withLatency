import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { GenreCounts, GenreKey, GenreTimes, Post } from "../types/social"
import {
  addFeedScrollListener,
  getFeedViewportRect,
} from "../utils/feed-scroll-container"

type ScrollContainerRef = RefObject<HTMLDivElement | null>
type HeaderRef = RefObject<HTMLDivElement | null>

type UseFeedTimingArgs = {
  headerRef: HeaderRef
  initialGenreCounts: GenreCounts
  initialGenreTimes: GenreTimes
  initialSeenPostIds: Set<string>
  isLocked: boolean
  isPaused: boolean
  posts: Post[] | null
  scrollRef: ScrollContainerRef
}

const REGULAR_POST_SELECTOR = "[data-regular-post-id]"

export function useFeedTiming({
  headerRef,
  initialGenreCounts,
  initialGenreTimes,
  initialSeenPostIds,
  isLocked,
  isPaused,
  posts,
  scrollRef,
}: UseFeedTimingArgs) {
  const [genreTimes, setGenreTimes] = useState<GenreTimes>(initialGenreTimes)
  const [genreCounts, setGenreCounts] = useState<GenreCounts>(initialGenreCounts)
  const genreMapRef = useRef<Map<string, GenreKey>>(new Map())
  const genreTimesRef = useRef<GenreTimes>(genreTimes)
  const genreCountsRef = useRef<GenreCounts>(genreCounts)
  const seenPostIdsRef = useRef<Set<string>>(initialSeenPostIds)
  const activePostIdRef = useRef<string | null>(null)
  const activePostStartedAtRef = useRef<number | null>(null)
  const pendingActiveStartedAtRef = useRef<number | null>(null)
  const evaluationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    genreTimesRef.current = genreTimes
  }, [genreTimes])

  useEffect(() => {
    genreCountsRef.current = genreCounts
  }, [genreCounts])

  const commitActivePostDuration = useCallback((now = Date.now()) => {
    const activePostId = activePostIdRef.current
    const activePostStartedAt = activePostStartedAtRef.current

    if (!activePostId || activePostStartedAt === null) {
      return genreTimesRef.current
    }

    const genre = genreMapRef.current.get(activePostId)
    if (!genre) {
      activePostStartedAtRef.current = now
      return genreTimesRef.current
    }

    const duration = Math.max(0, now - activePostStartedAt)
    if (duration === 0) {
      activePostStartedAtRef.current = now
      return genreTimesRef.current
    }

    const nextGenreTimes = {
      ...genreTimesRef.current,
      [genre]: genreTimesRef.current[genre] + duration,
    }

    genreTimesRef.current = nextGenreTimes
    activePostStartedAtRef.current = now
    setGenreTimes(nextGenreTimes)

    return nextGenreTimes
  }, [])

  const finalizeAttributedTiming = useCallback(() => {
    const nextGenreTimes = commitActivePostDuration()
    activePostIdRef.current = null
    activePostStartedAtRef.current = null
    pendingActiveStartedAtRef.current = null
    return nextGenreTimes
  }, [commitActivePostDuration])

  useEffect(() => {
    genreMapRef.current = new Map((posts ?? []).map((post) => [post.id, post.genre] as const))

    if (isLocked || isPaused) {
      if (activePostIdRef.current && activePostStartedAtRef.current !== null) {
        commitActivePostDuration()
      }
      activePostIdRef.current = null
      activePostStartedAtRef.current = null
      pendingActiveStartedAtRef.current = null
      return
    }

    if (
      posts &&
      posts.length > 0 &&
      !activePostIdRef.current &&
      activePostStartedAtRef.current === null
    ) {
      pendingActiveStartedAtRef.current = Date.now()
    }
  }, [commitActivePostDuration, isLocked, isPaused, posts])

  const findDominantPostId = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const containerRect = getFeedViewportRect(container)
    const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? containerRect.top
    const viewportTop = Math.max(containerRect.top, headerBottom)
    const viewportBottom = containerRect.bottom
    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)

    let bestPostId: string | null = null
    let bestVisibleArea = 0
    let bestTop = Number.POSITIVE_INFINITY

    postElements.forEach((element) => {
      const rect = element.getBoundingClientRect()
      const visibleTop = Math.max(rect.top, viewportTop)
      const visibleBottom = Math.min(rect.bottom, viewportBottom)
      const visibleHeight = visibleBottom - visibleTop

      if (visibleHeight <= 0) {
        return
      }

      const visibleArea = visibleHeight * Math.max(rect.width, 1)
      const postId = element.getAttribute("data-regular-post-id")
      if (!postId) {
        return
      }

      if (
        visibleArea > bestVisibleArea ||
        (visibleArea === bestVisibleArea && rect.top < bestTop)
      ) {
        bestPostId = postId
        bestVisibleArea = visibleArea
        bestTop = rect.top
      }
    })

    return bestPostId
  }, [headerRef, scrollRef])

  const scheduleActivePostEvaluation = useCallback(() => {
    if (!posts || isLocked || isPaused) {
      return
    }

    if (evaluationFrameRef.current !== null) {
      return
    }

    evaluationFrameRef.current = window.requestAnimationFrame(() => {
      evaluationFrameRef.current = null

      const nextPostId = findDominantPostId()
      if (!nextPostId) {
        return
      }

      const currentPostId = activePostIdRef.current
      if (currentPostId === nextPostId) {
        return
      }

      const now = Date.now()

      if (currentPostId) {
        commitActivePostDuration(now)
      }

      // Track unique post views per genre for content count analytics.
      // A post is counted once when it first becomes the dominant post.
      if (!seenPostIdsRef.current.has(nextPostId)) {
        seenPostIdsRef.current.add(nextPostId)
        const nextPostGenre = genreMapRef.current.get(nextPostId)
        if (nextPostGenre) {
          const nextGenreCounts = {
            ...genreCountsRef.current,
            [nextPostGenre]: genreCountsRef.current[nextPostGenre] + 1,
          }
          genreCountsRef.current = nextGenreCounts
          setGenreCounts(nextGenreCounts)
        }
      }

      activePostIdRef.current = nextPostId
      activePostStartedAtRef.current = currentPostId
        ? now
        : pendingActiveStartedAtRef.current ?? now
      pendingActiveStartedAtRef.current = null
    })
  }, [commitActivePostDuration, findDominantPostId, isLocked, isPaused, posts])

  useEffect(() => {
    if (!posts || isLocked || isPaused) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const handlePositionChange = () => {
      scheduleActivePostEvaluation()
    }

    scheduleActivePostEvaluation()
    const removeFeedScrollListener = addFeedScrollListener(container, handlePositionChange)
    window.addEventListener("resize", handlePositionChange)

    return () => {
      removeFeedScrollListener()
      window.removeEventListener("resize", handlePositionChange)

      if (evaluationFrameRef.current !== null) {
        window.cancelAnimationFrame(evaluationFrameRef.current)
        evaluationFrameRef.current = null
      }
    }
  }, [isLocked, isPaused, posts, scheduleActivePostEvaluation, scrollRef])

  return {
    commitActivePostDuration,
    finalizeAttributedTiming,
    genreCounts,
    genreCountsRef,
    genreTimes,
    genreTimesRef,
    scheduleActivePostEvaluation,
    seenPostIdsRef,
  }
}
