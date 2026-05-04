import { expect, test } from "@playwright/test"
import { startStudy } from "./helpers/session"
import { dismissTutorialIfVisible } from "./helpers/tutorial"

test("preview build keeps mobile fast-scroll autoplay focused and single-owner", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const consoleErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })

  // Include late feed videos that previously showed startup variance.
  const sampledVideoPostIds = [
    "post-video-sample",
    "post-kartu-pokemon",
    "post-digigit-keong",
  ]

  for (const postId of sampledVideoPostIds) {
    const post = page.locator(`[data-regular-post-id="${postId}"]`)
    await expect(post).toBeAttached()
    await post.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest" })
    })
    await expect(post).toBeVisible()
  }

  const isFocusedVideoPlaying = async () =>
    page.evaluate(() => {
      const viewportTop = 0
      const viewportBottom = window.innerHeight
      const posts = Array.from(
        document.querySelectorAll<HTMLElement>("[data-regular-post-id]")
      )

      let focusedVideoPostId: string | null = null
      let focusedVisibleRatio = 0

      for (const post of posts) {
        const video = post.querySelector("video")
        if (!(video instanceof HTMLVideoElement)) {
          continue
        }

        const rect = post.getBoundingClientRect()
        const overlap = Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop)
        if (overlap <= 0 || rect.height <= 0) {
          continue
        }

        const visibleRatio = overlap / rect.height
        if (visibleRatio > focusedVisibleRatio) {
          focusedVisibleRatio = visibleRatio
          focusedVideoPostId = post.getAttribute("data-regular-post-id")
        }
      }

      const playingVideoPostIds = Array.from(document.querySelectorAll("video"))
        .filter(
          (node) =>
            node instanceof HTMLVideoElement &&
            !node.paused &&
            !node.ended &&
            node.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        )
        .map(
          (node) =>
            node.closest<HTMLElement>("[data-regular-post-id]")?.getAttribute("data-regular-post-id") ??
            "unknown"
        )

      const focusedIsRelevant =
        focusedVideoPostId !== null &&
        focusedVisibleRatio >= 0.6 &&
        document
          .querySelector(`[data-regular-post-id="${focusedVideoPostId}"]`)
          ?.querySelector("video") instanceof HTMLVideoElement

      if (!focusedIsRelevant) {
        return {
          focusedVideoPostId,
          ok: playingVideoPostIds.length <= 1,
          playingVideoPostIds,
        }
      }

      return {
        focusedVideoPostId,
        ok:
          playingVideoPostIds.length === 1 &&
          playingVideoPostIds[0] === focusedVideoPostId,
        playingVideoPostIds,
      }
    })

  // Stress both directions to catch delayed handoff and stale playback ownership.
  for (let step = 0; step < 14; step += 1) {
    await page.mouse.wheel(0, 900)
    await expect
      .poll(isFocusedVideoPlaying, {
        message: `Expected focused visible video to own playback after downward scroll step ${step + 1}`,
        timeout: 4_500,
      })
      .toMatchObject({ ok: true })
  }

  for (let step = 0; step < 10; step += 1) {
    await page.mouse.wheel(0, -900)
    await expect
      .poll(isFocusedVideoPlaying, {
        message: `Expected focused visible video to own playback after upward scroll step ${step + 1}`,
        timeout: 4_500,
      })
      .toMatchObject({ ok: true })
  }

  expect(consoleErrors).toEqual([])
})
