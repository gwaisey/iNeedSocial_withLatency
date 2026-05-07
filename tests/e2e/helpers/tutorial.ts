import type { Page } from "@playwright/test"

async function forceCompleteTutorial(page: Page) {
  await page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return
    }

    window.sessionStorage.setItem(
      `ineedsocial:study:${sessionId}:tutorial`,
      JSON.stringify({ completed: true, currentStep: 0 })
    )
  })
  await page.reload()
  await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })
}

async function clickVisibleTutorialAction(page: Page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const skipButton = page.getByTestId("tutorial-skip-button").first()
    if ((await skipButton.count()) > 0 && await skipButton.isVisible()) {
      await skipButton.click({ force: true })
      return true
    }

    const nextButton = page.getByTestId("tutorial-next-button").first()
    if ((await nextButton.count()) === 0 || !(await nextButton.isVisible())) {
      return false
    }

    await nextButton.click({ force: true })
    await page.waitForTimeout(80)

    const hasTutorialAction = await page
      .locator('[data-testid="tutorial-skip-button"], [data-testid="tutorial-next-button"]')
      .count()
    if (hasTutorialAction === 0) {
      return true
    }
  }

  return false
}

async function waitForFeedAfterTutorial(page: Page) {
  await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })
  await page
    .locator("[data-regular-post-id]")
    .first()
    .waitFor({ state: "attached", timeout: 5_000 })
    .catch(() => {})

  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('[data-testid="feed-scroll-container"]')
      ?.dispatchEvent(new Event("scroll"))
    window.dispatchEvent(new Event("resize"))
  })
}

async function hasUnfinishedTutorial(page: Page) {
  return page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return false
    }

    const raw = window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:tutorial`)
    if (!raw) {
      return true
    }

    try {
      const state = JSON.parse(raw) as { completed?: boolean }
      return !state.completed
    } catch {
      return true
    }
  })
}

export async function dismissTutorialIfVisible(page: Page) {
  const tutorialAction = page
    .locator('[data-testid="tutorial-skip-button"], [data-testid="tutorial-next-button"]')
    .first()
  const tutorialIsVisible = await tutorialAction
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false)

  if (tutorialIsVisible) {
    await clickVisibleTutorialAction(page)
    await page
      .waitForFunction(
        () =>
          !document.querySelector(
            '[data-testid="tutorial-skip-button"], [data-testid="tutorial-next-button"]'
          ),
        { timeout: 5_000 }
      )
      .catch(() => {})
    await waitForFeedAfterTutorial(page)
    return
  }

  if (await hasUnfinishedTutorial(page)) {
    await forceCompleteTutorial(page)
  }

  await waitForFeedAfterTutorial(page)
}
