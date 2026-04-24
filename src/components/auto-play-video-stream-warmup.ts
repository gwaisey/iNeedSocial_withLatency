import { useEffect } from "react"
import { getCloudflareStreamOrigin } from "./auto-play-video-config"

const STREAM_WARMUP_LINK_ATTR = "data-cloudflare-stream-warmup"
const DIRECT_VIDEO_WARMUP_LINK_ATTR = "data-direct-video-warmup"
const warmedStreamManifestRequests = new Map<string, Promise<Response>>()
const warmedStreamTextRequests = new Map<string, Promise<string>>()
const warmedStreamDeepPrebufferRequests = new Map<string, Promise<void>>()
let hlsRuntimePreloadPromise: Promise<typeof import("hls.js")> | null = null
const MAX_DEEP_PREBUFFER_PLAYLISTS = 2

function warmCloudflareStreamResource(url?: string) {
  if (!url || typeof fetch !== "function") {
    return undefined
  }

  const existingRequest = warmedStreamManifestRequests.get(url)
  if (existingRequest) {
    return existingRequest
  }

  const request = fetch(url, {
    cache: "force-cache",
    credentials: "omit",
    mode: "cors",
  }).catch((error) => {
    warmedStreamManifestRequests.delete(url)
    throw error
  })

  warmedStreamManifestRequests.set(url, request)
  return request
}

function warmCloudflareStreamText(url?: string) {
  if (!url) {
    return undefined
  }

  const existingRequest = warmedStreamTextRequests.get(url)
  if (existingRequest) {
    return existingRequest
  }

  const request = warmCloudflareStreamResource(url)
    ?.then((response) => {
      if ("clone" in response && typeof response.clone === "function") {
        return response.clone().text()
      }

      return ""
    })
    .catch((error) => {
      warmedStreamTextRequests.delete(url)
      throw error
    })

  if (!request) {
    return undefined
  }

  warmedStreamTextRequests.set(url, request)
  return request
}

function resolvePlaylistUrl(entry: string, baseUrl: string) {
  try {
    return new URL(entry, baseUrl).toString()
  } catch {
    return undefined
  }
}

function getAttributeValue(line: string, attributeName: string) {
  const match = line.match(new RegExp(`${attributeName}="([^"]+)"`, "i"))
  return match?.[1]
}

function extractChildPlaylistUrls(manifestText: string, manifestUrl: string) {
  const childPlaylistUrls = new Set<string>()

  for (const rawLine of manifestText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    if (line.startsWith("#EXT-X-MEDIA")) {
      const mediaPlaylistUrl = resolvePlaylistUrl(getAttributeValue(line, "URI") ?? "", manifestUrl)
      if (mediaPlaylistUrl) {
        childPlaylistUrls.add(mediaPlaylistUrl)
      }
      continue
    }

    if (line.startsWith("#")) {
      continue
    }

    const childPlaylistUrl = resolvePlaylistUrl(line, manifestUrl)
    if (childPlaylistUrl) {
      childPlaylistUrls.add(childPlaylistUrl)
    }
  }

  return [...childPlaylistUrls].slice(0, MAX_DEEP_PREBUFFER_PLAYLISTS)
}

function extractMediaWarmupUrls(playlistText: string, playlistUrl: string) {
  const warmupUrls: string[] = []

  for (const rawLine of playlistText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    if (line.startsWith("#EXT-X-MAP")) {
      const initSegmentUrl = resolvePlaylistUrl(getAttributeValue(line, "URI") ?? "", playlistUrl)
      if (initSegmentUrl) {
        warmupUrls.push(initSegmentUrl)
      }
      continue
    }

    if (line.startsWith("#")) {
      continue
    }

    const mediaSegmentUrl = resolvePlaylistUrl(line, playlistUrl)
    if (mediaSegmentUrl) {
      warmupUrls.push(mediaSegmentUrl)
    }

    if (warmupUrls.length >= 2) {
      break
    }
  }

  return warmupUrls
}

function hasHeadLink(rel: string, href: string) {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)).some(
    (link) => link.getAttribute("href") === href
  )
}

function appendHeadLink({
  attributeName = STREAM_WARMUP_LINK_ATTR,
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

function ensurePreconnect(origin: string | undefined, attributeName = STREAM_WARMUP_LINK_ATTR) {
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

export function warmCloudflareStreamManifest(manifestUrl?: string) {
  return warmCloudflareStreamResource(manifestUrl)
}

export function deepPrebufferCloudflareStream(manifestUrl?: string) {
  if (!manifestUrl) {
    return undefined
  }

  const existingRequest = warmedStreamDeepPrebufferRequests.get(manifestUrl)
  if (existingRequest) {
    return existingRequest
  }

  const request = warmCloudflareStreamText(manifestUrl)
    ?.then(async (manifestText) => {
      const childPlaylistUrls = extractChildPlaylistUrls(manifestText, manifestUrl)
      await Promise.all(
        childPlaylistUrls.map(async (playlistUrl) => {
          const playlistText = await warmCloudflareStreamText(playlistUrl)
          if (!playlistText) {
            return
          }
          const warmupUrls = extractMediaWarmupUrls(playlistText, playlistUrl)
          await Promise.all(warmupUrls.map((warmupUrl) => warmCloudflareStreamResource(warmupUrl)))
        })
      )
    })
    .catch((error) => {
      warmedStreamDeepPrebufferRequests.delete(manifestUrl)
      throw error
    })

  if (!request) {
    return undefined
  }

  warmedStreamDeepPrebufferRequests.set(manifestUrl, request)
  return request
}

export function resetCloudflareStreamWarmupState() {
  warmedStreamManifestRequests.clear()
  warmedStreamTextRequests.clear()
  warmedStreamDeepPrebufferRequests.clear()
  hlsRuntimePreloadPromise = null

  if (typeof document === "undefined") {
    return
  }

  document.head
    .querySelectorAll(`[${STREAM_WARMUP_LINK_ATTR}], [${DIRECT_VIDEO_WARMUP_LINK_ATTR}]`)
    .forEach((link) => link.remove())
}

export function useCloudflareStreamWarmup({
  deepPrebuffer,
  enabled,
  manifestUrl,
}: {
  readonly deepPrebuffer: boolean
  readonly enabled: boolean
  readonly manifestUrl?: string
}) {
  useEffect(() => {
    if (!enabled || !manifestUrl) {
      return
    }

    ensurePreconnect(getCloudflareStreamOrigin())
    void preloadHlsRuntime().catch(() => {})
    void warmCloudflareStreamManifest(manifestUrl)?.catch(() => {})
    if (deepPrebuffer) {
      void deepPrebufferCloudflareStream(manifestUrl)?.catch(() => {})
    }
  }, [deepPrebuffer, enabled, manifestUrl])
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
