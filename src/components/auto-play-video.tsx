import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from "react"
import {
  getResolvedVideoSource,
  getVideoPosterSource,
} from "./auto-play-video-config"
import {
  useVideoCandidateLifecycle,
  useVideoPrewarmMount,
} from "./auto-play-video-lifecycle"
import { useVideoReadinessState } from "./auto-play-video-readiness"
import { useAutoPlayVideoPlayback } from "./auto-play-video-playback"
import { useAutoPlayVideoSource, type VideoLoadIssueContext } from "./auto-play-video-source"
import { useMountedVideoViewportState } from "./auto-play-video-viewport"

type AutoPlayVideoProps = {
  readonly className: string
  readonly canPrewarm?: boolean
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly onPosterLoad?: (image: HTMLImageElement) => void
  readonly placeholderClassName?: string
  readonly poster?: string
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly src?: string
}

export function AutoPlayVideo({
  className,
  canPrewarm = true,
  isActive = true,
  isMuted,
  onLoadedMetadata,
  onPosterLoad,
  placeholderClassName = "bg-ink/8",
  poster,
  shellClassName = "",
  skeletonClassName = "",
  scrollRootRef,
  src,
}: AutoPlayVideoProps) {
  const resolvedSrc = getResolvedVideoSource(src)
  const resolvedPoster = getVideoPosterSource(src, poster)
  const hasVideoSource = Boolean(resolvedSrc)
  const preloadCandidateId = useId()
  const playbackCandidateId = useId()
  const shellRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const loadIssueContextRef = useRef<VideoLoadIssueContext>({
    distanceToViewport: 0,
    isActive,
    isInViewport: false,
    isMuted,
    isVisible: false,
  })
  const hasPendingPlayAttemptRef = useRef(false)
  const lastReportedLoadIssueRef = useRef<string | null>(null)
  const lastReportedPlayIssueRef = useRef<string | null>(null)
  const [autoPreloadRank, setAutoPreloadRank] = useState<number | null>(null)
  const [isPlaybackOwner, setIsPlaybackOwner] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)
  const {
    distanceToViewport,
    isForwardHandoffCandidate,
    isInViewport,
    isNearViewport,
    isVisible,
    playbackPriority,
    preloadDirection,
    visibleFraction,
  } = useMountedVideoViewportState({
    hasVideoSource,
    scrollRootRef,
    shellRef,
    shouldMountVideo,
  })
  const isPlaybackVisible = isVisible || isForwardHandoffCandidate

  useEffect(() => {
    loadIssueContextRef.current = {
      distanceToViewport,
      isActive,
      isInViewport,
      isMuted,
      isVisible,
    }
  }, [distanceToViewport, isActive, isInViewport, isMuted, isVisible])

  useVideoCandidateLifecycle({
    canPrewarm,
    distanceToViewport,
    hasVideoSource,
    isActive,
    isVisible: isPlaybackVisible,
    playbackCandidateId,
    playbackPriority,
    playbackVisibilityScore: visibleFraction,
    preloadDirection,
    preloadCandidateId,
    setAutoPreloadRank,
    setIsPlaybackOwner,
    shouldMountVideo,
  })
  useVideoPrewarmMount({
    canPrewarm,
    hasVideoSource,
    scrollRootRef,
    setShouldMountVideo,
    shellRef,
  })
  const canUseAutoPreload = autoPreloadRank !== null
  const {
    hasAttachedSource,
    hasConnectedPlaybackSource,
    shouldAggressivelyLoadSource,
    shouldRenderVideoSource,
  } = useAutoPlayVideoSource({
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
  })
  const {
    handleLoadedData,
    handleLoadedMetadata,
    handlePosterLoad,
    hasLoadedFrame,
    queueFrameReady,
    shellAspectRatio,
  } = useVideoReadinessState({
    hasVideoSource,
    isSourceConnected: hasConnectedPlaybackSource,
    lastReportedLoadIssueRef,
    lastReportedPlayIssueRef,
    normalizedSrc: resolvedSrc,
    onLoadedMetadata,
    posterSrc: resolvedPoster,
    shouldMountVideo,
    videoRef,
  })
  const { shouldAutoplayVisibleVideo } = useAutoPlayVideoPlayback({
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
  })

  return (
    <div
      ref={shellRef}
      className={`relative w-full overflow-hidden ${placeholderClassName} ${shellClassName}`}
      style={{ aspectRatio: shellAspectRatio }}
    >
      {!resolvedPoster && !hasLoadedFrame && (
        <div
          className={`absolute inset-0 ${skeletonClassName} ${placeholderClassName}`}
        />
      )}
      {resolvedPoster && !hasLoadedFrame && (
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          decoding="async"
          onLoad={(event) => {
            handlePosterLoad(event.currentTarget)
            onPosterLoad?.(event.currentTarget)
          }}
          src={resolvedPoster}
        />
      )}
      {hasVideoSource && shouldMountVideo && (
        <video
          ref={videoRef}
          autoPlay={shouldAutoplayVisibleVideo}
          className={`${className} absolute inset-0 h-full w-full object-cover ${hasLoadedFrame ? "opacity-100" : "opacity-0"}`}
          loop
          muted={isMuted}
          onLoadedData={handleLoadedData}
          onLoadedMetadata={handleLoadedMetadata}
          playsInline
          poster={resolvedPoster}
          preload={
            shouldRenderVideoSource ? (shouldAggressivelyLoadSource ? "auto" : "metadata") : "none"
          }
        />
      )}
    </div>
  )
}
