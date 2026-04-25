import { KNOWN_PROGRESSIVE_IMAGE_DIMENSIONS } from "./progressive-image-dimensions"

export const DEFAULT_PROGRESSIVE_IMAGE_ASPECT_RATIO = "4 / 5"

const learnedImageAspectRatios = new Map<string, string>()

function buildAspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return undefined
  }

  return `${width} / ${height}`
}

function getNormalizedImageSource(src?: string) {
  const normalizedSrc = src?.trim()
  if (!normalizedSrc) {
    return undefined
  }

  try {
    return new URL(normalizedSrc, "https://ineedsocial.local").pathname
  } catch {
    return normalizedSrc
  }
}

export function getKnownProgressiveImageDimensions(src?: string) {
  const normalizedSrc = getNormalizedImageSource(src)
  if (!normalizedSrc) {
    return undefined
  }

  return KNOWN_PROGRESSIVE_IMAGE_DIMENSIONS[normalizedSrc]
}

export function getKnownProgressiveImageAspectRatio(src?: string) {
  const normalizedSrc = getNormalizedImageSource(src)
  if (!normalizedSrc) {
    return undefined
  }

  const learnedAspectRatio = learnedImageAspectRatios.get(normalizedSrc)
  if (learnedAspectRatio) {
    return learnedAspectRatio
  }

  const dimensions = getKnownProgressiveImageDimensions(normalizedSrc)
  return dimensions ? buildAspectRatio(dimensions.width, dimensions.height) : undefined
}

export function rememberProgressiveImageAspectRatio(
  src: string | undefined,
  aspectRatio: string | undefined
) {
  const normalizedSrc = getNormalizedImageSource(src)
  if (!normalizedSrc || !aspectRatio) {
    return
  }

  learnedImageAspectRatios.set(normalizedSrc, aspectRatio)
}

export function buildProgressiveImageAspectRatio(width: number, height: number) {
  return buildAspectRatio(width, height)
}
