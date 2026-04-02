# Architecture — iNeedSocial

Dokumen ini menjelaskan arsitektur, alur data, logika komponen, dan keputusan desain dari aplikasi iNeedSocial secara menyeluruh.

---

## Gambaran Umum

iNeedSocial adalah **Single Page Application (SPA)** berbasis React yang mensimulasikan pengalaman media sosial untuk keperluan riset. Aplikasi ini **tidak memerlukan backend** saat ini — semua data dibaca dari file JSON statis. Arsitektur dirancang agar mudah dialihkan ke API nyata hanya dengan satu flag.

```
Browser
  └── React SPA (Vite)
        ├── React Router   → navigasi antar halaman
        ├── StudyContext   → global state (likes, timer, komentar)
        ├── Pages          → tampilan per rute
        ├── Components     → UI reusable
        └── Feed Service   → pengambilan data (mock / real API)
              └── /content/feed.json   ← sumber data saat ini
```

---

## Struktur Direktori

```
src/
├── App.tsx                    Entry point routing
├── main.tsx                   Mount React ke DOM
├── index.css                  Global styles + Tailwind base
│
├── types/
│   └── social.ts              Semua TypeScript types
│
├── context/
│   └── study-context.tsx      Global state provider
│
├── services/
│   └── feed-service.ts        Layer abstraksi data (mock ↔ API)
│
├── pages/
│   ├── splash-page.tsx        /splash — intro screen
│   ├── welcome-page.tsx       /welcome — selamat datang
│   ├── feed-page.tsx          /feed — halaman utama
│   ├── timer-page.tsx         /timer — durasi scroll
│   └── thanks-page.tsx        /thank-you — penutup
│
└── components/
    ├── feed-post.tsx           Kartu postingan (image/carousel/video)
    ├── hero-post.tsx           Hero carousel (dark mode only)
    ├── profile-badge.tsx       Avatar dengan inisial
    ├── brand-logo.tsx          Logo SVG Gaby
    ├── comment-sheet.tsx       Bottom sheet komentar
    ├── theme-toggle.tsx        Tombol toggle light/dark
    ├── icon-action.tsx         Ikon aksi generik
    ├── layout/
    │   ├── Sidebar.tsx         Navigasi kiri (desktop only)
    │   ├── RightPanel.tsx      Panel kanan / saran (desktop only)
    │   ├── TopBar.tsx          Bar atas mobile
    │   └── BottomNav.tsx       Navigasi bawah mobile
    └── tutorial/
        └── TutorialOverlay.tsx Overlay tutorial onboarding
```

---

## Routing & Alur Halaman

Routing dikelola oleh **React Router DOM v7** di `App.tsx`, dibungkus `StudyProvider` agar semua halaman dapat mengakses global state.

```
/  →  redirect ke /splash

/splash
  Auto-redirect ke /welcome setelah 1.4 detik

/welcome
  User menekan tombol → navigate ke /feed?theme=light

/feed?theme=light  atau  /feed?theme=dark
  Halaman utama. Theme dikontrol via query parameter.
  User menekan logo di bawah feed → navigate ke /timer

/timer
  Menampilkan durasi scroll sejak masuk /feed.
  User menekan logo → navigate ke /thank-you

/thank-you
  Halaman penutup.
  User menekan tombol restart → navigate ke /splash

/* (rute tidak dikenal)
  → redirect ke /splash
```

### Diagram Alur

```
/splash ──(1.4s)──► /welcome ──(klik)──► /feed
                                            │
                              theme toggle  │  scroll selesai
                              ◄─────────────┤
                                            ▼
                                         /timer ──(klik)──► /thank-you
                                                                  │
                                                           (restart)
                                                                  ▼
                                                             /splash
```

---

## Sistem Theme

Theme dikontrol melalui **URL query parameter** `?theme=light` atau `?theme=dark`, bukan via localStorage atau CSS class.

```ts
// Dibaca di feed-page.tsx
const themeMode: ThemeMode =
  searchParams.get("theme") === "dark" ? "dark" : "light"
```

