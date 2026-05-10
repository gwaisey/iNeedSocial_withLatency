import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react"
import type { VideoPreloadRank } from "../utils/video-preload-budget"
import { getVideoNetworkPreloadPolicy } from "../utils/video-network-policy"
import {
  isDirectVideoFileSource,
  VIDEO_READY_STATE_CURRENT_DATA,
  VIDEO_SOURCE_IMMEDIATE_DETACH_DISTANCE_PX,
} from "./auto-play-video-config"
import {
  reportVideoLoadIssue,
  useVideoSourceLifecycleReset,
} from "./auto-play-video-lifecycle"
import { useDirectVideoWarmup } from "./auto-play-video-warmup"

export type VideoLoadIssueContext = {
  distanceToViewport: number
  isActive: boolean
  isInViewport: boolean
  isMuted: boolean
  isVisible: boolean
}

type UseAutoPlayVideoSourceArgs = {
  autoPreloadRank: VideoPreloadRank
  canUseAutoPreload: boolean
  distanceToViewport: number
  hasPendingPlayAttemptRef: MutableRefObject<boolean>
  hasVideoSource: boolean
  isInViewport: boolean
  isNearViewport: boolean
  isPlaybackVisible: boolean
  isVisible: boolean
  lastReportedLoadIssueRef: MutableRefObject<string | null>
  loadIssueContextRef: MutableRefObject<VideoLoadIssueContext>
  resolvedSrc?: string
  setAutoPreloadRank: Dispatch<SetStateAction<VideoPreloadRank>>
  setIsPlaybackOwner: Dispatch<SetStateAction<boolean>>
  setShouldMountVideo: Dispatch<SetStateAction<boolean>>
  shouldMountVideo: boolean
  videoRef: RefObject<HTMLVideoElement | null>
}

