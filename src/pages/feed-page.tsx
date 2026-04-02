import React, { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { RightPanel } from "../components/layout/RightPanel"
import { Sidebar } from "../components/layout/Sidebar"
import { BrandLogo } from "../components/brand-logo"
import { CommentSheet } from "../components/comment-sheet"
import { FeedPost } from "../components/feed-post"
import { ThemeToggle } from "../components/theme-toggle"
import { isTutorialDone, TutorialOverlay } from "../components/tutorial/TutorialOverlay"
import { useStudyState } from "../context/study-context"
import { socialFeedService } from "../services/feed-service"
import { getRandomLatency } from "../config/latency"
import { type FeedPayload, type ThemeMode } from "../types/social"

export function FeedPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payload, setPayload] = useState<FeedPayload | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showTimer, setShowTimer] = useState(false)

  const {
    commentSheet,
    feedStartedAt,
    likedPosts,
    repostedPosts,
    closeCommentSheet,
    openCommentSheet,
    startFeedTimer,
    toggleLiked,
    toggleReposted,
  } = useStudyState()

  // Mark the moment user first enters the feed (idempotent — won't reset on re-renders)
  useEffect(() => { startFeedTimer() }, [startFeedTimer])

  const themeMode: ThemeMode =
    searchParams.get("theme") === "dark" ? "dark" : "light"
  const isDark = themeMode === "dark"

  // Load feed
  useEffect(() => {
    let active = true
    setPayload(null)
    socialFeedService.getFeedByTheme(themeMode).then((r) => { if (active) setPayload(r) })
    return () => { active = false }
  }, [themeMode])

  // Show tutorial once on first load after feed renders
  useEffect(() => {
    if (!payload || isTutorialDone()) return
    const t = setTimeout(() => setShowTutorial(true), 350)
    return () => clearTimeout(t)
  }, [payload])

  // Reset scroll + hero index on theme change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    setHeroIndex(0)
    closeCommentSheet()
  }, [themeMode, closeCommentSheet])

  // Auto-advance hero carousel (dark mode only)
  useEffect(() => {
    if (!isDark || !payload?.heroSlides.length) return undefined
    const id = window.setInterval(
      () => setHeroIndex((i) => (i + 1) % payload.heroSlides.length),
      2600
    )
    return () => window.clearInterval(id)
  }, [isDark, payload])

  useEffect(() => {
    const handler = () => setShowTimer(true)
    window.addEventListener("timeropen", handler)
    return () => window.removeEventListener("timeropen", handler)
  }, [])

  const handleThemeToggle = () =>
    setSearchParams({ theme: isDark ? "light" : "dark" })

  const bgClass    = isDark ? "bg-page-dark"  : "bg-page-light"
  const textColor  = isDark ? "text-white"     : "text-ink"
  const dividerCls = isDark ? "divide-white/8" : "divide-ink/6"
  const borderCls  = isDark ? "border-white/8" : "border-ink/8"

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : ""}`}>

      {/* ── Desktop sidebar (position: fixed, hidden on mobile) ── */}
      <Sidebar theme={themeMode} />

      {/* ── Main scrollable content ── */}
      <main
        ref={scrollRef}
        className={`main-content no-scrollbar ${bgClass} ${textColor}`}
      >

        {/*
          ── Inline feed header (NOT sticky / NOT fixed) ──────────
          Scrolls with content. Logo on left, controls on right.
          On desktop the sidebar already shows the logo, so the logo
          is only shown on mobile (hidden lg:hidden → use lg:hidden).
        */}
        <div className={`sticky top-0 z-40 flex items-center px-4 py-3 border-b backdrop-blur-sm ${borderCls} ${isDark ? "bg-ink/90" : "bg-mist/90"}`}>
          {/* Spacer kiri — menyeimbangkan toggle agar logo benar-benar center di mobile */}
          <div className="w-[42px] lg:hidden shrink-0" />
          {/* Logo — center di mobile, invisible di desktop (sidebar sudah punya logo) */}
          <div className="flex-1 flex justify-center lg:invisible">
            <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={60} />
          </div>
          <ThemeToggle isDark={isDark} onClick={handleThemeToggle} />
        </div>

        {/* ── Feed stream ────────────────────────────────────────── */}
        <div className="feed-wrapper">

          {/* Loading skeleton */}
          {!payload && <FeedSkeleton isDark={isDark} />}

          {/* Dark mode: hero carousel + posts */}
          {payload && isDark && (
            <div className={`divide-y ${dividerCls}`}>
              {payload.posts.map((post) => (
                <RevealPost key={post.id} isDark>
                  <FeedPost
                    isDark
                    isLiked={Boolean(likedPosts[post.id])}
                    isReposted={Boolean(repostedPosts[post.id])}
                    onComment={() => openCommentSheet(post.id)}
                    onLike={() => toggleLiked(post.id)}
                    onRepost={() => toggleReposted(post.id)}
                    post={post}
                  />
                </RevealPost>
              ))}
            </div>
          )}

          {/* Light mode: regular posts */}
          {payload && !isDark && (
            <div className={`divide-y ${dividerCls}`}>
              {payload.posts.map((post, idx) => (
                <RevealPost
                  key={post.id}
                  isDark={false}
                  tutorialId={idx === 0 ? "tutorial-post" : undefined}
                >
                  <FeedPost
                    isDark={false}
                    isLiked={Boolean(likedPosts[post.id])}
                    isReposted={Boolean(repostedPosts[post.id])}
                    onComment={() => openCommentSheet(post.id)}
                    onLike={() => toggleLiked(post.id)}
                    onRepost={() => toggleReposted(post.id)}
                    post={post}
                  />
                </RevealPost>
              ))}
            </div>
          )}

          {/* Timer CTA – bottom of feed */}
          {payload && (
            <div className={`flex flex-col items-center gap-3 py-10 border-t ${borderCls}`}>
              <p className={`text-[11px] font-medium tracking-widest uppercase ${isDark ? "text-white/35" : "text-ink/35"}`}>
                Selesai scrolling?
              </p>
              <button
                aria-label="Open timer page"
                className="
                  flex h-14 w-14 items-center justify-center rounded-full
                  bg-white shadow-[0_8px_24px_rgba(18,17,25,0.16)]
                  active:scale-95 transition-transform
                "
                onClick={() => setShowTimer(true)}
                type="button"
              >
                <BrandLogo color="#27262F" width={32} />
              </button>
            </div>
          )}

        </div>
      </main>

      {/* ── Desktop right panel (position: fixed) ── */}
      <RightPanel theme={themeMode} />

      {/* ── Mobile FAB – timer shortcut (fixed bottom center, mobile only) ── */}
      <button
        aria-label="Lihat durasi scrolling"
        className="
          md:hidden fixed left-1/2 -translate-x-1/2 z-50
          flex h-14 w-14 items-center justify-center rounded-full
          bg-white shadow-[0_8px_28px_rgba(18,17,25,0.22)]
          active:scale-90 transition-transform
        "
        onClick={() => setShowTimer(true)}
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        type="button"
      >
        <BrandLogo color="#27262F" width={30} />
      </button>
      
      {showTimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-4 text-white text-center px-6">
            <BrandLogo color="#FFFFFF" width={48} />
            <div>
              <p className="text-base font-bold tracking-wide mb-3">Time You've Spent</p>
              <p className="text-[clamp(2.5rem,12vw,4rem)] font-bold tabular-nums leading-none whitespace-nowrap">
                {formatElapsed(feedStartedAt)}
              </p>
              <div className="mt-3 flex justify-between px-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                <span>jam</span>
                <span>mnt</span>
                <span>dtk</span>
              </div>
            </div>
            <p className="text-sm font-semibold text-[#FF516B] max-w-[260px] leading-relaxed">
              Don't forget to screenshot this page and submit to our post-questionnaire!
            </p>
            <div className="flex gap-4 mt-2">
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white active:scale-95 transition-transform"
                onClick={() => setShowTimer(false)}
                type="button"
              >
                ✕
              </button>
              <button
                aria-label="Continue to thank-you screen"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-transform"
                onClick={() => navigate("/thank-you")}
                type="button"
              >
                <BrandLogo color="#27262F" width={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {commentSheet && <CommentSheet onClose={closeCommentSheet} />}
      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
    </div>
  )
}

// ── Single post skeleton ─────────────────────────────────────────────────────
function SinglePostSkeleton({ isDark }: { isDark: boolean }) {
  const s = isDark ? "bg-white/10" : "bg-ink/8"
  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className={`h-9 w-9 rounded-full animate-pulse ${s}`} />
        <div className="space-y-1.5 flex-1">
          <div className={`h-3 w-24 rounded-full animate-pulse ${s}`} />
          <div className={`h-2.5 w-14 rounded-full animate-pulse ${s}`} />
        </div>
      </div>
      <div className={`w-full aspect-[4/5] animate-pulse ${s}`} />
      <div className="flex items-center gap-3 px-3 py-2">
        <div className={`h-5 w-12 rounded-full animate-pulse ${s}`} />
        <div className={`h-5 w-12 rounded-full animate-pulse ${s}`} />
        <div className={`h-5 w-8 rounded-full animate-pulse ${s}`} />
      </div>
      <div className="px-3 py-3 space-y-2">
        <div className={`h-3 w-20 rounded-full animate-pulse ${s}`} />
        <div className={`h-3 w-48 rounded-full animate-pulse ${s}`} />
      </div>
    </div>
  )
}

// ── Initial feed skeleton (3 placeholder posts while data loads) ─────────────
function FeedSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`divide-y ${isDark ? "divide-white/8" : "divide-ink/6"}`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <SinglePostSkeleton key={i} isDark={isDark} />
      ))}
    </div>
  )
}

// ── RevealPost — skeleton selama 2 detik saat post masuk viewport ────────────
function RevealPost({
  children,
  isDark,
  tutorialId,
}: {
  children: React.ReactNode
  isDark: boolean
  tutorialId?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (revealed) return
    const el = ref.current
    if (!el) return
    let timer: number
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = window.setTimeout(() => setRevealed(true), getRandomLatency())
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [revealed])

  return (
    <div ref={ref} {...(tutorialId ? { "data-tutorial-id": tutorialId } : {})}>
      {revealed ? children : <SinglePostSkeleton isDark={isDark} />}
    </div>
  )
}

function formatElapsed(feedStartedAt: number | null): string {
  const ms = feedStartedAt === null ? 0 : Date.now() - feedStartedAt
  const totalSec = Math.floor(ms / 1000)
  const hours   = String(Math.floor(totalSec / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSec % 60).padStart(2, "0")
  return `${hours} : ${minutes} : ${seconds}`
}