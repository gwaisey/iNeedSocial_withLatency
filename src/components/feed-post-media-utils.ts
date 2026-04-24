import type { MediaItem } from "../types/social"
import {
  getKnownVideoPosterDimensions,
  isDirectVideoFileSource,
} from "./auto-play-video-config"

export type MediaSurfaceTokens = {
  placeholder: string
  skeletonTone: string
  surface: string
}

export function isVideoMedia(media?: Pick<MediaItem, "src" | "streamUid">) {
  return Boolean(media?.streamUid?.trim()) || isDirectVideoFileSource(media?.src)
}

export function getMediaSurfaceTokens(isDark: boolean): MediaSurfaceTokens {
  return {
    placeholder: isDark ? "bg-white/8" : "bg-ink/8",
    skeletonTone: isDark ? "skeleton-dark" : "",
    surface: isDark ? "bg-white/8" : "bg-ink/8",
  }
}

export function buildVideoAspectRatioHeight(video: HTMLVideoElement) {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return video.clientWidth
  }

  return (video.clientWidth * video.videoHeight) / video.videoWidth
}

export function buildKnownVideoAspectRatioHeight({
  poster,
  src,
  width,
}: {
  readonly poster?: string
  readonly src?: string
  readonly width: number
}) {
  if (width <= 0) {
    return null
  }

  const dimensions = getKnownVideoPosterDimensions(src, poster)
  if (!dimensions) {
    return null
  }

  return (width * dimensions.height) / dimensions.width
}

export function buildImageAspectRatioHeight(image: HTMLImageElement) {
  return (image.clientWidth * image.naturalHeight) / image.naturalWidth
}
