import { useCallback, useEffect, useRef, useState } from "react"
import {
  buildProgressiveImageAspectRatio,
  DEFAULT_PROGRESSIVE_IMAGE_ASPECT_RATIO,
  getKnownProgressiveImageAspectRatio,
  rememberProgressiveImageAspectRatio,
} from "./progressive-image-config"

type ProgressiveImageProps = {
  readonly alt: string
  readonly className: string
  readonly onLoad?: (image: HTMLImageElement) => void
  readonly placeholderClassName?: string
  readonly priority?: "high" | "low"
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly src?: string
}

export function ProgressiveImage({
  alt,
  className,
  onLoad,
  placeholderClassName = "bg-ink/8",
  priority = "low",
  shellClassName = "",
  skeletonClassName = "",
  src,
}: ProgressiveImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const hasReportedLoadRef = useRef(false)
  const [hasLoadedImage, setHasLoadedImage] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(
    () => getKnownProgressiveImageAspectRatio(src) ?? DEFAULT_PROGRESSIVE_IMAGE_ASPECT_RATIO
  )

  const markImageReady = useCallback(
    (image: HTMLImageElement) => {
      if (!image.complete || image.naturalWidth === 0) {
        return
      }

      const knownAspectRatio = getKnownProgressiveImageAspectRatio(src)
      const measuredAspectRatio = buildProgressiveImageAspectRatio(
        image.naturalWidth,
        image.naturalHeight
      )
      rememberProgressiveImageAspectRatio(src, measuredAspectRatio)
      if (!knownAspectRatio && measuredAspectRatio) {
        setAspectRatio(measuredAspectRatio)
      }

      setHasLoadedImage(true)
      if (hasReportedLoadRef.current) {
        return
      }

      hasReportedLoadRef.current = true
      onLoad?.(image)
    },
    [onLoad, src]
  )

  useEffect(() => {
    setHasLoadedImage(false)
    setAspectRatio(getKnownProgressiveImageAspectRatio(src) ?? DEFAULT_PROGRESSIVE_IMAGE_ASPECT_RATIO)
    hasReportedLoadRef.current = false
  }, [src])

  useEffect(() => {
    const image = imageRef.current
    if (!image) {
      return
    }

    if (image.complete && image.naturalWidth > 0) {
      markImageReady(image)
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (imageRef.current) {
        markImageReady(imageRef.current)
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [markImageReady, src])

  return (
    <div
      className={`relative overflow-hidden ${placeholderClassName} ${shellClassName}`}
      style={{ aspectRatio }}
    >
      {!hasLoadedImage && (
        <div className={`absolute inset-0 skeleton ${skeletonClassName} ${placeholderClassName}`} />
      )}
      {src && (
        <img
          ref={imageRef}
          alt={alt}
          className={`${className} transition-opacity duration-200 ${hasLoadedImage ? "opacity-100" : "opacity-0"}`}
          decoding="async"
          fetchPriority={priority}
          loading={priority === "high" ? "eager" : "lazy"}
          onLoad={(event) => markImageReady(event.currentTarget)}
          src={src}
        />
      )}
    </div>
  )
}
