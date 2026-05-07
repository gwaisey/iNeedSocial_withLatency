type NetworkInformationLike = {
  readonly downlink?: number
  readonly effectiveType?: string
  readonly saveData?: boolean
}

export type VideoNetworkPreloadPolicy = {
  readonly aggressiveAutoLoadMaxRank: number
  readonly maxAbovePreloadDistancePx: number
  readonly maxAutoPreloadVideos: number
  readonly maxBelowPreloadDistancePx: number
  readonly oppositeDirectionWarmSlotIndex: number
}

export const DEFAULT_VIDEO_NETWORK_PRELOAD_POLICY: VideoNetworkPreloadPolicy = {
  aggressiveAutoLoadMaxRank: 5,
  maxAbovePreloadDistancePx: 18_000,
  maxAutoPreloadVideos: 7,
  maxBelowPreloadDistancePx: 18_000,
  oppositeDirectionWarmSlotIndex: 3,
}

const MOBILE_VIDEO_NETWORK_PRELOAD_POLICY: VideoNetworkPreloadPolicy = {
  aggressiveAutoLoadMaxRank: 1,
  maxAbovePreloadDistancePx: 6_500,
  maxAutoPreloadVideos: 3,
  maxBelowPreloadDistancePx: 9_000,
  oppositeDirectionWarmSlotIndex: 2,
}

const FAST_MOBILE_VIDEO_NETWORK_PRELOAD_POLICY: VideoNetworkPreloadPolicy = {
  aggressiveAutoLoadMaxRank: 2,
  maxAbovePreloadDistancePx: 10_000,
  maxAutoPreloadVideos: 4,
  maxBelowPreloadDistancePx: 12_000,
  oppositeDirectionWarmSlotIndex: 3,
}

const CONSTRAINED_VIDEO_NETWORK_PRELOAD_POLICY: VideoNetworkPreloadPolicy = {
  aggressiveAutoLoadMaxRank: -1,
  maxAbovePreloadDistancePx: 3_500,
  maxAutoPreloadVideos: 1,
  maxBelowPreloadDistancePx: 6_000,
  oppositeDirectionWarmSlotIndex: 1,
}

const SAVE_DATA_VIDEO_NETWORK_PRELOAD_POLICY: VideoNetworkPreloadPolicy = {
  aggressiveAutoLoadMaxRank: -1,
  maxAbovePreloadDistancePx: 0,
  maxAutoPreloadVideos: 0,
  maxBelowPreloadDistancePx: 0,
  oppositeDirectionWarmSlotIndex: 1,
}

function getConnection() {
  const navigatorWithConnection = globalThis.navigator as
    | (Navigator & {
        connection?: NetworkInformationLike
        mozConnection?: NetworkInformationLike
        webkitConnection?: NetworkInformationLike
      })
    | undefined

  return (
    navigatorWithConnection?.connection ??
    navigatorWithConnection?.mozConnection ??
    navigatorWithConnection?.webkitConnection
  )
}

function hasCoarsePointer() {
  const globalWithMatchMedia = globalThis as typeof globalThis & {
    matchMedia?: (query: string) => MediaQueryList
  }

  return (
    typeof globalWithMatchMedia.matchMedia === "function" &&
    globalWithMatchMedia.matchMedia("(pointer: coarse)").matches
  )
}

function isConstrainedConnection(connection: NetworkInformationLike | undefined) {
  const effectiveType = connection?.effectiveType?.toLowerCase()
  return (
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g" ||
    (typeof connection?.downlink === "number" && connection.downlink > 0 && connection.downlink <= 2)
  )
}

function isFastMobileConnection(connection: NetworkInformationLike | undefined) {
  if (connection?.saveData === true) {
    return false
  }

  return (
    connection?.effectiveType?.toLowerCase() === "4g" &&
    typeof connection.downlink === "number" &&
    connection.downlink >= 5
  )
}

export function getVideoNetworkPreloadPolicy(): VideoNetworkPreloadPolicy {
  const connection = getConnection()

  if (connection?.saveData === true) {
    return SAVE_DATA_VIDEO_NETWORK_PRELOAD_POLICY
  }

  if (isConstrainedConnection(connection)) {
    return CONSTRAINED_VIDEO_NETWORK_PRELOAD_POLICY
  }

  if (hasCoarsePointer()) {
    if (isFastMobileConnection(connection)) {
      return FAST_MOBILE_VIDEO_NETWORK_PRELOAD_POLICY
    }

    return MOBILE_VIDEO_NETWORK_PRELOAD_POLICY
  }

  return DEFAULT_VIDEO_NETWORK_PRELOAD_POLICY
}

export function shouldUseCompactVideoSource() {
  const connection = getConnection()
  return connection?.saveData === true || isConstrainedConnection(connection) || hasCoarsePointer()
}
