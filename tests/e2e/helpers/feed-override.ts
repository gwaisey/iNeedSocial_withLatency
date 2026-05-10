import type { Page } from "@playwright/test"

export type FeedOverrideMode = "malformed" | "passthrough"

export async function installControllableFeedOverride(
  page: Page,
  {
    initialMode = "malformed",
    sessionId,
  }: {
    initialMode?: FeedOverrideMode
    sessionId?: string
  } = {}
) {
  await page.addInitScript(
    ({ startingMode, targetSessionId }) => {
      if (targetSessionId) {
        window.sessionStorage.setItem("ineedsocial:study:active-session", targetSessionId)
      }

      const originalFetch = window.fetch.bind(window)
      ;(window as Window & { __feedOverrideMode?: FeedOverrideMode }).__feedOverrideMode =
        startingMode

      window.fetch = async (input, init) => {
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url

        if (
          (window as Window & { __feedOverrideMode?: FeedOverrideMode }).__feedOverrideMode ===
            "malformed" &&
          (requestUrl.includes("/content/feed.json") || requestUrl.includes("/api/feed"))
        ) {
          return new Response(JSON.stringify({ posts: "rusak" }), {
            headers: {
              "Content-Type": "application/json",
            },
            status: 200,
          })
        }

        return originalFetch(input, init)
      }
    },
    {
      startingMode: initialMode,
      targetSessionId: sessionId ?? null,
    }
  )

  return {
    async setMode(nextMode: FeedOverrideMode) {
      await page.evaluate((mode) => {
        ;(window as Window & { __feedOverrideMode?: FeedOverrideMode }).__feedOverrideMode = mode
      }, nextMode)
    },
  }
}

export async function delayFeedResponses(page: Page, delayMs: number) {
  await page.addInitScript((delay) => {
    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input, init) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url

      if (requestUrl.includes("/content/feed.json") || requestUrl.includes("/api/feed")) {
        await new Promise((resolve) => window.setTimeout(resolve, delay))
      }

      return originalFetch(input, init)
    }
  }, delayMs)
}
