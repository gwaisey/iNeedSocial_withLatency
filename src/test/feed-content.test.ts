import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { validateFeedPayload } from "../services/feed-service"

type FeedPayload = {
  posts: Array<{
    id: string
    media: Array<{
      alt: string
      poster?: string
      src: string
      streamUid?: string
    }>
  }>
}

function readLocalFeedPayload(): FeedPayload {
  const feedPath = path.resolve(process.cwd(), "public/content/feed.json")
  return JSON.parse(readFileSync(feedPath, "utf8")) as FeedPayload
}

function resolvePublicAssetPath(assetPath: string) {
  const normalizedPath = assetPath.replace(/\?.*$/, "").replace(/^\/+/, "")
  return path.resolve(process.cwd(), "public", normalizedPath)
}

describe("local feed content", () => {
  it("matches the runtime feed schema", () => {
    const payload = readLocalFeedPayload()
    expect(() => validateFeedPayload(payload)).not.toThrow()
  })

  it("references local media and poster assets that exist on disk", () => {
    const payload = readLocalFeedPayload()
    const missingAssets: string[] = []

    payload.posts.forEach((post) => {
      post.media.forEach((media, index) => {
        ;[media.src, media.poster].forEach((assetPath) => {
          if (!assetPath || !assetPath.startsWith("/content/")) {
            return
          }

          if (!existsSync(resolvePublicAssetPath(assetPath))) {
            missingAssets.push(`${post.id} media ${index + 1}: ${assetPath}`)
          }
        })
      })
    })

    expect(missingAssets).toEqual([])
  })

  it("keeps descriptive alt text on every media item", () => {
    const payload = readLocalFeedPayload()
    const emptyAltMedia = payload.posts.flatMap((post) =>
      post.media
        .map((media, index) =>
          media.alt.trim().length > 0 ? null : `${post.id} media ${index + 1}: ${media.src}`
        )
        .filter((value): value is string => value !== null)
    )

    expect(emptyAltMedia).toEqual([])
  })
})
