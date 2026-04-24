import { afterEach, describe, expect, it, vi } from "vitest"
import type { SessionReportPayload } from "../types/social"
import * as runtimeMonitoring from "../utils/runtime-monitoring"
import {
  isDuplicateSessionSaveError,
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
    values: SessionReportPayload[]
  }> = []

  const client: FeedSessionsClient = {
    from(table) {
      expect(table).toBe("feed_sessions")

      return {
        async insert(values) {
          calls.push({ values })
          return responses.shift() ?? { data: null, error: null }
        },
      }
    },
  }

  return { calls, client }
}

describe("supabase session saves", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("uses insert-only writes for feed session saves", async () => {
    const { calls, client } = createFeedSessionsClient([{ data: [payload], error: null }])

    await expect(saveSessionDataWithClient(client, payload)).resolves.toEqual([payload])
    expect(calls).toEqual([
      {
        values: [payload],
      },
    ])
  })

  it("retries transient save failures before succeeding", async () => {
    vi.useFakeTimers()
    const reportRuntimeIssueSpy = vi
      .spyOn(runtimeMonitoring, "reportRuntimeIssue")
      .mockImplementation((input) => ({
        error: input.error instanceof Error ? { message: input.error.message } : undefined,
        level: input.level,
        message: input.message,
        metadata: input.metadata,
        scope: input.scope,
        timestamp: "2026-04-20T00:00:00.000Z",
      }))

    const { calls, client } = createFeedSessionsClient([
      { data: null, error: { status: 503 } },
      { data: [payload], error: null },
    ])

    const savePromise = saveSessionDataWithClient(client, payload)
    await vi.runAllTimersAsync()

    await expect(savePromise).resolves.toEqual([payload])
    expect(calls).toHaveLength(2)
    expect(reportRuntimeIssueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.anything(),
        level: "warn",
        message: "Retrying feed session save after transient failure.",
        metadata: expect.objectContaining({
          attempt: 1,
          nextDelayMs: 150,
          sessionId: payload.session_id,
        }),
        scope: "supabase-save",
      })
    )
  })

  it("does not retry non-transient failures", async () => {
    const error = { status: 400 }
    const reportRuntimeIssueSpy = vi
      .spyOn(runtimeMonitoring, "reportRuntimeIssue")
      .mockImplementation((input) => ({
        error: input.error instanceof Error ? { message: input.error.message } : undefined,
        level: input.level,
        message: input.message,
        metadata: input.metadata,
        scope: input.scope,
        timestamp: "2026-04-20T00:00:00.000Z",
      }))
    const { calls, client } = createFeedSessionsClient([{ data: null, error }])

    await expect(saveSessionDataWithClient(client, payload)).rejects.toBe(error)
    expect(calls).toHaveLength(1)
    expect(isRetryableSaveError(error)).toBe(false)
    expect(reportRuntimeIssueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        level: "error",
        message: "Feed session save failed.",
        metadata: expect.objectContaining({
          attempt: 1,
          isRetryable: false,
          sessionId: payload.session_id,
        }),
        scope: "supabase-save",
      })
    )
  })

  it("treats duplicate session_id conflicts as an idempotent success", async () => {
    const duplicateError = {
      code: "23505",
      details: "Key (session_id)=(study_test_session) already exists.",
      message: "duplicate key value violates unique constraint",
      status: 409,
    }
    const { calls, client } = createFeedSessionsClient([{ data: null, error: duplicateError }])

    await expect(saveSessionDataWithClient(client, payload)).resolves.toBeNull()
    expect(calls).toHaveLength(1)
    expect(isDuplicateSessionSaveError(duplicateError)).toBe(true)
  })
})
