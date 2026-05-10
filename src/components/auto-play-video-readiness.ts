import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  type SyntheticEvent,
} from "react"
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  getKnownVideoAspectRatio,
  rememberVideoAspectRatio,
  VIDEO_REVEAL_PLAYBACK_PROGRESS_S,
  VIDEO_READY_STATE_CURRENT_DATA,
} from "./auto-play-video-config"
import { scheduleFirstRenderableVideoFrame } from "./auto-play-video-frame"
import { buildVideoAspectRatio } from "./auto-play-video-state"

function clearQueuedVideoFrame(
  frameReadyCleanupRef: MutableRefObject<(() => void) | null>,
  hasQueuedFrameReadyRef: MutableRefObject<boolean>
) {
  frameReadyCleanupRef.current?.()
  frameReadyCleanupRef.current = null
  hasQueuedFrameReadyRef.current = false
}

function waitForPlaybackProgress(
  video: HTMLVideoElement,
  onReady: () => void
) {
  let cancelled = false
  let animationFrameId: number | null = null

  const checkPlaybackProgress = () => {
    if (cancelled) {
      return
    }

    if (video.currentTime >= VIDEO_REVEAL_PLAYBACK_PROGRESS_S) {
      cancelled = true
      onReady()
      return
    }

    animationFrameId = window.requestAnimationFrame(checkPlaybackProgress)
  }

  checkPlaybackProgress()

  return () => {
    cancelled = true

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
    }
  }
}

function canRevealVideoSurface(video: HTMLVideoElement) {
  return !video.paused || video.currentTime > 0
}

function ensureVideoFrameReady({
  frameReadyCleanupRef,
  hasQueuedFrameReadyRef,
  setHasLoadedFrame,
  video,
}: {
  readonly frameReadyCleanupRef: MutableRefObject<(() => void) | null>
  readonly hasQueuedFrameReadyRef: MutableRefObject<boolean>
  readonly setHasLoadedFrame: Dispatch<SetStateAction<boolean>>
  readonly video: HTMLVideoElement
}) {
  if (hasQueuedFrameReadyRef.current) {
    return
  }

  hasQueuedFrameReadyRef.current = true
  frameReadyCleanupRef.current?.()
  frameReadyCleanupRef.current = scheduleFirstRenderableVideoFrame(video, () => {
    frameReadyCleanupRef.current = waitForPlaybackProgress(video, () => {
      frameReadyCleanupRef.current = null
      hasQueuedFrameReadyRef.current = false
      setHasLoadedFrame(true)
    })
  })
}

export function syncVideoMutedState(video: HTMLVideoElement, isMuted: boolean) {
  video.defaultMuted = isMuted
  video.muted = isMuted
  video.volume = isMuted ? 0 : 1
}

export function useVideoReadinessState({
  hasVideoSource,
  isSourceConnected,
  lastReportedLoadIssueRef,
  lastReportedPlayIssueRef,
  normalizedSrc,
  onLoadedMetadata,
  posterSrc,
  shouldMountVideo,
  videoRef,
}: {
  readonly hasVideoSource: boolean
  readonly isSourceConnected: boolean
  readonly lastReportedLoadIssueRef: MutableRefObject<string | null>
  readonly lastReportedPlayIssueRef: MutableRefObject<string | null>
  readonly normalizedSrc?: string
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly posterSrc?: string
  readonly shouldMountVideo: boolean
  readonly videoRef: RefObject<HTMLVideoElement | null>
}) {
  const frameReadyCleanupRef = useRef<(() => void) | null>(null)
  const hasQueuedFrameReadyRef = useRef(false)
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [shellAspectRatio, setShellAspectRatio] = useState(
    () => getKnownVideoAspectRatio(normalizedSrc, posterSrc) ?? DEFAULT_VIDEO_ASPECT_RATIO
  )

  useEffect(() => {
    return () => {
      clearQueuedVideoFrame(frameReadyCleanupRef, hasQueuedFrameReadyRef)
    }
  }, [])

  useEffect(() => {
    clearQueuedVideoFrame(frameReadyCleanupRef, hasQueuedFrameReadyRef)
    setHasLoadedFrame(false)
    lastReportedLoadIssueRef.current = null
    lastReportedPlayIssueRef.current = null
    setShellAspectRatio(
      getKnownVideoAspectRatio(normalizedSrc, posterSrc) ?? DEFAULT_VIDEO_ASPECT_RATIO
    )
  }, [lastReportedLoadIssueRef, lastReportedPlayIssueRef, normalizedSrc, posterSrc])

  useEffect(() => {
    if (isSourceConnected) {
      return
    }

    clearQueuedVideoFrame(frameReadyCleanupRef, hasQueuedFrameReadyRef)
    setHasLoadedFrame(false)
  }, [isSourceConnected])

  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !hasVideoSource ||
      !shouldMountVideo ||
      hasLoadedFrame ||
      video.readyState < VIDEO_READY_STATE_CURRENT_DATA ||
      !canRevealVideoSurface(video)
    ) {
      return
    }

    ensureVideoFrameReady({
      frameReadyCleanupRef,
      hasQueuedFrameReadyRef,
      setHasLoadedFrame,
      video,
    })
  }, [hasLoadedFrame, hasVideoSource, shouldMountVideo, videoRef])

  const handleLoadedData = (event: SyntheticEvent<HTMLVideoElement>) => {
    if (!canRevealVideoSurface(event.currentTarget)) {
      return
    }

    ensureVideoFrameReady({
      frameReadyCleanupRef,
      hasQueuedFrameReadyRef,
      setHasLoadedFrame,
      video: event.currentTarget,
    })
  }

  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const nextAspectRatio = buildVideoAspectRatio({
      videoHeight: event.currentTarget.videoHeight,
      videoWidth: event.currentTarget.videoWidth,
    })

    if (nextAspectRatio && !getKnownVideoAspectRatio(normalizedSrc, posterSrc)) {
      rememberVideoAspectRatio(normalizedSrc, nextAspectRatio)
      setShellAspectRatio(nextAspectRatio)
    }

    onLoadedMetadata?.(event)
  }

  const handlePosterLoad = (image: HTMLImageElement) => {
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return
    }

    const nextAspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`
    rememberVideoAspectRatio(normalizedSrc, nextAspectRatio)
    setShellAspectRatio(nextAspectRatio)
  }

  return {
    handleLoadedData,
    handleLoadedMetadata,
    handlePosterLoad,
    hasLoadedFrame,
    lastReportedLoadIssueRef,
    lastReportedPlayIssueRef,
    queueFrameReady: (video: HTMLVideoElement) => {
      ensureVideoFrameReady({
        frameReadyCleanupRef,
        hasQueuedFrameReadyRef,
        setHasLoadedFrame,
        video,
      })
    },
    shellAspectRatio,
  }
}
