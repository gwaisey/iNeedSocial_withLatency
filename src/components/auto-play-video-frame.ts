type VideoFrameCallbackHandle = number

type VideoWithFrameCallback = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: VideoFrameCallbackHandle) => void
  requestVideoFrameCallback?: (
    callback: (
      now: DOMHighResTimeStamp,
      metadata: VideoFrameCallbackMetadata
    ) => void
    ) => VideoFrameCallbackHandle
}

const VIDEO_FRAME_CALLBACK_FALLBACK_MS = 900

export function scheduleFirstRenderableVideoFrame(
  video: HTMLVideoElement,
  onReady: () => void
) {
  let cancelled = false
  let fallbackTimeoutId: number | null = null
  let videoFrameCallbackHandle: VideoFrameCallbackHandle | null = null

  const markReady = () => {
    if (cancelled) {
      return
    }

    cancelled = true
    onReady()
  }

  const frameAwareVideo = video as VideoWithFrameCallback
  if (typeof frameAwareVideo.requestVideoFrameCallback === "function") {
    videoFrameCallbackHandle = frameAwareVideo.requestVideoFrameCallback(() => {
      markReady()
    })

    fallbackTimeoutId = window.setTimeout(markReady, VIDEO_FRAME_CALLBACK_FALLBACK_MS)
  } else {
    markReady()
  }

  return () => {
    cancelled = true

    if (fallbackTimeoutId !== null) {
      window.clearTimeout(fallbackTimeoutId)
    }

    if (
      videoFrameCallbackHandle !== null &&
      typeof frameAwareVideo.cancelVideoFrameCallback === "function"
    ) {
      frameAwareVideo.cancelVideoFrameCallback(videoFrameCallbackHandle)
    }
  }
}
