// ─── Progressive Latency Config ───────────────────────────────────────────────
// Each post reveals slower as the user scrolls deeper into the feed.
// Post 0 = MIN_MS, last post = MAX_MS, linear scale in between.

export const LATENCY_CONFIG = {
  MIN_MS: 800,
  MAX_MS: 4000,
  TOTAL_POSTS: 120,
}

/** Returns a linearly increasing delay based on post index (0 = first post) */
export function getProgressiveLatency(index: number): number {
  const { MIN_MS, MAX_MS, TOTAL_POSTS } = LATENCY_CONFIG
  const clamped = Math.min(index, TOTAL_POSTS - 1)
  return Math.round(MIN_MS + (MAX_MS - MIN_MS) * (clamped / (TOTAL_POSTS - 1)))
}
