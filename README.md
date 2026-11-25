# Cookie Scraping Tools

Dashboard + worker untuk login otomatis ke akun, menyimpan cookie
sesi ke SQLite, dan mengekspor cookie dalam format JSON ekstensi
**Cookie-Editor** — siap di-import langsung ke browser.

## Arsitektur

- **`src/server/worker.ts`** — proses terpisah. Tiap `WORKER_TICK_SEC`, cek
  akun mana yang perlu diverifikasi/diperbarui:
  1. Kalau belum pernah login, atau sesi mendekati expired (`REFRESH_BEFORE_SEC`),
     langsung login ulang via Playwright (browser nyata → tahan terhadap form
     Next.js server actions / JS rendering).
  2. Kalau belum waktunya refresh tapi sudah lewat `CHECK_INTERVAL_SEC`, cek
     sesi masih hidup dulu (request pakai cookie yang tersimpan) sebelum
     memutuskan login ulang. Ini lebih akurat daripada hanya membaca
     `expirationDate` cookie, karena sesi bisa mati di server sebelum
     cookie-nya sendiri kedaluwarsa.
  3. Snapshot cookie baru + daftar app (scrape dashboard) disimpan ke SQLite,
     dengan kolom cookie **terenkripsi AES-256-GCM** (key dari `SECRET_KEY`).
- **`src/server/server.ts`** — Fastify: dashboard React + API (login admin,
  daftar akun & status, daftar app per akun, export `cookies.json`, log run).
- **SQLite** (`better-sqlite3`, WAL mode) — satu file `data/cookies.db`
  dipakai bersama oleh `web` dan `worker` (aman karena WAL mendukung
  banyak reader + satu writer sekaligus).
- **Frontend**: React + Vite + Tailwind v4, tema **Dens-UI** dengan palet
  kustom Mars Green `#008C8D` + Periwinkle `#53589A` + Powder `#FFF2DF`
  (lihat `web/src/styles/globals.css`).

Daftar **app dinamis**: worker meng-upsert app yang ditemukan di dashboard
portal tiap kali login; app yang tidak lagi muncul ditandai non-aktif
(histori tetap ada di SQLite), bukan dihapus.

## Setup (Linux)

```bash
# 1. Node 20+ dan Python 3 + curl_cffi
npm install
pip install -r requirements.txt   # atau: npm run setup:python

# 2. Konfigurasi
cp .env.example .env
nano .env
#   - SECRET_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   - ADMIN_PASSWORD: password untuk masuk dashboard (bukan password portal)
#   - ACCOUNT_1_EMAIL / ACCOUNT_1_PASSWORD, ACCOUNT_2_..., dst — akun yang dipakai

# 3. Build
npm run build     # compile server (tsc) + build UI (vite) -> dist/ dan web/dist/

# 4. Jalankan dengan PM2
npm i -g pm2      # kalau belum ada
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup       # ikuti instruksi agar PM2 auto-start saat reboot
```

Dashboard default di `http://<server>:3000`. Kalau diakses lewat HTTPS
(reverse proxy nginx/caddy), set `COOKIE_SECURE=true` di `.env`.

> **Panduan hosting lengkap (step-by-step + verifikasi tiap langkah,
> termasuk Nginx + HTTPS + PM2 auto-start saat reboot):** lihat
> [`docs/HOSTING.md`](docs/HOSTING.md). Ditulis supaya AI coding agent bisa
> mengerjakan deployment dari nol sampai live tanpa perlu bertanya balik,
> kecuali untuk keputusan yang memang butuh operator manusia (domain,
> kredensial akun, dsb. — lihat bagian 1 di dokumen itu).

## Kenapa login bukan lewat browser (Playwright)?

`premiumportal.id` ada di balik **Cloudflare bot-management** yang memblokir
request login (Next.js Server Action, header `next-action`) begitu
terdeteksi berasal dari Chromium yang dikendalikan otomatisasi — ini
terbukti lewat testing langsung: Playwright headless *maupun* headed
sama-sama kena 403 "Just a moment..." persis di request POST login,
walau halaman login-nya sendiri bisa termuat.

Solusinya ada di `scripts/portal_client.py`: login & cek status akun lewat
`curl_cffi` (meniru TLS/JA3 fingerprint Chrome asli) — ini lolos karena
tidak membawa "jejak" automation yang dideteksi Cloudflare. Detail
teknisnya:

- Hash header `next-action` **berubah tiap kali Next.js di-build ulang**,
  jadi tidak di-hardcode — digali otomatis dari bundle JS yang sedang live
  (dicari lewat nama fungsi `loginAction`/`getUserPackages`, bukan posisi
  tetap, supaya tetap jalan walau build berganti).
- Status akun (`premiumExpiresAt`, nama paket) diambil dari action
  `getUserPackages` di halaman dashboard, dalam **sesi/koneksi yang sama**
  dengan login — sesi baru yang langsung dipakai tanpa pemanasan (GET apa
  pun lebih dulu) ditolak 401 oleh backend walau token valid.
