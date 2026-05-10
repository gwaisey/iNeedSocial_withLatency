import { KNOWN_VIDEO_POSTER_DIMENSIONS } from "./auto-play-video-poster-dimensions"
import { shouldUseCompactVideoSource } from "../utils/video-network-policy"

export const VIDEO_PRELOAD_ROOT_MARGIN = "14000px 0px"
export const VIDEO_PLAY_START_VISIBLE_RATIO = 0.35
export const VIDEO_PLAY_STOP_VISIBLE_RATIO = 0.35
export const VIDEO_PLAY_HANDOFF_VISIBLE_RATIO = 0.15
export const VIDEO_RESET_DISTANCE_PX = 220
export const VIDEO_EARLY_LOAD_DISTANCE_PX = 9000
export const VIDEO_SOURCE_IMMEDIATE_DETACH_DISTANCE_PX = 16000
export const DEFAULT_VIDEO_ASPECT_RATIO = "9 / 16"
export const VIDEO_READY_STATE_CURRENT_DATA = 2
export const VIDEO_READY_STATE_FUTURE_DATA = 3
export const VIDEO_REVEAL_PLAYBACK_PROGRESS_S = 0.02
export const VIDEO_FOCUSED_PLAYBACK_RESCUE_DELAY_MS = 250
export const VIDEO_VIEWPORT_INTERSECTION_THRESHOLDS = [
  0,
  VIDEO_PLAY_STOP_VISIBLE_RATIO,
  VIDEO_PLAY_START_VISIBLE_RATIO,
  0.75,
  1,
]

const learnedVideoAspectRatios = new Map<string, string>()
const COMPACT_VIDEO_SOURCE_PREFIX = "/content/videos/"
const DEFAULT_VIDEO_SOURCE_PREFIX = "/content/videos-default/"
const LEGACY_VIDEO_SOURCE_PREFIX = "/content/videos/"
const DEFAULT_PUBLIC_VIDEO_BASE_URL = "https://pub-d618661628e3497397ad6ab54d430ff8.r2.dev"

function getVideoPublicBaseUrl() {
  const baseUrl = import.meta.env.VITE_VIDEO_PUBLIC_BASE_URL?.trim()
  if (baseUrl) {
    return baseUrl.replace(/\/$/, "")
  }

  if (import.meta.env.PROD) {
    return DEFAULT_PUBLIC_VIDEO_BASE_URL
  }

  return undefined
}

function getCompactVideoPublicBaseUrl() {
  const baseUrl = import.meta.env.VITE_VIDEO_COMPACT_PUBLIC_BASE_URL?.trim()
  if (baseUrl) {
    return baseUrl.replace(/\/$/, "")
  }

  return undefined
}

function shouldPreferCompactVideoSource() {
  const configuredVariant = import.meta.env.VITE_VIDEO_SOURCE_VARIANT?.trim().toLowerCase()
  if (configuredVariant === "default") {
    return false
  }

  if (configuredVariant === "compact") {
    return true
  }

  return import.meta.env.PROD || shouldUseCompactVideoSource()
}

function buildAspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return undefined
  }

  return `${width} / ${height}`
}

function normalizeLocalVideoSource(src?: string) {
  const normalizedSrc = src?.trim()
  if (!normalizedSrc) {
    return undefined
  }

  if (normalizedSrc.startsWith(DEFAULT_VIDEO_SOURCE_PREFIX)) {
    return normalizedSrc
  }

  if (normalizedSrc.startsWith(LEGACY_VIDEO_SOURCE_PREFIX)) {
    return normalizedSrc.replace(LEGACY_VIDEO_SOURCE_PREFIX, DEFAULT_VIDEO_SOURCE_PREFIX)
  }

  return normalizedSrc
}

function getPreferredVideoSource(src?: string) {
  const normalizedSrc = normalizeLocalVideoSource(src)
  if (!normalizedSrc?.startsWith(DEFAULT_VIDEO_SOURCE_PREFIX)) {
    return normalizedSrc
  }

  if (!shouldPreferCompactVideoSource()) {
    return normalizedSrc
  }

  return normalizedSrc.replace(DEFAULT_VIDEO_SOURCE_PREFIX, COMPACT_VIDEO_SOURCE_PREFIX)
}

function getPublicVideoSource(src?: string) {
  const normalizedSrc = getPreferredVideoSource(src)
  if (!normalizedSrc) {
    return undefined
  }

  if (normalizedSrc.startsWith(COMPACT_VIDEO_SOURCE_PREFIX)) {
    const compactBaseUrl = getCompactVideoPublicBaseUrl()
    return compactBaseUrl ? `${compactBaseUrl}${normalizedSrc}` : normalizedSrc
  }

  const publicBaseUrl = getVideoPublicBaseUrl()
  if (!normalizedSrc.startsWith(DEFAULT_VIDEO_SOURCE_PREFIX) || !publicBaseUrl) {
    return undefined
  }

  return `${publicBaseUrl}${normalizedSrc}`
}

export function getNormalizedVideoSource(src?: string) {
  const normalizedSrc = getPreferredVideoSource(src)
  const publicSrc = getPublicVideoSource(normalizedSrc)
  if (publicSrc) {
    return publicSrc
  }

  return normalizedSrc ? normalizedSrc : undefined
}

export function getVideoPublicOrigin() {
  const baseUrl = getVideoPublicBaseUrl()
  if (!baseUrl) {
    return undefined
  }

  try {
    return new URL(baseUrl).origin
  } catch {
    return undefined
  }
}

export function isDirectVideoFileSource(src?: string) {
  return /\.mp4($|\?)/i.test(src ?? "")
}

function getLocalVideoPosterSource(src?: string) {
  const normalizedSrc = normalizeLocalVideoSource(src)
  if (!normalizedSrc?.includes(DEFAULT_VIDEO_SOURCE_PREFIX) || !isDirectVideoFileSource(normalizedSrc)) {
    return undefined
  }

  return normalizedSrc.replace(DEFAULT_VIDEO_SOURCE_PREFIX, "/content/video-posters/").replace(/\.mp4$/, ".jpg")
}

export function getResolvedVideoSource(src?: string) {
  return getNormalizedVideoSource(src)
}

export function getVideoPosterSource(src?: string, poster?: string) {
  if (poster) {
    return poster
  }

  const localPoster = getLocalVideoPosterSource(src)
  if (localPoster) {
    return localPoster
  }

  return undefined
}

export function getKnownVideoPosterDimensions(src?: string, poster?: string) {
  const posterSources = [getVideoPosterSource(src, poster), getLocalVideoPosterSource(src)]

  for (const posterSrc of posterSources) {
    if (!posterSrc) {
      continue
    }

    const dimensions = KNOWN_VIDEO_POSTER_DIMENSIONS[posterSrc]
    if (dimensions) {
      return dimensions
    }
  }

  return undefined
}

export function getKnownVideoAspectRatio(src?: string, poster?: string) {
  if (!src) {
    return undefined
  }

  const learnedAspectRatio = learnedVideoAspectRatios.get(src)
  if (learnedAspectRatio) {
    return learnedAspectRatio
  }

  const dimensions = getKnownVideoPosterDimensions(src, poster)
  return dimensions ? buildAspectRatio(dimensions.width, dimensions.height) : undefined
}

export function rememberVideoAspectRatio(src: string | undefined, aspectRatio: string | null) {
  if (!src || !aspectRatio) {
    return
  }

  learnedVideoAspectRatios.set(src, aspectRatio)
}
