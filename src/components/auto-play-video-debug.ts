import { useEffect, type RefObject } from "react"
import {
  appendVideoDebugEntry,
  getVideoDebugElementSnapshot,
  isVideoDebugEnabled,
  probeVideoDebugRange,
} from "../utils/video-debug-log"

const VIDEO_DEBUG_MEDIA_EVENTS = [
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "stalled",
  "suspend",
  "waiting",
] as const

type UseAutoPlayVideoDebugArgs = {
  readonly attachedVideoSource?: string
  readonly autoPreloadRank: number | null
  readonly canUseAutoPreload: boolean
  readonly hasAttachedSource: boolean
  readonly hasConnectedPlaybackSource: boolean
  readonly hasLoadedFrame: boolean
  readonly isActive: boolean
  readonly isInViewport: boolean
  readonly isMuted: boolean
  readonly isPlaybackOwner: boolean
  readonly isPlaybackVisible: boolean
  readonly isVisible: boolean
  readonly resolvedSrc?: string
  readonly shellRef: RefObject<HTMLElement | null>
  readonly shouldAggressivelyLoadSource: boolean
  readonly shouldAutoplayVisibleVideo: boolean
  readonly shouldMountVideo: boolean
  readonly shouldRenderVideoSource: boolean
  readonly src?: string
  readonly videoRef: RefObject<HTMLVideoElement | null>
}

function getDebugContext({
  shellRef,
  videoRef,
}: {
  readonly shellRef: RefObject<HTMLElement | null>
  readonly videoRef: RefObject<HTMLVideoElement | null>
}) {
  const video = videoRef.current
  if (!video) {
    return null
  }

  return getVideoDebugElementSnapshot(video, shellRef.current)
}

export function useAutoPlayVideoDebug({
  attachedVideoSource,
  autoPreloadRank,
  canUseAutoPreload,
  hasAttachedSource,
  hasConnectedPlaybackSource,
  hasLoadedFrame,
  isActive,
  isInViewport,
  isMuted,
  isPlaybackOwner,
  isPlaybackVisible,
  isVisible,
  resolvedSrc,
  shellRef,
  shouldAggressivelyLoadSource,
  shouldAutoplayVisibleVideo,
  shouldMountVideo,
  shouldRenderVideoSource,
  src,
  videoRef,
}: UseAutoPlayVideoDebugArgs) {
  useEffect(() => {
    if (!isVideoDebugEnabled()) {
      return
    }

    appendVideoDebugEntry("video-state", {
      attachedVideoSource,
      autoPreloadRank,
      canUseAutoPreload,
      hasAttachedSource,
      hasConnectedPlaybackSource,
      hasLoadedFrame,
      isActive,
      isInViewport,
      isMuted,
      isPlaybackOwner,
      isPlaybackVisible,
      isVisible,
      rawSrc: src,
      resolvedSrc,
      shouldAggressivelyLoadSource,
      shouldAutoplayVisibleVideo,
      shouldMountVideo,
      shouldRenderVideoSource,
      video: getDebugContext({ shellRef, videoRef }),
    })
  }, [
    attachedVideoSource,
    autoPreloadRank,
    canUseAutoPreload,
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasLoadedFrame,
    isActive,
    isInViewport,
    isMuted,
    isPlaybackOwner,
    isPlaybackVisible,
    isVisible,
    resolvedSrc,
    shellRef,
    shouldAggressivelyLoadSource,
    shouldAutoplayVisibleVideo,
    shouldMountVideo,
    shouldRenderVideoSource,
    src,
    videoRef,
  ])

  useEffect(() => {
    if (!attachedVideoSource || !isVideoDebugEnabled()) {
      return
    }

    probeVideoDebugRange(attachedVideoSource, {
      rawSrc: src,
      resolvedSrc,
      video: getDebugContext({ shellRef, videoRef }),
    })
  }, [attachedVideoSource, resolvedSrc, shellRef, src, videoRef])

  useEffect(() => {
    if (!isVideoDebugEnabled()) {
      return
    }

    const video = videoRef.current
    if (!video) {
      if (hasAttachedSource || shouldMountVideo || shouldRenderVideoSource) {
        appendVideoDebugEntry("media-listeners-missing-video", {
          attachedVideoSource,
          hasAttachedSource,
          rawSrc: src,
          resolvedSrc,
          shouldMountVideo,
          shouldRenderVideoSource,
        })
      }

      return
    }

    const handleMediaEvent = (event: Event) => {
      appendVideoDebugEntry(`media-${event.type}`, {
        attachedVideoSource,
        rawSrc: src,
        resolvedSrc,
        video: getVideoDebugElementSnapshot(video, shellRef.current),
      })
    }

    VIDEO_DEBUG_MEDIA_EVENTS.forEach((eventName) => {
      video.addEventListener(eventName, handleMediaEvent)
    })
    appendVideoDebugEntry("media-listeners-attached", {
      attachedVideoSource,
      rawSrc: src,
      resolvedSrc,
      video: getVideoDebugElementSnapshot(video, shellRef.current),
    })

    return () => {
      VIDEO_DEBUG_MEDIA_EVENTS.forEach((eventName) => {
        video.removeEventListener(eventName, handleMediaEvent)
      })
    }
  }, [
    attachedVideoSource,
    hasAttachedSource,
    resolvedSrc,
    shellRef,
    shouldMountVideo,
    shouldRenderVideoSource,
    src,
    videoRef,
  ])
}
