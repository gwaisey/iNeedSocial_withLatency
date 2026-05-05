# Arsitektur - iNeedSocial

## Gambaran Umum

iNeedSocial adalah aplikasi React single-page untuk studi berbasis feed. Alur peserta dibuat singkat:

```text
/splash -> /welcome -> /feed -> /thank-you
```

Aplikasi ini bersifat mock-first. Feed dasar berasal dari `public/content/feed.json`, sesi peserta disimpan secara opsional ke Supabase, dan media video utama dipetakan ke Cloudflare R2 public origin sebagai sumber MP4 langsung.

## Struktur Runtime

```text
Browser
  -> React SPA
     -> React Router
     -> StudyProvider
     -> feed/session/media helpers
     -> Supabase session service
     -> runtime monitoring buffer

Lokal admin
  -> Skrip ekspor semua sesi
     -> Supabase service-role client
     -> File Excel .xlsx
```

File utama:

- `src/App.tsx` mendefinisikan route dan mempertahankan `/timer` sebagai redirect ke `/feed`.
- `src/pages/feed-page.tsx` mengorkestrasi layout feed, loading state, tutorial, tema, dan scroll restoration.
- `src/components/app-error-boundary.tsx` menangkap crash render/runtime tak terduga di level aplikasi.
- `src/components/auto-play-video.tsx` mengelola mount, preload, autoplay, poster, dan readiness video.
- `src/components/auto-play-video-config.ts` menormalkan sumber MP4, memetakan ke media origin publik, serta menentukan poster dan aspect ratio.
- `src/components/auto-play-video-source.ts` menangani warmup, attach/detach source, dan load hints.
- `src/utils/runtime-monitoring.ts` menyimpan buffer diagnostik lokal untuk error dan rejection yang tidak tertangani.
- `src/services/feed-service.ts` memilih sumber data feed berdasarkan env, memvalidasi payload, lalu menormalisasi data.
- `src/services/supabase.ts` memvalidasi konfigurasi Supabase frontend dan menyimpan satu ringkasan sesi secara idempoten berdasarkan `session_id`.
- `scripts/export-all-sessions.mjs` adalah jalur ekspor admin lokal untuk seluruh data sesi menggunakan service-role key privat.
- `scripts/verify-session-export.mjs` menjalankan verifikasi disposable live session + integritas hasil ekspor workbook.
- `src/context/study-context.tsx` menyimpan state suka, repost, dan session id aktif dengan namespace berbasis sesi studi.
- `src/context/study-session-storage.ts` menyimpan interaksi, progres tutorial, dan snapshot timer/feed di `sessionStorage`.
- `src/types/social.ts` berisi tipe feed, genre, dan payload sesi.

## Routing

Route dibuat ringkas:

- `/` redirect ke `/splash`
- `/splash` redirect ke `/welcome`
- `/welcome` memulai studi di `/feed?theme=light`
- `/feed` adalah layar utama studi
- `/timer` redirect ke `/feed`
- `/thank-you` adalah layar akhir

Tombol akhiri sesi di sidebar desktop dan CTA mobile sama-sama memfinalisasi sesi aktif lalu mengarahkan peserta langsung ke halaman terima kasih.

## Model Data Feed

Feed service menormalisasi semua post ke model internal yang ketat sebelum dipakai UI.

Sumber data feed dikontrol oleh `VITE_FEED_SOURCE`:

- `mock` memuat `public/content/feed.json`
- `api` memanggil `/api/feed?theme=...` sebagai kontrak integrasi future-proof

Nilai selain `api` dianggap `mock`. Repo ini belum menyediakan implementasi backend `/api/feed`.

### Tema

- `light`
- `dark`

### Tipe post

- `image`
- `carousel`
- `video`

### Kategori

- `humor`
- `berita`
- `wisata`
- `makanan`
- `olahraga`
- `game`

Kategori yang tidak dikenal atau kosong dinormalisasi sekali menjadi `humor` di dalam feed service.

## Pelacakan Sesi

`FeedPage` melacak waktu paparan peserta per kategori dengan atribusi kontinu ke post reguler dominan yang sedang terlihat di dalam kontainer scroll.

Perilaku penting:

- Session id studi yang sama dipakai sebagai sumber kebenaran untuk suka, repost, tutorial, dan snapshot timer.
- Waktu selalu dialokasikan ke satu post reguler setelah feed tampil, sehingga timer utama selaras dengan total kategori.
- Durasi post aktif difinalisasi sebelum sesi diakhiri.
- Total kategori yang sudah difinalisasi dipakai ulang untuk penyimpanan Supabase dan retry penyimpanan dari halaman terima kasih.
- Snapshot sesi ditulis ke `sessionStorage` pada perubahan state penting, `pagehide`, dan sebelum transisi tema sehingga refresh pada tab yang sama dapat melanjutkan sesi aktif.
- Reload halaman tidak menghitung jeda refresh sebagai durasi feed aktif.
- Guard mencegah insert sesi ganda jika aksi akhir sesi dipicu ulang atau retry save dijalankan.

