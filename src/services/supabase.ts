import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { SessionReportPayload } from "../types/social"

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const SAVE_RETRY_DELAYS_MS = [150, 300] as const

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ""
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""

type FeedSessionsSaveData = SessionReportPayload[] | null

type FeedSessionsSaveError = Error | {
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
    upsert: (
      values: SessionReportPayload[],
      options: {
        onConflict: string
      }
    ) => {
      select: () => SaveResponsePromise
    }
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

export function getSupabaseStatusMessage() {
  return supabaseConfigError
}

export async function saveSessionDataWithClient(
  client: FeedSessionsClient,
  payload: SessionReportPayload
) {
  let lastError: FeedSessionsSaveError = null

  for (let attempt = 0; attempt <= SAVE_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data, error } = await client
      .from("feed_sessions")
      .upsert([payload], { onConflict: "session_id" })
      .select()

    if (!error) {
      return data
    }

    lastError = error
    if (!isRetryableSaveError(error) || attempt === SAVE_RETRY_DELAYS_MS.length) {
      throw error
    }

    await wait(SAVE_RETRY_DELAYS_MS[attempt])
  }

  throw lastError
}

export async function saveSessionData(payload: SessionReportPayload) {
  return saveSessionDataWithClient(getSupabaseClient(), payload)
}
