const VIDEO_DEBUG_FLAG_STORAGE_KEY = "ineedsocial:video-debug-enabled"
const VIDEO_DEBUG_LOG_STORAGE_KEY = "ineedsocial:video-debug-log"
const MAX_VIDEO_DEBUG_ENTRIES = 800
const VIDEO_DEBUG_RANGE_PROBE_TIMEOUT_MS = 8_000

type NetworkInformationLike = {
  readonly downlink?: number
  readonly effectiveType?: string
  readonly rtt?: number
  readonly saveData?: boolean
  readonly type?: string
}

export type VideoDebugEntry = {
  readonly data?: Record<string, unknown>
  readonly elapsedMs: number
  readonly id: number
  readonly timestamp: string
  readonly type: string
}

type VideoDebugSubscriber = () => void

const subscribers = new Set<VideoDebugSubscriber>()
const probedVideoSources = new Set<string>()
let cachedEntries: VideoDebugEntry[] | null = null
let nextEntryId = 1

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function readStoredEntries() {
  const storage = getSessionStorage()
  if (!storage) {
    return []
  }

  try {
    const raw = storage.getItem(VIDEO_DEBUG_LOG_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VideoDebugEntry[]) : []
  } catch {
    return []
  }
}

function writeStoredEntries(entries: readonly VideoDebugEntry[]) {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(VIDEO_DEBUG_LOG_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // The in-memory log and copy button still work if storage quota is unavailable.
  }
}

function getCachedEntries() {
  if (cachedEntries) {
    return cachedEntries
  }

  cachedEntries = readStoredEntries()
  nextEntryId =
    cachedEntries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) + 1
  return cachedEntries
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber())
}

function getConnectionSnapshot() {
  if (typeof navigator === "undefined") {
    return null
  }

  const navigatorWithConnection = navigator as Navigator & {
    connection?: NetworkInformationLike
    mozConnection?: NetworkInformationLike
    webkitConnection?: NetworkInformationLike
  }
  const connection =
    navigatorWithConnection.connection ??
    navigatorWithConnection.mozConnection ??
    navigatorWithConnection.webkitConnection

  if (!connection) {
    return null
  }

  return {
    downlink: connection.downlink ?? null,
    effectiveType: connection.effectiveType ?? null,
    rtt: connection.rtt ?? null,
    saveData: connection.saveData ?? null,
    type: connection.type ?? null,
  }
}

function getCanPlayTypeSnapshot() {
  if (typeof document === "undefined") {
    return null
  }

  const video = document.createElement("video")
  return {
    h264Baseline: video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
    mp4: video.canPlayType("video/mp4"),
  }
}

