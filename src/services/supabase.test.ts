import { afterEach, describe, expect, it, vi } from "vitest"
import type { SessionReportPayload } from "../types/social"
import {
  isRetryableSaveError,
  saveSessionDataWithClient,
  type FeedSessionsClient,
} from "./supabase"

type SaveResponse = {
  data: SessionReportPayload[] | null
  error: Error | { message?: string; status?: number } | null
}

const payload: SessionReportPayload = {
  timestamp: "2026-04-13T00:00:00.000Z",
  session_id: "study_test_session",
  total_time: 3_000,
  humor_ms: 2_000,
  berita_ms: 500,
  wisata_ms: 0,
  makanan_ms: 500,
  olahraga_ms: 0,
  game_ms: 0,
  app_version: "without_latency",
}

function createFeedSessionsClient(responses: SaveResponse[]) {
  const calls: Array<{
    options: { onConflict: string }
    values: SessionReportPayload[]
  }> = []

  const client: FeedSessionsClient = {
    from(table) {
      expect(table).toBe("feed_sessions")

      return {
        upsert(values, options) {
          calls.push({ options, values })

          return {
            async select() {
              return responses.shift() ?? { data: null, error: null }
            },
          }
        },
      }
    },
  }

  return { calls, client }
}

describe("supabase session saves", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("uses session_id upsert to keep saves idempotent", async () => {
    const { calls, client } = createFeedSessionsClient([{ data: [payload], error: null }])

    await expect(saveSessionDataWithClient(client, payload)).resolves.toEqual([payload])
    expect(calls).toEqual([
      {
        options: { onConflict: "session_id" },
        values: [payload],
      },
    ])
  })

  it("retries transient save failures before succeeding", async () => {
    vi.useFakeTimers()

    const { calls, client } = createFeedSessionsClient([
      { data: null, error: { status: 503 } },
      { data: [payload], error: null },
    ])

    const savePromise = saveSessionDataWithClient(client, payload)
    await vi.runAllTimersAsync()

    await expect(savePromise).resolves.toEqual([payload])
    expect(calls).toHaveLength(2)
  })

  it("does not retry non-transient failures", async () => {
    const error = { status: 400 }
    const { calls, client } = createFeedSessionsClient([{ data: null, error }])

    await expect(saveSessionDataWithClient(client, payload)).rejects.toBe(error)
    expect(calls).toHaveLength(1)
    expect(isRetryableSaveError(error)).toBe(false)
  })
})