## State Interaksi Peserta

Interaksi feed ringan disimpan terpisah dari payload durasi sesi:

- suka dan repost disimpan di `sessionStorage`,
- progres tutorial dan snapshot timer ikut disimpan di `sessionStorage` dengan namespace sesi yang sama,
- namespace penyimpanan dibuat ulang saat sesi baru dimulai dari halaman sambutan,
- refresh pada tab yang sama tetap mempertahankan state sesi aktif,
- sesi baru tidak mewarisi suka/repost dari sesi peserta sebelumnya.

## Perilaku Media

`FeedPost` bertanggung jawab atas render konten media.

### Gambar

- Dimuat secara lazy dengan elemen `img` standar.

### Carousel

- Mendukung swipe dan navigasi tombol.
- Tinggi kontainer menyesuaikan dimensi slide aktif.
- Kontrol mute hanya muncul saat slide aktif memang video.

### Video

- Sumber lokal `/content/videos/*` dinormalisasi ke `/content/videos-default/*`.
- Path lokal tersebut dipetakan ke media origin publik (`VITE_VIDEO_PUBLIC_BASE_URL`) atau default origin R2 di build produksi.
- Visibilitas dipantau dengan `IntersectionObserver` dan subscription scroll yang sama.
- Video hanya autoplay saat terlihat.
- Video di carousel hanya autoplay pada slide aktif.
- Video berhenti saat keluar dari area terlihat dan source dilepas setelah grace period.
- Prewarm dan preload dibedakan untuk kandidat terdekat agar playback tidak berebut koneksi.
- Status mute diterapkan lewat effect, bukan callback ref.

## Penanganan Error

Pemuatan feed eksplisit:

- tampilkan skeleton saat loading,
- tampilkan state retry inline jika pemuatan gagal,
- retry tanpa memuat ulang seluruh aplikasi,
- log error mentah ke `console.error` sambil tetap menampilkan pesan fallback yang aman untuk peserta.

Runtime crash juga ditahan:

- app-level error boundary menangkap error render tak terduga,
- `runtime-monitoring` menyimpan buffer event lokal untuk `window.onerror` dan `unhandledrejection`,
- detail teknis tetap lokal dan tidak dikirim ke backend.

Penyimpanan Supabase frontend juga eksplisit:

- validasi env sebelum membuat client,
- gagal secara graceful jika konfigurasi tidak ada atau tidak valid,
- menggunakan `upsert` berbasis `session_id` dengan retry terbatas hanya untuk kegagalan transient,
- tampilkan status penyimpanan di halaman terima kasih tanpa mengembalikan peserta ke feed.

## Batasan Akses Supabase

Terdapat dua batas akses yang berbeda:

### Frontend peserta

- memakai `VITE_SUPABASE_URL`
- memakai `VITE_SUPABASE_PUBLISHABLE_KEY`
- hanya menyimpan satu ringkasan sesi
- tidak menampilkan analytics atau ekspor laporan di UI peserta

### Skrip admin lokal

- memakai `SUPABASE_URL`
- memakai `SUPABASE_SERVICE_ROLE_KEY`
- berjalan di luar browser
- dapat mengambil seluruh isi tabel `feed_sessions`
- menghasilkan satu file Excel admin

`SUPABASE_SERVICE_ROLE_KEY` tidak boleh masuk ke bundle frontend, tidak boleh dipakai di browser, dan tidak boleh di-commit ke repositori.

## Kebersihan Repo

Artefak hasil generate bukan bagian dari source:

- `dist/`
- `*.tsbuildinfo`
- output Vite hasil generate
- file temp lokal seperti `tmp/`

Service worker di `public/sw.js` mendaftarkan aset PWA dasar dan sengaja tidak caching request video/range agar playback tidak rusak setelah refresh.

## Quality Gates

Repo menyediakan quality gate minimum berikut:

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run test:e2e:preview`
- `npm run verify:session-export`

Pengujian saat ini berfokus pada:

- pemilihan sumber feed dan normalisasi payload,
- validasi bentuk feed yang salah,
- alokasi durasi kategori,
- namespace storage berbasis sesi,
- retry dan idempotensi penyimpanan sesi,
- playback media video, poster, dan carousel,
- smoke flow browser untuk refresh sesi feed dan state error feed,
- stress preview build (desktop + mobile fast scroll) untuk kepemilikan playback video aktif tunggal,
- verifikasi integritas baris sesi hasil export (`total_time`, `*_ms`, `*_count`) pada session disposable desktop + mobile,
- artifact produksi dan metadata deploy.
