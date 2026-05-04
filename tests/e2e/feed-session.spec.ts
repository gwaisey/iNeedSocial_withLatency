import { expect, test, type Page } from "@playwright/test"
import {
  getFeedScrollTop,
  getFirstVisiblePostId,
  setFeedScrollTop,
  waitForFeedScrollTopAtLeast,
  waitForVisibleFeedPost,
} from "./helpers/feed"
import {
  delayFeedResponses,
  installControllableFeedOverride,
} from "./helpers/feed-override"
import {
  isPostLikedInSession,
  readSessionSnapshot,
  seedCompletedTutorialSession,
  startStudy,
  sumGenreTimes,
} from "./helpers/session"
import { dismissTutorialIfVisible } from "./helpers/tutorial"

async function waitForTrackedTimeToExceed(page: Page, minimumMs = 0) {
  await expect
    .poll(async () => sumGenreTimes(await readSessionSnapshot(page)), {
      message: `Expected tracked time to exceed ${minimumMs}ms`,
      timeout: 10_000,
    })
    .toBeGreaterThan(minimumMs)
}

async function waitForTrackedTimeToStayAt(page: Page, expectedTotal: number, stableMs = 1_000) {
  await page.waitForFunction(
    ({ expected, stableDuration }) => {
      const win = window as Window & {
        __stableTrackedTimeExpected?: number
        __stableTrackedTimeSince?: number
      }
      const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
      const raw = sessionId
        ? window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:feed-session`)
        : null
      const snapshot = raw ? (JSON.parse(raw) as { genreTimes?: Record<string, number> }) : null
      const total = Object.values(snapshot?.genreTimes ?? {}).reduce(
        (runningTotal, value) => runningTotal + Number(value),
        0
      )

      if (total !== expected) {
        delete win.__stableTrackedTimeExpected
        delete win.__stableTrackedTimeSince
        return false
      }

      if (
        win.__stableTrackedTimeExpected !== expected ||
        typeof win.__stableTrackedTimeSince !== "number"
      ) {
        win.__stableTrackedTimeExpected = expected
        win.__stableTrackedTimeSince = performance.now()
        return false
      }

      return performance.now() - win.__stableTrackedTimeSince >= stableDuration
    },
    {
      expected: expectedTotal,
      stableDuration: stableMs,
    }
  )
}

async function seedEndedStudySession(page: Page, sessionId: string) {
  await page.addInitScript((targetSessionId) => {
    window.sessionStorage.setItem("ineedsocial:study:active-session", targetSessionId)
    window.sessionStorage.setItem(
      `ineedsocial:study:${targetSessionId}:feed-session`,
      JSON.stringify({
        status: "ended",
        genreTimes: {
          humor: 1_500,
          news: 0,
          travel: 0,
          food: 0,
          sport: 0,
          game: 0,
        },
        finalizedGenreTimes: null,
        finalReport: {
          session_id: targetSessionId,
          app_version: "without_latency",
          total_time: 1500,
          humor_time: 1500,
          news_time: 0,
          travel_time: 0,
          food_time: 0,
          sport_time: 0,
          game_time: 0,
          timestamp: new Date().toISOString(),
        },
        hasSubmitted: true,
        submissionHasError: false,
        submissionMessage: "Sesi berhasil disimpan.",
      })
    )
  }, sessionId)
}

async function expectThanksPageState(page: Page) {
  await expect(page.getByTestId("session-save-status")).toBeVisible()
  await expect(page.getByRole("button", { name: /unduh/i })).toHaveCount(0)
  const sessionSaveStatus = (await page.getByTestId("session-save-status").textContent()) ?? ""

  if (/berhasil disimpan/i.test(sessionSaveStatus)) {
    const expectedSessionId = await page.evaluate(() =>
      window.sessionStorage.getItem("ineedsocial:study:active-session")
    )

    await expect(page.getByTestId("session-reference-code")).toHaveText(expectedSessionId ?? "")
    await expect(page.getByTestId("retry-session-save-button")).toHaveCount(0)
  } else {
    await expect(page.getByTestId("session-reference-code")).toHaveCount(0)
    await expect(page.getByTestId("retry-session-save-button")).toBeVisible()
  }
}

test("direct /feed without an active session redirects to welcome", async ({ page }) => {
  await page.goto("/feed?theme=light")
  await page.waitForURL("**/welcome")
})

test("refresh keeps the same study session state in the feed", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  const firstLikeButton = page.locator('[data-testid^="like-button-"]').first()
  await firstLikeButton.waitFor({ state: "visible" })
  const likedPostId = await firstLikeButton.evaluate((element) =>
    element.getAttribute("data-testid")?.replace("like-button-", "") ?? null
  )

  await firstLikeButton.click()
  await expect(firstLikeButton).toHaveAttribute("data-liked", "true")

  await setFeedScrollTop(page, 1_600)
  await waitForFeedScrollTopAtLeast(page, 1_200)
  const firstVisiblePostBeforeRefresh = await getFirstVisiblePostId(page)

  await page.reload()
  await page.waitForURL("**/feed?theme=light")
  await dismissTutorialIfVisible(page)
  await waitForTrackedTimeToExceed(page, 0)

  expect(await isPostLikedInSession(page, likedPostId)).toBe(true)

  const snapshotAfterRefresh = await readSessionSnapshot(page)
  expect(sumGenreTimes(snapshotAfterRefresh)).toBeGreaterThan(0)
  expect(firstVisiblePostBeforeRefresh).not.toBeNull()
  expect(await getFeedScrollTop(page)).toBeLessThan(120)

  await page.getByTestId("sidebar-timer-open-button").click()
  await page.waitForURL("**/thank-you")
  await expectThanksPageState(page)

  await page.goBack()
  await page.waitForURL("**/welcome")
})

test("repeated lifecycle flushes do not double-count tracked time", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await page.getByTestId("theme-toggle-button").click()
  await page.waitForURL("**/feed?theme=dark")
  await waitForTrackedTimeToExceed(page, 0)

  const snapshotAfterCommittedPersist = await readSessionSnapshot(page)
  expect(sumGenreTimes(snapshotAfterCommittedPersist)).toBeGreaterThan(0)

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")))
  const snapshotAfterFirstFlush = await readSessionSnapshot(page)
  const totalAfterFirstFlush = sumGenreTimes(snapshotAfterFirstFlush)

  expect(totalAfterFirstFlush).toBeGreaterThan(0)

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")))
  const snapshotAfterSecondFlush = await readSessionSnapshot(page)
  const totalAfterSecondFlush = sumGenreTimes(snapshotAfterSecondFlush)

  expect(totalAfterSecondFlush).toBe(totalAfterFirstFlush)
})

test("welcome asks for confirmation before replacing an unfinished session", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await setFeedScrollTop(page, 4_200)
  await waitForFeedScrollTopAtLeast(page, 3_200)
  const firstSessionId = await page.evaluate(() =>
    window.sessionStorage.getItem("ineedsocial:study:active-session")
  )

  await page.goBack()
  await page.waitForURL("**/welcome")

  await page.getByTestId("start-study-button").click()
  await expect(page.getByTestId("restart-session-confirm-button")).toBeVisible()
  await page.getByTestId("restart-session-cancel-button").click()
  await expect(page.getByTestId("restart-session-confirm-button")).toHaveCount(0)

  await page.getByTestId("start-study-button").click()
  await page.getByTestId("restart-session-confirm-button").click()
  await page.waitForURL("**/feed?theme=light")
  await waitForVisibleFeedPost(page)

  const secondSessionId = await page.evaluate(() =>
    window.sessionStorage.getItem("ineedsocial:study:active-session")
  )

  expect(secondSessionId).not.toBe(firstSessionId)
})

test("browser back and forward preserve an unfinished session", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  const firstLikeButton = page.locator('[data-testid^="like-button-"]').first()
  await firstLikeButton.waitFor({ state: "visible" })
  const likedPostId = await firstLikeButton.evaluate((element) =>
    element.getAttribute("data-testid")?.replace("like-button-", "") ?? null
  )
  const activeSessionId = await page.evaluate(() =>
    window.sessionStorage.getItem("ineedsocial:study:active-session")
  )

  await firstLikeButton.click()
  await expect(firstLikeButton).toHaveAttribute("data-liked", "true")
  await setFeedScrollTop(page, 4_200)
  await waitForFeedScrollTopAtLeast(page, 3_200)

  await page.goBack()
  await page.waitForURL("**/welcome")

  await page.goForward()
  await page.waitForURL("**/feed?theme=light")
  await waitForVisibleFeedPost(page)

  expect(
    await page.evaluate(() => window.sessionStorage.getItem("ineedsocial:study:active-session"))
  ).toBe(activeSessionId)
  expect(await isPostLikedInSession(page, likedPostId)).toBe(true)
})

test("mobile feed scrolls the document so browser chrome can collapse", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedCompletedTutorialSession(page, "study_mobile_document_scroll")

  await page.goto("/feed?theme=light")
  await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })
  await waitForVisibleFeedPost(page)

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const feed = document.querySelector<HTMLElement>(
            '[data-testid="feed-scroll-container"]'
          )

          return {
            documentCanScroll:
              document.documentElement.scrollHeight > window.innerHeight + 1_000,
            feedOverflowY: feed ? getComputedStyle(feed).overflowY : null,
            feedScrollTop: feed?.scrollTop ?? null,
          }
        }),
      {
        message: "Expected the mobile feed to use document scrolling",
      }
    )
    .toEqual({
      documentCanScroll: true,
      feedOverflowY: "visible",
      feedScrollTop: 0,
    })

  await page.mouse.wheel(0, 1_400)

  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: "Expected mobile feed gestures to move document scrollY",
    })
    .toBeGreaterThan(500)

  await expect
    .poll(() => getFeedScrollTop(page), {
      message: "Expected mobile feed element not to own the scroll position",
    })
    .toBe(0)
})

test("mobile tutorial overlay locks document scrolling until dismissed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await startStudy(page)
  await page.waitForFunction(() =>
    Boolean(
      document.querySelector(
        '[data-testid="tutorial-delay-blocker"], [data-testid="tutorial-next-button"]'
      )
    )
  )
  await waitForVisibleFeedPost(page)

  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyPosition: document.body.style.position,
        documentOverflow: document.documentElement.style.overflow,
        scrollY: window.scrollY,
      }))
    )
    .toEqual({
      bodyPosition: "fixed",
      documentOverflow: "hidden",
      scrollY: 0,
    })

  await page.mouse.wheel(0, 1_200)
  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: "Expected tutorial overlay to lock mobile document scroll",
    })
    .toBe(0)

  await page.getByTestId("tutorial-skip-button").waitFor({ state: "visible" })
  await page.getByTestId("tutorial-skip-button").click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="tutorial-skip-button"]'))

  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyPosition: document.body.style.position,
        documentOverflow: document.documentElement.style.overflow,
      }))
    )
    .toEqual({
      bodyPosition: "",
      documentOverflow: "",
    })
})

test("tutorial overlay blocks feed interactions until dismissed", async ({ page }) => {
  await delayFeedResponses(page, 500)
  await startStudy(page)
  const tutorialDelayBlocker = page.getByTestId("tutorial-delay-blocker")
  const participantShell = page.getByTestId("participant-shell")
  await tutorialDelayBlocker.waitFor({ state: "visible" })
  await expect(page.getByTestId("tutorial-delay-status")).toHaveText("Tutorial akan dimulai.")
  expect(
    await participantShell.evaluate((element) => (element as HTMLElement).inert)
  ).toBe(true)
  await expect(participantShell).toHaveAttribute("aria-hidden", "true")

  const firstLikeButton = page.locator('[data-testid^="like-button-"]').first()
  await firstLikeButton.waitFor({ state: "visible" })
  const boundingBox = await firstLikeButton.boundingBox()
  expect(boundingBox).not.toBeNull()
  const scrollTopBeforeBlockedWheel = await getFeedScrollTop(page)

  await page.mouse.wheel(0, 1_200)
  await expect.poll(async () => getFeedScrollTop(page)).toBe(scrollTopBeforeBlockedWheel)
  await page.keyboard.press("PageDown")
  await expect.poll(async () => getFeedScrollTop(page)).toBe(scrollTopBeforeBlockedWheel)
  await page.keyboard.press("ArrowDown")
  await expect.poll(async () => getFeedScrollTop(page)).toBe(scrollTopBeforeBlockedWheel)

  await page.mouse.click(
    boundingBox!.x + boundingBox!.width / 2,
    boundingBox!.y + boundingBox!.height / 2
  )
  await expect(firstLikeButton).toHaveAttribute("data-liked", "false")

  await page.getByTestId("tutorial-skip-button").waitFor({ state: "visible" })
  await expect(tutorialDelayBlocker).toHaveCount(0)

  await waitForTrackedTimeToStayAt(page, 0)

  await page.keyboard.press("Tab")
  await expect(firstLikeButton).not.toBeFocused()
  await page.getByTestId("tutorial-next-button").press("Enter")
  await page.keyboard.press("Tab")
  await expect(firstLikeButton).not.toBeFocused()
  await page.getByTestId("tutorial-skip-button").press("Enter")
  await page.waitForFunction(() => !document.querySelector('[data-testid="tutorial-skip-button"]'))
  expect(
    await participantShell.evaluate((element) => (element as HTMLElement).inert)
  ).toBe(false)
  await expect(participantShell).not.toHaveAttribute("aria-hidden", "true")

  await firstLikeButton.click()
  await expect(firstLikeButton).toHaveAttribute("data-liked", "true")
})

test("tutorial delay blocker drops on feed error and returns on retry success", async ({ page }) => {
  const seededSessionId = "study_seeded_tutorial_retry"
  const feedOverride = await installControllableFeedOverride(page, {
    sessionId: seededSessionId,
  })

  await page.goto("/feed?theme=light")
  await page.waitForURL("**/feed?theme=light")

  await expect(page.getByText("Feed tidak dapat dimuat.")).toBeVisible()
  await expect(page.getByText("Format feed tidak valid.")).toBeVisible()
  await expect(page.getByTestId("tutorial-delay-blocker")).toHaveCount(0)
  await expect(page.getByTestId("feed-error-retry")).toBeVisible()

  await feedOverride.setMode("passthrough")
  await page.getByTestId("feed-error-retry").click()
  await expect(page.getByTestId("tutorial-delay-blocker")).toBeVisible()
  await expect(page.getByTestId("tutorial-delay-status")).toHaveText("Tutorial akan dimulai.")
  expect(
    await page.getByTestId("participant-shell").evaluate((element) => (element as HTMLElement).inert)
  ).toBe(true)
  await page.getByTestId("tutorial-skip-button").waitFor({ state: "visible" })
  await expect(page.getByTestId("tutorial-next-button")).toBeFocused()
  await expect(page.getByTestId("tutorial-delay-blocker")).toHaveCount(0)
})

test("theme switch keeps the anchored feed position and does not add browser history", async ({
  page,
}) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await setFeedScrollTop(page, 1_400)
  await waitForFeedScrollTopAtLeast(page, 1_000)
  const scrollTopBeforeToggle = await getFeedScrollTop(page)

  await page.getByTestId("theme-toggle-button").click()
  await page.waitForURL("**/feed?theme=dark")
  await page.waitForFunction(
    ({ lowerBound, upperBound }) => {
      const element = document.querySelector<HTMLElement>('[data-testid="feed-scroll-container"]')
      if (!element) {
        return false
      }

      return element.scrollTop >= lowerBound && element.scrollTop <= upperBound
    },
    {
      lowerBound: scrollTopBeforeToggle - 180,
      upperBound: scrollTopBeforeToggle + 180,
    }
  )

  await expect(page.locator(".app-shell")).toHaveClass(/theme-dark/)
  await expect(page.getByTestId("theme-toggle-button")).toHaveClass(/justify-start/)
  expect(Math.abs((await getFeedScrollTop(page)) - scrollTopBeforeToggle)).toBeLessThan(180)

  await page.goBack()
  await page.waitForURL("**/welcome")
})

test("theme switch preserves carousel slide state", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await setFeedScrollTop(page, 1_050)
  await waitForFeedScrollTopAtLeast(page, 650)

  const carouselIndicator = page.getByTestId("carousel-indicator-post-carousel")
  await expect(carouselIndicator).toBeVisible()
  await page.getByTestId("carousel-next-post-carousel").click()
  await expect(carouselIndicator).toHaveText("2/3")

  const scrollTopBeforeToggle = await getFeedScrollTop(page)
  await page.getByTestId("theme-toggle-button").click()
  await page.waitForURL("**/feed?theme=dark")

  await expect(carouselIndicator).toHaveText("2/3")
  expect(Math.abs((await getFeedScrollTop(page)) - scrollTopBeforeToggle)).toBeLessThan(180)
})

test("keluar clears a seeded session and forces a fresh restart", async ({ page }) => {
  const seededSessionId = "study_seeded_exit"
  await page.goto("/welcome")
  await page.evaluate((targetSessionId) => {
    window.sessionStorage.setItem("ineedsocial:study:active-session", targetSessionId)
  }, seededSessionId)
  await page.goto("/feed?theme=light")
  await page.waitForURL("**/feed?theme=light")
  await dismissTutorialIfVisible(page)
  await setFeedScrollTop(page, 4_200)
  await waitForFeedScrollTopAtLeast(page, 3_200)

  await page.getByTestId("sidebar-exit-button").click()
  await expect(page.getByTestId("exit-session-confirm-button")).toBeVisible()
  await page.getByTestId("exit-session-cancel-button").click()
  await expect(page.getByTestId("exit-session-confirm-button")).toHaveCount(0)

  await page.getByTestId("sidebar-exit-button").click()
  await page.getByTestId("exit-session-confirm-button").click()
  await page.waitForURL("**/welcome")

  expect(
    await page.evaluate(() => window.sessionStorage.getItem("ineedsocial:study:active-session"))
  ).toBeNull()

  await page.goto("/feed?theme=light")
  await page.waitForURL("**/welcome")

  await page.getByTestId("start-study-button").click()
  await page.waitForURL("**/feed?theme=light")
  await waitForVisibleFeedPost(page)
  expect(
    await page.evaluate(() => window.sessionStorage.getItem("ineedsocial:study:active-session"))
  ).not.toBe(seededSessionId)
})

test("browser history does not resurrect a session after keluar", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await page.getByTestId("sidebar-exit-button").click()
  await page.getByTestId("exit-session-confirm-button").click()
  await page.waitForURL("**/welcome")

  await page.goBack()
  await page.waitForURL(/\/(welcome|splash)(\?|$)/)
  expect(page.url()).not.toContain("/feed")

  await page.goForward()
  await page.waitForURL(/\/(welcome|splash)(\?|$)/)
  expect(page.url()).not.toContain("/feed")

  await page.goto("/feed?theme=light")
  await page.waitForURL("**/welcome")
})

test("browser history keeps ended sessions on thank-you while feed stays blocked", async ({
  page,
}) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await page.getByTestId("sidebar-timer-open-button").click()
  await page.waitForURL("**/thank-you")
  await expectThanksPageState(page)

  await page.goBack()
  await page.waitForURL(/\/(welcome|splash)(\?|$)/)
  expect(page.url()).not.toContain("/feed")

  await page.goForward()
  await page.waitForURL("**/thank-you")
  await expectThanksPageState(page)

  await page.goto("/feed?theme=light")
  await page.waitForURL("**/welcome")
})

test("thank-you shows the session code only for a successfully saved ended session", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4174",
  })

  const seededSessionId = "study_seeded_success"
  await seedEndedStudySession(page, seededSessionId)

  await page.goto("/thank-you")
  await expect(page.getByRole("button", { name: /unduh/i })).toHaveCount(0)
  await expect(page.getByTestId("session-reference-code")).toHaveText(seededSessionId)
  await expect(page.getByTestId("copy-session-code-button")).toBeVisible()

  await page.getByTestId("copy-session-code-button").click()
  await expect(page.getByTestId("copy-session-code-status")).toHaveText(
    "Kode sesi berhasil disalin."
  )
  const clipboardText = await page.evaluate(async () => navigator.clipboard.readText())
  expect(clipboardText).toBe(seededSessionId)

  await page.goto("/feed?theme=light")
  await page.waitForURL("**/welcome")
})

test("malformed feed payload shows the localized retry state", async ({ page }) => {
  await installControllableFeedOverride(page, {
    sessionId: "study_seeded_invalid_feed",
  })

  await page.goto("/feed?theme=light")
  await page.waitForURL("**/feed?theme=light")

  await expect(page.getByText("Feed tidak dapat dimuat.")).toBeVisible()
  await expect(page.getByText("Format feed tidak valid.")).toBeVisible()
  await expect(page.getByTestId("feed-error-retry")).toBeVisible()
})
