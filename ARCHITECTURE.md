# Arsitektur - iNeedSocial

## Gambaran Umum

iNeedSocial adalah aplikasi React single-page untuk studi penelitian berbasis feed. Alur peserta dibuat sesederhana mungkin:

```text
/splash -> /welcome -> /feed -> /thank-you
```

Aplikasi ini bersifat mock-first. Konten feed berasal dari `public/content/feed.json`, sedangkan ringkasan sesi dapat disimpan ke Supabase secara opsional. Client browser hanya menangani penulisan yang aman untuk peserta dan status akhir sesi di halaman terima kasih.

## Struktur Runtime

```text
Browser
  -> React SPA
     -> React Router
     -> StudyProvider
     -> Feed service
     -> Supabase session service

Lokal admin
  -> Skrip ekspor semua sesi
     -> Supabase service-role client
     -> File Excel .xlsx
```

File utama:

- `src/App.tsx` mendefinisikan route dan mempertahankan `/timer` sebagai redirect ke `/feed`.
- `src/pages/feed-page.tsx` mengorkestrasi layout feed, status loading, tutorial, dan pemulihan posisi scroll saat ganti tema.
- `src/hooks/use-feed-session.ts` menangani atribusi waktu per post, pemulihan snapshot sesi setelah refresh, finalisasi sesi, serta penyimpanan status sesi peserta.
- `src/services/feed-service.ts` memilih sumber data feed berdasarkan env, memvalidasi payload feed, lalu menormalisasi data feed.
- `src/services/supabase.ts` memvalidasi konfigurasi Supabase frontend dan menyimpan satu ringkasan sesi secara idempoten berdasarkan `session_id`.
- `scripts/export-all-sessions.mjs` adalah jalur ekspor admin lokal untuk seluruh data sesi menggunakan service-role key privat.
- `src/context/study-context.tsx` menyimpan state komentar, suka, repost, dan session id aktif dengan namespace berbasis sesi studi.
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

### Video

- Visibilitas dipantau dengan `IntersectionObserver`.
- Video berhenti saat keluar dari area terlihat.
- Video carousel hanya autoplay pada slide aktif.
- Status mute diterapkan lewat effect, bukan callback ref.

## Penanganan Error

Pemuatan feed eksplisit:

- tampilkan skeleton saat loading,
- tampilkan state retry inline jika pemuatan gagal,
- retry tanpa memuat ulang seluruh aplikasi,
- log error mentah ke `console.error` sambil tetap menampilkan pesan fallback yang aman untuk peserta.

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

Konfigurasi Vite TypeScript di `vite.config.ts` tetap menjadi sumber kebenaran tunggal.

## Quality Gates

Repo menyediakan quality gate minimum berikut:

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

Pengujian saat ini berfokus pada:

- pemilihan sumber feed dan normalisasi payload,
- validasi bentuk feed yang salah,
- alokasi pembulatan durasi kategori,
- namespace storage berbasis sesi,
- retry dan idempotensi penyimpanan sesi,
- smoke flow browser untuk refresh sesi feed dan state error feed.
