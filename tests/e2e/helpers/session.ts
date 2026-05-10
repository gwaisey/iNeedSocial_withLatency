import type { Page } from "@playwright/test"

export type SessionSnapshot = {
  genreTimes?: Record<string, number>
  hasSubmitted?: boolean
  session_id?: string
  status?: string
  submissionHasError?: boolean
  submissionMessage?: string | null
}

export function sumGenreTimes(snapshot: { genreTimes?: Record<string, number> } | null) {
  return Object.values(snapshot?.genreTimes ?? {}).reduce(
    (total, value) => total + value,
    0
  )
}

export async function readSessionSnapshot(page: Page) {
  return page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return null
    }

    const raw = window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:feed-session`)
    return raw ? (JSON.parse(raw) as SessionSnapshot) : null
  })
}

export async function isPostLikedInSession(page: Page, postId: string | null) {
  return page.evaluate((targetPostId) => {
    if (!targetPostId) {
      return false
    }

    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return false
    }

    const raw = window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:liked`)
    if (!raw) {
      return false
    }

    try {
      const likedPosts = JSON.parse(raw) as Record<string, boolean>
      return Boolean(likedPosts[targetPostId])
    } catch {
      return false
    }
  }, postId)
}

export async function seedActiveStudySession(page: Page, sessionId: string) {
  await page.addInitScript((targetSessionId) => {
    window.sessionStorage.setItem("ineedsocial:study:active-session", targetSessionId)
  }, sessionId)
}

export async function seedCompletedTutorialSession(page: Page, sessionId: string) {
  await page.addInitScript((targetSessionId) => {
    window.sessionStorage.setItem("ineedsocial:study:active-session", targetSessionId)
    window.sessionStorage.setItem(
      `ineedsocial:study:${targetSessionId}:tutorial`,
      JSON.stringify({ completed: true, currentStep: 0 })
    )
  }, sessionId)
}

export async function startStudy(page: Page) {
  await page.goto("/")
  await page.waitForURL("**/welcome")
  await page.getByTestId("start-study-button").click()
  await page.waitForURL("**/feed?theme=light")
}
