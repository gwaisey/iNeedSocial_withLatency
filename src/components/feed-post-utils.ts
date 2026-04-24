import type { FeedPostPalette } from "./feed-post-chrome"

export function getFeedPostPalette(isDark: boolean): FeedPostPalette {
  return {
    iconBase: isDark ? "text-white" : "text-ink",
    textMuted: isDark ? "text-white/50" : "text-haze",
    textPrimary: isDark ? "text-white" : "text-ink",
  }
}
