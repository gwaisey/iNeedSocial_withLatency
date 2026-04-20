export type ThemeMode = "light" | "dark"

export const GENRE_KEYS = [
  "humor",
  "berita",
  "wisata",
  "makanan",
  "olahraga",
  "game",
] as const

export type GenreKey = (typeof GENRE_KEYS)[number]

export type GenreTimes = Record<GenreKey, number>

export type MediaItem = {
  src: string
  alt: string
  poster?: string   // video thumbnail
}

export type PostType = "image" | "carousel" | "video"

export type Post = {
  id: string
  type: PostType
  username: string
  likes: string
  caption: string
  media: MediaItem[]
  genre: GenreKey
}

export type FeedPayload = {
  theme: ThemeMode
  posts: Post[]
}

export type SessionReportPayload = {
  timestamp: string
  session_id: string
  total_time: number
  humor_ms: number
  berita_ms: number
  wisata_ms: number
  makanan_ms: number
  olahraga_ms: number
  game_ms: number
  app_version: string
}
