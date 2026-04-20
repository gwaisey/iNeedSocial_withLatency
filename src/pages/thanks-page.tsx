import { useCallback, useEffect, useRef, useState } from "react"
import {
  getSessionStorage,
  readFeedSessionSnapshot,
  writeFeedSessionSnapshot,
  type FeedSessionSnapshot,
} from "../context/study-session-storage"
import { useStudyState } from "../context/study-context"
import { saveSessionData } from "../services/supabase"
import { getUserFacingErrorMessage } from "../utils/error-utils"

export function ThanksPage() {
  const { sessionId } = useStudyState()
  const storage = getSessionStorage()
  const [snapshot, setSnapshot] = useState<FeedSessionSnapshot | null>(() =>
    sessionId ? readFeedSessionSnapshot(storage, sessionId) : null
  )
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle")
  const [isRetryingSave, setIsRetryingSave] = useState(false)
  const resetCopyStateTimeoutRef = useRef<number | null>(null)
  const finalReport = snapshot?.finalReport ?? null
  const submissionMessage = snapshot?.submissionMessage ?? null
  const submissionHasError = snapshot?.submissionHasError ?? false
  const referenceCode =
    snapshot?.hasSubmitted && !snapshot.submissionHasError ? finalReport?.session_id ?? null : null

  useEffect(() => {
    setSnapshot(sessionId ? readFeedSessionSnapshot(storage, sessionId) : null)
  }, [sessionId, storage])

  useEffect(() => {
    return () => {
      if (resetCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyStateTimeoutRef.current)
      }
    }
  }, [])

  const handleCopyCode = useCallback(async () => {
    if (!referenceCode) {
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referenceCode)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = referenceCode
        textArea.setAttribute("readonly", "")
        textArea.style.position = "absolute"
        textArea.style.left = "-9999px"
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
      }

      setCopyState("success")
    } catch {
      setCopyState("error")
    } finally {
      if (resetCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyStateTimeoutRef.current)
      }

      resetCopyStateTimeoutRef.current = window.setTimeout(() => {
        setCopyState("idle")
      }, 2_000)
    }
  }, [referenceCode])

  const handleRetrySave = useCallback(async () => {
    if (!sessionId || !snapshot?.finalReport) {
      return
    }

    const savingSnapshot: FeedSessionSnapshot = {
      ...snapshot,
      hasSubmitted: false,
      submissionHasError: false,
      submissionMessage: "Menyimpan sesi...",
    }

    writeFeedSessionSnapshot(storage, sessionId, savingSnapshot)
    setSnapshot(savingSnapshot)
    setIsRetryingSave(true)

    try {
      await saveSessionData(snapshot.finalReport)

      const nextSnapshot: FeedSessionSnapshot = {
        ...savingSnapshot,
        hasSubmitted: true,
        submissionHasError: false,
        submissionMessage: "Sesi berhasil disimpan.",
      }

      writeFeedSessionSnapshot(storage, sessionId, nextSnapshot)
      setSnapshot(nextSnapshot)
    } catch (error) {
      const nextMessage = getUserFacingErrorMessage(
        error,
        "Sesi tidak dapat disimpan.",
        "thanks-page:retry-save"
      )

      const nextSnapshot: FeedSessionSnapshot = {
        ...savingSnapshot,
        hasSubmitted: false,
        submissionHasError: true,
        submissionMessage: nextMessage,
      }

      writeFeedSessionSnapshot(storage, sessionId, nextSnapshot)
      setSnapshot(nextSnapshot)
    } finally {
      setIsRetryingSave(false)
    }
  }, [sessionId, snapshot, storage])

  return (
    <div className="min-h-svh flex items-center justify-center bg-app-radial p-6 animate-fade-in">
      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-phone overflow-hidden px-8 py-14 text-ink">
        {/* Decorative bubbles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-mist/60 pointer-events-none" />
        <div className="absolute -top-12 -right-20 w-56 h-56 rounded-full bg-violet/10 pointer-events-none" />

        {/* Content */}
        <div className="relative space-y-2">
          <h1 className="text-4xl font-medium leading-tight">Terima Kasih!</h1>
          <p className="text-xl font-semibold italic text-haze">Sesi selesai.</p>
        </div>

        <p className="relative mt-6 text-base text-haze leading-relaxed">
          Terima kasih telah mengikuti simulasi ini. Partisipasi Anda sangat berarti bagi penelitian kami.
          <br /><br />
          {referenceCode
            ? "Gunakan kode sesi berikut bila Anda perlu mencatat atau melaporkan sesi ini."
            : "Jika sesi belum berhasil disimpan, Anda dapat mencoba menyimpannya lagi dari halaman ini."}
        </p>

        {referenceCode && (
          <div className="relative mt-6 rounded-2xl border border-violet/20 bg-violet/5 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-haze">
              Kode sesi
            </p>
            <p
              className="mt-2 break-all text-base font-bold text-ink"
              data-testid="session-reference-code"
            >
              {referenceCode}
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              <button
                className="inline-flex items-center justify-center rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(119,109,255,0.28)] transition-transform active:scale-95 disabled:opacity-70"
                data-testid="copy-session-code-button"
                disabled={!referenceCode}
                onClick={() => {
                  void handleCopyCode()
                }}
                type="button"
              >
                Salin kode
              </button>
              {copyState === "success" && (
                <p
                  className="text-xs font-medium text-violet"
                  data-testid="copy-session-code-status"
                >
                  Kode sesi berhasil disalin.
                </p>
              )}
              {copyState === "error" && (
                <p
                  className="text-xs font-medium text-[#C04B63]"
                  data-testid="copy-session-code-status"
                >
                  Gagal menyalin kode. Silakan salin manual.
                </p>
              )}
            </div>
          </div>
        )}

        {submissionMessage && (
          <div className="relative mt-5 space-y-3">
            <p
              className={`text-sm leading-relaxed ${
                submissionHasError ? "text-[#C04B63]" : "text-haze"
              }`}
              data-testid="session-save-status"
            >
              {submissionMessage}
            </p>
            {submissionHasError && finalReport && (
              <button
                className="inline-flex items-center justify-center rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(119,109,255,0.28)] transition-transform active:scale-95 disabled:opacity-70"
                data-testid="retry-session-save-button"
                disabled={isRetryingSave}
                onClick={() => {
                  void handleRetrySave()
                }}
                type="button"
              >
                {isRetryingSave ? "Mencoba menyimpan..." : "Coba simpan lagi"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
