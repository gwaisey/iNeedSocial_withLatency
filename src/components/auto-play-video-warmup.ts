import { useEffect } from "react"

const DIRECT_VIDEO_WARMUP_LINK_ATTR = "data-direct-video-warmup"
const COMPACT_VIDEO_PATH_SEGMENT = "/content/videos/"
const DIRECT_VIDEO_BYTE_WARMUP_BYTES = 384 * 1024
const warmedDirectVideoByteRanges = new Set<string>()
const inflightDirectVideoByteRanges = new Set<string>()

function hasHeadLink(rel: string, href: string) {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)).some(
    (link) => link.getAttribute("href") === href
  )
}

function appendHeadLink({
  crossOrigin,
  href,
  rel,
}: {
  readonly crossOrigin?: "anonymous"
  readonly href: string
  readonly rel: "dns-prefetch" | "preconnect"
}) {
  if (typeof document === "undefined" || hasHeadLink(rel, href)) {
    return
  }

  const link = document.createElement("link")
  link.rel = rel
  link.href = href
  link.setAttribute(DIRECT_VIDEO_WARMUP_LINK_ATTR, "true")

  if (crossOrigin) {
    link.crossOrigin = crossOrigin
  }

  document.head.appendChild(link)
}

function ensurePreconnect(origin: string | undefined) {
  if (!origin) {
    return
  }

  appendHeadLink({ href: origin, rel: "dns-prefetch" })
  appendHeadLink({
    crossOrigin: "anonymous",
    href: origin,
    rel: "preconnect",
  })
}

function getUrlOrigin(url?: string) {
  if (!url) {
    return undefined
  }

  try {
    return new URL(url, window.location.href).origin
  } catch {
    return undefined
  }
}

function shouldWarmDirectVideoBytes(src?: string) {
  if (!src || typeof window === "undefined" || typeof fetch !== "function") {
    return false
  }

  try {
    const url = new URL(src, window.location.href)
    return (
      url.origin !== window.location.origin &&
      url.pathname.includes(COMPACT_VIDEO_PATH_SEGMENT) &&
      /\.mp4$/i.test(url.pathname)
    )
  } catch {
    return false
  }
}

function warmDirectVideoBytes(src: string) {
  if (warmedDirectVideoByteRanges.has(src) || inflightDirectVideoByteRanges.has(src)) {
    return
  }

  inflightDirectVideoByteRanges.add(src)
  void fetch(src, {
    cache: "force-cache",
    credentials: "omit",
    headers: {
      Range: `bytes=0-${DIRECT_VIDEO_BYTE_WARMUP_BYTES - 1}`,
    },
    mode: "cors",
  })
    .then(async (response) => {
      if (!response.ok) {
        return
      }

      await response.arrayBuffer()
      warmedDirectVideoByteRanges.add(src)
    })
    .catch(() => {
      // Browser media preload remains the fallback when CORS or cache sharing is unavailable.
    })
    .finally(() => {
      inflightDirectVideoByteRanges.delete(src)
    })
}

export function resetVideoWarmupState() {
  if (typeof document === "undefined") {
    return
  }

  document.head.querySelectorAll(`[${DIRECT_VIDEO_WARMUP_LINK_ATTR}]`).forEach((link) => link.remove())
  warmedDirectVideoByteRanges.clear()
  inflightDirectVideoByteRanges.clear()
}

export function useDirectVideoWarmup({
  enabled,
  src,
}: {
  readonly enabled: boolean
  readonly src?: string
}) {
  useEffect(() => {
    if (!enabled || !src) {
      return
    }

    ensurePreconnect(getUrlOrigin(src))
    if (shouldWarmDirectVideoBytes(src)) {
      warmDirectVideoBytes(src)
    }
  }, [enabled, src])
}
