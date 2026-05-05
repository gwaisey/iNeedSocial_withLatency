import { spawn } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"
import { preview as createVitePreviewServer } from "vite"
import * as XLSX from "xlsx"

const PREVIEW_HOST = "127.0.0.1"
const PREVIEW_PORT = 4176
const DEFAULT_SHEET_NAME = "Semua Sesi"
const EXPORT_FILE_PATTERN = /^Laporan_Semua_Sesi_\d{4}-\d{2}-\d{2}\.xlsx$/
const GENRE_KEYS = ["humor", "berita", "wisata", "makanan", "olahraga", "game"]
const SESSION_VIEWPORTS = [
  {
    contextOptions: {
      hasTouch: false,
      isMobile: false,
      viewport: { height: 900, width: 1280 },
    },
    label: "desktop",
  },
  {
    contextOptions: {
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 },
    },
    label: "mobile",
  },
]

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    workbookPath: null,
    sessionId: null,
  }

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token === "--workbook") {
      parsed.workbookPath = args[index + 1] ?? null
      index += 1
      continue
    }
    if (token === "--session-id") {
      parsed.sessionId = args[index + 1] ?? null
      index += 1
      continue
    }
  }

  return parsed
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return NaN
}

function coerceRowNumber(row, key) {
  return normalizeNumber(row[key])
}

function buildReportFromRow(row) {
  const totalTime = coerceRowNumber(row, "total_time")
  const categoryTimes = Object.fromEntries(
    GENRE_KEYS.map((genre) => [genre, coerceRowNumber(row, `${genre}_ms`)])
  )
  const categoryCounts = Object.fromEntries(
    GENRE_KEYS.map((genre) => [genre, coerceRowNumber(row, `${genre}_count`)])
  )

  const categoryTimeSum = GENRE_KEYS.reduce(
    (runningTotal, genre) => runningTotal + categoryTimes[genre],
    0
  )

  const countsAreNonNegative = GENRE_KEYS.every((genre) => {
    const value = categoryCounts[genre]
    return Number.isFinite(value) && value >= 0
  })

  return {
    categoryCounts,
    categoryTimeSum,
    categoryTimes,
    countsAreNonNegative,
    totalTime,
  }
}

function findLatestWorkbookPath() {
  const root = process.cwd()
  const candidates = readdirSync(root)
    .filter((name) => EXPORT_FILE_PATTERN.test(name))
    .map((name) => {
      const absolutePath = path.join(root, name)
      return {
        absolutePath,
        modifiedTime: statSync(absolutePath).mtimeMs,
      }
    })

  if (candidates.length === 0) {
    throw new Error(
      "Tidak menemukan file ekspor sesi. Jalankan `npm run export:all-sessions` terlebih dahulu."
    )
  }

  candidates.sort((left, right) => right.modifiedTime - left.modifiedTime)
  return candidates[0].absolutePath
}

function findExportRow({ sessionId, workbookPath }) {
  if (!existsSync(workbookPath)) {
    throw new Error(`File workbook tidak ditemukan: ${workbookPath}`)
  }

  const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer" })
  const sheetName = workbook.SheetNames.includes(DEFAULT_SHEET_NAME)
    ? DEFAULT_SHEET_NAME
    : workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null })
  const targetRow = rows.find((row) => String(row.session_id ?? "") === String(sessionId))

  if (!targetRow) {
    throw new Error(
      `Session ${sessionId} tidak ditemukan di workbook ${workbookPath} (sheet: ${sheetName}).`
    )
  }

  return {
    row: targetRow,
    sheetName,
  }
}

function buildMachineReadableSummary({
  sessionResults,
  workbookPath,
}) {
  const passed = sessionResults.every((result) => result.passed)

  return {
    passed,
    workbookPath,
    sessionResults,
  }
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm"
}

function spawnProcess(command, args, options) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    ...options,
  })
}

function spawnNpm(args, options = {}) {
  const npmCommand = getNpmCommand()
  if (process.platform !== "win32") {
    return spawnProcess(npmCommand, args, options)
  }

  const commandLine = [npmCommand, ...args].join(" ")
  return spawnProcess("cmd.exe", ["/d", "/s", "/c", commandLine], options)
}

async function runNpmCommand(args, options = {}) {
  const {
    capture = false,
    stdio = capture ? ["ignore", "pipe", "pipe"] : "inherit",
  } = options

  return new Promise((resolve, reject) => {
    const child = spawnNpm(args, { stdio })

    let stdout = ""
    let stderr = ""

    if (capture && child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk)
      })
    }

    if (capture && child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk)
      })
    }

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr })
        return
      }

      reject(
        new Error(
          `Perintah gagal (npm ${args.join(" ")}), exit code ${code}${
            capture && stderr ? `\n${stderr}` : ""
          }`
        )
      )
    })
  })
}

