export const LATENCY_CONFIG = {
  BASE_MS: 0,         // first 10 posts: instant (0 ms)
  STEP_MS: 500,       // +500 ms every 10 posts after the first batch
  STEP_SIZE: 10,      // number of posts per step
}

export function getProgressiveLatency(index: number): number {
  const { STEP_MS, STEP_SIZE } = LATENCY_CONFIG
  const step = Math.floor(index / STEP_SIZE)
  if (step === 0) return 0
  return step * STEP_MS
}
