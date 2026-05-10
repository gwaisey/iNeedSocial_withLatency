import { readdirSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const imagesDir = join(repoRoot, "public", "content", "files")
const outputPath = join(repoRoot, "src", "components", "progressive-image-dimensions.ts")
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"])

function runBinary(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  })

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}.\n${result.stderr}`
    )
  }

  return result.stdout.trim()
}

function getSortedImageFiles() {
  return readdirSync(imagesDir)
    .filter((entry) => {
      const extension = entry.slice(entry.lastIndexOf(".")).toLowerCase()
      return imageExtensions.has(extension)
    })
    .sort((left, right) => left.localeCompare(right))
}

function readImageDimensions(filePath) {
  const output = runBinary("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0:s=x",
    filePath,
  ])

  const [widthText, heightText] = output.split("x")
  const width = Number.parseInt(widthText ?? "", 10)
  const height = Number.parseInt(heightText ?? "", 10)

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Unable to read dimensions for ${filePath}`)
  }

  return { height, width }
}

function main() {
  const entries = getSortedImageFiles().map((fileName) => {
    const filePath = join(imagesDir, fileName)
    const { width, height } = readImageDimensions(filePath)
    const publicPath = `/${relative(join(repoRoot, "public"), filePath).replaceAll("\\", "/")}`
    return `  "${publicPath}": { width: ${width}, height: ${height} },`
  })

  const contents = [
    "export type ProgressiveImageDimensions = {",
    "  readonly width: number",
    "  readonly height: number",
    "}",
    "",
    "export const KNOWN_PROGRESSIVE_IMAGE_DIMENSIONS: Record<string, ProgressiveImageDimensions> = {",
    ...entries,
    "}",
    "",
  ].join("\n")

  writeFileSync(outputPath, contents, "utf8")
  console.log(`Generated dimensions for ${entries.length} feed images.`)
}

main()
