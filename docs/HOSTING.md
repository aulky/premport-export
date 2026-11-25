# Panduan Hosting Cookie Scraping Tools (untuk AI agent / operator)

Dokumen ini adalah **runbook lengkap, langkah-demi-langkah**, ditulis supaya AI
coding agent (Claude Code, dsb.) atau operator manusia bisa men-deploy Cookie
Scraping Tools dari nol di VPS Linux sampai bisa diakses publik lewat HTTPS, **tanpa
perlu bertanya balik** kecuali ada keputusan yang memang hanya bisa diambil
manusia (lihat bagian "Keputusan yang butuh manusia" di bawah).

Ikuti berurutan. Tiap langkah punya perintah persis + cara verifikasi
("Cek:") sebelum lanjut ke langkah berikutnya. Jangan skip langkah verifikasi
— kalau gagal, perbaiki dulu sebelum lanjut.

## 0. Asumsi & target

- Target: **Ubuntu 22.04/24.04 LTS** atau **Debian 12** di VPS (DigitalOcean,
  Vultr, dll). Perintah di bawah pakai `apt`; sesuaikan kalau distro lain.
- Akses: SSH sebagai user dengan hak `sudo` (bukan harus root langsung).
- Domain (opsional tapi disarankan untuk HTTPS): `A record` domain/subdomain
  sudah diarahkan ke IP VPS sebelum mulai bagian Nginx/TLS.
- Repo project ini sudah di-push ke Git remote yang bisa diakses dari VPS
  (GitHub/GitLab/dst.), ATAU disalin manual via `scp`/`rsync`.

## 1. Keputusan yang butuh manusia (jangan diasumsikan oleh AI)

Berhenti dan tanya operator untuk hal-hal berikut sebelum lanjut — ini bukan
keputusan teknis yang aman ditebak:

1. **Domain/subdomain** yang dipakai (untuk Nginx `server_name` & sertifikat TLS).
2. **Kredensial akun** (`ACCOUNT_N_EMAIL`/`PASSWORD`) — ini
   kredensial asli milik operator, jangan pernah di-generate atau ditebak.
3. **`ADMIN_PASSWORD`** dashboard — boleh digenerate AI, tapi **sampaikan
   nilainya ke operator** (jangan hanya disimpan di server tanpa dicatat).
4. Apakah firewall provider (security group cloud) sudah mengizinkan port
   80/443 masuk — beberapa provider block by default di level network, bukan
   cuma `ufw`.

Semua langkah teknis lain di bawah ini aman dikerjakan otomatis.

## 2. Provisioning server dasar

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ca-certificates gnupg
```

**Cek:** `lsb_release -a` menunjukkan versi distro yang didukung.

### 2.1 Firewall dasar (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

**Cek:** output `ufw status` menunjukkan `22`, `80`, `443` berstatus `ALLOW`.
**Jangan** buka port `3000` ke publik — nanti diakses lewat Nginx reverse
proxy di 80/443 saja (lihat bagian 7).

## 3. Install Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Cek:** `node -v` → harus `v20.x` atau lebih baru. `npm -v` juga harus ada.

## 4. Install Python 3 + curl_cffi

Worker login ke `premiumportal.id` **wajib** lewat `curl_cffi` (impersonasi
TLS Chrome), bukan browser/Playwright — portal ini di balik Cloudflare
bot-management yang memblokir request dari Chromium otomatisasi (headless
maupun headed). Detail riset ada di `README.md` bagian "Kenapa login bukan
lewat browser".

```bash
sudo apt install -y python3 python3-pip python3-venv
```

**Cek:** `python3 --version` → 3.10+.

`curl_cffi` akan diinstal lewat `requirements.txt` project di langkah 6, bukan
global di sini.

## 5. Buat user khusus & ambil kode (opsional tapi disarankan)

Jangan jalankan aplikasi sebagai `root`. Kalau belum ada user non-root dengan
akses project:

```bash
sudo adduser --disabled-password --gecos "" cookievault
sudo su - cookievault
```

Dari sini (sebagai user `cookievault`), clone repo:

```bash
git clone <URL_REPO_GIT_ANDA> ~/cookie-vault
cd ~/cookie-vault
```

Kalau tidak pakai Git (copy manual), pastikan seluruh isi folder project
(kecuali `node_modules`, `dist`, `web/dist`, `.env`, `data/`) disalin ke
`~/cookie-vault` di server, lalu `cd` ke sana.

**Cek:** `ls` menunjukkan `package.json`, `src/`, `web/`, `scripts/`.

## 6. Install dependencies project

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Cek:** `python3 -c "import curl_cffi; print(curl_cffi.__version__)"` tidak error.

> Catatan: kalau pakai virtualenv (`.venv`) seperti di atas, set
> `PYTHON_BIN=/home/cookievault/cookie-vault/.venv/bin/python3` di `.env`
> (langkah 7) supaya worker Node memanggil Python yang benar (bukan
> `python3` sistem yang mungkin tidak punya `curl_cffi`).

## 7. Konfigurasi `.env`

```bash
cp .env.example .env
```

Generate dua nilai rahasia:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # -> SECRET_KEY
node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"  # -> ADMIN_PASSWORD (atau minta operator)
```

