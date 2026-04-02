export type ThemeMode = "light" | "dark"

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
}

export type HeroSlide = {
  id: string
  src: string
  alt: string
}

export type FeedPayload = {
  theme: ThemeMode
  heroSlides: HeroSlide[]
  posts: Post[]
}
