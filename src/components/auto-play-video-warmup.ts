import { useEffect } from "react"

const DIRECT_VIDEO_WARMUP_LINK_ATTR = "data-direct-video-warmup"

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

export function resetVideoWarmupState() {
  if (typeof document === "undefined") {
    return
  }

  document.head.querySelectorAll(`[${DIRECT_VIDEO_WARMUP_LINK_ATTR}]`).forEach((link) => link.remove())
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
  }, [enabled, src])
}
