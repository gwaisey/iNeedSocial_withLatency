import type { GenreKey, GenreTimes, SessionReportPayload } from "../types/social"

export const GENRE_DISPLAY_ORDER: GenreKey[] = [
  "humor",
  "berita",
  "wisata",
  "makanan",
  "olahraga",
  "game",
]

export const GENRE_META: Record<GenreKey, { label: string }> = {
  berita: { label: "Berita" },
  game: { label: "Game" },
  humor: { label: "Humor" },
  makanan: { label: "Makanan" },
  olahraga: { label: "Olahraga" },
  wisata: { label: "Wisata" },
}

export type DisplayedGenreBreakdownRow = {
  genre: GenreKey
  milliseconds: number
  percentage: string
  displaySeconds: number
}

export function createEmptyGenreTimes(): GenreTimes {
  return {
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  }
}

export function sumGenreTimes(genreTimes: GenreTimes) {
  return Object.values(genreTimes).reduce((total, value) => total + value, 0)
}

export function buildDisplayedGenreBreakdown(
  genreTimes: GenreTimes
): DisplayedGenreBreakdownRow[] {
  const totalMs = sumGenreTimes(genreTimes)
  const displayedTotalSeconds = Math.floor(totalMs / 1000)

  const rows = GENRE_DISPLAY_ORDER.map((genre, index) => {
    const milliseconds = genreTimes[genre]
    const exactSeconds = milliseconds / 1000

    return {
      genre,
      milliseconds,
      percentage: totalMs > 0 ? ((milliseconds / totalMs) * 100).toFixed(1) : "0",
      displaySeconds: Math.floor(exactSeconds),
      remainder: exactSeconds - Math.floor(exactSeconds),
      order: index,
    }
  })

  let missingSeconds =
    displayedTotalSeconds - rows.reduce((sum, row) => sum + row.displaySeconds, 0)

  if (missingSeconds > 0) {
    rows
      .slice()
      .sort((left, right) => right.remainder - left.remainder || left.order - right.order)
      .forEach((row) => {
        if (missingSeconds <= 0) {
          return
        }

        row.displaySeconds += 1
        missingSeconds -= 1
      })
  }

  return rows
    .sort((left, right) => left.order - right.order)
    .map((row) => ({
      genre: row.genre,
      milliseconds: row.milliseconds,
      percentage: row.percentage,
      displaySeconds: row.displaySeconds,
    }))
}

export function buildSessionReport(
  sessionId: string,
  genreTimes: GenreTimes,
  appVersion: string
): SessionReportPayload {
  return {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    total_time: sumGenreTimes(genreTimes),
    humor_ms: genreTimes.humor,
    berita_ms: genreTimes.berita,
    wisata_ms: genreTimes.wisata,
    makanan_ms: genreTimes.makanan,
    olahraga_ms: genreTimes.olahraga,
    game_ms: genreTimes.game,
    app_version: appVersion,
  }
}

export function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${hours} : ${minutes} : ${seconds}`
}
