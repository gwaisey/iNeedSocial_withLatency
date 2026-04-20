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
| Data | Feed JSON lokal + penyimpanan sesi opsional ke Supabase |

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

Pratinjau hasil build:

```bash
npm run preview
```

## Variabel Lingkungan

Salin `.env.example` menjadi `.env`, lalu isi sesuai kebutuhan.

### Variabel frontend untuk aplikasi peserta

```bash
VITE_FEED_SOURCE=mock
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`VITE_FEED_SOURCE` mendukung dua nilai:

- `mock` untuk memuat `public/content/feed.json` dan merupakan mode built-in yang aktif
- `api` untuk memanggil `/api/feed?theme=...` sebagai kontrak integrasi future-proof

Jika `VITE_FEED_SOURCE` kosong atau tidak valid, aplikasi otomatis kembali ke `mock`. Route `/api/feed` tidak disediakan di repo ini, sehingga mode `api` tetap membutuhkan backend eksternal.

Jika dua variabel frontend di atas belum diisi atau tidak valid, aplikasi tetap bisa berjalan. Status penyimpanan sesi akan tetap ditampilkan secara non-blocking di halaman terima kasih.

### Variabel privat untuk ekspor admin

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai oleh skrip admin lokal. Jangan pernah mengekspos nilai ini ke browser, menyimpannya di kode frontend, atau meng-commit-nya ke git.

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
- Penyimpanan sesi peserta sekarang bersifat idempoten berdasarkan `session_id`, sehingga refresh atau retry tidak membuat baris duplikat jika migrasi database sudah diterapkan.

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
```

## Catatan

- Saat feed dimuat, aplikasi menampilkan skeleton.
- Jika pemuatan feed gagal, aplikasi menampilkan state retry di dalam halaman.
- Payload feed divalidasi secara runtime sebelum dinormalisasi. Jika format feed tidak valid, UI menampilkan pesan aman yang terlokalisasi dan detail error mentah dicatat ke `console.error`.
- Waktu feed dialokasikan terus-menerus ke post dominan yang terlihat, sehingga timer utama selaras dengan total kategori.
- Video hanya autoplay saat terlihat, dan video di carousel hanya autoplay pada slide aktif.
- Error runtime yang aman untuk pengguna tetap ditampilkan secara lokal, sementara error mentah dicatat ke `console.error` untuk debugging.
- Output build di `dist/`, file `.env`, log lokal Vite, `*.tsbuildinfo`, dan output config hasil generate tidak boleh dilacak di git.
- Jika file-file terabaikan tersebut pernah ter-commit, bersihkan index git saat ini dan rewrite history repo agar artefak serta secret lama benar-benar terhapus.
- Terapkan migrasi `supabase/migrations/202604130900_feed_sessions_session_id_unique.sql` agar tabel `feed_sessions` memiliki constraint unik pada `session_id` dan duplikasi lama dibersihkan sebelum upsert client dijalankan penuh.
