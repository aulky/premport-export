// Landing page publik di "/" (untuk pengunjung yang belum login). Dibuat di
// server sebagai HTML biasa: cepat, terbaca crawler tanpa JavaScript, dan
// gayanya mengikuti halaman login (latar beranimasi, kartu kaca, font Geist).
// JavaScript di bawah hanya untuk animasi muncul saat digulir dan navbar;
// tanpa JS semua konten tetap tampil.
import { DESCRIPTION, FAQ, NAME, esc, headTags, jsonLd } from "./seo.js";

export interface LandingFonts {
  sans?: string;
  mono?: string;
}

// ---------- ikon (lucide, garis 2px) ----------

const PATHS = {
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  scroll:
    '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  login:
    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
  dashboard:
    '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  cookie:
    '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>',
} as const;

const icon = (name: keyof typeof PATHS, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;

/** Logo aplikasi -- sama dengan web/src/components/Logo.tsx. `id` harus unik per halaman. */
const logo = (id: string, size: number) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b3a9"/><stop offset=".55" stop-color="#007c7e"/><stop offset="1" stop-color="#3a4481"/></linearGradient>
    <mask id="${id}m"><rect width="40" height="40" fill="#fff"/><circle cx="29.5" cy="13.5" r="5.5" fill="#000"/><circle cx="23" cy="8.5" r="3.5" fill="#000"/></mask>
  </defs>
  <rect width="40" height="40" rx="11" fill="url(#${id}bg)"/>
  <circle cx="19" cy="21" r="12" fill="#fff" mask="url(#${id}m)"/>
  <g fill="#0f4f55"><circle cx="14.5" cy="17" r="2.1"/><circle cx="20.5" cy="22.5" r="2.4"/><circle cx="14" cy="26" r="1.6"/><circle cx="24.5" cy="28" r="1.4"/></g>
  <g fill="#fff"><rect x="29.5" y="8" width="3.6" height="3.6" rx="1"/><rect x="34" y="14" width="2.4" height="2.4" rx=".7" opacity=".75"/><rect x="31" y="4" width="2" height="2" rx=".6" opacity=".55"/></g>
</svg>`;

// ---------- isi ----------

const NAV = [
  ["#preview", "Preview"],
  ["#features", "Features"],
  ["#how", "How it works"],
  ["#security", "Security"],
  ["#faq", "FAQ"],
] as const;

const FACTS: [value: string, label: string][] = [
  ["24/7", "Background worker keeps sessions alive"],
  ["1 click", "From dashboard to cookie.json"],
  ["AES-256", "GCM encryption for every cookie"],
  ["0", "Public sign-ups: admins create every user"],
];

const STEPS: [title: string, text: string][] = [
  ["Admin connects accounts", "The provider accounts are added once by the administrator."],
  ["Worker signs in", "Each account is signed in and its cookies are scraped and encrypted."],
  ["You pick and download", "Open an account or app in the dashboard and fetch a fresh cookie.json."],
  ["Import and go", "Import the file with Cookie-Editor on the target website and reload."],
];

const PAGES: [icon: keyof typeof PATHS, title: string, text: string][] = [
  ["dashboard", "Dashboard", "Every account at a glance: status, last check, time left, and one-click export."],
  ["grid", "Apps", "Browse the provider's app catalog, search it, and fetch cookies per item or account slot."],
  ["scroll", "Logs", "Sign-ins, cookie downloads, and worker activity, filterable by IP address."],
  ["users", "Users", "Create users with an optional expiry date and set how long a session lasts."],
  ["book", "Tutorial", "A step-by-step guide to importing cookies with Cookie-Editor."],
];

const SECURITY = [
  "Cookies are encrypted with AES-256-GCM before they touch the database",
  "Signed, httpOnly session cookies that expire on their own",
  "Session lifetime is adjustable from 1 to 1,440 minutes",
  "Signing in again ends the previous session immediately",
  "Five failed sign-ins lock that IP address for 15 minutes",
  "Every sign-in and cookie download is logged with IP and device",
];

const MINI_FEATURES: [icon: keyof typeof PATHS, title: string, text: string][] = [
  ["timer", "Automatic sign-out", "Users are signed out the moment their session ends."],
  ["key", "One active session", "A new sign-in replaces the old one everywhere."],
  ["phone", "Any screen", "Built for phones, tablets, and wide monitors."],
  ["moon", "Light and dark", "Follows your system theme, or pick your own."],
];

// ---------- potongan HTML ----------

/** Tiruan dashboard asli, ukurannya ikut lebar bingkai (container query, satuan em). */
function dashboardMock(): string {
  const rows: [string, string, string, string, string, string][] = [
    ["Account 1", "primary", "valid", "2m ago", "61d left", "79"],
    ["Account 2", "", "valid", "4m ago", "7d left", "79"],
    ["Account 3", "", "valid", "6m ago", "28d left", "64"],
    ["Account 4", "", "error", "9m ago", "—", "0"],
  ];
  const status = (s: string) =>
    s === "valid" ? '<span class="m-badge ok">Active</span>' : '<span class="m-badge err">Sign-in failed</span>';
  const activity: [boolean, string, string, string][] = [
    [true, "acc-1", "login — 2 cookies, refreshed", "2m"],
    [true, "acc-2", "apps-sync — 79 apps, 437 items", "4m"],
    [true, "acc-1", "item-fetch — cookie.json downloaded", "5m"],
    [false, "acc-4", "login — wrong password", "9m"],
  ];
  return `<div class="screen">
    <aside class="m-side">
      <div class="m-brand">${logo("mk", 28)}<div><b>Cookie Scraping</b><small>Tools</small></div></div>
      <div class="m-label">Menu</div>
      <div class="m-nav active">${icon("dashboard", 14)}Dashboard</div>
      <div class="m-nav">${icon("grid", 14)}Apps</div>
      <div class="m-nav">${icon("scroll", 14)}Logs</div>
      <div class="m-nav">${icon("users", 14)}Users</div>
      <div class="m-nav">${icon("book", 14)}Tutorial</div>
      <div class="m-user"><b>admin</b><small>Admin</small></div>
    </aside>
    <div class="m-main">
      <div class="m-head">
        <div><b>Dashboard</b><small>Account and cookie status, always up to date</small></div>
        <div class="m-head-r"><span class="m-btn">${icon("refresh", 12)}<span>Refresh All</span></span><span class="m-avatar">AD</span></div>
      </div>
      <div class="m-body">
        <div class="m-stats">
          <div class="m-stat"><div><small>Total accounts</small><b>4</b></div><span class="m-ic">${icon("users", 14)}</span></div>
          <div class="m-stat"><div><small>Active</small><b>3</b></div><span class="m-ic ok">${icon("circleCheck", 14)}</span></div>
          <div class="m-stat"><div><small>Needs attention</small><b class="err">1</b></div><span class="m-ic err">${icon("alert", 14)}</span></div>
        </div>
        <div class="m-card">
          <div class="m-card-h"><b>Accounts &amp; cookies</b><span class="m-search">${icon("search", 11)}Search accounts…</span></div>
          <div class="m-table">
            <div class="m-tr m-th"><span>Account</span><span>Status</span><span class="m-hide">Checked</span><span class="m-hide">Session ends</span><span class="m-hide">Apps</span><span class="m-right">Actions</span></div>
            ${rows
              .map(
                ([name, tag, st, checked, ends, apps]) => `<div class="m-tr">
              <span><b>${name}</b>${tag ? '<i class="m-tag">Primary</i>' : ""}</span>
              <span>${status(st)}</span>
              <span class="m-hide m-muted">${checked}</span>
              <span class="m-hide m-muted">${ends}</span>
              <span class="m-hide">${apps} apps</span>
              <span class="m-right"><i class="m-mini">${icon("refresh", 10)}</i><i class="m-export${st === "valid" ? "" : " off"}">Export cookie.json</i></span>
            </div>`,
              )
              .join("")}
          </div>
        </div>
        <div class="m-card m-activity">
          <div class="m-card-h"><b>Recent activity</b><span class="m-link">View all logs</span></div>
          ${activity
            .map(
              ([ok, acc, msg, t]) =>
                `<div class="m-act"><span class="m-dot ${ok ? "ok" : "err"}"></span><b>${acc}</b><span class="m-muted">${msg}</span><span class="m-time">${t} ago</span></div>`,
            )
            .join("")}
        </div>
      </div>
    </div>
  </div>`;
}

const JSON_SNIPPET = `<span class="p">[</span>
  <span class="p">{</span>
    <span class="k">"domain"</span>: <span class="s">".example.com"</span>,
    <span class="k">"name"</span>: <span class="s">"session_id"</span>,
    <span class="k">"value"</span>: <span class="s">"a91f…c07e"</span>,
    <span class="k">"httpOnly"</span>: <span class="b">true</span>,
    <span class="k">"secure"</span>: <span class="b">true</span>,
    <span class="k">"expirationDate"</span>: <span class="n">1798000000</span>
  <span class="p">}</span>
<span class="p">]</span>`;

function features(): string {
  const sessionRows: [string, number, string][] = [
    ["Account 1", 92, "61d left"],
    ["Account 2", 64, "7d left"],
    ["Account 3", 80, "28d left"],
    ["Account 4", 41, "3d left"],
  ];
  const apps: [string, string, string, string][] = [
    ["S", "Streaming app", "12 items", "Cookie"],
    ["A", "AI assistant", "4 items", "Cookie"],
    ["D", "Design suite", "2 items", "Credentials"],
    ["L", "Learning platform", "1 item", "Account list"],
  ];
  const logs: [string, string, string, boolean][] = [
    ["Sign-in", "admin · Chrome on Windows", "just now", true],
    ["Cookie download", "user1 · Account 1", "3m ago", true],
    ["Sign-in", "unknown · wrong password", "12m ago", false],
  ];
  return `<div class="bento">
    <article class="card wide reveal">
      <span class="ficon">${icon("zap")}</span>
      <h3>Always-fresh sessions</h3>
      <p>A background worker checks every account and signs in again before its session expires, so the cookies you download are never stale.</p>
      <div class="viz sessions">
        ${sessionRows
          .map(
            ([n, pct, left], i) =>
              `<div class="srow"><span>${n}</span><div class="sbar"><i style="--w:${pct}%;--d:${i * 120}ms"></i></div><em>${left}</em></div>`,
          )
          .join("")}
        <div class="slegend"><span class="pulse-dot"></span>Re-login scheduled before expiry<span class="snext">Next check in 4m</span></div>
      </div>
    </article>
    <article class="card reveal" style="--d:80ms">
      <span class="ficon">${icon("download")}</span>
      <h3>One-click export</h3>
      <p>Download cookies as Cookie-Editor JSON, ready to import.</p>
      <pre class="code" aria-label="Example cookie.json">${JSON_SNIPPET}</pre>
    </article>
    <article class="card reveal">
      <span class="ficon">${icon("grid")}</span>
      <h3>Full app catalog</h3>
      <p>Every app the provider offers, with the fetch method for each.</p>
      <ul class="viz apps">
        ${apps
          .map(
            ([l, n, c, t]) =>
              `<li><span class="alogo">${l}</span><span class="aname"><b>${n}</b><small>${c}</small></span><span class="abadge">${t}</span></li>`,
          )
          .join("")}
      </ul>
    </article>
    <article class="card reveal" style="--d:80ms">
      <span class="ficon">${icon("lock")}</span>
      <h3>Encrypted at rest</h3>
      <p>Cookies are sealed with AES-256-GCM before they are stored.</p>
      <div class="viz cipher">
        <div class="cline"><span>session_id</span><b>a91f…c07e</b></div>
        <div class="carrow">${icon("lock", 14)} AES-256-GCM</div>
        <div class="cline enc"><span>stored</span><b>9f3a7be1d0c4…</b></div>
      </div>
    </article>
    <article class="card reveal" style="--d:160ms">
      <span class="ficon">${icon("users")}</span>
      <h3>Roles that make sense</h3>
      <p>Admins manage everything. Users view accounts and fetch cookies.</p>
      <div class="viz roles">
        <div class="role admin"><b>Admin</b><span>Accounts · Users · Logs · Settings</span></div>
        <div class="role"><b>User</b><span>View accounts · Fetch cookies</span></div>
      </div>
    </article>
    <article class="card wide reveal">
      <span class="ficon">${icon("scroll")}</span>
      <h3>Complete access history</h3>
      <p>Know who signed in and who downloaded what, with time, IP address, and device.</p>
      <ul class="viz logs">
        ${logs
          .map(
            ([ev, who, t, ok]) =>
              `<li><span class="ldot ${ok ? "ok" : "err"}"></span><b>${ev}</b><span class="lwho">${who}</span><span class="lip">10.0.•.•</span><em>${t}</em></li>`,
          )
          .join("")}
      </ul>
    </article>
    <article class="card reveal" style="--d:80ms">
      <span class="ficon">${icon("shield")}</span>
      <h3>Brute-force protection</h3>
      <p>After five wrong passwords, that IP address waits 15 minutes before it can try again.</p>
      <div class="viz attempts">${Array.from({ length: 5 }, (_, i) => `<i style="--d:${i * 90}ms"></i>`).join("")}<span>15:00</span></div>
    </article>
  </div>
  <ul class="minis">
    ${MINI_FEATURES.map(
      ([ic, t, d], i) =>
        `<li class="reveal" style="--d:${i * 70}ms"><span class="ficon sm">${icon(ic, 18)}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></li>`,
    ).join("")}
  </ul>`;
}

// ---------- gaya ----------

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:5rem;-webkit-text-size-adjust:100%;overflow-x:clip}
body{margin:0;min-height:100vh;color:#e8edf7;background:#070d1a;font:16px/1.65 "Geist Variable","Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:clip}
a{color:inherit}
:focus-visible{outline:2px solid #5eead4;outline-offset:3px;border-radius:6px}
.mono,code,pre{font-family:"Geist Mono Variable","Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.skip{position:absolute;left:1rem;top:-3rem;z-index:100;padding:.5rem 1rem;border-radius:.5rem;background:#14b3a9;color:#04201f;font-weight:600}
.skip:focus{top:1rem}

/* Latar "aurora": dua cahaya lembut yang bergeser sangat pelan + grid tipis. */
.scene{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;contain:strict}
.aurora{position:absolute;border-radius:50%;will-change:transform}
.aurora.a{width:76rem;height:48rem;left:-20rem;top:-26rem;background:radial-gradient(closest-side,rgb(20 179 169/.32),transparent);animation:au-a 40s ease-in-out infinite alternate}
.aurora.b{width:70rem;height:46rem;right:-24rem;top:30%;background:radial-gradient(closest-side,rgb(79 70 229/.26),transparent);animation:au-b 48s ease-in-out infinite alternate}
@keyframes au-a{to{transform:translate3d(12rem,5rem,0) scale(1.08)}}
@keyframes au-b{to{transform:translate3d(-12rem,-6rem,0) scale(1.06)}}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgb(255 255 255/.04) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255/.04) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse 80% 50% at 50% 0%,#000 20%,transparent 75%)}

.wrap{width:100%;max-width:74rem;margin:0 auto;padding:0 1.25rem}
@media (min-width:640px){.wrap{padding:0 2rem}}

/* Navbar */
.nav{position:sticky;top:0;z-index:50;transition:background-color .3s,border-color .3s,backdrop-filter .3s;border-bottom:1px solid transparent}
.nav.scrolled{background:rgb(7 13 26/.72);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border-color:rgb(255 255 255/.07)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:4.25rem}
.brand{display:flex;align-items:center;gap:.7rem;text-decoration:none}
.brand svg{filter:drop-shadow(0 6px 14px rgb(0 0 0/.35))}
.brand b{display:block;font-size:15px;letter-spacing:-.01em;line-height:1.15}
.brand small{display:block;font-size:10.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:rgb(255 255 255/.55)}
.links{display:none;gap:.25rem}
.links a{padding:.45rem .8rem;border-radius:999px;font-size:14px;font-weight:500;color:rgb(255 255 255/.7);text-decoration:none;transition:color .2s,background-color .2s}
.links a:hover{color:#fff;background:rgb(255 255 255/.07)}
@media (min-width:900px){.links{display:flex}}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1.5rem;border-radius:999px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;white-space:nowrap;transition:transform .2s,background-color .2s,box-shadow .2s}
.btn.primary{background:linear-gradient(135deg,#19c2b6,#0b7677);box-shadow:0 10px 30px -10px rgb(20 179 169/.75),inset 0 1px 0 rgb(255 255 255/.2)}
.btn.primary:hover{transform:translateY(-1px);box-shadow:0 16px 36px -10px rgb(20 179 169/.9),inset 0 1px 0 rgb(255 255 255/.2)}
.btn.ghost{border:1px solid rgb(255 255 255/.16);background:rgb(255 255 255/.06)}
.btn.ghost:hover{background:rgb(255 255 255/.12)}
.btn.sm{padding:.55rem 1.1rem;font-size:14px}
.btn svg{transition:transform .2s}
.btn:hover svg{transform:translateX(2px)}

/* Hero */
.hero{text-align:center;padding-top:4.5rem}
h1{margin:0 auto;max-width:54rem;font-size:clamp(2.3rem,6.4vw,4.6rem);line-height:1.04;letter-spacing:-.035em;font-weight:650;text-wrap:balance;color:#fff}
.shine{background:linear-gradient(100deg,#5eead4,#a5b4fc);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{margin:1.4rem auto 0;max-width:40rem;font-size:clamp(1.02rem,2.2vw,1.2rem);color:rgb(232 237 247/.72);text-wrap:pretty}
.cta{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem;margin-top:2.1rem}
.ticks{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem 1.4rem;margin:1.6rem 0 0;padding:0;list-style:none;font-size:14px;color:rgb(232 237 247/.65)}
.ticks li{display:flex;align-items:center;gap:.4rem}
.ticks svg{color:#5eead4}

/* Pratinjau dashboard */
.preview{position:relative;margin:4rem auto 0;max-width:68rem;perspective:1800px}
.frame{position:relative;border-radius:1.1rem;padding:.55rem;background:linear-gradient(180deg,rgb(255 255 255/.14),rgb(255 255 255/.04));box-shadow:0 40px 120px -30px rgb(20 179 169/.35),0 30px 80px -40px rgb(0 0 0/.9);transform-origin:50% 0}
.js .frame{transform:rotateX(14deg) scale(.96);opacity:0;transition:transform 1.2s cubic-bezier(.16,1,.3,1),opacity .9s ease}
.js .preview.in .frame{transform:none;opacity:1}
.chrome{display:flex;align-items:center;gap:.4rem;padding:.35rem .5rem .6rem}
.chrome i{width:.65rem;height:.65rem;border-radius:50%;background:rgb(255 255 255/.18)}
.chrome i:nth-child(1){background:#f87171}.chrome i:nth-child(2){background:#fbbf24}.chrome i:nth-child(3){background:#34d399}
.chrome span{margin-left:.8rem;padding:.15rem 1rem;border-radius:999px;background:rgb(255 255 255/.07);font-size:12px;color:rgb(255 255 255/.55)}
.mock{container-type:inline-size;border-radius:.7rem;overflow:hidden}

.screen{--bg:#0b111e;--card:#131c2d;--line:#243047;--muted:#98a6bd;--brand:#45cbc8;display:grid;grid-template-columns:12.5em 1fr;font-size:1.45cqw;line-height:1.45;background:var(--bg);color:#e5eaf4;text-align:left}
.screen svg{width:1.1em;height:1.1em;flex:none}
.m-side{display:flex;flex-direction:column;gap:.2em;padding:1em .8em;background:#0e1626;border-right:1px solid #1e2a41}
.m-brand{display:flex;align-items:center;gap:.6em;margin-bottom:1em;padding:0 .3em}
.m-brand svg{width:2.2em;height:2.2em}
.m-brand b{display:block;font-size:.85em}.m-brand small{display:block;font-size:.6em;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.m-label{padding:0 .6em;font-size:.6em;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.m-nav{display:flex;align-items:center;gap:.6em;padding:.5em .6em;border-radius:.5em;font-size:.82em;color:rgb(229 234 244/.8)}
.m-nav.active{background:#1b2941;color:#fff}.m-nav.active svg{color:var(--brand)}
.m-user{margin-top:auto;padding:.8em .6em 0;border-top:1px solid #1e2a41}
.m-user b{display:block;font-size:.8em}.m-user small{font-size:.6em;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
.m-main{min-width:0}
.m-head{display:flex;align-items:center;justify-content:space-between;gap:1em;padding:.9em 1.4em;border-bottom:1px solid var(--line);background:rgb(19 28 45/.6)}
.m-head b{display:block;font-size:1.05em}.m-head small{display:block;font-size:.7em;color:var(--muted)}
.m-head-r{display:flex;align-items:center;gap:.7em}
.m-btn{display:inline-flex;align-items:center;gap:.4em;padding:.45em .9em;border-radius:999px;background:#1f2a3f;font-size:.72em;font-weight:600}
.m-avatar{display:grid;place-content:center;width:2em;height:2em;border-radius:50%;background:var(--brand);color:#05201f;font-size:.65em;font-weight:700}
.m-body{display:grid;gap:1em;padding:1.3em 1.4em 1.5em}
.m-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.9em}
.m-stat{display:flex;align-items:center;justify-content:space-between;padding:.9em 1em;border-radius:.8em;background:var(--card);border:1px solid var(--line)}
.m-stat small{display:block;font-size:.7em;color:var(--muted)}.m-stat b{font-size:1.6em;letter-spacing:-.02em}.m-stat b.err{color:#f5737d}
.m-ic{display:grid;place-content:center;width:2.3em;height:2.3em;border-radius:.6em;background:#1a2c40;color:var(--brand)}
.m-ic.ok{background:#10392d;color:#8be5b9}.m-ic.err{background:rgb(245 115 125/.12);color:#f5737d}
.m-card{padding:1em 1.1em;border-radius:.8em;background:var(--card);border:1px solid var(--line)}
.m-card-h{display:flex;align-items:center;justify-content:space-between;gap:1em;margin-bottom:.6em}
.m-card-h b{font-size:.85em}
.m-search{display:inline-flex;align-items:center;gap:.4em;padding:.35em .8em;border:1px solid #303e59;border-radius:.5em;font-size:.65em;color:var(--muted)}
.m-link{font-size:.7em;font-weight:600}
.m-tr{display:grid;grid-template-columns:1.4fr 1.1fr .8fr .9fr .7fr 1.6fr;align-items:center;gap:.6em;padding:.55em 0;border-top:1px solid rgb(36 48 71/.7);font-size:.72em}
.m-th{border-top:0;font-size:.58em;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.m-tr b{font-weight:600}.m-muted{color:var(--muted)}
.m-tag{margin-left:.4em;padding:.1em .5em;border-radius:999px;background:#1f2a3f;font-size:.8em;font-style:normal}
.m-badge{display:inline-block;padding:.15em .6em;border-radius:999px;font-size:.88em;font-weight:600}
.m-badge.ok{background:#10392d;color:#8be5b9}.m-badge.err{background:rgb(245 115 125/.14);color:#f5737d}
.m-right{display:flex;justify-content:flex-end;align-items:center;gap:.4em}
.m-mini{display:grid;place-content:center;width:2em;height:2em;border:1px solid #303e59;border-radius:999px}
.m-export{padding:.35em .8em;border-radius:999px;background:#1f2a3f;font-style:normal;font-weight:600;white-space:nowrap}
.m-export.off{opacity:.45}
.m-act{display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:.6em;padding:.45em 0;border-top:1px solid rgb(36 48 71/.7);font-size:.7em}
.m-act:first-of-type{border-top:0}
.m-act .m-muted{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.m-dot{width:.55em;height:.55em;border-radius:50%}.m-dot.ok{background:#34d399}.m-dot.err{background:#f5737d}
.m-time{color:var(--muted)}
@container (max-width:640px){
  .screen{grid-template-columns:1fr;font-size:3cqw}
  .m-side{display:none}
  .m-hide{display:none}
  .m-tr{grid-template-columns:1.3fr 1fr 1.4fr}
  .m-stats{gap:.6em}
  .m-activity{display:none}
  .m-btn span{display:none}
}

/* Kartu melayang di atas pratinjau */
.float{position:absolute;z-index:2;display:flex;align-items:center;gap:.7rem;padding:.75rem 1rem;border-radius:.9rem;background:rgb(15 23 42/.92);border:1px solid rgb(255 255 255/.12);box-shadow:0 20px 50px -20px rgb(0 0 0/.8);font-size:13px;line-height:1.35;text-align:left}
.float b{display:block;color:#fff}.float span{color:rgb(232 237 247/.6)}
.float .fi{display:grid;place-content:center;width:2rem;height:2rem;border-radius:.6rem;flex:none}
.float.toast{top:34%;right:-1.75rem;border-left:3px solid #34d399}.float.toast .fi{background:#10392d;color:#8be5b9}
.float.chip{bottom:14%;left:-2rem}.float.chip .fi{background:#1a2c40;color:#5eead4}
.js .float{opacity:0;transform:translate3d(0,14px,0);transition:opacity .7s ease,transform .7s cubic-bezier(.16,1,.3,1)}
.js .preview.in .float{opacity:1;transform:none}
.js .preview.in .float.toast{transition-delay:.7s}.js .preview.in .float.chip{transition-delay:.95s}
@media (max-width:900px){.float{display:none}}

/* Section umum */
section.block{padding-top:6rem}
.eyebrow{display:block;margin-bottom:.8rem;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#5eead4;text-align:center}
h2{margin:0 auto;max-width:44rem;font-size:clamp(1.8rem,4vw,2.75rem);line-height:1.12;letter-spacing:-.03em;font-weight:650;text-align:center;text-wrap:balance;color:#fff}
.sub{margin:1rem auto 3rem;max-width:38rem;text-align:center;color:rgb(232 237 247/.66);text-wrap:pretty}

/* Fakta singkat */
.facts{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin:5rem 0 0;padding:0;list-style:none}
@media (min-width:860px){.facts{grid-template-columns:repeat(4,1fr)}}
.facts li{padding:1.4rem 1.2rem;border-radius:1rem;text-align:center;background:#0d1524;border:1px solid rgb(255 255 255/.07)}
.facts b{display:block;font-size:clamp(1.6rem,3.5vw,2.2rem);letter-spacing:-.03em;background:linear-gradient(135deg,#fff,#99f6e4);-webkit-background-clip:text;background-clip:text;color:transparent}
.facts span{font-size:14px;color:rgb(232 237 247/.6)}

/* Kartu */
.card{position:relative;padding:1.6rem;border-radius:1.25rem;background:linear-gradient(180deg,#131c2d,#0d1423);border:1px solid rgb(255 255 255/.08);box-shadow:0 24px 60px -32px rgb(0 0 0/.8);overflow:hidden;transition:border-color .3s,transform .3s}
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(28rem 14rem at 0% 0%,rgb(20 179 169/.1),transparent 60%);pointer-events:none}
.card:hover{border-color:rgb(94 234 212/.3);transform:translateY(-3px)}
.card h3{margin:1rem 0 .35rem;font-size:1.12rem;letter-spacing:-.01em;color:#fff}
.card p{margin:0;font-size:.95rem;color:rgb(232 237 247/.66)}
.ficon{display:inline-grid;place-content:center;width:2.75rem;height:2.75rem;border-radius:.8rem;border:1px solid rgb(94 234 212/.25);background:rgb(20 179 169/.12);color:#5eead4}
.ficon.sm{width:2.4rem;height:2.4rem;border-radius:.7rem}

.bento{display:grid;gap:1rem}
@media (min-width:760px){.bento{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1040px){.bento{grid-template-columns:repeat(3,1fr)}.bento .wide{grid-column:span 2}}
.viz{margin-top:1.4rem}

.sessions{display:grid;gap:.95rem}
.srow{display:grid;grid-template-columns:5.5rem 1fr 4.2rem;align-items:center;gap:.8rem;font-size:13px}
.srow em{font-style:normal;color:rgb(232 237 247/.55);text-align:right}
.sbar{height:.55rem;border-radius:999px;background:rgb(255 255 255/.07);overflow:hidden}
.sbar i{display:block;width:var(--w);height:100%;border-radius:inherit;background:linear-gradient(90deg,#14b3a9,#5eead4);transform-origin:0 50%}
.js .sbar i{transform:scaleX(0);transition:transform 1.4s cubic-bezier(.16,1,.3,1) var(--d,0ms)}
.js .in .sbar i{transform:none}
.slegend{display:flex;align-items:center;gap:.5rem;margin-top:.5rem;padding-top:.9rem;border-top:1px solid rgb(255 255 255/.06);font-size:13px;color:rgb(232 237 247/.55)}
.snext{margin-left:auto;white-space:nowrap;padding:.15rem .6rem;border-radius:999px;background:rgb(20 179 169/.12);color:#5eead4;font-size:12px;font-weight:600}
.pulse-dot{position:relative;width:.5rem;height:.5rem;border-radius:50%;background:#34d399}
.pulse-dot{box-shadow:0 0 0 3px rgb(52 211 153/.18)}

.code{margin:1.3rem 0 0;padding:1rem 1.1rem;border-radius:.8rem;background:#060b16;border:1px solid rgb(255 255 255/.07);font-size:12.5px;line-height:1.6;color:#cbd5e1;overflow-x:auto}
.code .k{color:#a5b4fc}.code .s{color:#5eead4}.code .b{color:#fbbf24}.code .n{color:#f9a8d4}.code .p{color:#64748b}

.apps{display:grid;gap:.5rem;margin:1.3rem 0 0;padding:0;list-style:none}
.apps li{display:flex;align-items:center;gap:.7rem;padding:.55rem .7rem;border-radius:.7rem;background:rgb(255 255 255/.035);border:1px solid rgb(255 255 255/.06);font-size:13px}
.alogo{display:grid;place-content:center;width:1.9rem;height:1.9rem;border-radius:.5rem;background:linear-gradient(135deg,#1f3a52,#2a2f6b);font-weight:700;flex:none}
.aname{flex:1;min-width:0}.aname b{display:block;font-weight:600}.aname small{color:rgb(232 237 247/.5)}
.abadge{padding:.15rem .55rem;border-radius:999px;background:#10392d;color:#8be5b9;font-size:11.5px;font-weight:600;white-space:nowrap}

.cipher{display:grid;gap:.5rem}
.cline{display:flex;justify-content:space-between;gap:1rem;padding:.6rem .8rem;border-radius:.6rem;background:rgb(255 255 255/.04);font-size:12.5px;font-family:"Geist Mono Variable","Geist Mono",ui-monospace,monospace}
.cline span{color:rgb(232 237 247/.5)}.cline.enc b{color:#a5b4fc}
.carrow{display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:12px;font-weight:600;color:#5eead4}

.roles{display:grid;gap:.5rem}
.role{padding:.7rem .9rem;border-radius:.7rem;background:rgb(255 255 255/.04);border:1px solid rgb(255 255 255/.06)}
.role b{display:block;font-size:14px}.role span{font-size:12.5px;color:rgb(232 237 247/.55)}
.role.admin{border-color:rgb(165 180 252/.3);background:rgb(79 70 229/.1)}.role.admin b{color:#c7d2fe}

.logs{display:grid;gap:.45rem;margin:1.4rem 0 0;padding:0;list-style:none}
.logs li{display:grid;grid-template-columns:auto 8rem 1fr auto auto;align-items:center;gap:.8rem;padding:.6rem .8rem;border-radius:.7rem;background:rgb(255 255 255/.035);font-size:13px}
.ldot{width:.5rem;height:.5rem;border-radius:50%}.ldot.ok{background:#34d399}.ldot.err{background:#f5737d}
.lwho{color:rgb(232 237 247/.6);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lip{font-family:"Geist Mono Variable","Geist Mono",ui-monospace,monospace;color:#5eead4;font-size:12px}
.logs em{font-style:normal;color:rgb(232 237 247/.45);font-size:12px}
@media (max-width:560px){.logs li{grid-template-columns:auto 1fr auto}.lwho,.lip{display:none}}

.attempts{display:flex;align-items:center;gap:.45rem}
.attempts i{width:1.6rem;height:.5rem;border-radius:999px;background:#f5737d}
.js .attempts i{opacity:.15;transition:opacity .4s ease var(--d)}
.js .in .attempts i{opacity:1}
.attempts span{margin-left:auto;padding:.2rem .6rem;border-radius:999px;background:rgb(245 115 125/.12);color:#fca5a5;font:600 12.5px "Geist Mono Variable","Geist Mono",ui-monospace,monospace}

.minis{display:grid;gap:1rem;margin:1rem 0 0;padding:0;list-style:none}
@media (min-width:640px){.minis{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1040px){.minis{grid-template-columns:repeat(4,1fr)}}
.minis li{display:flex;gap:.85rem;align-items:flex-start;padding:1.1rem;border-radius:1rem;background:#0e1626;border:1px solid rgb(255 255 255/.07)}
.minis b{display:block;font-size:15px;color:#fff}.minis span{font-size:13.5px;color:rgb(232 237 247/.6)}

/* Halaman di dalam aplikasi */
.pages{display:grid;gap:1rem;margin:0;padding:0;list-style:none}
@media (min-width:640px){.pages{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1040px){.pages{grid-template-columns:repeat(5,1fr)}}
.pages li{padding:1.3rem}
.pages h3{margin-top:.9rem}

/* Langkah */
.steps{position:relative;display:grid;gap:1rem;margin:0;padding:0;list-style:none;counter-reset:s}
@media (min-width:760px){.steps{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1040px){.steps{grid-template-columns:repeat(4,1fr)}.steps::before{content:"";position:absolute;left:12%;right:12%;top:2.95rem;height:1px;background:linear-gradient(90deg,transparent,rgb(94 234 212/.45),rgb(165 180 252/.45),transparent)}}
.steps li{text-align:center}
.num{position:relative;display:inline-grid;place-content:center;width:2.9rem;height:2.9rem;border-radius:50%;font-weight:700;color:#fff;background:linear-gradient(135deg,#14b3a9,#4f46e5);box-shadow:0 0 0 6px #0b1222,0 10px 28px -8px rgb(20 179 169/.8)}

/* Keamanan */
.sec{display:grid;gap:2.5rem;align-items:center}
@media (min-width:900px){.sec{grid-template-columns:1.1fr 1fr}}
.sec h2,.sec .eyebrow,.sec .sub{text-align:left;margin-left:0}
.sec .sub{margin-bottom:1.6rem}
.checks{display:grid;gap:.8rem;margin:0;padding:0;list-style:none}
.checks li{display:flex;gap:.75rem;align-items:flex-start;color:rgb(232 237 247/.82)}
.checks svg{flex:none;margin-top:.2rem;padding:.2rem;width:1.3rem;height:1.3rem;border-radius:50%;background:rgb(20 179 169/.18);color:#5eead4}
.vault{position:relative;display:grid;place-items:center;aspect-ratio:1/1;max-width:26rem;width:100%;margin:0 auto;overflow:hidden;border-radius:50%;contain:paint}
.ring{position:absolute;inset:8px;border-radius:50%;border:1px dashed rgb(94 234 212/.22);animation:spin 90s linear infinite}
.ring.r2{inset:12%;border-style:solid;border-color:rgb(165 180 252/.16);animation:none}
.ring.r3{inset:24%;border-color:rgb(94 234 212/.15)}
@keyframes spin{to{transform:rotate(360deg)}}
.vault-core{position:relative;display:grid;place-content:center;justify-items:center;gap:.5rem;width:42%;aspect-ratio:1/1;border-radius:2rem;background:linear-gradient(145deg,#14b3a9,#3a4481);box-shadow:0 30px 80px -20px rgb(20 179 169/.6),inset 0 1px 0 rgb(255 255 255/.25);color:#fff;text-align:center}
.vault-core svg{width:38%;height:auto}
.vault-core b{font:600 12px "Geist Mono Variable","Geist Mono",ui-monospace,monospace;letter-spacing:.04em}

/* FAQ */
.faq{max-width:50rem;margin:0 auto;display:grid;gap:.75rem}
.faq details{border-radius:1rem;background:#0e1626;border:1px solid rgb(255 255 255/.08);transition:border-color .2s,background-color .2s}
.faq details[open]{background:#111b2e;border-color:rgb(94 234 212/.25)}
.faq summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem 1.35rem;cursor:pointer;font-weight:600;color:#fff;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"";flex:none;width:.55rem;height:.55rem;margin:-.2rem .2rem 0 0;border-right:2px solid #5eead4;border-bottom:2px solid #5eead4;transform:rotate(45deg);transition:transform .25s}
.faq details[open] summary::after{transform:rotate(-135deg);margin-top:.25rem}
.faq details p{margin:0;padding:0 1.35rem 1.2rem;color:rgb(232 237 247/.7)}

/* Penutup */
.final{position:relative;margin:6rem 0 0;padding:4rem 1.5rem;border-radius:1.75rem;text-align:center;overflow:hidden;background:linear-gradient(135deg,rgb(20 179 169/.22),rgb(79 70 229/.22));border:1px solid rgb(255 255 255/.1)}
.final::before{content:"";position:absolute;inset:0;background:radial-gradient(40rem 20rem at 50% 120%,rgb(94 234 212/.25),transparent 60%);pointer-events:none}
.final h2{position:relative}
.final p{position:relative;margin:1rem auto 2rem;max-width:34rem;color:rgb(232 237 247/.75)}
.final .cta{position:relative;margin:0}
.note{margin:2rem auto 0;max-width:42rem;text-align:center;font-size:14px;color:rgb(232 237 247/.5)}
footer{margin-top:4rem;border-top:1px solid rgb(255 255 255/.07)}
footer .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding-top:1.75rem;padding-bottom:2rem;font-size:13px;color:rgb(232 237 247/.5)}
footer nav{display:flex;flex-wrap:wrap;gap:1.2rem}
footer a{text-decoration:none}footer a:hover{color:#fff}

/* Animasi muncul: hanya opacity + transform (murah untuk GPU). Tanpa JS semua tampil. */
.js .reveal{opacity:0;transform:translate3d(0,22px,0);transition:opacity .8s ease var(--d,0ms),transform .8s cubic-bezier(.16,1,.3,1) var(--d,0ms)}
.js .reveal.in{opacity:1;transform:none}
.js .card.reveal.in:hover{transform:translateY(-3px);transition-delay:0ms}
.hero-in{animation:up .9s cubic-bezier(.16,1,.3,1) both}
.hero-in.d1{animation-delay:.08s}.hero-in.d2{animation-delay:.16s}.hero-in.d3{animation-delay:.24s}
@keyframes up{from{opacity:0;transform:translate3d(0,18px,0)}}

@media (max-width:640px){
  .hero{padding-top:2.5rem}
  .cta .btn{flex:1 1 100%}
  .final .cta .btn{flex:1 1 100%}
  section.block{padding-top:4.5rem}
  .aurora.a{width:38rem;height:26rem;left:-14rem;top:-10rem}
  .aurora.b{width:34rem;height:24rem;right:-14rem}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  html{scroll-behavior:auto}
}`;

const SCRIPT = `(function(){
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var els = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function (e) { e.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }
  var nav = document.querySelector(".nav"), ticking = false;
  function onScroll() { nav.classList.toggle("scrolled", window.scrollY > 8); ticking = false; }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
})();`;

// ---------- halaman ----------

export function renderLanding(base: string, fonts: LandingFonts = {}): string {
  const faqLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });
  const fontFace = (family: string, url?: string) =>
    url
      ? `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:100 900;src:url("${esc(url)}") format("woff2")}`
      : "";
  const preload = (url?: string) =>
    url ? `<link rel="preload" href="${esc(url)}" as="font" type="font/woff2" crossorigin />` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#070d1a" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <script>document.documentElement.classList.add("js")</script>
    ${headTags(base, "/")}
    ${jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: `${base}/` })}
    ${faqLd}
    ${preload(fonts.sans)}
    <style>${fontFace("Geist Variable", fonts.sans)}${fontFace("Geist Mono Variable", fonts.mono)}${CSS}</style>
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <div class="scene" aria-hidden="true">
      <div class="aurora a"></div><div class="aurora b"></div>
      <div class="grid"></div>
    </div>

    <header class="nav">
      <div class="wrap">
        <a class="brand" href="/" aria-label="${esc(NAME)} home">${logo("nv", 38)}<span><b>Cookie Scraping</b><small>Tools</small></span></a>
        <nav class="links" aria-label="Sections">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</nav>
        <a class="btn ghost sm" href="/login">${icon("login", 16)}Sign in</a>
      </div>
    </header>

    <main id="main">
      <section class="hero wrap">
        <h1 class="hero-in">Fresh session cookies, <span class="shine">ready to import.</span></h1>
        <p class="lead hero-in d1">${esc(DESCRIPTION)}</p>
        <div class="cta hero-in d2">
          <a class="btn primary" href="/login">Open the dashboard ${icon("arrow", 18)}</a>
          <a class="btn ghost" href="#features">Explore features</a>
        </div>
        <ul class="ticks hero-in d3">
          <li>${icon("check", 16)}Automatic re-login</li>
          <li>${icon("check", 16)}Cookie-Editor JSON</li>
          <li>${icon("check", 16)}AES-256-GCM encryption</li>
        </ul>

        <div class="preview reveal" id="preview">
          <div class="frame">
            <div class="chrome" aria-hidden="true"><i></i><i></i><i></i><span>Dashboard</span></div>
            <div class="mock" role="img" aria-label="Preview of the dashboard: account status cards, the accounts table with export buttons, and recent activity">${dashboardMock()}</div>
          </div>
          <div class="float toast" aria-hidden="true"><span class="fi">${icon("circleCheck", 16)}</span><div><b>Download started</b><span>cookie.json for Account 1</span></div></div>
          <div class="float chip" aria-hidden="true"><span class="fi">${icon("refresh", 16)}</span><div><b>Session refreshed</b><span>Account 2 · 61 days left</span></div></div>
        </div>

        <ul class="facts">
          ${FACTS.map(([v, l], i) => `<li class="reveal" style="--d:${i * 80}ms"><b>${esc(v)}</b><span>${esc(l)}</span></li>`).join("")}
        </ul>
      </section>

      <section class="block wrap" id="features" aria-labelledby="features-h">
        <span class="eyebrow reveal">Features</span>
        <h2 id="features-h" class="reveal">Everything you need to keep cookies fresh</h2>
        <p class="sub reveal">The worker does the tedious part in the background. You open the dashboard and download.</p>
        ${features()}
      </section>

      <section class="block wrap" aria-labelledby="pages-h">
        <span class="eyebrow reveal">Inside the app</span>
        <h2 id="pages-h" class="reveal">Five pages, zero clutter</h2>
        <p class="sub reveal">Each page does one job well, on desktop and on your phone.</p>
        <ul class="pages">
          ${PAGES.map(
            ([ic, t, d], i) =>
              `<li class="card reveal" style="--d:${i * 70}ms"><span class="ficon">${icon(ic)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`,
          ).join("")}
        </ul>
      </section>

      <section class="block wrap" id="how" aria-labelledby="how-h">
        <span class="eyebrow reveal">How it works</span>
        <h2 id="how-h" class="reveal">From account to browser in four steps</h2>
        <p class="sub reveal">Set up once. After that, fresh cookies are always one click away.</p>
        <ol class="steps">
          ${STEPS.map(
            ([t, d], i) =>
              `<li class="card reveal" style="--d:${i * 90}ms"><span class="num">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`,
          ).join("")}
        </ol>
      </section>

      <section class="block wrap" id="security" aria-labelledby="security-h">
        <div class="sec">
          <div>
            <span class="eyebrow reveal">Security</span>
            <h2 id="security-h" class="reveal">Built to protect every session</h2>
            <p class="sub reveal">Session cookies are as sensitive as passwords, so they are treated that way.</p>
            <ul class="checks">
              ${SECURITY.map((s, i) => `<li class="reveal" style="--d:${i * 60}ms">${icon("check", 14)}<span>${esc(s)}</span></li>`).join("")}
            </ul>
          </div>
          <div class="vault reveal" aria-hidden="true">
            <div class="ring"></div>
            <div class="ring r2"></div>
            <div class="ring r3"></div>
            <div class="vault-core">${icon("shield", 64)}<b>AES-256-GCM</b></div>
          </div>
        </div>
      </section>

      <section class="block wrap" id="faq" aria-labelledby="faq-h">
        <span class="eyebrow reveal">FAQ</span>
        <h2 id="faq-h" class="reveal">Questions and answers</h2>
        <p class="sub reveal">Short answers to what people ask most.</p>
        <div class="faq">
          ${FAQ.map(
            ([q, a], i) =>
              `<details class="reveal" style="--d:${Math.min(i, 5) * 50}ms"${i === 0 ? " open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`,
          ).join("")}
        </div>
      </section>

      <section class="wrap">
        <div class="final reveal">
          <h2>Ready for fresh cookies?</h2>
          <p>Sign in with the account your administrator gave you and download your first cookie.json in seconds.</p>
          <div class="cta">
            <a class="btn primary" href="/login">Sign in ${icon("arrow", 18)}</a>
            <a class="btn ghost" href="#how">See how it works</a>
          </div>
        </div>
        <p class="note">Use it only with accounts you are allowed to use, and follow the terms of service of the provider.</p>
      </section>
    </main>

    <footer>
      <div class="wrap">
        <a class="brand" href="/" aria-label="${esc(NAME)} home">${logo("ft", 30)}<span><b>Cookie Scraping</b><small>Tools</small></span></a>
        <nav aria-label="Footer">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}<a href="/login">Sign in</a></nav>
        <span>© ${new Date().getFullYear()} ${esc(NAME)}</span>
      </div>
    </footer>
    <script>${SCRIPT}</script>
  </body>
</html>
`;
}

