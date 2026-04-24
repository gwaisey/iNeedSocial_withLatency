export type VideoPreloadDirection = "above" | "below" | "visible"
export type VideoPreloadRank = number | null

type VideoPreloadCandidate = {
  canPrewarm: boolean
  distancePx: number
  direction: VideoPreloadDirection
  notify: (preloadRank: VideoPreloadRank) => void
}

// Keep auto-preloading focused on the next few videos so we buffer enough data
// for instant playback once a video becomes visible, especially on real networks.
const MAX_AUTO_PRELOAD_VIDEOS = 4
const MAX_BELOW_PRELOAD_DISTANCE_PX = 12000
const MAX_ABOVE_PRELOAD_DISTANCE_PX = 900
const registry = new Map<string, VideoPreloadCandidate>()

function getEligibleCandidates({
  direction,
  maxDistancePx,
}: {
  readonly direction: Exclude<VideoPreloadDirection, "visible">
  readonly maxDistancePx: number
}) {
  return [...registry.entries()]
    .filter(([, candidate]) => {
      return (
        candidate.canPrewarm &&
        candidate.direction === direction &&
        Number.isFinite(candidate.distancePx) &&
        candidate.distancePx <= maxDistancePx
      )
    })
    .sort((left, right) => {
      return left[1].distancePx - right[1].distancePx || left[0].localeCompare(right[0])
    })
}

function recomputeBudget() {
  const belowCandidates = getEligibleCandidates({
    direction: "below",
    maxDistancePx: MAX_BELOW_PRELOAD_DISTANCE_PX,
  })

  const preloadRanks = new Map<string, number>(
    (belowCandidates.length > 0
      ? belowCandidates
      : getEligibleCandidates({
          direction: "above",
          maxDistancePx: MAX_ABOVE_PRELOAD_DISTANCE_PX,
        })
    )
      .slice(0, MAX_AUTO_PRELOAD_VIDEOS)
      .map(([candidateId], index) => [candidateId, index])
  )

  registry.forEach((candidate, candidateId) => {
    candidate.notify(preloadRanks.get(candidateId) ?? null)
  })
}

export function registerVideoPreloadCandidate(
  candidateId: string,
  notify: (preloadRank: VideoPreloadRank) => void
) {
  registry.set(candidateId, {
    canPrewarm: false,
    distancePx: Number.POSITIVE_INFINITY,
    direction: "below",
    notify,
  })
  recomputeBudget()
}

export function unregisterVideoPreloadCandidate(candidateId: string) {
  if (!registry.delete(candidateId)) {
    return
  }

  recomputeBudget()
}

export function updateVideoPreloadCandidate(
  candidateId: string,
  {
    canPrewarm,
    distancePx,
    direction,
  }: {
    canPrewarm: boolean
    distancePx: number
    direction: VideoPreloadDirection
  }
) {
  const candidate = registry.get(candidateId)
  if (!candidate) {
    return
  }

  candidate.canPrewarm = canPrewarm
  candidate.distancePx = canPrewarm ? distancePx : Number.POSITIVE_INFINITY
  candidate.direction = direction
  recomputeBudget()
}

export function resetVideoPreloadBudgetForTests() {
  registry.clear()
}