- `accessToken` yang didapat adalah JWT dengan `exp` ~24 jam — dipakai
  worker untuk cek-cepat tanpa login ulang; login ulang penuh hanya
  terjadi kalau pengecekan itu gagal (token kedaluwarsa/revoked).

Node tidak punya library resmi untuk impersonasi TLS seperti `curl_cffi`,
jadi Node worker memanggil `scripts/portal_client.py` sebagai subprocess
(kredensial dikirim lewat stdin, bukan argumen CLI, supaya tidak muncul
di `ps`/process list).

## Cookie per aplikasi (Netflix, Canva, ChatGPT, dst.)

Ditemukan lewat reverse-engineering ekstensi resmi "Premium Portal
Extension" (`static/background/index.js`, deobfuscated manual — lihat git
history skrip `scripts/apps_client.py` untuk detail penuh): ada backend
terpisah, **`consumer-api.premiumportal.id`**, dipakai dengan header
`Authorization: Bearer <accessToken>`:

- `GET /extensions/init/full` → katalog ~80 app beserta `items[]`-nya
  (tiap app punya banyak "slot akun" bersama, mis. Netflix punya 97 item).
- `GET /extensions/get-cookies/{itemId}` → cookie **siap pakai**, formatnya
  identik 1:1 dengan Cookie-Editor (sudah divalidasi dengan Netflix asli:
  `NetflixId`, `SecureNetflixId`, dst).

**Desain keamanan penting**: worker HANYA mensinkron katalog app+item secara
otomatis (aman, murni metadata, tidak menyentuh kuota). Pengambilan cookie
per item (`get-cookies`) **selalu manual**, dipicu tombol **"Get"** di
dashboard — tidak pernah otomatis/massal. Ini karena beberapa app (terbukti
dari teks di kode ekstensi sendiri, mis. Netflix: *"dibatasi untuk pilih 10
akun dalam 24 jam"*) punya limit harian; mengambil cookie semua item
sekaligus bisa memicu banned.

Tidak semua app pakai `targetType: "cookies"` — ada juga `"autofill"`
(isi form otomatis via kredensial, endpoint `/items/creds`), `"list"`, dan
`"link"` (cuma link langsung). Dashboard saat ini hanya mendukung export
untuk `targetType: "cookies"`; yang lain ditampilkan tapi belum ada aksinya.

Alur di dashboard: klik jumlah app pada baris akun → pilih app → pilih
item/slot → klik **Get** → klik ikon download untuk export `cookies.json`.

## Menambah / mengganti akun

Tinggal tambah baris `ACCOUNT_N_LABEL` / `ACCOUNT_N_EMAIL` /
`ACCOUNT_N_PASSWORD` di `.env`, lalu:

```bash
pm2 restart cookie-vault-worker cookie-vault-web
```

Akun yang dihapus dari `.env` otomatis dinonaktifkan di dashboard (bukan
dihapus datanya).

## Export cookie

Di dashboard, klik **Export cookie.json** pada akun yang statusnya
`Aktif`/`Expired` — file yang diunduh formatnya identik dengan hasil
**Export → JSON** di ekstensi Cookie-Editor, tinggal **Import** langsung.

## Riwayat akses

Halaman **Logs** menampilkan 10 entri terbaru per halaman, dalam tiga tab:

- **Riwayat login** — login berhasil, password salah, dan logout, lengkap
  dengan jam, IP, dan perangkat.
- **Pengambilan cookie** — Get dan unduhan cookie per IP: app, item, akun, dan
  jumlah cookie. Klik sebuah IP untuk memfilter. Nilai cookie tidak disimpan di
  log.
- **Aktivitas sistem** — login worker, cek sesi, dan sinkron katalog.

Disimpan maksimal 10.000 entri login dan 10.000 entri cookie (yang terlama
dihapus). Semua pengguna dashboard memakai satu `ADMIN_PASSWORD`, jadi orang
hanya bisa dibedakan dari IP dan perangkatnya.

IP diambil dari `X-Forwarded-For` hanya kalau request datang dari proxy
tepercaya (`TRUST_PROXY`, default `loopback` = Nginx di server yang sama). Kalau
ada proxy lain di depannya (mis. Cloudflare), atur agar Nginx meneruskan IP asli
(`real_ip_header`), atau yang tercatat adalah IP proxy tersebut.

## Keamanan

- Semua cookie di SQLite dienkripsi (AES-256-GCM) dengan `SECRET_KEY`.
- Endpoint `/api/*` (kecuali `/api/login`) butuh sesi admin (`ADMIN_PASSWORD`).
- `.env` berisi kredensial portal — jangan commit, sudah ada di `.gitignore`.
- Pastikan penggunaan scraping/login otomatis ini sesuai Ketentuan
  Layanan portal yang bersangkutan.

## Development (Windows, lokal)

```bash
npm run dev     # web + worker + ui sekaligus (butuh concurrently, sudah ter-install)
```

atau jalankan terpisah kalau mau log masing-masing:

```bash
npm run dev:web      # fastify + api, port 3000
npm run dev:ui       # vite dev server (proxy /api ke :3000), port 5173
npm run dev:worker   # worker (login via scripts/portal_client.py)
```
