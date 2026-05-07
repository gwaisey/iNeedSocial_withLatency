# iNeedSocial

iNeedSocial adalah aplikasi web React + TypeScript + Vite yang mensimulasikan feed media sosial untuk kebutuhan penelitian. Peserta melewati halaman splash, halaman sambutan, feed utama, lalu halaman terima kasih. Aplikasi melacak durasi sesi dan interaksi penelitian di belakang layar tanpa menampilkan ringkasan analitik ke peserta.

## Tumpukan Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Framework | React 19 + TypeScript 5 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v3 |
| Ikon | Lucide React |
| Build tool | Vite 6 |
| Data | Feed JSON lokal + media video Cloudflare R2 public origin + penyimpanan sesi opsional ke Supabase |

## Kebutuhan

- Node.js 18+
- npm 9+

## Instalasi

```bash
npm install
```

## Menjalankan Proyek

Mode pengembangan:

```bash
npm run dev
```

Build produksi:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Menjalankan pengujian unit dan komponen:

```bash
npm run test
```

Menjalankan smoke test browser:

```bash
npm run test:e2e
```

Menjalankan smoke test preview build (desktop + mobile fast-scroll media):

```bash
npm run test:e2e:preview
```

Pratinjau hasil build:

```bash
npm run preview
```

## Variabel Lingkungan

Salin `.env.example` menjadi `.env` untuk pengembangan lokal. Untuk deployment produksi, gunakan `.env.production.example` sebagai template variabel yang perlu diisi di platform hosting.

### Variabel frontend untuk aplikasi peserta

