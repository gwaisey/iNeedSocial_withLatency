import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const videosDir = join(repoRoot, "public", "content", "videos")
const postersDir = join(repoRoot, "public", "content", "video-posters")
const dimensionsOutputPath = join(
  repoRoot,
  "src",
  "components",
  "auto-play-video-poster-dimensions.ts"
)

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

function getSortedFiles(directory, extension) {
  return readdirSync(directory)
    .filter((entry) => entry.toLowerCase().endsWith(extension))
    .sort((left, right) => left.localeCompare(right))
}

function extractPoster(videoFileName) {
  const inputPath = join(videosDir, videoFileName)
  const outputPath = join(postersDir, `${basename(videoFileName, ".mp4")}.jpg`)

  runBinary("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "select=eq(n\\,0)",
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ])
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

function writeDimensionsFile() {
  const posterFiles = getSortedFiles(postersDir, ".jpg")
  const entries = posterFiles.map((posterFileName) => {
    const filePath = join(postersDir, posterFileName)
    const { width, height } = readImageDimensions(filePath)
    const publicPath = `/${relative(join(repoRoot, "public"), filePath).replaceAll("\\", "/")}`
    return `  "${publicPath}": { width: ${width}, height: ${height} },`
  })

  const contents = [
    "export type VideoPosterDimensions = {",
    "  readonly width: number",
    "  readonly height: number",
    "}",
    "",
    "export const KNOWN_VIDEO_POSTER_DIMENSIONS: Record<string, VideoPosterDimensions> = {",
    ...entries,
    "}",
    "",
  ].join("\n")

  writeFileSync(dimensionsOutputPath, contents, "utf8")
}

function main() {
  mkdirSync(postersDir, { recursive: true })

  const videoFiles = getSortedFiles(videosDir, ".mp4")
  if (videoFiles.length === 0) {
    throw new Error(`No MP4 files found in ${videosDir}`)
  }

  for (const videoFileName of videoFiles) {
    extractPoster(videoFileName)
  }

  writeDimensionsFile()

  const totalPosterBytes = getSortedFiles(postersDir, ".jpg")
    .map((fileName) => statSync(join(postersDir, fileName)).size)
    .reduce((sum, size) => sum + size, 0)

  console.log(
    `Generated ${videoFiles.length} posters in ${postersDir} (${Math.round(totalPosterBytes / 1024)} KiB).`
  )
}

main()
