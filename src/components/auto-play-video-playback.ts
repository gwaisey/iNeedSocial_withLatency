import { useEffect, type MutableRefObject, type RefObject } from "react"
import { VIDEO_READY_STATE_CURRENT_DATA } from "./auto-play-video-config"
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

    if (video.readyState < VIDEO_READY_STATE_CURRENT_DATA) {
      video.preload = "auto"
      try {
        video.load()
      } catch {
        // Ignore browsers that disallow load() during a playback transition.
      }
    }

    if (hasPendingPlayAttemptRef.current) {
      return
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
      return
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
    videoRef,
  ])

  return {
    shouldAutoplayVisibleVideo,
  }
}
