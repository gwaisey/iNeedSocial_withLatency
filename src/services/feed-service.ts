import { z } from "zod"
import {
  GENRE_KEYS,
  type FeedPayload,
  type GenreKey,
  type MediaItem,
  type Post,
  type ThemeMode,
} from "../types/social"
import { reportRuntimeIssue } from "../utils/runtime-monitoring"

const VALID_GENRES = new Set<GenreKey>(GENRE_KEYS)

export type FeedSource = "mock" | "api"

type RawPost = Omit<Post, "genre"> & { genre?: string | null }

type RawFeedPayload = {
  posts: RawPost[]
}

function isVideoMediaSource(media: Pick<MediaItem, "src" | "streamUid">) {
  return Boolean(media.streamUid?.trim()) || /\.mp4($|\?)/i.test(media.src)
}

function validatePostMediaShape(post: RawPost, context: z.RefinementCtx) {
  const mediaKinds = post.media.map((item) => isVideoMediaSource(item))

  if (post.type === "image" && mediaKinds.some(Boolean)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Image posts cannot include video media.",
      path: ["media"],
    })
  }

  if (post.type === "video" && mediaKinds.some((isVideo) => !isVideo)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Video posts must use video media sources.",
      path: ["media"],
    })
  }

  if (post.type === "carousel" && post.media.length < 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Carousel posts must contain at least two media items.",
      path: ["media"],
    })
  }
}

const rawMediaSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string().trim().min(1),
    poster: z.string().optional(),
    streamUid: z.string().trim().min(1).optional(),
    streamDelivery: z.enum(["hls", "mp4"]).optional(),
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
  .superRefine(validatePostMediaShape)

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

  reportRuntimeIssue({
    error: result.error,
    level: "error",
    message: "Feed payload validation failed.",
    metadata: {
      issueCount: result.error.issues.length,
    },
    scope: "feed-service",
  })
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
