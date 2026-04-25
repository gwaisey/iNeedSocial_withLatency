export type FeedScrollMetrics = {
  readonly clientHeight: number
  readonly scrollHeight: number
  readonly scrollTop: number
}

export type FeedViewportRect = {
  readonly bottom: number
  readonly top: number
}

export function getFeedScrollRoot(element: HTMLElement | null) {
  if (!element || typeof window === "undefined") {
    return null
  }

  const overflowY = window.getComputedStyle(element).overflowY
  return overflowY === "visible" || overflowY === "clip" ? null : element
}

function getDocumentScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

function getDocumentScrollHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  )
}

export function getFeedScrollMetrics(element: HTMLElement | null): FeedScrollMetrics {
  const scrollRoot = getFeedScrollRoot(element)

  if (scrollRoot) {
    return {
      clientHeight: scrollRoot.clientHeight,
      scrollHeight: scrollRoot.scrollHeight,
      scrollTop: scrollRoot.scrollTop,
    }
  }

  return {
    clientHeight: window.innerHeight,
    scrollHeight: getDocumentScrollHeight(),
    scrollTop: getDocumentScrollTop(),
  }
}

export function getFeedScrollTop(element: HTMLElement | null) {
  return getFeedScrollMetrics(element).scrollTop
}

export function setFeedScrollTop(element: HTMLElement | null, scrollTop: number) {
  const scrollRoot = getFeedScrollRoot(element)
  if (scrollRoot) {
    scrollRoot.scrollTop = scrollTop
    return
  }

  window.scrollTo(0, scrollTop)
}

export function adjustFeedScrollTop(element: HTMLElement | null, delta: number) {
  const scrollRoot = getFeedScrollRoot(element)
  if (scrollRoot) {
    scrollRoot.scrollTop += delta
    return
  }

  window.scrollTo(0, getDocumentScrollTop() + delta)
}

export function getFeedViewportRect(element: HTMLElement | null): FeedViewportRect {
  const scrollRoot = getFeedScrollRoot(element)
  if (scrollRoot) {
    const rect = scrollRoot.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      top: rect.top,
    }
  }

  return {
    bottom: window.innerHeight,
    top: 0,
  }
}

export function addFeedScrollListener(element: HTMLElement | null, listener: () => void) {
  const scrollRoot = getFeedScrollRoot(element)
  const target: HTMLElement | Window = scrollRoot ?? window

  target.addEventListener("scroll", listener, { passive: true })
  return () => {
    target.removeEventListener("scroll", listener)
  }
}