Edit `.env` (`nano .env` atau lewat tool edit file) dan isi minimal:

```ini
PORT=3000
HOST=127.0.0.1          # bind ke localhost saja; publik lewat Nginx (bagian 9)
DB_PATH=./data/cookies.db
SECRET_KEY=<hasil generate di atas>
ADMIN_PASSWORD=<hasil generate / dari operator>
SESSION_TTL_SEC=43200
COOKIE_SECURE=true      # WAJIB true kalau diakses lewat HTTPS (lihat bagian 9)
WORKER_TICK_SEC=15
CHECK_INTERVAL_SEC=300
REFRESH_BEFORE_SEC=600
KEEP_SNAPSHOTS=5
MAX_FAIL_BEFORE_BACKOFF=3
PYTHON_BIN=/home/cookievault/cookie-vault/.venv/bin/python3

ACCOUNT_1_LABEL=Akun 1
ACCOUNT_1_EMAIL=<dari operator>
ACCOUNT_1_PASSWORD=<dari operator>
ACCOUNT_2_LABEL=Akun 2
ACCOUNT_2_EMAIL=<dari operator, opsional>
ACCOUNT_2_PASSWORD=<dari operator, opsional>
```

**PENTING keamanan:** `HOST=127.0.0.1` (bukan `0.0.0.0`) supaya port 3000
hanya bisa diakses dari server itu sendiri — akses publik lewat Nginx di
bagian 9. Kalau tidak pakai Nginx/TLS sama sekali (tidak disarankan), minimal
`COOKIE_SECURE=false` dan buka port 3000 lewat ufw secara eksplisit.

**Cek:** `cat .env` tidak ada baris kosong di nilai wajib (`SECRET_KEY`,
`ADMIN_PASSWORD`, minimal satu `ACCOUNT_1_EMAIL`/`PASSWORD`).

## 8. Build & tes jalan manual (sebelum PM2)

```bash
npm run build
node dist/server/server.js &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
kill %1
```

**Cek:** output curl `200`. Kalau bukan 200, baca log yang tercetak sebelum
lanjut — jangan lanjut ke PM2 dengan server yang belum terbukti jalan.

Tes worker juga (akan jalan terus sampai di-Ctrl+C, biarkan ~20 detik lalu stop):

```bash
timeout 20 node dist/server/worker.js
```

**Cek:** muncul baris log `[worker] start. akun aktif: N, tick=15s` dan
(kalau kredensial benar) `[worker] OK <label>: N cookies disimpan`. Kalau
muncul `GAGAL ... login gagal`, cek kembali `ACCOUNT_N_EMAIL/PASSWORD` di
`.env` — ini paling sering akar masalahnya, bukan bug kode.

## 9. Jalankan permanen dengan PM2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Supaya PM2 (dan karenanya worker + web) **otomatis menyala lagi setelah
reboot server** — ini menjawab kebutuhan "worker selalu nyala":

```bash
pm2 startup systemd -u cookievault --hp /home/cookievault
```

