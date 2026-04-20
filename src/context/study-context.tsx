import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  clearStudySession,
  getSessionStorage,
  readActiveStudySession,
  readInteractionState,
  startNewStudySession,
  writeInteractionState,
} from "./study-session-storage"

type StudyContextValue = {
  commentSheet: string | null
  likedPosts: Record<string, boolean>
  repostedPosts: Record<string, boolean>
  sessionId: string | null
  closeCommentSheet: () => void
  discardStudySession: () => void
  openCommentSheet: (postId: string) => void
  startStudySession: () => string
  toggleLiked: (postId: string) => void
  toggleReposted: (postId: string) => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

export function StudyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    readActiveStudySession(getSessionStorage())
  )
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(
    () => (sessionId ? readInteractionState(getSessionStorage(), sessionId, "liked") : {})
  )
  const [repostedPosts, setRepostedPosts] = useState<Record<string, boolean>>(
    () => (sessionId ? readInteractionState(getSessionStorage(), sessionId, "reposted") : {})
  )
  const [commentSheet, setCommentSheet] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      return
    }

    writeInteractionState(getSessionStorage(), sessionId, "liked", likedPosts)
  }, [likedPosts, sessionId])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    writeInteractionState(getSessionStorage(), sessionId, "reposted", repostedPosts)
  }, [repostedPosts, sessionId])

  const toggleLiked = useCallback((postId: string) => {
    if (!sessionId) {
      return
    }

    setLikedPosts((curr) => ({ ...curr, [postId]: !curr[postId] }))
  }, [sessionId])

  const toggleReposted = useCallback((postId: string) => {
    if (!sessionId) {
      return
    }

    setRepostedPosts((curr) => ({ ...curr, [postId]: !curr[postId] }))
  }, [sessionId])

  const closeCommentSheet = useCallback(() => setCommentSheet(null), [])
  const openCommentSheet = useCallback((postId: string) => setCommentSheet(postId), [])
  const startStudySession = useCallback(() => {
    const nextSessionId = startNewStudySession(getSessionStorage())
    setSessionId(nextSessionId)
    setLikedPosts({})
    setRepostedPosts({})
    setCommentSheet(null)
    return nextSessionId
  }, [])
  const discardStudySession = useCallback(() => {
    clearStudySession(getSessionStorage(), sessionId)
    setSessionId(null)
    setLikedPosts({})
    setRepostedPosts({})
    setCommentSheet(null)
  }, [sessionId])

  const value = useMemo(
    () => ({
      commentSheet,
      discardStudySession,
      likedPosts,
      repostedPosts,
      sessionId,
      closeCommentSheet,
      openCommentSheet,
      startStudySession,
      toggleLiked,
      toggleReposted,
    }),
    [
      commentSheet,
      discardStudySession,
      likedPosts,
      repostedPosts,
      sessionId,
      closeCommentSheet,
      openCommentSheet,
      startStudySession,
      toggleLiked,
      toggleReposted,
    ]
  )

  return (
    <StudyContext.Provider value={value}>
      {children}
    </StudyContext.Provider>
  )
}

export function useStudyState() {
  const context = useContext(StudyContext)
  if (!context) throw new Error("useStudyState must be used inside StudyProvider")
  return context
}
