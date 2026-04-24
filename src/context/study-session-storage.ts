import type { GenreTimes, SessionReportPayload } from "../types/social"

export type InteractionState = Record<string, boolean>

export type InteractionKind = "liked" | "reposted"

export type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">

const STORAGE_NAMESPACE = "ineedsocial:study"
const ACTIVE_SESSION_KEY = `${STORAGE_NAMESPACE}:active-session`
const FEED_SNAPSHOT_SUFFIX = "feed-session"
const TUTORIAL_STATE_SUFFIX = "tutorial"
const VIDEO_AUDIO_PREFERENCE_SUFFIX = "video-audio-preference"
let hasWarnedStorageFallback = false

export type TutorialState = {
  completed: boolean
  currentStep: number
}

export type FeedSessionStatus = "active" | "ended"

export type FeedSessionSnapshot = {
  status: FeedSessionStatus
  genreTimes: GenreTimes
  finalizedGenreTimes: GenreTimes | null
  finalReport: SessionReportPayload | null
  hasSubmitted: boolean
  submissionHasError: boolean
  submissionMessage: string | null
}

export type VideoAudioPreference = {
  muted: boolean
}

function buildInteractionKey(sessionId: string, kind: InteractionKind) {
  return `${STORAGE_NAMESPACE}:${sessionId}:${kind}`
}

function buildSessionScopedKey(sessionId: string, suffix: string) {
  return `${STORAGE_NAMESPACE}:${sessionId}:${suffix}`
}

function createSessionId() {
  return `study_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function createDefaultTutorialState(): TutorialState {
  return {
    completed: false,
    currentStep: 0,
  }
}

function createDefaultVideoAudioPreference(): VideoAudioPreference {
  return {
    muted: true,
  }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function removeStudySessionData(storage: StorageLike, sessionId: string) {
  storage.removeItem(buildInteractionKey(sessionId, "liked"))
  storage.removeItem(buildInteractionKey(sessionId, "reposted"))
  storage.removeItem(buildSessionScopedKey(sessionId, FEED_SNAPSHOT_SUFFIX))
  storage.removeItem(buildSessionScopedKey(sessionId, TUTORIAL_STATE_SUFFIX))
  storage.removeItem(buildSessionScopedKey(sessionId, VIDEO_AUDIO_PREFERENCE_SUFFIX))
}

export function getSessionStorage(): StorageLike | null {
  try {
    return window.sessionStorage
  } catch {
    if (!hasWarnedStorageFallback) {
      console.warn(
        "[study-session-storage] sessionStorage tidak tersedia; state sesi akan bersifat sementara."
      )
      hasWarnedStorageFallback = true
    }
    return null
  }
}

export function readActiveStudySession(storage: StorageLike | null) {
  if (!storage) {
    return null
  }

  return storage.getItem(ACTIVE_SESSION_KEY)
}

export function clearStudySession(storage: StorageLike | null, sessionId?: string | null) {
  if (!storage) {
    return
  }

  const targetSessionId = sessionId ?? readActiveStudySession(storage)
  if (!targetSessionId) {
    return
  }

  removeStudySessionData(storage, targetSessionId)

  if (storage.getItem(ACTIVE_SESSION_KEY) === targetSessionId) {
    storage.removeItem(ACTIVE_SESSION_KEY)
  }
}

export function startNewStudySession(storage: StorageLike | null) {
  if (!storage) {
    return createSessionId()
  }

  clearStudySession(storage)

  const nextSessionId = createSessionId()
  storage.setItem(ACTIVE_SESSION_KEY, nextSessionId)
  return nextSessionId
}

export function isStudySessionResumable(storage: StorageLike | null, sessionId: string | null) {
  if (!sessionId) {
    return false
  }

  if (!storage) {
    return true
  }

  if (readActiveStudySession(storage) !== sessionId) {
    return false
  }

  return readFeedSessionSnapshot(storage, sessionId)?.status !== "ended"
}

export function isStudySessionEnded(storage: StorageLike | null, sessionId: string | null) {
  if (!storage || !sessionId) {
    return false
  }

  if (readActiveStudySession(storage) !== sessionId) {
    return false
  }

  return readFeedSessionSnapshot(storage, sessionId)?.status === "ended"
}

export function readInteractionState(
  storage: StorageLike | null,
  sessionId: string,
  kind: InteractionKind
) {
  if (!storage) {
    return {}
  }

  return safeParse(storage.getItem(buildInteractionKey(sessionId, kind)), {})
}

export function writeInteractionState(
  storage: StorageLike | null,
  sessionId: string,
  kind: InteractionKind,
  value: InteractionState
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(buildInteractionKey(sessionId, kind), JSON.stringify(value))
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}

export function readTutorialState(storage: StorageLike | null, sessionId: string): TutorialState {
  if (!storage) {
    return createDefaultTutorialState()
  }

  return safeParse(
    storage.getItem(buildSessionScopedKey(sessionId, TUTORIAL_STATE_SUFFIX)),
    createDefaultTutorialState()
  )
}

export function writeTutorialState(
  storage: StorageLike | null,
  sessionId: string,
  value: TutorialState
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(
      buildSessionScopedKey(sessionId, TUTORIAL_STATE_SUFFIX),
      JSON.stringify(value)
    )
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}

export function readVideoAudioPreference(
  storage: StorageLike | null,
  sessionId: string
): VideoAudioPreference {
  if (!storage) {
    return createDefaultVideoAudioPreference()
  }

  return safeParse(
    storage.getItem(buildSessionScopedKey(sessionId, VIDEO_AUDIO_PREFERENCE_SUFFIX)),
    createDefaultVideoAudioPreference()
  )
}

export function writeVideoAudioPreference(
  storage: StorageLike | null,
  sessionId: string,
  value: VideoAudioPreference
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(
      buildSessionScopedKey(sessionId, VIDEO_AUDIO_PREFERENCE_SUFFIX),
      JSON.stringify(value)
    )
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}

export function readFeedSessionSnapshot(
  storage: StorageLike | null,
  sessionId: string
): FeedSessionSnapshot | null {
  if (!storage) {
    return null
  }

  return safeParse<FeedSessionSnapshot | null>(
    storage.getItem(buildSessionScopedKey(sessionId, FEED_SNAPSHOT_SUFFIX)),
    null
  )
}

export function writeFeedSessionSnapshot(
  storage: StorageLike | null,
  sessionId: string,
  value: FeedSessionSnapshot | null
) {
  if (!storage) {
    return
  }

  try {
    const key = buildSessionScopedKey(sessionId, FEED_SNAPSHOT_SUFFIX)
    if (value === null) {
      storage.removeItem(key)
      return
    }

    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}
