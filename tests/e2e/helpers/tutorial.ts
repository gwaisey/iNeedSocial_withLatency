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

async function waitForFeedAfterTutorial(page: Page) {
  await page.waitForFunction(() => {
    const container = document.querySelector<HTMLElement>(
      '[data-testid="feed-scroll-container"]'
    )
    if (!container) {
      return false
    }

    const viewportTop = 0
    const viewportBottom = window.innerHeight
    return Array.from(container.querySelectorAll<HTMLElement>("[data-regular-post-id]")).some(
      (element) => {
        const rect = element.getBoundingClientRect()
        return rect.bottom > viewportTop && rect.top < viewportBottom
      }
    )
  })

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
  const tutorialSkipButton = page.getByTestId("tutorial-skip-button")
  const tutorialIsVisible = await tutorialSkipButton
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false)

  if (tutorialIsVisible) {
    await tutorialSkipButton.click({ force: true })
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="tutorial-skip-button"]'), {
        timeout: 5_000,
      })
      .catch(() => {})
    await waitForFeedAfterTutorial(page)
    return
  }

  if (await hasUnfinishedTutorial(page)) {
    await forceCompleteTutorial(page)
  }

  await waitForFeedAfterTutorial(page)
}
