import { describe, expect, it } from "vitest"
import {
  buildDisplayedGenreBreakdown,
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
})
