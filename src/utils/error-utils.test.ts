import { afterEach, describe, expect, it, vi } from "vitest"
import { getUserFacingErrorMessage } from "./error-utils"

describe("getUserFacingErrorMessage", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

  afterEach(() => {
    consoleErrorSpy.mockClear()
  })

  it("preserves safe localized service messages", () => {
    const message = getUserFacingErrorMessage(
      new Error("Permintaan data gagal dengan status 500 untuk /api/feed."),
      "Feed tidak dapat dimuat.",
      "feed-page:load"
    )

    expect(message).toBe("Permintaan data gagal dengan status 500 untuk /api/feed.")
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[feed-page:load]",
      expect.any(Error)
    )
  })

  it("falls back for unsafe runtime errors", () => {
    const message = getUserFacingErrorMessage(
      new Error("Cannot read properties of undefined (reading 'foo')"),
      "Sesi tidak dapat disimpan.",
      "feed-session:save"
    )

    expect(message).toBe("Sesi tidak dapat disimpan.")
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[feed-session:save]",
      expect.any(Error)
    )
  })
})
