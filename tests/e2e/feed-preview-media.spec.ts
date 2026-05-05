import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { startStudy } from "./helpers/session"
import { dismissTutorialIfVisible } from "./helpers/tutorial"

type ScrollState = {
  atEnd: boolean
  atStart: boolean
}

type PlaybackState = {
  focusedAnimatedSkeleton: boolean
  focusedVideoPostId: string | null
  ok: boolean
  playingVideoPostIds: string[]
}

function isVideoSource(src: string) {
  const normalizedSrc = src.toLowerCase().split("?")[0]
  return (
    normalizedSrc.includes("/videos-default/") ||
    normalizedSrc.includes("/videos/") ||
    normalizedSrc.endsWith(".mp4") ||
    normalizedSrc.endsWith(".webm") ||
    normalizedSrc.endsWith(".ogg") ||
    normalizedSrc.endsWith(".mov") ||
    normalizedSrc.endsWith(".m4v")
  )
}

function loadCarouselSlideVideoFlags() {
  const feedPath = path.join(process.cwd(), "public/content/feed.json")
  const feed = JSON.parse(readFileSync(feedPath, "utf8")) as {
    posts?: Array<{
      id?: string
      media?: Array<{ src?: string }>
      type?: string
    }>
  }
  const flags = new Map<string, boolean[]>()

  for (const post of feed.posts ?? []) {
    if (post.type !== "carousel" || !post.id) {
      continue
    }

    const slideVideoFlags = Array.isArray(post.media)
      ? post.media.map((item) => isVideoSource(item.src ?? ""))
      : []
    flags.set(post.id, slideVideoFlags)
  }

  return flags
}

const carouselSlideVideoFlags = loadCarouselSlideVideoFlags()

async function readScrollState(page: Page): Promise<ScrollState> {
  return page.evaluate(() => {
    const feed = document.querySelector<HTMLElement>('[data-testid="feed-scroll-container"]')
    if (!feed) {
      return { atEnd: false, atStart: true }
    }

    const usesDocumentScroll = getComputedStyle(feed).overflowY === "visible"
    if (usesDocumentScroll) {
      const max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      )
      const position = Math.max(0, window.scrollY)
      return {
        atEnd: max - position <= 8,
        atStart: position <= 8,
      }
    }

    const max = Math.max(0, feed.scrollHeight - feed.clientHeight)
    const position = Math.max(0, feed.scrollTop)
    return {
      atEnd: max - position <= 8,
      atStart: position <= 8,
    }
  })
}

async function waitForStablePlayback(page: Page, direction: "down" | "up", step: number) {
  await expect
    .poll(
      () =>
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

          const playingVideoPostIds: string[] = []

          for (const node of Array.from(document.querySelectorAll("video"))) {
            if (
              !(node instanceof HTMLVideoElement) ||
              node.paused ||
              node.ended ||
              node.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
            ) {
              continue
            }

            const ownerPost = node.closest<HTMLElement>("[data-regular-post-id]")
            const ownerId = ownerPost?.getAttribute("data-regular-post-id") ?? "unknown"
            playingVideoPostIds.push(ownerId)

          }

          const focusedIsRelevant = focusedVideoPostId !== null && focusedVisibleRatio >= 0.7

          let focusedAnimatedSkeleton = false
          if (focusedIsRelevant && focusedVideoPostId) {
            const focusedPost = document.querySelector<HTMLElement>(
              `[data-regular-post-id="${focusedVideoPostId}"]`
            )
            focusedAnimatedSkeleton = Array.from(
              focusedPost?.querySelectorAll<HTMLElement>(".skeleton") ?? []
            ).some((node) => {
              const style = window.getComputedStyle(node)
              return style.animationName !== "none" && Number.parseFloat(style.opacity || "1") > 0.01
            })
          }

          const hasSinglePlaybackOwner =
            playingVideoPostIds.length <= 1 ||
            (focusedIsRelevant &&
              playingVideoPostIds.length === 1 &&
              playingVideoPostIds[0] === focusedVideoPostId)

          return {
            focusedAnimatedSkeleton,
            focusedVideoPostId,
            ok:
              hasSinglePlaybackOwner &&
              !focusedAnimatedSkeleton,
            playingVideoPostIds,
          } satisfies PlaybackState
        }),
      {
        message: `Expected stable video playback ownership while scrolling ${direction} (step ${step}).`,
        timeout: 10_000,
      }
    )
    .toMatchObject({ ok: true })
}

async function getRenderedCarouselPostIds(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="carousel-indicator-"]'))
      .map((node) => node.dataset.testid?.replace("carousel-indicator-", "") ?? "")
      .filter(Boolean)
  )
}

