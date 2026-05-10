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
  focusedPosterVisibleWhilePlaying: boolean
  focusedVisibleRatio: number
  focusedVideoPlaying: boolean
  focusedVideoPostId: string | null
  ok: boolean
  playingVideoPostIds: string[]
}

type FocusedStartupState = {
  focusedVideoPostId: string | null
  focusedIsRelevant: boolean
  focusedPosterVisibleWhilePlaying: boolean
  focusedVideoPlaying: boolean
}

type StartupSampleResult = {
  checked: boolean
  passed: boolean
  postId: string | null
  reason: "not-focused" | "not-playing" | "passed" | "poster-visible"
}

const FOCUSED_VIDEO_STARTUP_TIMEOUT_MS = 2_000
const PLAYBACK_STABILITY_TIMEOUT_MS = 3_500
const SCROLL_STARTUP_WARMUP_STEPS = 8
// The full-feed stress pass jumps 1100px at a time; allow a small absolute
// number of startup misses while still failing repeated media stalls.
const MAX_FOCUSED_STARTUP_MISSES = 8

function isStartupStep(step: number) {
  return step > SCROLL_STARTUP_WARMUP_STEPS
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
          const viewportLeft = 0
          const viewportRight = window.innerWidth
          const posts = Array.from(
            document.querySelectorAll<HTMLElement>("[data-regular-post-id]")
          )

          const findVisibleVideo = (post: HTMLElement) => {
            let visibleVideo: HTMLVideoElement | null = null
            let bestVisibleArea = 0

            for (const video of Array.from(post.querySelectorAll("video"))) {
              if (!(video instanceof HTMLVideoElement)) {
                continue
              }

              const rect = video.getBoundingClientRect()
              const overlapWidth =
                Math.min(rect.right, viewportRight) - Math.max(rect.left, viewportLeft)
              const overlapHeight =
                Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop)
              if (overlapWidth <= 0 || overlapHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
                continue
              }

              const visibleArea = overlapWidth * overlapHeight
              if (visibleArea > bestVisibleArea) {
                bestVisibleArea = visibleArea
                visibleVideo = video
              }
            }

            return visibleVideo
          }

          let focusedVideoPostId: string | null = null
          let focusedVisibleRatio = 0
          let focusedVideoPlaying = false
          let focusedPosterVisibleWhilePlaying = false

          for (const post of posts) {
            const video = findVisibleVideo(post)
            if (!video) {
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

              focusedVideoPlaying =
                !video.paused &&
                !video.ended &&
                video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

              const poster = video.parentElement?.querySelector('img[aria-hidden="true"]')
              if (focusedVideoPlaying && poster instanceof HTMLImageElement) {
                const posterOpacity = Number.parseFloat(
                  window.getComputedStyle(poster).opacity || "1"
                )
                focusedPosterVisibleWhilePlaying = posterOpacity > 0.01
              } else {
                focusedPosterVisibleWhilePlaying = false
              }
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
            focusedPosterVisibleWhilePlaying,
            focusedVisibleRatio,
            focusedVideoPlaying,
            focusedVideoPostId,
            ok:
              hasSinglePlaybackOwner &&
              !focusedAnimatedSkeleton &&
              !focusedPosterVisibleWhilePlaying,
            playingVideoPostIds,
          } satisfies PlaybackState
        }),
      {
        message: `Expected stable video playback ownership while scrolling ${direction} (step ${step}).`,
        timeout: PLAYBACK_STABILITY_TIMEOUT_MS,
      }
    )
    .toMatchObject({ ok: true })
}