```bash
VITE_FEED_SOURCE=mock
VITE_VIDEO_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
VITE_VIDEO_COMPACT_PUBLIC_BASE_URL=
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`VITE_FEED_SOURCE` mendukung dua nilai:

- `mock` untuk memuat `public/content/feed.json` dan merupakan mode built-in yang aktif
- `api` untuk memanggil `/api/feed?theme=...` sebagai kontrak integrasi future-proof

Jika `VITE_FEED_SOURCE` kosong atau tidak valid, aplikasi otomatis kembali ke `mock`. Route `/api/feed` tidak disediakan di repo ini, sehingga mode `api` tetap membutuhkan backend eksternal.

`VITE_VIDEO_PUBLIC_BASE_URL` adalah asal utama video feed. Aplikasi akan memetakan path lokal `public/content/videos-default/*` menjadi URL absolut berbentuk `${VITE_VIDEO_PUBLIC_BASE_URL}/content/videos-default/*`.
Gunakan URL origin public R2 (misalnya `https://pub-xxxxxxxx.r2.dev`) agar browser bisa melakukan range request (`206 Partial Content`) untuk autoplay yang lebih cepat.

Untuk browser mobile, koneksi lambat, atau mode hemat data, aplikasi memilih varian ringkas `public/content/videos/*`. Jika `VITE_VIDEO_COMPACT_PUBLIC_BASE_URL` diisi, varian ringkas dipetakan ke origin tersebut; jika kosong, varian ringkas memakai origin utama `VITE_VIDEO_PUBLIC_BASE_URL`.

Jika `VITE_VIDEO_PUBLIC_BASE_URL` tidak diisi, build produksi akan memakai origin public R2 default yang tertanam di kode, sedangkan mode pengembangan lokal tetap menggunakan path lokal `public/content/videos-default/*`.

Jika variabel Supabase frontend belum diisi atau tidak valid, aplikasi tetap bisa berjalan. Status penyimpanan sesi akan tetap ditampilkan secara non-blocking di halaman terima kasih.

### Variabel privat untuk ekspor admin / server

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai oleh skrip admin lokal atau proses server-side. Jangan pernah mengekspos nilai ini ke browser, menyimpannya di kode frontend, atau meng-commit-nya ke git.

Jika nilai key produksi pernah terekspos di luar pengaturan rahasia hosting, rotasi key harus dilakukan langsung di Supabase/Vercel. Repo ini hanya menyediakan template variabel, bukan mekanisme rotasi key.

## Alur Studi

```text
/ -> /splash -> /welcome -> /feed?theme=light -> /thank-you
```

| Layar | URL | Fungsi |
| --- | --- | --- |
| Splash | `/splash` | Layar pembuka yang mengarahkan ke halaman sambutan |
| Sambutan | `/welcome` | Titik masuk sebelum peserta melihat feed |
| Feed | `/feed` | Pengalaman studi utama dalam tema terang atau gelap |
| Terima kasih | `/thank-you` | Layar penutup setelah sesi selesai |

`/timer` tetap tersedia sebagai redirect kompatibilitas ke `/feed`, tetapi bukan halaman studi mandiri.

## Data Feed

Konten feed dibaca dari:

```text
public/content/feed.json
```

Tipe post yang didukung:

- `image`
- `carousel`
- `video`

Setiap post dinormalisasi ke salah satu kategori penelitian berikut:

- `humor`
- `berita`
- `wisata`
- `makanan`
- `olahraga`
- `game`

Aliran post yang sama digunakan untuk mode terang dan gelap. Konten stimulus penelitian di `public/content/feed.json` dipertahankan apa adanya.

## Perilaku Interaksi Peserta

- Status suka dan repost sekarang disimpan di `sessionStorage`, bukan `localStorage`.
- Refresh pada tab yang sama tetap mempertahankan interaksi, progres tutorial, dan snapshot timer selama sesi studi yang sama.
- Memulai sesi baru dari halaman sambutan akan membuat namespace sesi baru dan menghapus interaksi sesi sebelumnya.
- Reload halaman tidak menghitung jeda refresh sebagai waktu melihat feed, tetapi melanjutkan timer dari snapshot sesi aktif setelah feed kembali tampil.

## Penyimpanan Sesi dan Ekspor

- Aplikasi peserta menyimpan satu ringkasan sesi ke Supabase untuk setiap sesi studi.
- Browser peserta hanya menjalankan perilaku yang aman untuk peserta.
- Ketika sesi diakhiri, peserta langsung diarahkan ke halaman terima kasih.
- Halaman terima kasih menampilkan status penyimpanan sesi dan kode sesi hanya jika penyimpanan berhasil.
- Jika penyimpanan gagal, halaman terima kasih menyediakan tombol retry tanpa mengembalikan peserta ke feed.
- Ekspor seluruh sesi tidak tersedia di UI peserta.
- Penyimpanan sesi peserta memakai publishable key frontend dengan akses database yang dibatasi oleh RLS insert-only pada tabel `feed_sessions`.
- Retry penyimpanan tetap aman secara idempoten berdasarkan `session_id`, sehingga retry setelah save yang sempat berhasil tidak menambah baris duplikat jika migrasi database sudah diterapkan.

### Ekspor semua sesi untuk admin

Gunakan skrip admin lokal berikut:

```bash
npm run export:all-sessions
```

Skrip ini:

- membaca `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`,
- mengambil semua baris dari tabel `feed_sessions`,
- membuat file Excel bernama `Laporan_Semua_Sesi_YYYY-MM-DD.xlsx`,
- menggunakan sheet bernama `Semua Sesi`.

Skrip admin ini berjalan di luar aplikasi peserta dan tidak menggunakan publishable key frontend.

## Struktur Proyek

```text
src/
  components/
  context/
  pages/
  services/
  types/
  App.tsx
  main.tsx
public/
  content/
  icons/
  manifest.json
  sw.js
scripts/
  export-all-sessions.mjs
  verify-session-export.mjs
```

Media video saat ini dipetakan dari `public/content/videos-default/*` ke Cloudflare R2 public origin melalui `VITE_VIDEO_PUBLIC_BASE_URL`, atau ke origin public R2 default yang tertanam di build produksi bila env ini kosong.

## Catatan

- Saat feed dimuat, aplikasi menampilkan skeleton.
- Jika pemuatan feed gagal, aplikasi menampilkan state retry di dalam halaman.
- Payload feed divalidasi secara runtime sebelum dinormalisasi. Jika format feed tidak valid, UI menampilkan pesan aman yang terlokalisasi dan detail error teknis dicatat melalui reporter runtime internal.
- Waktu feed dialokasikan terus-menerus ke post dominan yang terlihat, sehingga timer utama selaras dengan total kategori.
- Video hanya autoplay saat terlihat, dan video di carousel hanya autoplay pada slide aktif.
- Error runtime yang aman untuk pengguna tetap ditampilkan secara lokal, sementara reporter runtime internal meneruskan detail teknis ke `console.warn` / `console.error` dan event browser `ineedsocial:monitoring` untuk integrasi monitoring berikutnya.
- Output build di `dist/`, file `.env`, log lokal Vite, `*.tsbuildinfo`, dan output config hasil generate tidak boleh dilacak di git.
- Jika file-file terabaikan tersebut pernah ter-commit, bersihkan index git saat ini dan rewrite history repo agar artefak serta secret lama benar-benar terhapus.
- Terapkan migrasi `supabase/migrations/202604130900_feed_sessions_session_id_unique.sql` agar tabel `feed_sessions` memiliki constraint unik pada `session_id` dan duplikasi lama dibersihkan sebelum save client insert-only dijalankan penuh.
- Terapkan migrasi `supabase/migrations/202604200900_feed_sessions_rls.sql` setelah constraint unik sudah aktif agar akses client ke `feed_sessions` dibatasi menjadi insert-only dan pembacaan anonim tidak lagi terbuka.

## Smoke Check Setelah Deploy

Setelah deploy ke production:

1. Buka aplikasi dan mulai satu sesi studi baru.
2. Lewati tutorial bila muncul, lalu interaksikan feed beberapa detik.
3. Ubah tema sekali untuk memastikan feed tetap pulih dengan benar.
4. Buka satu post video, unmute lalu mute lagi untuk memastikan kontrol audio tetap sinkron.
5. Akhiri sesi sampai ke halaman terima kasih.
6. Pastikan status save menampilkan kondisi sukses atau retry yang jelas.
7. Verifikasi satu baris baru masuk ke `feed_sessions`.
8. Verifikasi client anonim tidak bisa melakukan `SELECT`, `UPDATE`, atau `DELETE` ke `feed_sessions` setelah migrasi RLS diterapkan.

## Checklist Siap Produksi (Release Gate)

Jalankan urutan berikut untuk signoff:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:e2e:preview
npm run verify:session-export
```

`verify:session-export` akan:

- menjalankan dua sesi disposable nyata lewat browser preview (desktop + mobile),
- submit sesi ke backend yang aktif,
- mengekspor workbook sesi,
- memverifikasi integritas baris `session_id` tersebut.

Kriteria lulus:

- semua perintah di atas sukses tanpa error,
- `test:e2e:preview` tidak menemukan console `error`,
- untuk sesi disposable desktop dan mobile, hanya satu video aktif yang memegang playback pada saat scroll cepat,
- output `VERIFY_SESSION_EXPORT_RESULT` bernilai `"passed": true`,
- `total_time` sama dengan jumlah semua `*_ms`,
- semua `*_count` bernilai non-negatif,
- `*_count` di workbook sama dengan snapshot kategori akhir di aplikasi.

Aturan interpretasi kegagalan:

- Kegagalan yang konsisten (reproducible) pada command di atas adalah **blocking** untuk deploy.
- Kegagalan acak satu kali boleh diulang satu kali; jika ulangannya bersih, lanjutkan.
- Jika pola flaky berulang pada area media/scroll/session-save, anggap **blocking** sampai sumbernya ditemukan.

Stop condition (siap deploy): semua gate lulus pada satu pass penuh tanpa defect blocking terbuka.
