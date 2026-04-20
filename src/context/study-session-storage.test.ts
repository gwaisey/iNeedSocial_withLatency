import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearStudySession,
  isStudySessionEnded,
  isStudySessionResumable,
  readActiveStudySession,
  readFeedSessionSnapshot,
  readInteractionState,
  readTutorialState,
  startNewStudySession,
  writeInteractionState,
  writeFeedSessionSnapshot,
  writeTutorialState,
  type StorageLike,
} from "./study-session-storage"
import { createEmptyGenreTimes } from "../utils/feed-session"

function createMemoryStorage(): StorageLike {
  const storage = new Map<string, string>()

  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key)! : null
    },
    removeItem(key) {
      storage.delete(key)
    },
    setItem(key, value) {
      storage.set(key, value)
    },
  }
}

describe("study session storage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists interaction state inside the active session namespace", () => {
    const storage = createMemoryStorage()
    const sessionId = startNewStudySession(storage)

    writeInteractionState(storage, sessionId, "liked", { "post-1": true })

    expect(readInteractionState(storage, sessionId, "liked")).toEqual({ "post-1": true })
  })

  it("tracks the current active session separately from session data", () => {
    const storage = createMemoryStorage()
    const firstSessionId = startNewStudySession(storage)

    writeInteractionState(storage, firstSessionId, "liked", { "post-1": true })
    writeInteractionState(storage, firstSessionId, "reposted", { "post-2": true })

    const secondSessionId = startNewStudySession(storage)

    expect(readActiveStudySession(storage)).toBe(secondSessionId)
    expect(secondSessionId).not.toBe(firstSessionId)
    expect(readInteractionState(storage, secondSessionId, "liked")).toEqual({})
    expect(readInteractionState(storage, secondSessionId, "reposted")).toEqual({})
  })

  it("persists tutorial progress and feed snapshots inside the session namespace", () => {
    const storage = createMemoryStorage()
    const sessionId = startNewStudySession(storage)
    const genreTimes = createEmptyGenreTimes()
    genreTimes.humor = 2_000

    writeTutorialState(storage, sessionId, { completed: false, currentStep: 2 })
    writeFeedSessionSnapshot(storage, sessionId, {
      status: "active",
      genreTimes,
      finalizedGenreTimes: null,
      finalReport: null,
      hasSubmitted: false,
      submissionHasError: false,
      submissionMessage: null,
    })

    expect(readTutorialState(storage, sessionId)).toEqual({
      completed: false,
      currentStep: 2,
    })
    expect(readFeedSessionSnapshot(storage, sessionId)).toMatchObject({
      status: "active",
      genreTimes: {
        humor: 2_000,
      },
    })
  })

  it("resets tutorial progress and feed snapshots when a new study session starts", () => {
    const storage = createMemoryStorage()
    const firstSessionId = startNewStudySession(storage)

    writeTutorialState(storage, firstSessionId, { completed: false, currentStep: 1 })
    writeFeedSessionSnapshot(storage, firstSessionId, {
      status: "ended",
      genreTimes: createEmptyGenreTimes(),
      finalizedGenreTimes: null,
      finalReport: null,
      hasSubmitted: true,
      submissionHasError: false,
      submissionMessage: "Sesi berhasil disimpan.",
    })

    const secondSessionId = startNewStudySession(storage)

    expect(secondSessionId).not.toBe(firstSessionId)
    expect(readTutorialState(storage, secondSessionId)).toEqual({
      completed: false,
      currentStep: 0,
    })
    expect(readFeedSessionSnapshot(storage, secondSessionId)).toBeNull()
  })

  it("distinguishes resumable and ended sessions from the persisted snapshot", () => {
    const storage = createMemoryStorage()
    const sessionId = startNewStudySession(storage)

    expect(isStudySessionResumable(storage, sessionId)).toBe(true)
    expect(isStudySessionEnded(storage, sessionId)).toBe(false)

    writeFeedSessionSnapshot(storage, sessionId, {
      status: "ended",
      genreTimes: createEmptyGenreTimes(),
      finalizedGenreTimes: null,
      finalReport: null,
      hasSubmitted: false,
      submissionHasError: true,
      submissionMessage: "Sesi tidak dapat disimpan.",
    })

    expect(isStudySessionResumable(storage, sessionId)).toBe(false)
    expect(isStudySessionEnded(storage, sessionId)).toBe(true)
  })

  it("clears the active session id and its scoped data when discarding a session", () => {
    const storage = createMemoryStorage()
    const sessionId = startNewStudySession(storage)

    writeInteractionState(storage, sessionId, "liked", { "post-1": true })
    writeTutorialState(storage, sessionId, { completed: false, currentStep: 3 })
    writeFeedSessionSnapshot(storage, sessionId, {
      status: "active",
      genreTimes: createEmptyGenreTimes(),
      finalizedGenreTimes: null,
      finalReport: null,
      hasSubmitted: false,
      submissionHasError: false,
      submissionMessage: null,
    })

    clearStudySession(storage, sessionId)

    expect(readActiveStudySession(storage)).toBeNull()
    expect(readInteractionState(storage, sessionId, "liked")).toEqual({})
    expect(readTutorialState(storage, sessionId)).toEqual({
      completed: false,
      currentStep: 0,
    })
    expect(readFeedSessionSnapshot(storage, sessionId)).toBeNull()
  })

  it("logs the storage fallback only once when sessionStorage is unavailable", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const sessionStorageSpy = vi
      .spyOn(window, "sessionStorage", "get")
      .mockImplementation(() => {
        throw new Error("blocked")
      })

    vi.resetModules()
    const storageModule = await import("./study-session-storage")

    expect(storageModule.getSessionStorage()).toBeNull()
    expect(storageModule.getSessionStorage()).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)

    sessionStorageSpy.mockRestore()
  })
})