async function waitForFocusedVideoStartup(
  page: Page,
  step: number
): Promise<StartupSampleResult> {
  if (!isStartupStep(step)) {
    return { checked: false, passed: true, postId: null, reason: "not-focused" }
  }

  const readFocusedStartupState = () =>
    page.evaluate(() => {
      const viewportTop = 0
      const viewportBottom = window.innerHeight
      const viewportLeft = 0
      const viewportRight = window.innerWidth
      const posts = Array.from(
        document.querySelectorAll<HTMLElement>("[data-regular-post-id]")
      )

      const findVisibleVideo = (post: HTMLElement) => {
        let visibleVideo: HTMLVideoElement | null = null
        let bestVisibleArea = 0

        for (const video of Array.from(post.querySelectorAll("video"))) {
          if (!(video instanceof HTMLVideoElement)) {
            continue
          }

          const rect = video.getBoundingClientRect()
          const overlapWidth =
            Math.min(rect.right, viewportRight) - Math.max(rect.left, viewportLeft)
          const overlapHeight =
            Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop)
          if (overlapWidth <= 0 || overlapHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
            continue
          }

          const visibleArea = overlapWidth * overlapHeight
          if (visibleArea > bestVisibleArea) {
            bestVisibleArea = visibleArea
            visibleVideo = video
          }
        }

        return visibleVideo
      }

      let focusedVideoPostId: string | null = null
      let focusedVisibleRatio = 0
      let focusedVideoPlaying = false
      let focusedPosterVisibleWhilePlaying = false

      for (const post of posts) {
        const video = findVisibleVideo(post)
        if (!video) {
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
          focusedVideoPlaying =
            !video.paused &&
            !video.ended &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

          const poster = video.parentElement?.querySelector('img[aria-hidden="true"]')
          if (focusedVideoPlaying && poster instanceof HTMLImageElement) {
            const posterOpacity = Number.parseFloat(
              window.getComputedStyle(poster).opacity || "1"
            )
            focusedPosterVisibleWhilePlaying = posterOpacity > 0.01
          } else {
            focusedPosterVisibleWhilePlaying = false
          }
        }
      }

      return {
        focusedVideoPostId,
        focusedIsRelevant: focusedVideoPostId !== null && focusedVisibleRatio >= 0.7,
        focusedPosterVisibleWhilePlaying,
        focusedVideoPlaying,
      } satisfies FocusedStartupState
    })

  const initialState = await readFocusedStartupState()
  if (!initialState.focusedIsRelevant) {
    return {
      checked: false,
      passed: true,
      postId: initialState.focusedVideoPostId,
      reason: "not-focused",
    }
  }

  if (initialState.focusedVideoPlaying && !initialState.focusedPosterVisibleWhilePlaying) {
    return {
      checked: true,
      passed: true,
      postId: initialState.focusedVideoPostId,
      reason: "passed",
    }
  }

  const deadline = Date.now() + FOCUSED_VIDEO_STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const nextState = await readFocusedStartupState()
    const focusChanged = nextState.focusedVideoPostId !== initialState.focusedVideoPostId
    if (!nextState.focusedIsRelevant || focusChanged) {
      return {
        checked: true,
        passed: true,
        postId: initialState.focusedVideoPostId,
        reason: "passed",
      }
    }

    if (nextState.focusedVideoPlaying && !nextState.focusedPosterVisibleWhilePlaying) {
      return {
        checked: true,
        passed: true,
        postId: initialState.focusedVideoPostId,
        reason: "passed",
      }
    }

    await page.waitForTimeout(120)
  }

  return {
    checked: true,
    passed: false,
    postId: initialState.focusedVideoPostId,
    reason: initialState.focusedVideoPlaying ? "poster-visible" : "not-playing",
  }
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
  let focusedStartupChecks = 0
  let focusedStartupMisses = 0
  const focusedStartupMissExamples: string[] = []

  let reachedFeedEndSignals = 0
  for (let step = 1; step <= 320; step += 1) {
    await page.mouse.wheel(0, 1_100)
    await waitForStablePlayback(page, "down", step)
    const startupResult = await waitForFocusedVideoStartup(page, step)
    if (startupResult.checked) {
      focusedStartupChecks += 1
        if (!startupResult.passed) {
          focusedStartupMisses += 1
          if (focusedStartupMissExamples.length < 6) {
            focusedStartupMissExamples.push(
              `down:${step}:${startupResult.postId ?? "unknown"}:${startupResult.reason}`
            )
          }
        }
    }
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
    const startupResult = await waitForFocusedVideoStartup(page, step)
    if (startupResult.checked) {
      focusedStartupChecks += 1
        if (!startupResult.passed) {
          focusedStartupMisses += 1
          if (focusedStartupMissExamples.length < 6) {
            focusedStartupMissExamples.push(
              `up:${step}:${startupResult.postId ?? "unknown"}:${startupResult.reason}`
            )
          }
        }
    }
    const scrollState = await readScrollState(page)
    reachedFeedStartSignals = scrollState.atStart ? reachedFeedStartSignals + 1 : 0
    if (reachedFeedStartSignals >= 3) {
      break
    }
  }
  expect(reachedFeedStartSignals).toBeGreaterThanOrEqual(3)

  expect(focusedStartupChecks).toBeGreaterThan(0)
  expect(
    focusedStartupMisses,
    `Expected focused video startup misses to stay within ${MAX_FOCUSED_STARTUP_MISSES} samples out of ${focusedStartupChecks}. Samples: ${focusedStartupMissExamples.join(", ")}`
  ).toBeLessThanOrEqual(MAX_FOCUSED_STARTUP_MISSES)

  expect(consoleErrors).toEqual([])
})
