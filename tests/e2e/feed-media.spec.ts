import { expect, test } from "@playwright/test"
import {
  scrollPostIntoView,
  setFeedScrollTop,
  waitForFeedScrollTopAtLeast,
  waitForRenderedImageMedia,
  waitForRenderedVideoFallbackMedia,
  waitForRenderedVideoMedia,
  waitForSinglePlayingVideo,
  waitForVideoPausedAndReset,
  waitForVideoPlaying,
} from "./helpers/feed"
import { startStudy } from "./helpers/session"
import { dismissTutorialIfVisible } from "./helpers/tutorial"

test("only the visible video plays and it resets after leaving the viewport", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
  await waitForVideoPlaying(page, "post-video-sample")
  await waitForSinglePlayingVideo(page, "post-video-sample")

  await scrollPostIntoView(page, "post-buffalo")
  await waitForRenderedVideoMedia(page, "post-buffalo")
  await waitForVideoPlaying(page, "post-buffalo")
  await waitForSinglePlayingVideo(page, "post-buffalo")
  await waitForVideoPausedAndReset(page, "post-video-sample")
})

test("photo, carousel, and video media render again after leaving and returning to feed", async ({
  page,
}) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await waitForRenderedImageMedia(page, "post-snoopy")
  await setFeedScrollTop(page, 1_050)
  await waitForFeedScrollTopAtLeast(page, 650)
  await waitForRenderedImageMedia(page, "post-carousel")
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  await page.goBack()
  await page.waitForURL("**/welcome")

  await page.goForward()
  await page.waitForURL("**/feed?theme=light")
  await waitForRenderedImageMedia(page, "post-snoopy")
  await setFeedScrollTop(page, 1_050)
  await waitForFeedScrollTopAtLeast(page, 650)
  await waitForRenderedImageMedia(page, "post-carousel")
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
})

test("refresh with a controlling service worker keeps videos rendering", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  await page.reload()
  await page.waitForURL("**/feed?theme=light")
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller))
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
})

test("refresh resets autoplay-with-sound preference while keeping videos rendering", async ({
  page,
}) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  const muteButton = page.getByTestId("mute-button-post-video-sample")
  await expect(muteButton).toHaveAttribute("data-muted", "true")
  await muteButton.click()
  await expect(muteButton).toHaveAttribute("data-muted", "false")

  await page.reload()
  await page.waitForURL("**/feed?theme=light")
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller))
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
  await expect(page.getByTestId("mute-button-post-video-sample")).toHaveAttribute(
    "data-muted",
    "true"
  )
})

test("autoplay failures are buffered locally without crashing the feed", async ({ page }) => {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play

    HTMLMediaElement.prototype.play = function () {
      const ownerPostId =
        (this as HTMLMediaElement)
          .closest?.("[data-regular-post-id]")
          ?.getAttribute("data-regular-post-id") ?? ""

      if (ownerPostId === "post-video-sample") {
        return Promise.reject(new DOMException("autoplay blocked", "NotAllowedError"))
      }

      return originalPlay.call(this)
    }
  })

  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoFallbackMedia(page, "post-video-sample")
  await expect(page.locator('[data-regular-post-id="post-video-sample"]')).toBeVisible()

  await expect
    .poll(async () =>
      page.evaluate(() => window.sessionStorage.getItem("ineedsocial:runtime-monitoring"))
    )
    .toContain("Video autoplay was blocked or interrupted.")
})

test("video mute preference stays session-scoped across later videos", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  const firstVideoMuteButton = page.getByTestId("mute-button-post-video-sample")
  await expect(firstVideoMuteButton).toHaveAttribute("data-muted", "true")
  await firstVideoMuteButton.click()
  await expect(firstVideoMuteButton).toHaveAttribute("data-muted", "false")

  await scrollPostIntoView(page, "post-kopi-kak")
  await waitForRenderedVideoMedia(page, "post-kopi-kak")
  await expect(page.getByTestId("mute-button-post-kopi-kak")).toHaveAttribute(
    "data-muted",
    "false"
  )

  await page.getByTestId("sidebar-exit-button").click()
  await page.getByTestId("exit-session-confirm-button").click()
  await page.waitForURL("**/welcome")

  await page.getByTestId("start-study-button").click()
  await page.waitForURL("**/feed?theme=light")
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await expect(page.getByTestId("mute-button-post-video-sample")).toHaveAttribute(
    "data-muted",
    "true"
  )
})
