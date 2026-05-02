import { describe, expect, it } from "vitest"
import {
  buildDisplayedGenreBreakdown,
  buildSessionReport,
  createEmptyGenreCounts,
  createEmptyGenreTimes,
  formatElapsed,
  sumGenreTimes,
} from "./feed-session"

describe("feed-session utilities", () => {
  it("allocates rounded display seconds so rows match the headline timer", () => {
    const genreTimes = createEmptyGenreTimes()
    genreTimes.humor = 10_999
    genreTimes.berita = 2_999
    genreTimes.makanan = 1_999

    const rows = buildDisplayedGenreBreakdown(genreTimes)
    const displayedTotalSeconds = Math.floor(sumGenreTimes(genreTimes) / 1000)
    const displayedRowTotal = rows.reduce((sum, row) => sum + row.displaySeconds, 0)

    expect(displayedRowTotal).toBe(displayedTotalSeconds)
    expect(rows.find((row) => row.genre === "humor")?.displaySeconds).toBe(11)
    expect(rows.find((row) => row.genre === "berita")?.displaySeconds).toBe(3)
  })

  it("formats elapsed time as hh : mm : ss", () => {
    expect(formatElapsed(3_723_000)).toBe("01 : 02 : 03")
  })

  it("includes genre counts in the session report payload", () => {
    const genreTimes = createEmptyGenreTimes()
    genreTimes.humor = 5_000
    genreTimes.berita = 2_000

    const genreCounts = createEmptyGenreCounts()
    genreCounts.humor = 3
    genreCounts.berita = 1

    const report = buildSessionReport("test_session", genreTimes, genreCounts, "test_version")

    expect(report.humor_count).toBe(3)
    expect(report.berita_count).toBe(1)
    expect(report.wisata_count).toBe(0)
    expect(report.makanan_count).toBe(0)
    expect(report.olahraga_count).toBe(0)
    expect(report.game_count).toBe(0)
    expect(report.humor_ms).toBe(5_000)
    expect(report.berita_ms).toBe(2_000)
    expect(report.total_time).toBe(7_000)
    expect(report.session_id).toBe("test_session")
    expect(report.app_version).toBe("test_version")
  })
})