**Keuntungan pendekatan ini:**
- URL shareable dengan tema tertentu
- Tidak ada state tersembunyi di storage
- Theme dapat dikontrol oleh peneliti (mengarahkan user ke URL tertentu)

### Perbedaan Light vs Dark

| Aspek | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Background | Gradient ungu muda (`bg-page-light`) | Gradient gelap (`bg-page-dark`) |
| Hero Post | Tidak tampil | Tampil (auto-advance 2.6 detik) |
| Teks | `text-ink` (#27262F) | `text-white` |
| Header sticky | `bg-mist/90` + blur | `bg-ink/90` + blur |

---

## Layer Data — Feed Service

```
src/services/feed-service.ts
```

Semua akses data disalurkan lewat satu objek `socialFeedService`. Ada dua mode:

```ts
const USE_MOCK = true   // true = JSON lokal, false = API nyata
```

| Mode | Sumber Data | Endpoint |
|------|------------|----------|
| Mock (`USE_MOCK = true`) | `public/content/feed.json` | — |
| Real (`USE_MOCK = false`) | Backend HTTP | `GET /api/feed?theme=...` |

**Format response yang diharapkan** (sama persis untuk mock dan real):

```ts
type FeedPayload = {
  theme: ThemeMode        // "light" | "dark"
  heroSlides: HeroSlide[] // slide hero carousel (dark mode)
  posts: Post[]           // daftar postingan
}
```

---

## Type System

Semua tipe terdefinisi di `src/types/social.ts`:

```ts
type PostType = "image" | "carousel" | "video"

type MediaItem = {
  src: string
  alt: string
  poster?: string    // hanya untuk video (thumbnail)
}

type Post = {
  id: string
  type: PostType
  username: string
  likes: string      // string karena format "1.234" (bukan number)
  caption: string
  media: MediaItem[]
}

type HeroSlide = {
  id: string
  src: string
  alt: string
}
```

---

## Global State — StudyContext

```
src/context/study-context.tsx
```

`StudyProvider` membungkus seluruh aplikasi di `App.tsx` dan menyediakan state yang perlu diakses lintas halaman.

### State yang Dikelola

| State | Tipe | Fungsi |
|-------|------|--------|
| `likedPosts` | `Record<string, boolean>` | Postingan mana yang sudah di-like |
| `repostedPosts` | `Record<string, boolean>` | Postingan mana yang sudah di-share |
| `commentSheet` | `string \| null` | ID post yang sedang dibuka komentarnya |
| `feedStartedAt` | `number \| null` | Timestamp `Date.now()` saat user masuk /feed |

### Persistensi

`likedPosts` dan `repostedPosts` otomatis disimpan ke `localStorage`:

```
gaby:liked      → Record<postId, boolean>
gaby:reposted   → Record<postId, boolean>
```

Saat refresh halaman, state di-hydrate kembali dari localStorage. Berfungsi bahkan di private mode (error localStorage ditangkap dengan try/catch).

### Timer

`feedStartedAt` diset sekali saat komponen `FeedPage` pertama mount melalui `startFeedTimer()`. Sifatnya **idempotent** — memanggil berkali-kali tidak mengubah nilai awal:

```ts
const startFeedTimer = useCallback(() => {
  setFeedStartedAt((prev) => prev ?? Date.now())
}, [])
```

Di `TimerPage`, elapsed time dihitung sebagai:
```ts
const elapsedMs = feedStartedAt === null ? 0 : Date.now() - feedStartedAt
```

---

## Feed Page — Logika Utama

```
src/pages/feed-page.tsx
```

### Lifecycle & Effects

```
Mount
  ├── startFeedTimer()                    catat waktu masuk feed
  ├── socialFeedService.getFeedByTheme()  fetch data
  └── (jika tutorial belum selesai)       setTimeout 350ms → tampilkan tutorial

Theme berubah (query param)
  ├── fetch ulang data dengan tema baru
  ├── scroll ke atas
  └── tutup comment sheet

Dark mode aktif + data ada
  └── setInterval 2600ms → auto-advance hero slide
```

### Render Tree Feed

```
FeedPage
├── Sidebar (fixed, desktop only)
├── <main>
│   ├── Header sticky (logo center mobile + toggle kanan atas)
│   └── feed-wrapper
│       ├── FeedSkeleton          ← saat data belum tersedia
│       ├── [dark mode]
│       │   ├── RevealPost → HeroPost
│       │   └── RevealPost → FeedPost  (× n posts)
│       ├── [light mode]
│       │   └── RevealPost → FeedPost  (× n posts)
│       └── Timer CTA button
├── RightPanel (fixed, desktop only)
├── Mobile FAB timer (fixed bottom, mobile only)
├── CommentSheet (conditional overlay)
└── TutorialOverlay (conditional overlay)
```

---

## Skeleton Loading & RevealPost

Sistem loading dua lapis untuk pengalaman seperti media sosial nyata:

### Lapis 1 — Initial Load

Saat data belum tiba dari `feed.json`, ditampilkan `FeedSkeleton` (3 placeholder animasi pulse).

### Lapis 2 — Per-Post Reveal (IntersectionObserver)

Setelah data tiba, setiap post dibungkus `RevealPost`. Logikanya:

```
Post dibungkus RevealPost
  └── Render awal: SinglePostSkeleton (dengan tinggi penuh)

IntersectionObserver memantau tiap post
  └── Post masuk viewport (threshold 10%)
        └── setTimeout 2000ms
              └── revealed = true → render konten asli
```

**Keunggulan:**
- Post yang jauh di bawah belum reveal → scroll terasa bertahap
- Sekali revealed, tidak skeleton lagi (state `revealed` tidak reset)
- `observer.disconnect()` setelah trigger → tidak ada memory leak
- `clearTimeout` di cleanup effect → aman jika komponen unmount sebelum 2 detik

```ts
// Inti logika RevealPost
const observer = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      timer = window.setTimeout(() => setRevealed(true), 2000)
      observer.disconnect()
    }
  },
  { threshold: 0.1 }
)
```

---

## Komponen Post — FeedPost

```
src/components/feed-post.tsx
```

Satu komponen menangani tiga tipe post berdasarkan `post.type`:

### image

```
<article>
  ├── Header (avatar, username, "Baru saja", ··· button)
  ├── <img> aspect-ratio 4/5 object-cover
  ├── Action row (Like, Comment, Share, Bookmark)
  └── Like count + Caption
```

### carousel

```
<article>
  ├── Header
  ├── Carousel container (overflow-hidden)
  │   ├── Flex row slides (translateX untuk sliding)
  │   ├── Counter "1/3" top-right
  │   ├── Dot indicators bottom-center
  │   ├── Prev arrow (hidden jika di slide pertama)
  │   └── Next arrow (hidden jika di slide terakhir)
  ├── Action row
  └── Like count + Caption
```

Navigasi carousel:
- **Touch**: `onTouchStart` + `onTouchEnd`, threshold 40px
- **Click**: tombol ChevronLeft / ChevronRight
- **Animasi**: CSS `transition-transform duration-300 ease-out`

### video

```
<article>
  ├── Header
  ├── <video controls playsInline poster={...} src={...}>
  ├── Action row
  └── Like count + Caption
```

---

## Komponen Hero Post

```
src/components/hero-post.tsx
```

Hanya muncul di **dark mode**. Auto-advance dikontrol dari `FeedPage` (bukan internal component) — interval 2.6 detik dikelola di `feed-page.tsx` dan index slide dioper sebagai prop `activeIndex`.

Ini memungkinkan interval dibersihkan saat tema berubah tanpa memory leak.

---

## Tutorial Overlay

```
src/components/tutorial/TutorialOverlay.tsx
```

Tutorial 6 langkah yang muncul sekali saat user pertama kali membuka feed.

### Mekanisme Spotlight

Menggunakan SVG mask untuk efek "spotlight" — area gelap dengan lubang transparan di sekitar elemen target:

```
SVG fullscreen
  └── <mask id="tutorial-mask">
        ├── <rect fill="white" />   ← semua area gelap
        └── <rect fill="black" />   ← area target = transparan (spotlight)
      </mask>
  └── <rect fill="rgba(0,0,0,0.82)" mask="..." />   ← dark overlay
```

Target elemen diambil via `document.querySelector(selector)` dan `getBoundingClientRect()`.

### Persistensi Tutorial

```ts
localStorage.setItem("gaby:tutorial_v1", "1")   // setelah selesai
localStorage.getItem("gaby:tutorial_v1") === "1"  // cek sudah selesai
```

### 6 Langkah Tutorial

| # | Target Selector | Posisi Tooltip |
|---|----------------|---------------|
| 1 | — | Full modal (selamat datang) |
| 2 | `[data-tutorial-id='tutorial-post']` | Below |
| 3 | `[aria-label='Suka postingan']` | Above |
| 4 | `[aria-label='Buka komentar']` | Above |
| 5 | `[aria-label='Toggle theme']` | Below |
| 6 | — | Full modal (siap mulai) |

---

## Layout Responsif

Tiga breakpoint utama:

```
Mobile (< 768px / md)
├── Header sticky: spacer + logo center + toggle kanan
├── Feed full width
├── FAB timer (fixed bottom center)
└── Sidebar & RightPanel: hidden

Tablet (768px – 1023px)
├── Feed centered, max-width 470px
└── Sidebar & RightPanel: hidden

Desktop (≥ 1024px / lg)
├── Sidebar fixed kiri (280px)
├── Feed centered, max-width 470px
└── RightPanel fixed kanan (320px)
```

### CSS Classes Utama (`index.css`)

| Class | Fungsi |
|-------|--------|
| `.app-shell` | Flex container utama, 100vh |
| `.sidebar` | Fixed kiri, hidden mobile |
| `.main-content` | Area scroll utama |
| `.feed-wrapper` | Container feed, max-width 470px |
| `.right-panel` | Fixed kanan, hidden mobile |
| `.no-scrollbar` | Sembunyikan scrollbar, pertahankan scroll |

---

## PWA (Progressive Web App)

Konfigurasi di `public/manifest.json` dan `vite.config.js` via `vite-plugin-pwa`:

| Setting | Nilai |
|---------|-------|
| `name` | iNeedSocial |
| `display` | `standalone` (tanpa browser chrome) |
| `theme_color` | `#776DFF` (violet) |
| `start_url` | `/` |
| `lang` | `id` (Bahasa Indonesia) |

Icons yang diperlukan:
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon.svg`

---

## Keputusan Desain Penting

### 1. Theme via Query Parameter

Theme disimpan di URL (`?theme=dark`), bukan localStorage. Ini memungkinkan peneliti mengarahkan peserta ke URL dengan tema tertentu secara langsung.

### 2. Mock-First dengan Flag Tunggal

Satu flag `USE_MOCK` di `feed-service.ts` mengalihkan antara data lokal dan API nyata. Tidak ada perubahan kode lain yang diperlukan.

### 3. Timer Idempotent

`startFeedTimer()` menggunakan pola `prev ?? Date.now()` sehingga aman dipanggil dari `useEffect` yang mungkin re-run, tanpa mereset timestamp awal.

### 4. IntersectionObserver per Post

Setiap `RevealPost` membuat observer sendiri dan langsung `disconnect()` setelah trigger. Ini lebih efisien daripada satu observer global yang harus mengelola state semua post.

### 5. Hero Index di FeedPage

`activeIndex` hero carousel tidak disimpan di dalam `HeroPost` melainkan di `FeedPage`. Ini memungkinkan interval auto-advance dibersihkan bersama saat theme berubah (satu `useEffect` cleanup).

### 6. `data-tutorial-id` sebagai Bridge

Tutorial overlay menggunakan CSS selector `[data-tutorial-id='tutorial-post']` untuk menemukan elemen target di DOM. Atribut ini dioper sebagai prop `tutorialId` ke `RevealPost` dan diteruskan ke div wrapper — memutus ketergantungan langsung antara `TutorialOverlay` dan struktur internal `FeedPost`.
