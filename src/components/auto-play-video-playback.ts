import { useEffect, useRef, type MutableRefObject, type RefObject } from "react"
import {
  VIDEO_FOCUSED_PLAYBACK_RESCUE_DELAY_MS,
  VIDEO_READY_STATE_CURRENT_DATA,
} from "./auto-play-video-config"
import { syncVideoMutedState } from "./auto-play-video-readiness"
import {
  classifyVideoPlayError,
  reportVideoPlayIssue,
} from "./auto-play-video-lifecycle"
import { getVideoPlaybackDecision } from "./auto-play-video-state"

type UseAutoPlayVideoPlaybackArgs = {
  distanceToViewport: number
  hasAttachedSource: boolean
  hasConnectedPlaybackSource: boolean
  hasLoadedFrame: boolean
  hasPendingPlayAttemptRef: MutableRefObject<boolean>
  isActive: boolean
  isInViewport: boolean
  isMuted: boolean
  isPlaybackOwner: boolean
  isPlaybackVisible: boolean
  isVisible: boolean
  lastReportedPlayIssueRef: MutableRefObject<string | null>
  queueFrameReady: (video: HTMLVideoElement) => void
  resolvedSrc?: string
  videoRef: RefObject<HTMLVideoElement | null>
}

function attemptVisibleVideoPlayback({
  distanceToViewport,
  forceLoad,
  hasLoadedFrame,
  hasPendingPlayAttemptRef,
  isActive,
  isInViewport,
  isMuted,
  isVisible,
  lastReportedPlayIssueRef,
  queueFrameReady,
  resolvedSrc,
  video,
}: {
  readonly distanceToViewport: number
  readonly forceLoad: boolean
  readonly hasLoadedFrame: boolean
  readonly hasPendingPlayAttemptRef: MutableRefObject<boolean>
  readonly isActive: boolean
  readonly isInViewport: boolean
  readonly isMuted: boolean
  readonly isVisible: boolean
  readonly lastReportedPlayIssueRef: MutableRefObject<string | null>
  readonly queueFrameReady: (video: HTMLVideoElement) => void
  readonly resolvedSrc?: string
  readonly video: HTMLVideoElement
}) {
  const shouldRequestLoad =
    video.readyState < VIDEO_READY_STATE_CURRENT_DATA &&
    (forceLoad || video.networkState !== HTMLMediaElement.NETWORK_LOADING)

  if (shouldRequestLoad) {
    video.preload = "auto"
    try {
      video.load()
    } catch {
      // Ignore browsers that disallow load() during a playback transition.
    }
  }

  if (hasPendingPlayAttemptRef.current) {
    if (!forceLoad || !video.paused) {
      return false
    }

    hasPendingPlayAttemptRef.current = false
  }

  const shouldStartMuted = !isMuted
  if (shouldStartMuted) {
    video.defaultMuted = true
    video.muted = true
    video.volume = 0
  }

  hasPendingPlayAttemptRef.current = true
  const playPromise = video.play()
  if (!playPromise || typeof playPromise.then !== "function") {
    hasPendingPlayAttemptRef.current = false
    return true
  }

  void playPromise
    .then(() => {
      hasPendingPlayAttemptRef.current = false
      if (!hasLoadedFrame) {
        queueFrameReady(video)
      }

      if (!shouldStartMuted) {
        return
      }

      syncVideoMutedState(video, isMuted)
    })
    .catch((error) => {
      hasPendingPlayAttemptRef.current = false
      reportVideoPlayIssue({
        classification: classifyVideoPlayError(error),
        distanceToViewport,
        error,
        isActive,
        isInViewport,
        isMuted,
        isVisible,
        lastReportedIssueRef: lastReportedPlayIssueRef,
        src: resolvedSrc,
      })
    })

  return true
}

