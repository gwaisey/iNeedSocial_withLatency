import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { SessionReportPayload } from "../types/social"
import { reportRuntimeIssue } from "../utils/runtime-monitoring"

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const SAVE_RETRY_DELAYS_MS = [150, 300] as const

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ""
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""

type FeedSessionsSaveData = SessionReportPayload[] | null
type FeedSessionsSaveError = Error | {
  code?: string
  details?: string
  message?: string
  status?: number
} | null

type SaveResponse = {
  data: FeedSessionsSaveData
  error: FeedSessionsSaveError
}

type SaveResponsePromise = PromiseLike<SaveResponse>

export type FeedSessionsClient = {
  from: (table: "feed_sessions") => {
    insert: (values: SessionReportPayload[]) => SaveResponsePromise
  }
}

let cachedClient: SupabaseClient | null = null

function getSupabaseConfigMessage(): string | null {
  if (!supabaseUrl) {
    return "Penyimpanan Supabase dinonaktifkan karena VITE_SUPABASE_URL belum diatur."
  }

  try {
    new URL(supabaseUrl)
  } catch {
    return "Penyimpanan Supabase dinonaktifkan karena VITE_SUPABASE_URL tidak valid."
  }

  if (!supabaseKey) {
    return "Penyimpanan Supabase dinonaktifkan karena VITE_SUPABASE_PUBLISHABLE_KEY belum diatur."
  }

  return null
}

const supabaseConfigError = getSupabaseConfigMessage()

function getSupabaseClient(): SupabaseClient {
  if (supabaseConfigError) {
    throw new Error(supabaseConfigError)
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseKey)
  }

  return cachedClient
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function extractErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null
  }

  const status = Reflect.get(error, "status")
  return typeof status === "number" ? status : null
}

function extractErrorText(error: unknown, key: "code" | "details" | "message") {
  if (typeof error !== "object" || error === null) {
    return null
  }

  const value = Reflect.get(error, key)
  return typeof value === "string" ? value : null
}

export function isRetryableSaveError(error: unknown) {
  if (error instanceof TypeError) {
    return true
  }

  if (error instanceof Error && /fetch|network|timeout|load failed/i.test(error.message)) {
    return true
  }

  const status = extractErrorStatus(error)
  return status !== null ? RETRYABLE_STATUS_CODES.has(status) : false
}

export function isDuplicateSessionSaveError(error: unknown) {
  const code = extractErrorText(error, "code")
  const details = extractErrorText(error, "details")
  const message = extractErrorText(error, "message")
  const status = extractErrorStatus(error)
  const combinedText = [details, message].filter(Boolean).join(" ")

  if (code === "23505") {
    return /session_id|duplicate|unique/i.test(combinedText)
  }

  if (status === 409) {
    return /session_id|duplicate|unique/i.test(combinedText)
  }

  return false
}

export function getSupabaseStatusMessage() {
  return supabaseConfigError
}

export async function saveSessionDataWithClient(
  client: FeedSessionsClient,
  payload: SessionReportPayload
) {
  let lastError: FeedSessionsSaveError = null

  for (let attempt = 0; attempt <= SAVE_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data, error } = await client.from("feed_sessions").insert([payload])

    // With insert-only RLS, a duplicate session_id means a prior save already won.
    if (!error || isDuplicateSessionSaveError(error)) {
      return data
    }

    lastError = error
    if (!isRetryableSaveError(error) || attempt === SAVE_RETRY_DELAYS_MS.length) {
      reportRuntimeIssue({
        error,
        level: "error",
        message: "Feed session save failed.",
        metadata: {
          attempt: attempt + 1,
          isRetryable: isRetryableSaveError(error),
          sessionId: payload.session_id,
        },
        scope: "supabase-save",
      })
      throw error
    }

    reportRuntimeIssue({
      error,
      level: "warn",
      message: "Retrying feed session save after transient failure.",
      metadata: {
        attempt: attempt + 1,
        nextDelayMs: SAVE_RETRY_DELAYS_MS[attempt],
        sessionId: payload.session_id,
      },
      scope: "supabase-save",
    })
    await wait(SAVE_RETRY_DELAYS_MS[attempt])
  }

  throw lastError
}

export async function saveSessionData(payload: SessionReportPayload) {
  return saveSessionDataWithClient(getSupabaseClient(), payload)
}
