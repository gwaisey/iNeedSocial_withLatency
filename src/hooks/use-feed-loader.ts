import { useEffect, useRef, useState } from "react"
import type { FeedPayload, ThemeMode } from "../types/social"
import { socialFeedService } from "../services/feed-service"
import { getUserFacingErrorMessage } from "../utils/error-utils"

type UseFeedLoaderArgs = {
  themeMode: ThemeMode
}

export function useFeedLoader({ themeMode }: UseFeedLoaderArgs) {
  const forcedRefreshThemeRef = useRef<ThemeMode | null>(null)
  const payloadCacheRef = useRef<Partial<Record<ThemeMode, FeedPayload>>>({})
  const [payload, setPayload] = useState<FeedPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedRequestKey, setFeedRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    const cachedPayload = payloadCacheRef.current[themeMode]
    const shouldForceRefresh = forcedRefreshThemeRef.current === themeMode

    if (cachedPayload && !shouldForceRefresh) {
      setPayload(cachedPayload)
      setFeedError(null)
      setIsLoading(false)

      return () => {
        active = false
      }
    }

    async function loadFeed() {
      setIsLoading(true)
      setFeedError(null)

      try {
        const nextPayload = await socialFeedService.getFeedByTheme(themeMode)
        if (!active) {
          return
        }

        forcedRefreshThemeRef.current = null
        payloadCacheRef.current[themeMode] = nextPayload
        setPayload(nextPayload)
      } catch (error) {
        if (!active) {
          return
        }

        forcedRefreshThemeRef.current = null
        setPayload((current) => (current?.theme === themeMode ? current : null))
        setFeedError(
          getUserFacingErrorMessage(error, "Feed tidak dapat dimuat.", "feed-page:load")
        )
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadFeed()

    return () => {
      active = false
    }
  }, [feedRequestKey, themeMode])

  return {
    feedError,
    isLoading,
    payload,
    retryFeed: () => {
      forcedRefreshThemeRef.current = themeMode
      setFeedRequestKey((current) => current + 1)
    },
  }
}
