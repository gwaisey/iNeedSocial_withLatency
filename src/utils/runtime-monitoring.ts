export const RUNTIME_MONITORING_EVENT_NAME = "ineedsocial:monitoring"
const RUNTIME_MONITORING_STORAGE_KEY = "ineedsocial:runtime-monitoring"
const MAX_BUFFERED_RUNTIME_EVENTS = 40

export type MonitoringLevel = "warn" | "error"

export type MonitoringScope =
  | "app-error-boundary"
  | "feed-service"
  | "supabase-save"
  | "window-error"
  | "window-unhandled-rejection"
  | "video-playback"

export type MonitoringErrorDetail = {
  readonly message: string
  readonly name?: string
  readonly stack?: string
}

export type RuntimeMonitoringEvent = {
  readonly error?: MonitoringErrorDetail
  readonly level: MonitoringLevel
  readonly message: string
  readonly metadata?: Record<string, unknown>
  readonly scope: MonitoringScope
  readonly timestamp: string
}

type ReportRuntimeIssueInput = Omit<RuntimeMonitoringEvent, "error" | "timestamp"> & {
  readonly error?: unknown
}

declare global {
  interface WindowEventMap {
    "ineedsocial:monitoring": CustomEvent<RuntimeMonitoringEvent>
  }
}

let globalErrorListener: ((event: ErrorEvent) => void) | null = null
let globalUnhandledRejectionListener: ((event: PromiseRejectionEvent) => void) | null = null
let bufferedEventsWithoutWindow: RuntimeMonitoringEvent[] = []

function normalizeError(error: unknown): MonitoringErrorDetail | undefined {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  if (typeof error === "string") {
    return { message: error }
  }

  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return { message: String(error) }
  }

  if (typeof error === "object" && error !== null) {
    try {
      return { message: JSON.stringify(error) }
    } catch {
      return { message: String(error) }
    }
  }

  return undefined
}

function readBufferedRuntimeIssues(): RuntimeMonitoringEvent[] {
  if (typeof window === "undefined") {
    return [...bufferedEventsWithoutWindow]
  }

  try {
    const raw = window.sessionStorage.getItem(RUNTIME_MONITORING_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RuntimeMonitoringEvent[]) : []
  } catch {
    return []
  }
}

function writeBufferedRuntimeIssues(events: RuntimeMonitoringEvent[]) {
  const nextEvents = events.slice(-MAX_BUFFERED_RUNTIME_EVENTS)

  if (typeof window === "undefined") {
    bufferedEventsWithoutWindow = nextEvents
    return
  }

  try {
    if (nextEvents.length === 0) {
      window.sessionStorage.removeItem(RUNTIME_MONITORING_STORAGE_KEY)
    } else {
      window.sessionStorage.setItem(RUNTIME_MONITORING_STORAGE_KEY, JSON.stringify(nextEvents))
    }
  } catch {
    // Ignore sessionStorage failures; console output and custom events still work.
  }
}

function bufferRuntimeIssue(detail: RuntimeMonitoringEvent) {
  writeBufferedRuntimeIssues([...readBufferedRuntimeIssues(), detail])
}

export function reportRuntimeIssue(input: ReportRuntimeIssueInput): RuntimeMonitoringEvent {
  const detail: RuntimeMonitoringEvent = {
    error: normalizeError(input.error),
    level: input.level,
    message: input.message,
    metadata: input.metadata,
    scope: input.scope,
    timestamp: new Date().toISOString(),
  }

  bufferRuntimeIssue(detail)

  const consoleMethod = detail.level === "error" ? console.error : console.warn
  consoleMethod(`[monitoring:${detail.scope}] ${detail.message}`, detail)

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(RUNTIME_MONITORING_EVENT_NAME, { detail }))
  }

  return detail
}

export function getBufferedRuntimeIssues() {
  return readBufferedRuntimeIssues()
}

export function clearBufferedRuntimeIssues() {
  writeBufferedRuntimeIssues([])
}

export function installGlobalRuntimeMonitoring() {
  if (typeof window === "undefined" || globalErrorListener || globalUnhandledRejectionListener) {
    return
  }

  globalErrorListener = (event) => {
    reportRuntimeIssue({
      error: event.error ?? event.message,
      level: "error",
      message: "Unhandled window error reached the runtime monitor.",
      metadata: {
        colno: event.colno,
        filename: event.filename,
        lineno: event.lineno,
      },
      scope: "window-error",
    })
  }

  globalUnhandledRejectionListener = (event) => {
    reportRuntimeIssue({
      error: event.reason,
      level: "error",
      message: "Unhandled promise rejection reached the runtime monitor.",
      metadata: {
        hasReason: typeof event.reason !== "undefined",
      },
      scope: "window-unhandled-rejection",
    })
  }

  window.addEventListener("error", globalErrorListener)
  window.addEventListener("unhandledrejection", globalUnhandledRejectionListener)
}

export function resetRuntimeMonitoringForTests() {
  clearBufferedRuntimeIssues()
  bufferedEventsWithoutWindow = []

  if (typeof window !== "undefined") {
    if (globalErrorListener) {
      window.removeEventListener("error", globalErrorListener)
    }

    if (globalUnhandledRejectionListener) {
      window.removeEventListener("unhandledrejection", globalUnhandledRejectionListener)
    }
  }

  globalErrorListener = null
  globalUnhandledRejectionListener = null
}
