type VideoPlaybackCandidate = {
  notify: (isPlaybackOwner: boolean) => void
  priority: number
  shouldOwnPlayback: boolean
  visibilityScore: number
}

const playbackRegistry = new Map<string, VideoPlaybackCandidate>()

function recomputePlaybackOwner() {
  const nextPlaybackOwnerId =
    [...playbackRegistry.entries()]
      .filter(([, candidate]) => {
        return candidate.shouldOwnPlayback && Number.isFinite(candidate.priority)
      })
      .sort((left, right) => {
        return (
          left[1].priority - right[1].priority ||
          right[1].visibilityScore - left[1].visibilityScore ||
          left[0].localeCompare(right[0])
        )
      })[0]?.[0] ?? null

  playbackRegistry.forEach((candidate, candidateId) => {
    candidate.notify(candidateId === nextPlaybackOwnerId)
  })
}

export function registerVideoPlaybackCandidate(
  candidateId: string,
  notify: (isPlaybackOwner: boolean) => void
) {
  playbackRegistry.set(candidateId, {
    notify,
    priority: Number.POSITIVE_INFINITY,
    shouldOwnPlayback: false,
    visibilityScore: 0,
  })
  recomputePlaybackOwner()
}

export function unregisterVideoPlaybackCandidate(candidateId: string) {
  if (!playbackRegistry.delete(candidateId)) {
    return
  }

  recomputePlaybackOwner()
}

export function updateVideoPlaybackCandidate(
  candidateId: string,
  {
    priority,
    shouldOwnPlayback,
    visibilityScore,
  }: {
    priority: number
    shouldOwnPlayback: boolean
    visibilityScore: number
  }
) {
  const candidate = playbackRegistry.get(candidateId)
  if (!candidate) {
    return
  }

  candidate.priority = shouldOwnPlayback ? priority : Number.POSITIVE_INFINITY
  candidate.shouldOwnPlayback = shouldOwnPlayback
  candidate.visibilityScore = shouldOwnPlayback ? visibilityScore : 0
  recomputePlaybackOwner()
}

export function resetVideoPlaybackCoordinatorForTests() {
  playbackRegistry.clear()
}