Perintah di atas akan mencetak **satu baris perintah `sudo env ...`** —
copy-paste dan jalankan baris itu persis (beda tiap server, tidak bisa
ditebak/di-hardcode). Setelah itu:

```bash
pm2 save
```

**Cek, wajib semua lolos sebelum lanjut:**

```bash
pm2 status
# cookie-vault-web    harus "online"
# cookie-vault-worker harus "online"

pm2 logs cookie-vault-worker --lines 30 --nostream
# harus ada "[worker] start. akun aktif: N" tanpa error login terus-menerus

sudo reboot
# tunggu ~1 menit, SSH lagi, lalu:
pm2 status
# keduanya harus "online" lagi TANPA perlu `pm2 start` manual
```

Kalau setelah reboot `pm2 status` kosong/kedua app tidak ada: `pm2 startup`
tidak berhasil ter-install sebagai service. Jalankan ulang
`pm2 startup systemd ...` dan pastikan baris `sudo env ...` yang dicetak
benar-benar dijalankan (bukan cuma dibaca).

### 9.1 Auto-restart kalau crash (sudah default, verifikasi saja)

`ecosystem.config.cjs` sudah punya `autorestart: true` dan `max_restarts`
untuk kedua proses — PM2 otomatis me-restart kalau proses crash. Verifikasi:

```bash
pm2 id cookie-vault-worker          # catat PID via: pm2 show cookie-vault-worker
kill -9 <PID_WORKER>
sleep 3
pm2 status                          # cookie-vault-worker harus balik "online" sendiri
```

### 9.2 Log rotation (supaya disk tidak penuh)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

## 10. Reverse proxy Nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Buat file `/etc/nginx/sites-available/cookie-vault`:

```nginx
server {
    listen 80;
    server_name DOMAIN_ANDA.COM;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Ganti `DOMAIN_ANDA.COM` dengan domain dari operator (bagian 1).

```bash
sudo ln -s /etc/nginx/sites-available/cookie-vault /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Cek:** `sudo nginx -t` → `syntax is ok` dan `test is successful`. Lalu
`curl -s -o /dev/null -w "%{http_code}\n" http://DOMAIN_ANDA.COM/` → `200`.

Pasang TLS (certbot akan otomatis edit config Nginx untuk redirect ke HTTPS):

```bash
sudo certbot --nginx -d DOMAIN_ANDA.COM
```

Ikuti prompt (email untuk notifikasi expiry, setuju ToS). Certbot otomatis
pasang cron/systemd timer untuk renew — verifikasi:

```bash
sudo certbot renew --dry-run
```

**Cek:** `https://DOMAIN_ANDA.COM/` terbuka tanpa warning sertifikat, dan
halaman login Cookie Scraping Tools muncul (bukan 502/504 — kalau 502, cek `pm2 logs
cookie-vault-web` dan pastikan `HOST=127.0.0.1` & `PORT=3000` di `.env` cocok
dengan `proxy_pass` di Nginx).

Setelah HTTPS aktif, pastikan `.env` punya `COOKIE_SECURE=true` lalu:

```bash
pm2 restart cookie-vault-web
```

## 11. Verifikasi akhir end-to-end

1. Buka `https://DOMAIN_ANDA.COM/` → halaman login muncul.
2. Login pakai `ADMIN_PASSWORD` dari `.env` → masuk ke Dashboard.
3. Tunggu sampai kolom **Status** akun jadi `Aktif` (worker butuh beberapa
   tick pertama untuk login — lihat `pm2 logs cookie-vault-worker`).
4. Klik akun → buka 1 app (`targetType: cookies`) → klik **Get** pada 1 item
   → pastikan muncul jumlah cookie & tombol download aktif.
5. Download cookie, buka halaman **Tutorial** di sidebar untuk langkah
   import ke ekstensi Cookie-Editor.
6. Cek halaman **Logs** → harus ada entri `login`, `check`, `apps-sync`.

Kalau semua lolos, deployment selesai.

## 12. Update / redeploy (setelah ada perubahan kode)

