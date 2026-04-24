import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const testDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testDir, "../..")

function readRepoFile(...segments: string[]) {
  return readFileSync(path.join(repoRoot, ...segments), "utf8")
}

describe("production artifacts", () => {
  it("keeps the site marked as noindex and free of stale branding", () => {
    const indexHtml = readRepoFile("index.html")
    const robotsTxt = readRepoFile("public", "robots.txt")

    expect(indexHtml).toContain('name="robots" content="noindex, nofollow"')
    expect(indexHtml).not.toContain("Grace")
    expect(robotsTxt).toContain("User-agent: *")
    expect(robotsTxt).toContain("Disallow: /")
  })

  it("ships the icon files declared by the manifest", () => {
    const manifest = JSON.parse(readRepoFile("public", "manifest.json")) as {
      icons?: Array<{ src: string }>
    }

    for (const icon of manifest.icons ?? []) {
      const iconPath = icon.src.replace(/^\/+/, "").split("/")
      expect(existsSync(path.join(repoRoot, "public", ...iconPath))).toBe(true)
    }

    expect(existsSync(path.join(repoRoot, "public", "icons", "apple-touch-icon.png"))).toBe(true)
  })
})
