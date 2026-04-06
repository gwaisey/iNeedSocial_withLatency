// ─── Progressive Latency Config ───────────────────────────────────────────────
// Latency increases by 0.5s every 10 posts.
// Posts 0-9: 500ms, Posts 10-19: 1000ms, Posts 20-29: 1500ms, etc.

export const LATENCY_CONFIG = {
  BASE_MS: 500,       // starting latency for first 10 posts
  STEP_MS: 500,       // how much to add every 10 posts
  STEP_SIZE: 10,      // number of posts per step
}

/** Returns latency based on post index — increases every 10 posts */
export function getProgressiveLatency(index: number): number {
  const { BASE_MS, STEP_MS, STEP_SIZE } = LATENCY_CONFIG
  const step = Math.floor(index / STEP_SIZE)
  return BASE_MS + step * STEP_MS
}