function readFeedTargets() {
  const feedPath = path.join(process.cwd(), "public", "content", "feed.json")
  const raw = readFileSync(feedPath, "utf8")
  const parsed = JSON.parse(raw)
  const posts = Array.isArray(parsed?.posts) ? parsed.posts : []
  const seenGenres = new Set()
  const targets = []

  for (const post of posts) {
    if (!post || typeof post !== "object") {
      continue
    }

    const genre = typeof post.genre === "string" ? post.genre : null
    const id = typeof post.id === "string" ? post.id : null
    if (!genre || !id || seenGenres.has(genre)) {
      continue
    }

    seenGenres.add(genre)
    targets.push({
      id,
      genre,
    })

    if (targets.length >= 4) {
      break
    }
  }

  if (targets.length < 2) {
    throw new Error("Target post untuk verifikasi sesi tidak cukup. Periksa feed.json.")
  }

  return targets
}

async function dismissTutorialIfVisible(page) {
  const skipButton = page.getByTestId("tutorial-skip-button")
  try {
    await skipButton.waitFor({ state: "visible", timeout: 2_500 })
    await skipButton.click()
    await skipButton.waitFor({ state: "detached", timeout: 10_000 })
  } catch {
    // Tutorial mungkin memang tidak muncul untuk sesi ini.
  }
}

async function scrollToPostById(page, postId) {
  const selector = `[data-regular-post-id="${postId}"]`

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const post = page.locator(selector)
    if ((await post.count()) > 0) {
      await post.first().evaluate((element) => {
        element.scrollIntoView({ block: "center", inline: "nearest" })
      })
      await post.first().waitFor({ state: "visible", timeout: 5_000 })
      return
    }

    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(120)
  }

  throw new Error(`Post ${postId} tidak ditemukan saat verifikasi sesi.`)
}

async function readCurrentSessionSnapshot(page) {
  return page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return null
    }

    const raw = window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:feed-session`)
    const snapshot = raw ? JSON.parse(raw) : null

    return {
      sessionId,
      snapshot,
    }
  })
}

async function clickEndSession(page) {
  const timerButtonIds = [
    "sidebar-timer-open-button",
    "timer-open-button-mobile",
    "timer-open-button",
  ]

  for (const testId of timerButtonIds) {
    const button = page.getByTestId(testId).first()
    if ((await button.count()) === 0) {
      continue
    }

    if (await button.isVisible()) {
      await button.click()
      return
    }
  }

  await page.mouse.wheel(0, -1_200)
  for (const testId of timerButtonIds) {
    const button = page.getByTestId(testId).first()
    if ((await button.count()) === 0) {
      continue
    }

    if (await button.isVisible()) {
      await button.click()
      return
    }
  }

  throw new Error("Tidak menemukan tombol akhiri sesi yang bisa diklik.")
}

async function startPreviewServer() {
  const previewServer = await createVitePreviewServer({
    preview: {
      host: PREVIEW_HOST,
      port: PREVIEW_PORT,
      strictPort: false,
    },
  })

  const address = previewServer.httpServer?.address()
  if (!address || typeof address === "string") {
    throw new Error("Alamat preview server tidak valid.")
  }

  return {
    previewServer,
    previewUrl: `http://${PREVIEW_HOST}:${address.port}`,
  }
}

