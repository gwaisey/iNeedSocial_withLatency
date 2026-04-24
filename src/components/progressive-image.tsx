import { useCallback, useEffect, useRef, useState } from "react"

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

  const markImageReady = useCallback(
    (image: HTMLImageElement) => {
      if (!image.complete || image.naturalWidth === 0) {
        return
      }

      setHasLoadedImage(true)
      if (hasReportedLoadRef.current) {
        return
      }

      hasReportedLoadRef.current = true
      onLoad?.(image)
    },
    [onLoad]
  )

  useEffect(() => {
    setHasLoadedImage(false)
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
      className={`relative overflow-hidden ${placeholderClassName} ${shellClassName} ${hasLoadedImage ? "" : "aspect-[4/5]"}`}
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