```bash
cd ~/cookie-vault
git pull
npm install                 # kalau ada dependency baru
source .venv/bin/activate && pip install -r requirements.txt   # kalau requirements.txt berubah
npm run build
pm2 restart cookie-vault-web cookie-vault-worker
```

**Cek:** `pm2 status` kedua proses `online`, lalu buka dashboard di browser
dan pastikan tidak ada halaman putih kosong (lihat Troubleshooting #3 kalau
terjadi).

## 13. Menambah/mengganti akun

Edit `.env`, tambah/ubah baris `ACCOUNT_N_LABEL/EMAIL/PASSWORD`, lalu:

```bash
pm2 restart cookie-vault-worker cookie-vault-web
```

Akun pertama (`ACCOUNT_1_...`) otomatis jadi **Primary** di dashboard — tetap
dicoba login terus-menerus walau akun lain gagal.

## 14. Troubleshooting

**1. Worker terus-menerus `login gagal`**
Hampir selalu kredensial salah/kadaluarsa di `.env`, atau IP VPS
diblokir/rate-limited oleh Cloudflare (coba dari IP lain untuk pastikan).
Bukan bug kode kalau pesan errornya jelas "email/password salah".

**2. `pm2 logs cookie-vault-worker` menunjukkan "Gagal menjalankan Python"**
`PYTHON_BIN` di `.env` salah path, atau `curl_cffi` belum terinstal di
venv itu. Jalankan ulang langkah 6, lalu `pm2 restart cookie-vault-worker`.

**3. Dashboard blank putih total setelah redeploy**
Pernah terjadi: `@fastify/static` kalau didaftarkan dengan opsi
`wildcard:false` hanya mendaftarkan rute file statis **sekali saat startup**
— build baru dengan nama file ter-hash baru jadi tidak kebaca sampai proses
di-restart. Project ini sudah diperbaiki (`wildcard` dibiarkan default
`true`, melayani per-request), tapi kalau regresi: pastikan
`src/server/server.ts` TIDAK mengandung `wildcard: false`, lalu
`pm2 restart cookie-vault-web`.

**4. 502 Bad Gateway dari Nginx**
`cookie-vault-web` tidak jalan di port yang diharapkan Nginx. Cek
`pm2 status` (`online`?), `pm2 logs cookie-vault-web`, dan cocokkan
`PORT`/`HOST` di `.env` dengan `proxy_pass` di config Nginx.

**5. Ada beberapa proses worker duplikat (dari testing manual sebelumnya)**
Jangan jalankan `node dist/server/worker.js` manual di tengah PM2 sudah
mengelolanya — bisa balapan login ke akun yang sama dan memicu
403/kicked-session di portal. Selalu kelola lewat `pm2 start/restart/stop`,
jangan campur dengan proses manual yang dibiarkan hidup di background.

**6. Request `POST` ke API balas `400 Bad Request` padahal body kosong**
Fastify menolak header `Content-Type: application/json` tanpa body. Semua
endpoint POST tanpa payload di frontend (`refresh`, `fetch` cookie, dst.)
sudah mengirim `body: "{}"` secara eksplisit — kalau menambah endpoint baru
yang dipanggil tanpa body dari `web/src/lib/api.ts`, ikuti pola yang sama.

## 15. Checklist keamanan sebelum go-live

- [ ] `.env` tidak pernah di-commit ke Git (`.gitignore` sudah mengecualikannya).
- [ ] `HOST=127.0.0.1` di `.env` (port 3000 tidak terbuka ke publik langsung).
- [ ] `COOKIE_SECURE=true` setelah HTTPS aktif.
- [ ] `ADMIN_PASSWORD` kuat (bukan default/tebakan) dan sudah disampaikan ke operator.
- [ ] `ufw status` hanya mengizinkan 22/80/443.
- [ ] `pm2 startup` sudah diverifikasi lewat `sudo reboot` (bagian 9).
- [ ] Backup `data/cookies.db` terjadwal (opsional tapi disarankan — file ini
      berisi semua cookie terenkripsi; backup teratur, mis. `cron` + `rsync`
      ke storage lain, sebelum maintenance besar).