async function closePreviewServer(previewServer) {
  if (!previewServer) {
    return
  }

  if (typeof previewServer.close === "function") {
    await previewServer.close()
    return
  }

  if (previewServer.httpServer) {
    await new Promise((resolve, reject) => {
      previewServer.httpServer.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}

async function runDisposableSession({
  browser,
  contextOptions,
  label,
  previewUrl,
}) {
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  const consoleErrors = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  try {
    await page.goto(`${previewUrl}/`, { waitUntil: "domcontentloaded" })
    await page.waitForURL("**/welcome")
    await page.getByTestId("start-study-button").click()
    await page.waitForURL("**/feed?theme=light")
    await dismissTutorialIfVisible(page)
    await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })

    const targets = readFeedTargets()
    for (const target of targets) {
      await scrollToPostById(page, target.id)
      await page.waitForTimeout(1_000)
    }

    await page.waitForFunction(() => {
      const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
      if (!sessionId) {
        return false
      }

      const raw = window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:feed-session`)
      if (!raw) {
        return false
      }

      const snapshot = JSON.parse(raw)
      const genreTimes = snapshot?.genreTimes ?? {}
      const total = Object.values(genreTimes).reduce((sum, value) => sum + Number(value || 0), 0)
      return total >= 2_000
    })

    const preSubmit = await readCurrentSessionSnapshot(page)
    if (!preSubmit?.sessionId || !preSubmit?.snapshot?.genreCounts) {
      throw new Error("Snapshot sesi sebelum submit tidak valid.")
    }

    await clickEndSession(page)
    await page.waitForURL("**/thank-you")
    const saveStatus = page.getByTestId("session-save-status")
    await saveStatus.waitFor({ state: "visible" })
    const saveStatusText = ((await saveStatus.textContent()) ?? "").trim()

    if (!/berhasil disimpan/i.test(saveStatusText)) {
      throw new Error(`Penyimpanan sesi tidak sukses: "${saveStatusText}"`)
    }

    const postSubmit = await readCurrentSessionSnapshot(page)
    if (!postSubmit?.sessionId) {
      throw new Error("Session id hilang setelah submit sesi.")
    }

    if (consoleErrors.length > 0) {
      throw new Error(
        `[${label}] Terdapat console error saat disposable session: ${consoleErrors.join(" | ")}`
      )
    }

    return {
      label,
      sessionId: postSubmit.sessionId,
      snapshotCounts:
        postSubmit.snapshot?.genreCounts ??
        preSubmit.snapshot.genreCounts,
    }
  } finally {
    await context.close()
  }
}

function assertCountsMatch(snapshotCounts, exportedCounts) {
  return GENRE_KEYS.every(
    (genre) => normalizeNumber(snapshotCounts?.[genre]) === normalizeNumber(exportedCounts?.[genre])
  )
}

async function main() {
  const { workbookPath: providedWorkbookPath, sessionId: providedSessionId } = parseArgs()

  const sessionRuns = []

  if (providedSessionId) {
    sessionRuns.push({
      label: "manual",
      sessionId: providedSessionId,
      snapshotCounts: null,
    })
  } else {
    console.log("Menjalankan disposable live session desktop + mobile untuk verifikasi ekspor...")
    const { previewServer, previewUrl } = await startPreviewServer()
    const browser = await chromium.launch({ headless: true })

    try {
      for (const viewportProfile of SESSION_VIEWPORTS) {
        const sessionRun = await runDisposableSession({
          browser,
          contextOptions: viewportProfile.contextOptions,
          label: viewportProfile.label,
          previewUrl,
        })
        sessionRuns.push(sessionRun)
      }
    } finally {
      await browser.close()
      await closePreviewServer(previewServer)
    }
  }

  console.log(`Session target: ${sessionRuns.map((run) => `${run.label}:${run.sessionId}`).join(", ")}`)
  const shouldRunExport = !providedWorkbookPath
  if (shouldRunExport) {
    console.log("Menjalankan ekspor semua sesi...")
    await runNpmCommand(["run", "export:all-sessions"])
  }

  const workbookPath = providedWorkbookPath
    ? path.resolve(process.cwd(), providedWorkbookPath)
    : findLatestWorkbookPath()
  console.log(`Workbook target: ${workbookPath}`)

  console.log("Ringkasan verifikasi sesi ekspor:")
  const sessionResults = []
  for (const sessionRun of sessionRuns) {
    const { row } = findExportRow({ sessionId: sessionRun.sessionId, workbookPath })
    const report = buildReportFromRow(row)
    const exportCounts = Object.fromEntries(
      GENRE_KEYS.map((genre) => [genre, report.categoryCounts[genre]])
    )
    const effectiveSnapshotCounts = sessionRun.snapshotCounts ?? exportCounts

    const totalTimeMatchesBreakdown = report.totalTime === report.categoryTimeSum
    const countsAreNonNegative = report.countsAreNonNegative
    const countsMatchSnapshot = assertCountsMatch(effectiveSnapshotCounts, exportCounts)
    const passed =
      totalTimeMatchesBreakdown &&
      countsAreNonNegative &&
      countsMatchSnapshot

    sessionResults.push({
      checks: {
        countsAreNonNegative,
        countsMatchSnapshot,
        totalTimeMatchesBreakdown,
      },
      exported: {
        categoryCounts: exportCounts,
        categoryTimeSum: report.categoryTimeSum,
        categoryTimes: report.categoryTimes,
        totalTime: report.totalTime,
      },
      label: sessionRun.label,
      passed,
      sessionId: sessionRun.sessionId,
      snapshot: {
        categoryCounts: effectiveSnapshotCounts,
      },
    })

    console.log(`- [${sessionRun.label}] session_id: ${sessionRun.sessionId}`)
    console.log(`  total_time cocok dengan jumlah kategori: ${totalTimeMatchesBreakdown}`)
    console.log(`  semua *_count bernilai non-negatif: ${countsAreNonNegative}`)
    console.log(`  *_count ekspor cocok dengan snapshot sesi: ${countsMatchSnapshot}`)
  }

  const summary = buildMachineReadableSummary({
    sessionResults,
    workbookPath,
  })

  console.log(`VERIFY_SESSION_EXPORT_RESULT=${JSON.stringify(summary)}`)

  if (!summary.passed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui."
  console.error(message)
  process.exitCode = 1
})
