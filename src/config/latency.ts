export const LATENCY_CONFIG = {
  BASE_MS: 500,       // starting latency for first 10 posts
  STEP_MS: 500,       // how much to add every 10 posts
  STEP_SIZE: 10,      // number of posts per step
}

export function getProgressiveLatency(index: number): number {
  const { BASE_MS, STEP_MS, STEP_SIZE } = LATENCY_CONFIG
  const step = Math.floor(index / STEP_SIZE)
  return BASE_MS + step * STEP_MS
}
