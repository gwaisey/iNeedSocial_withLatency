// ─── Variative Latency Config ─────────────────────────────────────────────────
// Controls how long each post takes to "reveal" after entering the viewport.
// Adjust MIN and MAX to change the range of the random delay.

export const LATENCY_CONFIG = {
  MIN_MS: 2000,   // minimum 2 seconds
  MAX_MS: 4000,   // maximum 4 seconds
}

/** Returns a random integer between MIN_MS and MAX_MS (inclusive) */
export function getRandomLatency(): number {
  return Math.floor(
    Math.random() * (LATENCY_CONFIG.MAX_MS - LATENCY_CONFIG.MIN_MS + 1)
      + LATENCY_CONFIG.MIN_MS
  )
}
