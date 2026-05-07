import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  appendVideoDebugEntry,
  clearVideoDebugEntries,
  formatVideoDebugReport,
  getVideoDebugEntries,
  getVideoDebugEnvironment,
  isVideoDebugEnabled,
  subscribeVideoDebugEntries,
  type VideoDebugEntry,
} from "../utils/video-debug-log"

type CopyState = "error" | "idle" | "success"

function getEntrySource(entry: VideoDebugEntry) {
  const data = entry.data
  const src =
    typeof data?.src === "string"
      ? data.src
      : typeof data?.attachedVideoSource === "string"
        ? data.attachedVideoSource
        : typeof data?.resolvedSrc === "string"
          ? data.resolvedSrc
          : undefined

  if (!src) {
    return ""
  }

  try {
    return new URL(src, window.location.href).pathname.split("/").pop() ?? src
  } catch {
    return src
  }
}

function getEntrySummary(entry: VideoDebugEntry) {
  const data = entry.data
  const video = data?.video as
    | {
        readonly currentTime?: number
        readonly networkState?: number
        readonly ownerPostId?: string | null
        readonly paused?: boolean
        readonly readyState?: number
      }
    | undefined

  if (!video) {
    return ""
  }

  return [
    video.ownerPostId,
    `r${video.readyState ?? "?"}`,
    `n${video.networkState ?? "?"}`,
    video.paused === true ? "paused" : video.paused === false ? "playing" : null,
    typeof video.currentTime === "number" ? `${video.currentTime}s` : null,
  ]
    .filter(Boolean)
    .join(" ")
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement("textarea")
  textArea.value = text
  textArea.setAttribute("readonly", "")
  textArea.style.position = "fixed"
  textArea.style.left = "-9999px"
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand("copy")
  document.body.removeChild(textArea)
}

export function VideoDebugPanel() {
  const copyResetTimeoutRef = useRef<number | null>(null)
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const [entries, setEntries] = useState<VideoDebugEntry[]>(() =>
    isVideoDebugEnabled() ? getVideoDebugEntries() : []
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const isEnabled = isVideoDebugEnabled()

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    appendVideoDebugEntry("debug-panel-mounted", {
      environment: getVideoDebugEnvironment(),
    })
    setEntries(getVideoDebugEntries())

    return subscribeVideoDebugEntries(() => {
      setEntries(getVideoDebugEntries())
    })
  }, [isEnabled])

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const latestEntries = useMemo(() => entries.slice(-12).reverse(), [entries])

  const handleCopy = useCallback(async () => {
    try {
      await copyText(formatVideoDebugReport())
      setCopyState("success")
    } catch {
      setCopyState("error")
    }

    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current)
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle")
      copyResetTimeoutRef.current = null
    }, 2_000)
  }, [])

  const handleClear = useCallback(() => {
    clearVideoDebugEntries()
    setEntries([])
  }, [])

  if (!isEnabled) {
    return null
  }

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[220] rounded-2xl border border-white/20 bg-ink/95 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur md:left-auto md:w-[28rem]"
      data-testid="video-debug-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-tight">Video debug</p>
          <p className="text-[11px] leading-tight text-white/65">
            {entries.length} events captured
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition active:scale-95"
            data-testid="video-debug-toggle-button"
            onClick={() => setIsExpanded((value) => !value)}
            type="button"
          >
            {isExpanded ? "Hide" : "Show"}
          </button>
          <button
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink transition active:scale-95"
            data-testid="video-debug-copy-button"
            onClick={handleCopy}
            type="button"
          >
            Copy
          </button>
          <button
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold transition active:scale-95"
            data-testid="video-debug-clear-button"
            onClick={handleClear}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      {copyState !== "idle" && (
        <p className="mt-2 text-xs text-white/75">
          {copyState === "success" ? "Copied debug report." : "Copy failed."}
        </p>
      )}

      {isExpanded && (
        <div className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/35 p-2 text-[11px] leading-snug">
          {latestEntries.length === 0 ? (
            <p className="text-white/60">No events yet.</p>
          ) : (
            <ol className="space-y-2">
              {latestEntries.map((entry) => (
                <li key={entry.id} className="border-b border-white/10 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{entry.type}</span>
                    <span className="text-white/50">+{entry.elapsedMs}ms</span>
                  </div>
                  <p className="break-all text-white/65">{getEntrySource(entry)}</p>
                  <p className="text-white/65">{getEntrySummary(entry)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
