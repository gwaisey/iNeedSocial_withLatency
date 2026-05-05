export type VideoPreloadDirection = "above" | "below" | "visible"
export type VideoPreloadRank = number | null

type VideoPreloadCandidate = {
  canPrewarm: boolean
  distancePx: number
  direction: VideoPreloadDirection
  notify: (preloadRank: VideoPreloadRank) => void
}

// Keep auto-preloading focused on nearby videos while giving fast mobile scrolls
// enough runway in both directions.
const MAX_AUTO_PRELOAD_VIDEOS = 5
const MAX_BELOW_PRELOAD_DISTANCE_PX = 12000
const MAX_ABOVE_PRELOAD_DISTANCE_PX = 12000
// Keep one nearby opposite-direction video warm so reversing scroll does not start cold.
const OPPOSITE_DIRECTION_WARM_SLOT_INDEX = 2
const registry = new Map<string, VideoPreloadCandidate>()
let preferredPreloadDirection: Exclude<VideoPreloadDirection, "visible"> = "below"

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

function pickPreloadCandidates(
  preferredCandidates: Array<[string, VideoPreloadCandidate]>,
  fallbackCandidates: Array<[string, VideoPreloadCandidate]>
) {
  const selectedCandidates: Array<[string, VideoPreloadCandidate]> = []

  const addPreferredCandidate = () => {
    const nextPreferredCandidate = preferredCandidates.shift()
    if (nextPreferredCandidate) {
      selectedCandidates.push(nextPreferredCandidate)
    }
  }

  while (
    selectedCandidates.length < MAX_AUTO_PRELOAD_VIDEOS &&
    (preferredCandidates.length > 0 || fallbackCandidates.length > 0)
  ) {
    if (
      selectedCandidates.length === OPPOSITE_DIRECTION_WARM_SLOT_INDEX &&
      fallbackCandidates.length > 0
    ) {
      const fallbackCandidate = fallbackCandidates.shift()
      if (fallbackCandidate) {
        selectedCandidates.push(fallbackCandidate)
      }
      continue
    }

    if (preferredCandidates.length > 0) {
      addPreferredCandidate()
      continue
    }

    const fallbackCandidate = fallbackCandidates.shift()
    if (fallbackCandidate) {
      selectedCandidates.push(fallbackCandidate)
    }
  }

  return selectedCandidates
}

function recomputeBudget() {
  const preferredCandidates = getEligibleCandidates({
    direction: preferredPreloadDirection,
    maxDistancePx:
      preferredPreloadDirection === "below"
        ? MAX_BELOW_PRELOAD_DISTANCE_PX
        : MAX_ABOVE_PRELOAD_DISTANCE_PX,
  })
  const fallbackDirection = preferredPreloadDirection === "below" ? "above" : "below"
  const fallbackCandidates = getEligibleCandidates({
    direction: fallbackDirection,
    maxDistancePx:
      fallbackDirection === "below" ? MAX_BELOW_PRELOAD_DISTANCE_PX : MAX_ABOVE_PRELOAD_DISTANCE_PX,
  })

  const preloadRanks = new Map<string, number>(
    pickPreloadCandidates(preferredCandidates, fallbackCandidates)
      .map(([candidateId], index) => [candidateId, index])
  )

  registry.forEach((candidate, candidateId) => {
    candidate.notify(preloadRanks.get(candidateId) ?? null)
  })
}

export function setVideoPreloadScrollDirection(direction: "down" | "none" | "up") {
  const nextPreferredDirection = direction === "up" ? "above" : "below"
  if (preferredPreloadDirection === nextPreferredDirection) {
    return
  }

  preferredPreloadDirection = nextPreferredDirection
  recomputeBudget()
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
  preferredPreloadDirection = "below"
}
