import { z } from "zod"
import {
  GENRE_KEYS,
  type FeedPayload,
  type GenreKey,
  type Post,
  type ThemeMode,
} from "../types/social"

const VALID_GENRES = new Set<GenreKey>(GENRE_KEYS)

export type FeedSource = "mock" | "api"

type RawPost = Omit<Post, "genre"> & { genre?: string | null }

type RawFeedPayload = {
  posts: RawPost[]
}

const rawMediaSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string(),
    poster: z.string().optional(),
  })
  .strict()

const rawPostSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["image", "carousel", "video"]),
    username: z.string(),
    likes: z.string(),
    caption: z.string(),
    media: z.array(rawMediaSchema).min(1),
    genre: z.string().nullable().optional(),
  })
  .strict()

const rawFeedPayloadSchema = z
  .object({
    posts: z.array(rawPostSchema),
  })
  .strict()

export function resolveFeedSource(value: string | undefined): FeedSource {
  return value === "api" ? "api" : "mock"
}

export function resolveFeedPath(path: string, baseUrl = import.meta.env.BASE_URL) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.replace(/^\/+/, "")
  return `${normalizedBaseUrl}${normalizedPath}`
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveFeedPath(path), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Permintaan data gagal dengan status ${response.status} untuk ${path}.`)
  }

  return response.json() as Promise<T>
}

function normalizeGenre(genre?: string | null): GenreKey {
  return VALID_GENRES.has(genre as GenreKey) ? (genre as GenreKey) : "humor"
}

export function validateFeedPayload(payload: unknown): RawFeedPayload {
  const result = rawFeedPayloadSchema.safeParse(payload)
  if (result.success) {
    return result.data
  }

  console.error("[feed-service:validation]", result.error)
  throw new Error("Format feed tidak valid.")
}

export function normalizeFeedPayload(theme: ThemeMode, payload: RawFeedPayload): FeedPayload {
  return {
    theme,
    posts: payload.posts.map((post) => ({
      ...post,
      genre: normalizeGenre(post.genre),
    })),
  }
}

async function mockGetFeed(theme: ThemeMode): Promise<FeedPayload> {
  const payload = validateFeedPayload(await apiFetch<unknown>("content/feed.json"))
  return normalizeFeedPayload(theme, payload)
}

async function realGetFeed(theme: ThemeMode): Promise<FeedPayload> {
  const payload = validateFeedPayload(await apiFetch<unknown>(`api/feed?theme=${theme}`))
  return normalizeFeedPayload(theme, payload)
}

export const socialFeedService = {
  getFeedByTheme(theme: ThemeMode): Promise<FeedPayload> {
    const feedSource = resolveFeedSource(import.meta.env.VITE_FEED_SOURCE)
    return feedSource === "api" ? realGetFeed(theme) : mockGetFeed(theme)
  },
}
