# Cookie Scraping Tools Hosting Guide (for AI agents / operators)

This is a **complete, step-by-step runbook**, written so that an AI coding agent
(Claude Code and similar) or a human operator can deploy Cookie Scraping Tools
from scratch on a Linux VPS until it is publicly reachable over HTTPS, **without
asking questions**, except for decisions only a human can make (see "Decisions
that need a human" below).

Follow the steps in order. Each step has the exact commands and a way to verify
it ("Check:") before moving on. Don't skip a check; if it fails, fix it first.

## 0. Assumptions and target

- Target: **Ubuntu 22.04/24.04 LTS** or **Debian 12** on a VPS (DigitalOcean,
  Vultr, etc.). Commands use `apt`; adapt them for other distributions.
- Access: SSH as a user with `sudo` rights (not necessarily root).
- Domain (optional but recommended for HTTPS): the domain/subdomain `A record`
  already points to the VPS IP before you start the Nginx/TLS section.
- The repository is on a Git remote the VPS can reach (GitHub, GitLab, etc.), OR
  you copy it manually with `scp`/`rsync`.

## 1. Decisions that need a human (an AI must not assume these)

Stop and ask the operator about the following. They are not safe to guess:

1. The **domain/subdomain** to use (for Nginx `server_name` and the TLS certificate).
2. The **account credentials** (`ACCOUNT_N_EMAIL`/`PASSWORD`). These are the
   operator's real credentials; never generate or guess them.
3. The dashboard **`ADMIN_PASSWORD`**. An AI may generate it, but must **give the
   value to the operator** (don't leave it only on the server).
4. Whether the provider's firewall (cloud security group) allows inbound ports
   80/443. Some providers block them at network level, not just in `ufw`.

Every other technical step below is safe to run automatically.

## 2. Basic server provisioning

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ca-certificates gnupg
```

**Check:** `lsb_release -a` shows a supported distribution version.

### 2.1 Basic firewall (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

**Check:** `ufw status` shows `22`, `80`, and `443` as `ALLOW`. **Don't** open
port `3000` to the public; it is reached through the Nginx reverse proxy on
80/443 only (see section 10).

## 3. Install Node.js 22+

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Check:** `node -v` shows `v22.x` or newer, and `npm -v` works.

## 4. Install Python 3 and curl_cffi

The worker **must** sign in to `premiumportal.id` through `curl_cffi` (Chrome TLS
impersonation), not a browser or Playwright: the site is behind Cloudflare bot
management, which blocks requests from automated Chromium (headless or headed).
See "Why sign-in does not use a browser" in `README.md`.

```bash
sudo apt install -y python3 python3-pip python3-venv
```

**Check:** `python3 --version` shows 3.10 or newer.

`curl_cffi` is installed from the project's `requirements.txt` in step 6, not
globally here.

## 5. Create a dedicated user and get the code (optional but recommended)

Don't run the application as `root`. If there is no non-root user for the project
yet:

```bash
sudo adduser --disabled-password --gecos "" cookievault
sudo su - cookievault
```

From here (as `cookievault`), clone the repository:

```bash
git clone <YOUR_GIT_REPO_URL> ~/cookie-vault
cd ~/cookie-vault
```

Without Git, copy the whole project folder (except `node_modules`, `dist`,
`web/dist`, `.env`, `data/`) to `~/cookie-vault` on the server, then `cd` into it.

**Check:** `ls` shows `package.json`, `src/`, `web/`, `scripts/`.

## 6. Install project dependencies

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Check:** `python3 -c "import curl_cffi; print(curl_cffi.__version__)"` runs
without errors.

> With a virtualenv (`.venv`) as above, set
> `PYTHON_BIN=/home/cookievault/cookie-vault/.venv/bin/python3` in `.env` (step 7)
> so the Node processes call the right Python, not the system `python3`, which may
> not have `curl_cffi`.

## 7. Configure `.env`

```bash
cp .env.example .env
```

Generate two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # -> SECRET_KEY
node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"  # -> ADMIN_PASSWORD (or ask the operator)
```

Edit `.env` (`nano .env` or a file editing tool) and set at least:

```ini
PORT=3000
HOST=127.0.0.1          # bind to localhost only; public access goes through Nginx (section 10)
DB_PATH=./data/cookies.db
SECRET_KEY=<generated above>
ADMIN_PASSWORD=<generated / from the operator>
SESSION_TTL_SEC=43200
COOKIE_SECURE=true      # MUST be true when served over HTTPS (section 10)
PUBLIC_URL=https://YOUR_DOMAIN.COM   # for link previews, canonical URLs, sitemap
WORKER_TICK_SEC=15
CHECK_INTERVAL_SEC=300
REFRESH_BEFORE_SEC=600
KEEP_SNAPSHOTS=5
MAX_FAIL_BEFORE_BACKOFF=3
PYTHON_BIN=/home/cookievault/cookie-vault/.venv/bin/python3

ACCOUNT_1_LABEL=Account 1
ACCOUNT_1_EMAIL=<from the operator>
ACCOUNT_1_PASSWORD=<from the operator>
ACCOUNT_2_LABEL=Account 2
ACCOUNT_2_EMAIL=<from the operator, optional>
ACCOUNT_2_PASSWORD=<from the operator, optional>
```

Passwords may contain `#`, `!`, `$` and similar characters. Don't put a comment
after a password on the same line.

**Security:** use `HOST=127.0.0.1` (not `0.0.0.0`) so port 3000 is only reachable
from the server itself; public access goes through Nginx (section 10). Without
Nginx/TLS (not recommended), at least set `COOKIE_SECURE=false` and open port 3000
in `ufw` explicitly.

**Check:** `cat .env` shows no empty required values (`SECRET_KEY`,
`ADMIN_PASSWORD`, and at least one `ACCOUNT_1_EMAIL`/`PASSWORD`).

## 8. Build and test manually (before PM2)

```bash
npm run build
node dist/server/server.js &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
kill %1
```

**Check:** curl prints `200`. If not, read the printed log before continuing;
don't move on to PM2 with a server that hasn't been shown to work.

Test the worker too (it runs until stopped; let it run about 20 seconds):

```bash
timeout 20 node dist/server/worker.js
```

**Check:** you see `[worker] start. active accounts: N, tick=15s` and (with
correct credentials) `[worker] OK <label>: N cookies saved`. If you see
`FAILED ... `, check `ACCOUNT_N_EMAIL/PASSWORD` in `.env` first; that is the most
common cause, not a code bug.

## 9. Run permanently with PM2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

So that PM2 (and therefore the worker and web app) **starts again after a server
reboot**:

```bash
pm2 startup systemd -u cookievault --hp /home/cookievault
```

This prints **one `sudo env ...` command**. Copy and run exactly that line (it
differs per server and cannot be guessed). Then:

```bash
pm2 save
```

**Check — all of these must pass before continuing:**

```bash
pm2 status
# cookie-vault-web    must be "online"
# cookie-vault-worker must be "online"

pm2 logs cookie-vault-worker --lines 30 --nostream
# shows "[worker] start. active accounts: N" without repeated sign-in errors

sudo reboot
# wait about 1 minute, SSH in again, then:
pm2 status
# both must be "online" again WITHOUT running `pm2 start` manually
```

If `pm2 status` is empty after the reboot, `pm2 startup` was not installed as a
service. Run `pm2 startup systemd ...` again and make sure the printed `sudo env
...` line is actually executed.

### 9.1 Auto-restart after a crash (default, just verify)

`ecosystem.config.cjs` already sets `autorestart: true` and `max_restarts` for
both processes, so PM2 restarts a crashed process. Verify:

```bash
pm2 show cookie-vault-worker        # note the PID
kill -9 <WORKER_PID>
sleep 3
pm2 status                          # cookie-vault-worker should be "online" again
```

### 9.2 Log rotation (so the disk doesn't fill up)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

## 10. Nginx reverse proxy and HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/cookie-vault`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.COM;

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

Replace `YOUR_DOMAIN.COM` with the operator's domain (section 1). The
`X-Forwarded-For` header is what lets the access history record real visitor IPs.

```bash
sudo ln -s /etc/nginx/sites-available/cookie-vault /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Check:** `sudo nginx -t` says `syntax is ok` and `test is successful`, then
`curl -s -o /dev/null -w "%{http_code}\n" http://YOUR_DOMAIN.COM/` prints `200`.

Add TLS (certbot edits the Nginx config to redirect to HTTPS):

```bash
sudo certbot --nginx -d YOUR_DOMAIN.COM
```

Follow the prompts (expiry notification email, terms of service). Certbot sets up
a renewal timer; verify it:

```bash
sudo certbot renew --dry-run
```

**Check:** `https://YOUR_DOMAIN.COM/` opens without certificate warnings and shows
the Cookie Scraping Tools sign-in page. For a 502, check `pm2 logs
cookie-vault-web` and that `HOST=127.0.0.1` and `PORT=3000` in `.env` match
`proxy_pass`.

Once HTTPS works, make sure `.env` has `COOKIE_SECURE=true`, then:

```bash
pm2 restart cookie-vault-web
```

## 11. Final end-to-end check

1. Open `https://YOUR_DOMAIN.COM/` — the sign-in page appears.
2. Sign in with username `admin` and the `ADMIN_PASSWORD` from `.env` — you reach
   the Dashboard.
3. Wait until the account **Status** becomes `Active` (the worker needs a few
   ticks to sign in — see `pm2 logs cookie-vault-worker`).
4. Click the account → open an app (`targetType: cookies`) → click **Get** on one
   item → a cookie count appears and the download button is enabled.
5. Download the cookies and open the **Tutorial** page for how to import them with
   the Cookie-Editor extension.
6. Check the **Logs** page: it has sign-in entries and `System` entries for
   sign-in, session check, and app sync.

7. If other people need access, create accounts for them on the **Users** page.
   They get the `user` role (see "Dashboard accounts and roles" in `README.md`).
   Don't share the admin password.

If everything passes, the deployment is complete.

### 11.1 Link previews and search engines (optional)

1. `curl -s https://YOUR_DOMAIN.COM/ | grep og:image` shows your domain, and
   `https://YOUR_DOMAIN.COM/og-image.png` opens in a browser.
2. Send the link in WhatsApp: the preview shows the logo, title, and description.
   WhatsApp caches previews; add `?v=2` to the link to force a new one.
3. For search engines, add the domain in Google Search Console and Bing Webmaster
   Tools, then submit `https://YOUR_DOMAIN.COM/sitemap.xml`. Indexing and ranking
   are decided by them and are not guaranteed.

## 12. Update / redeploy (after code changes)

```bash
cd ~/cookie-vault
git pull
npm install                 # in case there are new dependencies
source .venv/bin/activate && pip install -r requirements.txt   # if requirements.txt changed
npm run build
pm2 restart cookie-vault-web cookie-vault-worker
```

**Check:** both processes are `online` in `pm2 status`, and the dashboard opens
without a blank page (see Troubleshooting #3 if it does).

## 13. Adding or changing source accounts

Edit `.env`, add or change `ACCOUNT_N_LABEL/EMAIL/PASSWORD`, then:

```bash
pm2 restart cookie-vault-worker cookie-vault-web
```

The first account (`ACCOUNT_1_...`) is marked **Primary** in the dashboard; it
keeps being retried even when other accounts fail.

## 14. Troubleshooting

**1. The worker keeps reporting a failed sign-in**
Almost always wrong or expired credentials in `.env`, or the VPS IP is blocked or
rate-limited by Cloudflare (try from another IP to confirm). It is not a code bug
if the error clearly says the email or password is wrong.

**2. `pm2 logs cookie-vault-worker` shows "Failed to run Python"**
`PYTHON_BIN` in `.env` has the wrong path, or `curl_cffi` is not installed in that
virtualenv. Repeat step 6, then `pm2 restart cookie-vault-worker`.

**3. The dashboard is completely blank after a redeploy**
This happened once: when `@fastify/static` is registered with `wildcard:false`, it
registers static routes **only at startup**, so a new build with new hashed file
names is not served until the process restarts. It is fixed (`wildcard` is left at
its default `true`), but if it regresses, make sure `src/server/server.ts` does
NOT contain `wildcard: false`, then `pm2 restart cookie-vault-web`.

**4. 502 Bad Gateway from Nginx**
`cookie-vault-web` is not listening where Nginx expects it. Check `pm2 status`,
`pm2 logs cookie-vault-web`, and compare `PORT`/`HOST` in `.env` with
`proxy_pass` in the Nginx config.

**5. Duplicate worker processes (left over from manual testing)**
Don't run `node dist/server/worker.js` manually while PM2 manages it: the two can
race to sign in to the same account and trigger 403s or kicked sessions. Always
use `pm2 start/restart/stop`.

**6. A `POST` API request returns `400 Bad Request` with an empty body**
Fastify rejects `Content-Type: application/json` without a body. Frontend POSTs
without a payload send `body: "{}"` explicitly; follow the same pattern for new
endpoints in `web/src/lib/api.ts`.

## 15. Security checklist before going live

- [ ] `.env` is never committed to Git (`.gitignore` already excludes it).
- [ ] `HOST=127.0.0.1` in `.env` (port 3000 is not directly public).
- [ ] `COOKIE_SECURE=true` once HTTPS works.
- [ ] `ADMIN_PASSWORD` is strong (not a default or guessable value) and the
      operator has it.
- [ ] Other people have their own `user` accounts instead of the admin password.
- [ ] `ufw status` only allows 22/80/443.
- [ ] `pm2 startup` was verified with `sudo reboot` (section 9).
- [ ] `data/cookies.db` is backed up on a schedule (optional but recommended: it
      holds all the encrypted cookies; use `cron` + `rsync` to another storage,
      especially before major maintenance).