export function useAutoPlayVideoPlayback({
  distanceToViewport,
  hasAttachedSource,
  hasConnectedPlaybackSource,
  hasLoadedFrame,
  hasPendingPlayAttemptRef,
  isActive,
  isInViewport,
  isMuted,
  isPlaybackOwner,
  isPlaybackVisible,
  isVisible,
  lastReportedPlayIssueRef,
  queueFrameReady,
  resolvedSrc,
  videoRef,
}: UseAutoPlayVideoPlaybackArgs) {
  const rescueAttemptedRef = useRef(false)
  const rescueTimeoutRef = useRef<number | null>(null)
  const shouldRescueFocusedPlayback =
    isActive &&
    isPlaybackOwner &&
    isPlaybackVisible &&
    hasAttachedSource &&
    hasConnectedPlaybackSource
  const shouldAutoplayVisibleVideo =
    isMuted && isActive && isPlaybackOwner && isPlaybackVisible && hasConnectedPlaybackSource

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    syncVideoMutedState(video, isMuted)
  }, [isMuted, videoRef])

  useEffect(() => {
    rescueAttemptedRef.current = false

    if (rescueTimeoutRef.current !== null) {
      window.clearTimeout(rescueTimeoutRef.current)
      rescueTimeoutRef.current = null
    }
  }, [resolvedSrc])

  useEffect(() => {
    if (shouldRescueFocusedPlayback) {
      return
    }

    rescueAttemptedRef.current = false
    if (rescueTimeoutRef.current !== null) {
      window.clearTimeout(rescueTimeoutRef.current)
      rescueTimeoutRef.current = null
    }
  }, [shouldRescueFocusedPlayback])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasAttachedSource) {
      return
    }

    const playbackDecision = getVideoPlaybackDecision({
      currentTime: video.currentTime,
      distanceToViewport,
      isActive,
      isInViewport,
      isPlaybackOwner,
      isPaused: video.paused,
      isVisible: isPlaybackVisible,
    })

    if (playbackDecision.shouldPause) {
      hasPendingPlayAttemptRef.current = false
      video.pause()
    }

    if (playbackDecision.shouldReset) {
      try {
        video.currentTime = 0
      } catch {
        // Ignore browsers that disallow currentTime changes before metadata loads.
      }
    }

    if (!hasConnectedPlaybackSource || !playbackDecision.shouldPlay || !video.paused) {
      return
    }

    attemptVisibleVideoPlayback({
      distanceToViewport,
      forceLoad: false,
      hasLoadedFrame,
      hasPendingPlayAttemptRef,
      isActive,
      isInViewport,
      isMuted,
      isVisible,
      lastReportedPlayIssueRef,
      queueFrameReady,
      resolvedSrc,
      video,
    })
  }, [
    distanceToViewport,
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasLoadedFrame,
    hasPendingPlayAttemptRef,
    isActive,
    isInViewport,
    isMuted,
    isPlaybackOwner,
    isPlaybackVisible,
    isVisible,
    lastReportedPlayIssueRef,
    queueFrameReady,
    resolvedSrc,
    shouldRescueFocusedPlayback,
    videoRef,
  ])

  useEffect(() => {
    const video = videoRef.current

    if (
      !video ||
      !shouldRescueFocusedPlayback ||
      rescueAttemptedRef.current ||
      rescueTimeoutRef.current !== null
    ) {
      return
    }

    const startTime = video.currentTime
    rescueTimeoutRef.current = window.setTimeout(() => {
      rescueTimeoutRef.current = null

      const currentVideo = videoRef.current
      if (!currentVideo || !shouldRescueFocusedPlayback || rescueAttemptedRef.current) {
        return
      }

      const hasStartedProgressing =
        !currentVideo.paused &&
        currentVideo.readyState >= VIDEO_READY_STATE_CURRENT_DATA &&
        currentVideo.currentTime > startTime + 0.02

      if (hasStartedProgressing) {
        return
      }

      rescueAttemptedRef.current = true
      if (!currentVideo.paused && currentVideo.readyState >= VIDEO_READY_STATE_CURRENT_DATA) {
        return
      }

      attemptVisibleVideoPlayback({
        distanceToViewport,
        forceLoad: true,
        hasLoadedFrame,
        hasPendingPlayAttemptRef,
        isActive,
        isInViewport,
        isMuted,
        isVisible,
        lastReportedPlayIssueRef,
        queueFrameReady,
        resolvedSrc,
        video: currentVideo,
      })
    }, VIDEO_FOCUSED_PLAYBACK_RESCUE_DELAY_MS)

    return () => {
      if (rescueTimeoutRef.current !== null) {
        window.clearTimeout(rescueTimeoutRef.current)
        rescueTimeoutRef.current = null
      }
    }
  }, [
    distanceToViewport,
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasLoadedFrame,
    hasPendingPlayAttemptRef,
    isActive,
    isInViewport,
    isMuted,
    isPlaybackOwner,
    isPlaybackVisible,
    isVisible,
    lastReportedPlayIssueRef,
    queueFrameReady,
    resolvedSrc,
    shouldRescueFocusedPlayback,
    videoRef,
  ])

  return {
    shouldAutoplayVisibleVideo,
  }
}
