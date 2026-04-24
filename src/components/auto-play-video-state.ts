import {
  VIDEO_EARLY_LOAD_DISTANCE_PX,
  VIDEO_PLAY_HANDOFF_VISIBLE_RATIO,
  VIDEO_PLAY_START_VISIBLE_RATIO,
  VIDEO_PLAY_STOP_VISIBLE_RATIO,
  VIDEO_READY_STATE_CURRENT_DATA,
  VIDEO_READY_STATE_FUTURE_DATA,
  VIDEO_RESET_DISTANCE_PX,
} from "./auto-play-video-config"

export type VideoViewportState = {
  readonly centerOffset: number
  readonly distanceToViewport: number
  readonly isInViewport: boolean
  readonly isVisible: boolean
  readonly visibleFraction: number
}

export type VideoPlaybackDecision = {
  readonly shouldPause: boolean
  readonly shouldPlay: boolean
  readonly shouldReset: boolean
}

export type VideoScrollDirection = "down" | "none" | "up"

export function getDistanceToViewport(
  rootTop: number,
  rootBottom: number,
  targetTop: number,
  targetBottom: number
) {
  if (targetBottom < rootTop) {
    return rootTop - targetBottom
  }

  if (targetTop > rootBottom) {
    return targetTop - rootBottom
  }

  return 0
}

export function getViewportOverlapHeight(
  rootTop: number,
  rootBottom: number,
  targetTop: number,
  targetBottom: number
) {
  return Math.max(0, Math.min(targetBottom, rootBottom) - Math.max(targetTop, rootTop))
}

export function getViewportBounds(root: HTMLElement | null) {
  if (!root) {
    return { bottom: window.innerHeight, top: 0 }
  }

  const rect = root.getBoundingClientRect()
  return { bottom: rect.bottom, top: rect.top }
}

function getViewportCenterOffset(
  rootTop: number,
  rootBottom: number,
  targetTop: number,
  targetBottom: number
) {
  const rootCenter = (rootTop + rootBottom) / 2
  const targetCenter = (targetTop + targetBottom) / 2
  return Math.abs(targetCenter - rootCenter)
}

function getViewportVisibleFraction(
  overlapHeight: number,
  rootTop: number,
  rootBottom: number,
  targetTop: number,
  targetBottom: number
) {
  const rootHeight = Math.max(0, rootBottom - rootTop)
  const targetHeight = Math.max(0, targetBottom - targetTop)
  const maxVisibleHeight = Math.min(rootHeight, targetHeight)

  if (maxVisibleHeight <= 0) {
    return 0
  }

  return Math.min(1, overlapHeight / maxVisibleHeight)
}

export function deriveVideoViewportState({
  rootBottom,
  rootTop,
  targetBottom,
  targetTop,
  wasVisible,
}: {
  readonly rootBottom: number
  readonly rootTop: number
  readonly targetBottom: number
  readonly targetTop: number
  readonly wasVisible: boolean
}): VideoViewportState {
  const overlapHeight = getViewportOverlapHeight(rootTop, rootBottom, targetTop, targetBottom)
  const distanceToViewport = getDistanceToViewport(rootTop, rootBottom, targetTop, targetBottom)
  const visibleFraction = getViewportVisibleFraction(
    overlapHeight,
    rootTop,
    rootBottom,
    targetTop,
    targetBottom
  )
  const requiredVisibleFraction = wasVisible
    ? VIDEO_PLAY_STOP_VISIBLE_RATIO
    : VIDEO_PLAY_START_VISIBLE_RATIO

  return {
    centerOffset: getViewportCenterOffset(rootTop, rootBottom, targetTop, targetBottom),
    distanceToViewport,
    isInViewport: overlapHeight > 0,
    isVisible: overlapHeight > 0 && visibleFraction >= requiredVisibleFraction,
    visibleFraction,
  }
}