function sanitizeValue(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return typeof value === "undefined" ? undefined : { value }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch {
    return { value: String(value) }
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  return { message: String(error) }
}

function readDebugFlagFromStorage() {
  const storage = getSessionStorage()
  return storage?.getItem(VIDEO_DEBUG_FLAG_STORAGE_KEY) === "true"
}

export function syncVideoDebugFlagFromSearch(search = window.location.search) {
  const storage = getSessionStorage()
  const params = new URLSearchParams(search)
  const debugParam = params.get("debugVideo")

  if (debugParam === "1") {
    storage?.setItem(VIDEO_DEBUG_FLAG_STORAGE_KEY, "true")
    return true
  }

  if (debugParam === "0") {
    storage?.removeItem(VIDEO_DEBUG_FLAG_STORAGE_KEY)
    return false
  }

  return readDebugFlagFromStorage()
}

export function isVideoDebugEnabled() {
  if (typeof window === "undefined") {
    return false
  }

  return syncVideoDebugFlagFromSearch(window.location.search)
}

export function getVideoDebugEnvironment() {
  if (typeof window === "undefined") {
    return null
  }

  return {
    canPlayType: getCanPlayTypeSnapshot(),
    connection: getConnectionSnapshot(),
    devicePixelRatio: window.devicePixelRatio,
    href: window.location.href,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    isSecureContext: window.isSecureContext,
    language: navigator.language,
    onLine: navigator.onLine,
    userAgent: navigator.userAgent,
    visibilityState: document.visibilityState,
  }
}

export function appendVideoDebugEntry(type: string, data?: unknown) {
  if (!isVideoDebugEnabled()) {
    return null
  }

  const entries = getCachedEntries()
  const nextEntry: VideoDebugEntry = {
    data: sanitizeValue(data),
    elapsedMs:
      typeof performance !== "undefined" ? Math.round(performance.now()) : 0,
    id: nextEntryId,
    timestamp: new Date().toISOString(),
    type,
  }

  nextEntryId += 1
  cachedEntries = [...entries, nextEntry].slice(-MAX_VIDEO_DEBUG_ENTRIES)
  writeStoredEntries(cachedEntries)
  notifySubscribers()
  return nextEntry
}

export function getVideoDebugEntries() {
  return [...getCachedEntries()]
}

export function clearVideoDebugEntries() {
  cachedEntries = []
  nextEntryId = 1
  probedVideoSources.clear()
  writeStoredEntries([])
  notifySubscribers()
}

export function subscribeVideoDebugEntries(subscriber: VideoDebugSubscriber) {
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

function getMediaErrorSnapshot(error: MediaError | null) {
  if (!error) {
    return null
  }

  return {
    code: error.code,
    message: error.message,
  }
}

function getBufferedRanges(video: HTMLVideoElement) {
  return Array.from({ length: video.buffered.length }, (_, index) => ({
    end: Number(video.buffered.end(index).toFixed(3)),
    start: Number(video.buffered.start(index).toFixed(3)),
  }))
}

function getRectSnapshot(element: Element | null) {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()
  return {
    bottom: Math.round(rect.bottom),
    height: Math.round(rect.height),
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
  }
}

export function getVideoDebugElementSnapshot(
  video: HTMLVideoElement,
  shell: HTMLElement | null
) {
  const ownerPost = video.closest<HTMLElement>("[data-regular-post-id]")

  return {
    attrSrc: video.getAttribute("src"),
    autoplay: video.autoplay,
    buffered: getBufferedRanges(video),
    currentSrc: video.currentSrc,
    currentTime: Number(video.currentTime.toFixed(3)),
    duration: Number.isFinite(video.duration)
      ? Number(video.duration.toFixed(3))
      : null,
    ended: video.ended,
    error: getMediaErrorSnapshot(video.error),
    muted: video.muted,
    networkState: video.networkState,
    ownerPostId: ownerPost?.getAttribute("data-regular-post-id") ?? null,
    paused: video.paused,
    playbackRate: video.playbackRate,
    preload: video.getAttribute("preload"),
    readyState: video.readyState,
    rect: getRectSnapshot(video),
    shellRect: getRectSnapshot(shell),
    visibilityState: document.visibilityState,
    volume: video.volume,
  }
}

export function probeVideoDebugRange(src: string, context?: Record<string, unknown>) {
  if (!isVideoDebugEnabled() || probedVideoSources.has(src) || typeof fetch !== "function") {
    return
  }

  probedVideoSources.add(src)
  const startedAt = performance.now()
  const abortController =
    typeof AbortController === "function" ? new AbortController() : null
  const timeoutId =
    abortController && typeof window !== "undefined"
      ? window.setTimeout(() => abortController.abort(), VIDEO_DEBUG_RANGE_PROBE_TIMEOUT_MS)
      : null
  appendVideoDebugEntry("range-probe-start", { ...context, src })

  void fetch(src, {
    cache: "no-store",
    credentials: "omit",
    headers: {
      Range: "bytes=0-1",
    },
    mode: "cors",
    signal: abortController?.signal,
  })
    .then((response) => {
      appendVideoDebugEntry("range-probe-result", {
        ...context,
        accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
        acceptRanges: response.headers.get("accept-ranges"),
        contentLength: response.headers.get("content-length"),
        contentRange: response.headers.get("content-range"),
        contentType: response.headers.get("content-type"),
        elapsedMs: Math.round(performance.now() - startedAt),
        ok: response.ok,
        redirected: response.redirected,
        responseType: response.type,
        src,
        status: response.status,
        url: response.url,
      })
    })
    .catch((error) => {
      appendVideoDebugEntry("range-probe-error", {
        ...context,
        elapsedMs: Math.round(performance.now() - startedAt),
        error: normalizeError(error),
        src,
      })
    })
    .finally(() => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    })
}

export function formatVideoDebugReport() {
  return JSON.stringify(
    {
      entries: getVideoDebugEntries(),
      environment: getVideoDebugEnvironment(),
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  )
}
