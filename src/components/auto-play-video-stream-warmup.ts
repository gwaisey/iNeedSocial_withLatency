import { useEffect } from "react"

const DIRECT_VIDEO_WARMUP_LINK_ATTR = "data-direct-video-warmup"
let hlsRuntimePreloadPromise: Promise<typeof import("hls.js")> | null = null

function hasHeadLink(rel: string, href: string) {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)).some(
    (link) => link.getAttribute("href") === href
  )
}

function appendHeadLink({
  attributeName = DIRECT_VIDEO_WARMUP_LINK_ATTR,
  crossOrigin,
  href,
  rel,
}: {
  readonly attributeName?: string
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
  link.setAttribute(attributeName, "true")

  if (crossOrigin) {
    link.crossOrigin = crossOrigin
  }

  document.head.appendChild(link)
}

function ensurePreconnect(origin: string | undefined, attributeName = DIRECT_VIDEO_WARMUP_LINK_ATTR) {
  if (!origin) {
    return
  }

  appendHeadLink({ attributeName, href: origin, rel: "dns-prefetch" })
  appendHeadLink({
    attributeName,
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

export function preloadHlsRuntime() {
  if (!hlsRuntimePreloadPromise) {
    hlsRuntimePreloadPromise = import("hls.js").catch((error) => {
      hlsRuntimePreloadPromise = null
      throw error
    })
  }

  return hlsRuntimePreloadPromise
}

export function resetStreamWarmupState() {
  hlsRuntimePreloadPromise = null

  if (typeof document === "undefined") {
    return
  }

  document.head
    .querySelectorAll(`[${DIRECT_VIDEO_WARMUP_LINK_ATTR}]`)
    .forEach((link) => link.remove())
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

    ensurePreconnect(getUrlOrigin(src), DIRECT_VIDEO_WARMUP_LINK_ATTR)
  }, [enabled, src])
}
