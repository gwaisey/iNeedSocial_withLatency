import { expect, type Page } from "@playwright/test"

export async function getFeedScrollTop(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-testid="feed-scroll-container"]'
    )
    return element?.scrollTop ?? 0
  })
}

export async function setFeedScrollTop(page: Page, top: number) {
  await page.waitForFunction(() =>
    Boolean(document.querySelector('[data-testid="feed-scroll-container"]'))
  )
  await page.evaluate((nextTop) => {
    const element = document.querySelector<HTMLElement>(
      '[data-testid="feed-scroll-container"]'
    )
    if (!element) {
      throw new Error("Feed scroll container is not attached.")
    }

    element.scrollTop = nextTop
    element.dispatchEvent(new Event("scroll"))
  }, top)
}

export async function waitForFeedScrollTopAtLeast(page: Page, minimumTop: number) {
  await expect
    .poll(async () => getFeedScrollTop(page), {
      message: `Expected feed scrollTop to reach at least ${minimumTop}px`,
    })
    .toBeGreaterThan(minimumTop)
}

export async function getFirstVisiblePostId(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>('[data-testid="feed-scroll-container"]')
    if (!container) {
      return null
    }

    const containerRect = container.getBoundingClientRect()
    const posts = container.querySelectorAll<HTMLElement>("[data-regular-post-id]")

    for (const element of posts) {
      const rect = element.getBoundingClientRect()
      const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom

      if (isVisible) {
        return element.getAttribute("data-regular-post-id")
      }
    }

    return null
  })
}

export async function waitForVisibleFeedPost(page: Page) {
  await expect
    .poll(async () => getFirstVisiblePostId(page), {
      message: "Expected at least one feed post to be visible in the viewport",
    })
    .not.toBeNull()
}

export async function scrollPostIntoView(page: Page, postId: string) {
  const post = page.locator(`[data-regular-post-id="${postId}"]`)
  await expect(post).toBeAttached()
  await post.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" })
  })
  await expect(post).toBeVisible()
}

export async function waitForRenderedImageMedia(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return false
    }

    const images = Array.from(post.querySelectorAll("img[alt]"))
    if (!images.length) {
      return false
    }

    return images.some((node) => {
      if (!(node instanceof HTMLImageElement)) {
        return false
      }

      const style = window.getComputedStyle(node)
      return node.complete && node.naturalWidth > 0 && style.opacity !== "0"
    })
  }, postId)
}

export async function waitForRenderedVideoMedia(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return false
    }

    const video = post.querySelector("video")
    if (!(video instanceof HTMLVideoElement)) {
      return false
    }

    const style = window.getComputedStyle(video)
    return style.opacity !== "0" && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  }, postId)
}

export async function waitForRenderedVideoFallbackMedia(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return false
    }

    const poster = post.querySelector('img[aria-hidden="true"]')
    if (!(poster instanceof HTMLImageElement)) {
      return false
    }

    return poster.complete && poster.naturalWidth > 0
  }, postId)
}

export async function waitForVideoPlaying(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    const video = post?.querySelector("video")
    return (
      video instanceof HTMLVideoElement &&
      !video.paused &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    )
  }, postId)
}

export async function waitForVideoPausedAndReset(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    const video = post?.querySelector("video")
    return (
      video instanceof HTMLVideoElement &&
      video.paused &&
      Math.abs(video.currentTime) < 0.05
    )
  }, postId)
}

export async function waitForSinglePlayingVideo(page: Page, expectedPostId: string) {
  await page.waitForFunction((targetPostId) => {
    const playingVideos = Array.from(document.querySelectorAll("video")).filter((node) => {
      return node instanceof HTMLVideoElement && !node.paused
    })

    if (playingVideos.length !== 1) {
      return false
    }

    const ownerPost = playingVideos[0].closest<HTMLElement>("[data-regular-post-id]")
    return ownerPost?.dataset.regularPostId === targetPostId
  }, expectedPostId)
}