async function readActiveCarouselSlideRenderedMediaState(page: Page, postId: string) {
  return page.evaluate((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return { hasRenderedMedia: false }
    }

    const root = post.querySelector<HTMLElement>(".w-full.overflow-hidden.relative")
    const track = root?.querySelector<HTMLElement>(".flex.will-change-transform")
    if (!root || !track) {
      return { hasRenderedMedia: false }
    }

    const rootRect = root.getBoundingClientRect()
    const slides = Array.from(track.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement
    )

    let activeIndex = -1
    let maxOverlapArea = -1

    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect()
      const overlapWidth = Math.max(0, Math.min(rect.right, rootRect.right) - Math.max(rect.left, rootRect.left))
      const overlapHeight = Math.max(0, Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top))
      const overlapArea = overlapWidth * overlapHeight
      if (overlapArea > maxOverlapArea) {
        maxOverlapArea = overlapArea
        activeIndex = index
      }
    })

    const activeSlide = slides[activeIndex]
    if (!activeSlide) {
      return { hasRenderedMedia: false }
    }

    const video = activeSlide.querySelector("video")
    const poster = activeSlide.querySelector('img[aria-hidden="true"]')
    const image = activeSlide.querySelector('img:not([aria-hidden="true"])')
    const hasRenderedVideo =
      video instanceof HTMLVideoElement &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      window.getComputedStyle(video).opacity !== "0"
    const hasRenderedPoster =
      poster instanceof HTMLImageElement &&
      poster.complete &&
      poster.naturalWidth > 0 &&
      window.getComputedStyle(poster).opacity !== "0"
    const hasRenderedImage =
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      window.getComputedStyle(image).opacity !== "0"

    return {
      hasRenderedMedia: hasRenderedVideo || hasRenderedPoster || hasRenderedImage,
    }
  }, postId)
}

async function verifyCarouselSlides(page: Page, postId: string, slideHasVideoFlags: boolean[]) {
  const totalSlides = slideHasVideoFlags.length
  const post = page.locator(`[data-regular-post-id="${postId}"]`)
  await expect(post).toBeAttached()
  await post.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" })
  })
  await expect(post).toBeVisible()

  const indicator = page.getByTestId(`carousel-indicator-${postId}`)
  await expect(indicator).toBeVisible()
  await expect(indicator).toHaveText(`1/${totalSlides}`)

  for (let expectedSlideIndex = 1; expectedSlideIndex <= totalSlides; expectedSlideIndex += 1) {
    await expect(indicator).toHaveText(`${expectedSlideIndex}/${totalSlides}`)

    await expect
      .poll(() => readActiveCarouselSlideRenderedMediaState(page, postId), {
        message: `Expected carousel slide ${expectedSlideIndex}/${totalSlides} to render media for ${postId}.`,
        timeout: 5_000,
      })
      .toMatchObject({ hasRenderedMedia: true })

    const expectedActiveSlideHasVideo = slideHasVideoFlags[expectedSlideIndex - 1] ?? false
    const muteButton = page.getByTestId(`mute-button-${postId}`)
    if (expectedActiveSlideHasVideo) {
      await expect
        .poll(() => muteButton.count(), {
          timeout: 5_000,
        })
        .toBeGreaterThan(0)
      await expect(muteButton).toBeVisible()
    } else {
      await expect(muteButton).toHaveCount(0)
    }

    if (expectedSlideIndex < totalSlides) {
      await page.getByTestId(`carousel-next-${postId}`).click()
    }
  }

  for (let expectedSlideIndex = totalSlides; expectedSlideIndex > 1; expectedSlideIndex -= 1) {
    await page.getByTestId(`carousel-prev-${postId}`).click()
    await expect(indicator).toHaveText(`${expectedSlideIndex - 1}/${totalSlides}`)
  }
}

test("preview build keeps full-feed autoplay stable and validates every carousel slide", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const ignoredConsoleErrorFragments = ["net::ERR_CERT_COMMON_NAME_INVALID"]

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text()
      const shouldIgnore = ignoredConsoleErrorFragments.some((fragment) =>
        text.includes(fragment)
      )
      if (!shouldIgnore) {
        consoleErrors.push(text)
      }
    }
  })

  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })

  let reachedFeedEndSignals = 0
  for (let step = 1; step <= 320; step += 1) {
    await page.mouse.wheel(0, 1_100)
    await waitForStablePlayback(page, "down", step)
    const scrollState = await readScrollState(page)
    reachedFeedEndSignals = scrollState.atEnd ? reachedFeedEndSignals + 1 : 0
    if (reachedFeedEndSignals >= 3) {
      break
    }
  }
  expect(reachedFeedEndSignals).toBeGreaterThanOrEqual(3)

  const renderedCarouselIds = await getRenderedCarouselPostIds(page)
  const renderedCarouselIdSet = new Set(renderedCarouselIds)
  expect(renderedCarouselIds.length).toBeGreaterThan(0)
  expect(renderedCarouselIdSet.size).toBe(carouselSlideVideoFlags.size)

  for (const [carouselPostId, slideHasVideoFlags] of carouselSlideVideoFlags.entries()) {
    expect(renderedCarouselIdSet.has(carouselPostId)).toBe(true)
    await verifyCarouselSlides(page, carouselPostId, slideHasVideoFlags)
  }

  let reachedFeedStartSignals = 0
  for (let step = 1; step <= 320; step += 1) {
    await page.mouse.wheel(0, -1_100)
    await waitForStablePlayback(page, "up", step)
    const scrollState = await readScrollState(page)
    reachedFeedStartSignals = scrollState.atStart ? reachedFeedStartSignals + 1 : 0
    if (reachedFeedStartSignals >= 3) {
      break
    }
  }
  expect(reachedFeedStartSignals).toBeGreaterThanOrEqual(3)

  expect(consoleErrors).toEqual([])
})