export function getVideoPlaybackDecision({
  currentTime,
  distanceToViewport,
  isActive,
  isInViewport,
  isPlaybackOwner,
  isPaused,
  isVisible,
}: {
  readonly currentTime: number
  readonly distanceToViewport: number
  readonly isActive: boolean
  readonly isInViewport: boolean
  readonly isPlaybackOwner: boolean
  readonly isPaused: boolean
  readonly isVisible: boolean
}): VideoPlaybackDecision {
  if (!isActive) {
    return {
      shouldPause: true,
      shouldPlay: false,
      shouldReset: currentTime > 0,
    }
  }

  if (!isInViewport) {
    return {
      shouldPause: true,
      shouldPlay: false,
      shouldReset: distanceToViewport >= VIDEO_RESET_DISTANCE_PX && currentTime > 0,
    }
  }

  if (!isVisible) {
    return {
      shouldPause: true,
      shouldPlay: false,
      shouldReset: false,
    }
  }

  if (!isPlaybackOwner) {
    return {
      shouldPause: true,
      shouldPlay: false,
      shouldReset: false,
    }
  }

  return {
    shouldPause: false,
    shouldPlay: isPaused,
    shouldReset: false,
  }
}

export function shouldEnsureViewportData({
  hasEnsuredViewportData,
  isInViewport,
  isPaused,
  readyState,
}: {
  readonly hasEnsuredViewportData: boolean
  readonly isInViewport: boolean
  readonly isPaused: boolean
  readonly readyState: number
}) {
  return (
    isInViewport &&
    !hasEnsuredViewportData &&
    readyState < VIDEO_READY_STATE_CURRENT_DATA &&
    isPaused
  )
}

export function shouldForceAutoPreload({
  canUseAutoPreload,
  hasForcedPreload,
  isInViewport,
  isVisible,
  readyState,
}: {
  readonly canUseAutoPreload: boolean
  readonly hasForcedPreload: boolean
  readonly isInViewport: boolean
  readonly isVisible: boolean
  readonly readyState: number
}) {
  return (
    canUseAutoPreload &&
    !hasForcedPreload &&
    !isInViewport &&
    !isVisible &&
    readyState < VIDEO_READY_STATE_FUTURE_DATA
  )
}

export function shouldAttachVideoSource({
  canUseAutoPreload,
  hasAttachedSource,
  isInViewport,
  isNearViewport,
  isVisible,
}: {
  readonly canUseAutoPreload: boolean
  readonly hasAttachedSource: boolean
  readonly isInViewport: boolean
  readonly isNearViewport: boolean
  readonly isVisible: boolean
}) {
  return hasAttachedSource || canUseAutoPreload || isNearViewport || isInViewport || isVisible
}

export function shouldEarlyLoadNearViewport({
  distanceToViewport,
  hasLoadedFrame,
  isActive,
  readyState,
}: {
  readonly distanceToViewport: number
  readonly hasLoadedFrame: boolean
  readonly isActive: boolean
  readonly readyState: number
}) {
  return (
    isActive &&
    !hasLoadedFrame &&
    Number.isFinite(distanceToViewport) &&
    distanceToViewport <= VIDEO_EARLY_LOAD_DISTANCE_PX &&
    readyState < VIDEO_READY_STATE_CURRENT_DATA
  )
}

export function shouldPromoteForwardPlaybackHandoff({
  isInViewport,
  rootTop,
  scrollDirection,
  targetTop,
  visibleFraction,
}: {
  readonly isInViewport: boolean
  readonly rootTop: number
  readonly scrollDirection: VideoScrollDirection
  readonly targetTop: number
  readonly visibleFraction: number
}) {
  return (
    scrollDirection === "down" &&
    isInViewport &&
    targetTop >= rootTop &&
    visibleFraction >= VIDEO_PLAY_HANDOFF_VISIBLE_RATIO
  )
}

export function getVideoPlaybackPriority({
  centerOffset,
  isForwardHandoffCandidate,
  visibleFraction,
}: {
  readonly centerOffset: number
  readonly isForwardHandoffCandidate: boolean
  readonly visibleFraction: number
}) {
  if (isForwardHandoffCandidate && visibleFraction >= VIDEO_PLAY_START_VISIBLE_RATIO) {
    return -1
  }

  return centerOffset
}

export function buildVideoAspectRatio({
  videoHeight,
  videoWidth,
}: {
  readonly videoHeight: number
  readonly videoWidth: number
}) {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return null
  }

  return `${videoWidth} / ${videoHeight}`
}
