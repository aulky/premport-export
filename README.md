# Cookie Scraping Tools

A dashboard and worker that sign in to your accounts automatically, store the
session cookies in SQLite, and export them as JSON in the **Cookie-Editor**
extension format, ready to import into a browser.

## Architecture

- **`src/server/worker.ts`** — a separate process. Every `WORKER_TICK_SEC` it
  checks which accounts need to be verified or renewed:
  1. If an account has never signed in, or its session is close to expiring
     (`REFRESH_BEFORE_SEC`), it signs in again (see
     [Why sign-in does not use a browser](#why-sign-in-does-not-use-a-browser-playwright)).
  2. Otherwise, once `CHECK_INTERVAL_SEC` has passed, it first checks that the
     session is still alive (using the stored cookies) before deciding to sign in
     again. This is more accurate than reading the cookie's `expirationDate`,
     because a session can die on the server before the cookie expires.
  3. The new cookie snapshot and the app list are stored in SQLite, with the
     cookie column **encrypted with AES-256-GCM** (key derived from `SECRET_KEY`).
- **`src/server/server.ts`** — Fastify: the React dashboard and its API (sign-in,
  accounts and status, apps per account, `cookies.json` export, logs).
- **SQLite** (`better-sqlite3`, WAL mode) — a single `data/cookies.db` file shared
  by `web` and `worker` (safe because WAL allows many readers and one writer).
- **Frontend**: React + Vite + Tailwind v4, **Dens-UI** theme with a custom palette
  of Mars Green `#008C8D`, Periwinkle `#53589A`, and Powder `#FFF2DF`
  (see `web/src/styles/globals.css`).

The **app list is dynamic**: the worker upserts the apps it finds on every
sign-in. Apps that no longer appear are marked inactive, not deleted, so their
history stays in SQLite.

## Setup (Linux)

```bash
# 1. Node 22+ and Python 3 + curl_cffi
npm install
pip install -r requirements.txt   # or: npm run setup:python

# 2. Configuration
cp .env.example .env
nano .env
#   - SECRET_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   - ADMIN_PASSWORD: password of the dashboard "admin" account (not the source account password)
#   - ACCOUNT_1_EMAIL / ACCOUNT_1_PASSWORD, ACCOUNT_2_..., etc. — the accounts to use

# 3. Build
npm run build     # compile the server (tsc) and the UI (vite) -> dist/ and web/dist/

# 4. Run with PM2
npm i -g pm2      # if not installed yet
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup       # follow the instructions so PM2 starts again after a reboot
```

The dashboard listens on `http://<server>:3000` by default. If you serve it over
HTTPS (nginx/caddy reverse proxy), set `COOKIE_SECURE=true` in `.env`.

> **Full hosting guide** (step by step with a check after each step, including
> Nginx, HTTPS, and PM2 auto-start): see [`docs/HOSTING.md`](docs/HOSTING.md). It
> is written so an AI coding agent can take the deployment from zero to live,
> asking only for decisions that really need a human operator (domain, account
> credentials, and so on — see section 1 there).

## Why sign-in does not use a browser (Playwright)

`premiumportal.id` sits behind **Cloudflare bot management**, which blocks the
sign-in request (a Next.js Server Action with a `next-action` header) when it
comes from an automated Chromium. This was confirmed by direct testing: both
headless and headed Playwright received a 403 "Just a moment..." on exactly the
sign-in POST, although the login page itself loaded.

The solution is in `scripts/portal_client.py`: sign-in and status checks go
through `curl_cffi`, which imitates a real Chrome TLS/JA3 fingerprint and so does
not carry the automation traits Cloudflare detects. Technical details:

- The `next-action` header hash **changes on every Next.js rebuild**, so it is not
  hard-coded. It is extracted from the live JS bundle (located by the function
  names `loginAction` / `getUserPackages`, not by position).
- Account status (`premiumExpiresAt`, package name) comes from the
  `getUserPackages` action on the site's dashboard page, in the **same
  session/connection** as the sign-in. A fresh session used without a warm-up
  request is rejected with 401 even with a valid token.
- The `accessToken` is a JWT with an `exp` of about 24 hours. The worker uses it
  for a cheap check; a full sign-in only happens when that check fails.

Node has no official TLS impersonation library like `curl_cffi`, so the Node
processes run `scripts/portal_client.py` as a subprocess. Credentials are passed
on stdin, not as CLI arguments, so they don't show up in the process list.

## Per-app cookies (Netflix, Canva, ChatGPT, etc.)

Found by reverse engineering the official "Premium Portal Extension"
(`static/background/index.js`, deobfuscated by hand — see the history of
`scripts/apps_client.py`): there is a separate backend,
**`consumer-api.premiumportal.id`**, called with
`Authorization: Bearer <accessToken>`:

- `GET /extensions/init/full` — a catalog of about 80 apps and their `items[]`
  (each app has many shared "account slots"; Netflix has 97 items, for example).
- `GET /extensions/get-cookies/{itemId}` — **ready-to-use** cookies in exactly the
  Cookie-Editor format (verified against real Netflix cookies).

**Important safety design**: the worker only syncs the app and item catalog
automatically (metadata only, no quota used). Fetching an item's cookies
(`get-cookies`) is **always manual**, triggered by the **Get** button — never
automatic or in bulk. Some apps have daily limits (the extension's own text says,
for Netflix, that you may only pick 10 accounts in 24 hours), and fetching every
item at once could get the account banned.

Not every app uses `targetType: "cookies"`. There are also `"autofill"` (see
below), `"list"`, and `"link"` — the latter two are listed without actions for
now (not yet reverse-engineered).

In the dashboard: click the app count on an account row → pick an app → pick an
item/slot → click **Get** → click the download icon to export `cookies.json`.

## Account credentials (MediaFire, QuillBot, Gamma, etc.)

Some apps share an account via **username/password** instead of cookies
(`targetType: "autofill"` — the official extension auto-fills the sign-in form
with them). Found the same way as the cookie endpoints, by reverse-engineering
`autofill.<hash>.js` and `static/background/index.js` (handler `detail-account`
→ `services/auto-login.service.ts`):

- `GET /items/creds/single/{itemId}` — `{url, username, password}` for that item.

In the dashboard: pick an app with the **Account credentials** badge → pick an
item → click **Get**. The username/password appear inline, with the password
masked by default (click the eye icon to reveal, or use the copy buttons). If
it looks stale, click **Refresh** to fetch the current value from the provider;
**View** shows the last fetched value again without a new provider call. Same
safety rule as cookies: always manual, never automatic or in bulk. Only the
most recent value is stored (not a history), and it is encrypted the same way
as cookies.

## Dashboard accounts and roles

Sign in with a username and password.

- **admin** — username `admin`, password `ADMIN_PASSWORD` from `.env`. Creates
  users, resets their passwords, and deletes them on the **Users** page.
- **user** — created by the admin. Can view data and fetch cookies, but cannot add
  or manage anything.

| Feature | Admin | User |
|---|---|---|
| Dashboard, Apps, Tutorial | yes | yes |
| Get, view, and download app cookies/credentials | yes | yes |
| Refresh / Refresh All (sign in again to the source account) | yes | no |
| Export the source account's session cookie | yes | no |
| Logs (system activity, access history with IPs) | yes | no |
| Users (add, reset password, delete) | yes | no |

The server enforces these rules: an API route is admin-only unless it is
explicitly opened to users in `src/server/server.ts`. Deleting a user or changing
a password ends that account's existing sessions immediately. User passwords are
stored as salted scrypt hashes. Usernames are 3-32 characters (letters, numbers,
`.`, `_`, `-`), passwords at least 8 characters.

Note that each **Get** by any user counts against the provider's daily limits.

## Adding or changing source accounts

Add `ACCOUNT_N_LABEL` / `ACCOUNT_N_EMAIL` / `ACCOUNT_N_PASSWORD` lines to `.env`,
then:

```bash
pm2 restart cookie-vault-worker cookie-vault-web
```

Accounts removed from `.env` are deactivated in the dashboard; their data is not
deleted.

Passwords may contain `#`, `!`, `$` and similar characters. Do not put a comment
after a password on the same line.

## Exporting cookies

In the dashboard, click **Export cookie.json** on an account whose status is
`Active` or `Expired`. The downloaded file has the same format as Cookie-Editor's
**Export → JSON**, so you can **Import** it directly.

## Access history

The **Logs** page shows 10 entries per page, newest first, in three tabs:

- **Sign-ins** — successful sign-ins, failed attempts, and sign-outs, with time,
  username, IP, and device.
- **Cookies** — cookie and credential fetches/views/downloads: who and from
  which IP, app, item, account, and cookie count. Click an IP to filter.
  Cookie values and passwords are never logged.
- **System** — worker sign-ins, session checks, and catalog syncs.

At most 10,000 sign-in entries and 10,000 cookie entries are kept; the oldest are
removed first.

The IP is taken from `X-Forwarded-For` only when the request comes from a trusted
proxy (`TRUST_PROXY`, default `loopback` = Nginx on the same server). If another
proxy sits in front (such as Cloudflare), configure Nginx to forward the real IP
(`real_ip_header`), otherwise that proxy's IP is recorded.

## Search engines and link previews

The server adds the title, description, Open Graph and Twitter tags, and
schema.org data that search engines and chat apps read, and serves:

| Address | Content |
|---|---|
| `/about` | Public description of the tool, readable without JavaScript |
| `/robots.txt` | Allows crawling, except `/api/` |
| `/sitemap.xml` | `/` and `/about` |
| `/llms.txt` | Summary for AI assistants |
| `/og-image.png` | Preview image shown when the link is shared |
| `/favicon.ico`, `/favicon.svg` | Icon shown in browsers and search results |

Set `PUBLIC_URL=https://your-domain.com` in `.env`. Pages inside the app are
marked `noindex`. The texts are in `src/server/seo.ts`.

Being indexed, ranked, or recommended by a search engine or AI assistant is
decided by them and cannot be guaranteed. To get started: serve the site over
HTTPS, then submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Security

- All cookies in SQLite are encrypted (AES-256-GCM) with `SECRET_KEY`.
- After 5 failed sign-ins from one IP (one /64 for IPv6), further attempts from
  it are refused with `429` for the rest of a 15-minute window, even with the
  right password. The count is kept in memory, so `pm2 restart cookie-vault-web`
  clears it. Behind a proxy such as Cloudflare, make sure the real visitor IP
  reaches the app (see [Access history](#access-history)), otherwise visitors
  share one limit.
- Every `/api/*` endpoint except `/api/login` requires a signed-in session, and
  is admin-only unless explicitly opened to users.
- `.env` holds account credentials — never commit it (it is in `.gitignore`).
- Make sure automated sign-in and scraping comply with the terms of service of
  the site involved.

## Development (Windows, local)

```bash
npm run dev     # web + worker + UI together (uses concurrently, already installed)
```

or run them separately to get separate logs:

```bash
npm run dev:web      # Fastify + API, port 3000
npm run dev:ui       # Vite dev server (proxies /api to :3000), port 5173
npm run dev:worker   # worker (signs in via scripts/portal_client.py)
```