export function useAutoPlayVideoSource({
  autoPreloadRank,
  canUseAutoPreload,
  distanceToViewport,
  hasPendingPlayAttemptRef,
  hasVideoSource,
  isInViewport,
  isNearViewport,
  isPlaybackVisible,
  isVisible,
  lastReportedLoadIssueRef,
  loadIssueContextRef,
  resolvedSrc,
  setAutoPreloadRank,
  setIsPlaybackOwner,
  setShouldMountVideo,
  shouldMountVideo,
  videoRef,
}: UseAutoPlayVideoSourceArgs) {
  const sourceCleanupRef = useRef<(() => void) | null>(null)
  const detachSourceTimeoutRef = useRef<number | null>(null)
  const hasIssuedLoadHintRef = useRef(false)
  const hasIssuedVisibleLoadHintRef = useRef(false)
  const shouldAggressivelyLoadSourceRef = useRef(false)
  const [hasAttachedSource, setHasAttachedSource] = useState(false)
  const [hasConnectedPlaybackSource, setHasConnectedPlaybackSource] = useState(false)
  const preloadPolicy = getVideoNetworkPreloadPolicy()
  const aggressiveAutoLoadMaxRank = preloadPolicy.aggressiveAutoLoadMaxRank
  const sourceDetachGraceMs = preloadPolicy.sourceDetachGraceMs
  const shouldConnectVideoSource =
    hasVideoSource &&
    (shouldMountVideo ||
      canUseAutoPreload ||
      isNearViewport ||
      isInViewport ||
      isVisible ||
      isPlaybackVisible)

  useVideoSourceLifecycleReset({
    normalizedSrc: resolvedSrc,
    setAutoPreloadRank,
    setHasAttachedSource,
    setIsPlaybackOwner,
    setShouldMountVideo,
    shouldResetViewportDataRef: hasPendingPlayAttemptRef,
    shouldResetWarmupRef: hasPendingPlayAttemptRef,
  })

  const shouldAggressivelyLoadSource =
    hasVideoSource &&
    shouldConnectVideoSource &&
    (isInViewport ||
      isPlaybackVisible ||
      (autoPreloadRank !== null && autoPreloadRank <= aggressiveAutoLoadMaxRank))
  const shouldKeepAttachedSource =
    hasAttachedSource && (isInViewport || isVisible || canUseAutoPreload)

  const shouldRenderVideoSource =
    hasVideoSource &&
    shouldConnectVideoSource &&
    (shouldKeepAttachedSource || canUseAutoPreload || isNearViewport || isInViewport || isVisible)

  useLayoutEffect(() => {
    shouldAggressivelyLoadSourceRef.current = shouldAggressivelyLoadSource
  }, [shouldAggressivelyLoadSource])

  useDirectVideoWarmup({
    enabled:
      shouldConnectVideoSource &&
      isDirectVideoFileSource(resolvedSrc) &&
      (canUseAutoPreload || isNearViewport || isInViewport || isVisible),
    src: resolvedSrc,
  })

  useLayoutEffect(() => {
    if (!shouldRenderVideoSource || hasAttachedSource) {
      return
    }

    if (detachSourceTimeoutRef.current !== null) {
      window.clearTimeout(detachSourceTimeoutRef.current)
      detachSourceTimeoutRef.current = null
    }
    setHasAttachedSource(true)
  }, [hasAttachedSource, shouldRenderVideoSource])

  useEffect(() => {
    const clearScheduledSourceDetach = () => {
      if (detachSourceTimeoutRef.current === null) {
        return
      }

      window.clearTimeout(detachSourceTimeoutRef.current)
      detachSourceTimeoutRef.current = null
    }

    const detachPlaybackSource = () => {
      clearScheduledSourceDetach()
      hasPendingPlayAttemptRef.current = false
      hasIssuedLoadHintRef.current = false
      hasIssuedVisibleLoadHintRef.current = false
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
      setHasConnectedPlaybackSource(false)
      setHasAttachedSource(false)
    }

    if (shouldRenderVideoSource) {
      clearScheduledSourceDetach()
      return
    }

    if (!hasAttachedSource) {
      return
    }

    const shouldDetachImmediately =
      !hasVideoSource ||
      !shouldConnectVideoSource ||
      (Number.isFinite(distanceToViewport) &&
        distanceToViewport >= VIDEO_SOURCE_IMMEDIATE_DETACH_DISTANCE_PX)

    if (shouldDetachImmediately) {
      detachPlaybackSource()
      return
    }

    if (sourceDetachGraceMs <= 0) {
      detachPlaybackSource()
      return
    }

    if (detachSourceTimeoutRef.current !== null) {
      return
    }

    detachSourceTimeoutRef.current = window.setTimeout(() => {
      detachSourceTimeoutRef.current = null
      detachPlaybackSource()
    }, sourceDetachGraceMs)
  }, [
    distanceToViewport,
    hasAttachedSource,
    hasPendingPlayAttemptRef,
    hasVideoSource,
    shouldConnectVideoSource,
    shouldMountVideo,
    shouldRenderVideoSource,
    sourceDetachGraceMs,
  ])

  useEffect(() => {
    if (detachSourceTimeoutRef.current !== null) {
      window.clearTimeout(detachSourceTimeoutRef.current)
      detachSourceTimeoutRef.current = null
    }
    sourceCleanupRef.current?.()
    sourceCleanupRef.current = null
    setHasConnectedPlaybackSource(false)
  }, [resolvedSrc])

  useEffect(() => {
    hasIssuedLoadHintRef.current = false
    hasIssuedVisibleLoadHintRef.current = false
  }, [resolvedSrc])

  useEffect(() => {
    return () => {
      if (detachSourceTimeoutRef.current !== null) {
        window.clearTimeout(detachSourceTimeoutRef.current)
        detachSourceTimeoutRef.current = null
      }
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const video = videoRef.current
    if (!video || !resolvedSrc || !hasAttachedSource) {
      return
    }

    sourceCleanupRef.current?.()
    sourceCleanupRef.current = null
    setHasConnectedPlaybackSource(false)

    if (!isDirectVideoFileSource(resolvedSrc)) {
      const context = loadIssueContextRef.current
      reportVideoLoadIssue({
        distanceToViewport: context.distanceToViewport,
        error: new Error("Video source is not a direct MP4 file."),
        isActive: context.isActive,
        isInViewport: context.isInViewport,
        isMuted: context.isMuted,
        isVisible: context.isVisible,
        lastReportedIssueRef: lastReportedLoadIssueRef,
        src: resolvedSrc,
        stage: context.isVisible ? "viewport" : context.isInViewport ? "near-viewport" : "prewarm",
      })
      return
    }

    const shouldAutoLoadNow = shouldAggressivelyLoadSourceRef.current
    hasIssuedVisibleLoadHintRef.current = false
    video.preload = shouldAutoLoadNow ? "auto" : "metadata"
    video.src = resolvedSrc
    if (shouldAutoLoadNow && video.readyState < VIDEO_READY_STATE_CURRENT_DATA) {
      hasIssuedLoadHintRef.current = true
      try {
        video.load()
      } catch {
        // Ignore browsers that disallow load() in certain lifecycle moments.
      }
    }

    setHasConnectedPlaybackSource(true)
    sourceCleanupRef.current = () => {
      video.pause()
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        // Ignore browsers that complain about detaching the current source.
      }
    }

    return () => {
      setHasConnectedPlaybackSource(false)
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
    }
  }, [
    hasAttachedSource,
    lastReportedLoadIssueRef,
    loadIssueContextRef,
    resolvedSrc,
    videoRef,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !hasVideoSource ||
      !hasConnectedPlaybackSource ||
      !shouldMountVideo ||
      !hasAttachedSource ||
      hasIssuedLoadHintRef.current
    ) {
      return
    }

    // Nudge the browser to start fetching bytes for the current or immediate next
    // playback candidate. Avoid auto-loading several offscreen videos at once because
    // browser media connection limits can delay the video the user reaches next.
    if (
      (autoPreloadRank === null || autoPreloadRank > aggressiveAutoLoadMaxRank) &&
      !isPlaybackVisible &&
      !isInViewport
    ) {
      return
    }

    if (!isDirectVideoFileSource(resolvedSrc)) {
      return
    }

    if (!video.paused || video.currentTime > 0) {
      return
    }

    if (video.readyState >= VIDEO_READY_STATE_CURRENT_DATA) {
      return
    }

    hasIssuedLoadHintRef.current = true
    video.preload = "auto"
    try {
      video.load()
    } catch {
      // Ignore browsers that disallow load() in certain lifecycle moments.
    }
  }, [
    autoPreloadRank,
    aggressiveAutoLoadMaxRank,
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasVideoSource,
    isInViewport,
    isPlaybackVisible,
    resolvedSrc,
    shouldMountVideo,
    videoRef,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !hasVideoSource ||
      !hasConnectedPlaybackSource ||
      !hasAttachedSource ||
      !isDirectVideoFileSource(resolvedSrc) ||
      hasIssuedVisibleLoadHintRef.current ||
      !video.paused ||
      video.readyState >= VIDEO_READY_STATE_CURRENT_DATA ||
      (!isPlaybackVisible && !isInViewport)
    ) {
      return
    }

    hasIssuedVisibleLoadHintRef.current = true
    video.preload = "auto"
    try {
      video.load()
    } catch {
      // Ignore browsers that disallow load() during a visibility transition.
    }
  }, [
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasVideoSource,
    isInViewport,
    isPlaybackVisible,
    resolvedSrc,
    videoRef,
  ])

  return {
    hasAttachedSource,
    hasConnectedPlaybackSource,
    shouldAggressivelyLoadSource,
    shouldRenderVideoSource,
  }
}
