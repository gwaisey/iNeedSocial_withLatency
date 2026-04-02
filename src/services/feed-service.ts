import { type FeedPayload, type ThemeMode } from "../types/social"

// ─── API Config ───────────────────────────────────────────────────────────────
const BASE_URL = ""
const USE_MOCK = true   // flip to false once backend is live

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// ─── Mock: load from /content/feed.json ──────────────────────────────────────
async function mockGetFeed(theme: ThemeMode): Promise<FeedPayload> {
  const { heroSlides, posts } = await apiFetch<FeedPayload>("/content/feed.json")
  return { theme, heroSlides, posts }
}

// ─── Real API ─────────────────────────────────────────────────────────────────
async function realGetFeed(theme: ThemeMode): Promise<FeedPayload> {
  return apiFetch<FeedPayload>(`/api/feed?theme=${theme}`)
}

// ─── Public service ───────────────────────────────────────────────────────────
export const socialFeedService = {
  getFeedByTheme(theme: ThemeMode): Promise<FeedPayload> {
    return USE_MOCK ? mockGetFeed(theme) : realGetFeed(theme)
  },
}
