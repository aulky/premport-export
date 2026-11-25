import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertServerConfig, config } from "./config.js";
import { makeSession, verifySession } from "./crypto.js";
import {
  authenticate,
  createUser,
  deleteUser,
  listUsers,
  normalizeUsername,
  passwordProblem,
  principalFor,
  setPassword,
  usernameProblem,
  type Principal,
} from "./users.js";
import {
  listAccounts,
  listPortalApps,
  listPortalItems,
  getPortalItem,
  markItemFetch,
  saveItemCookies,
  latestItemCookies,
  latestCookies,
  recentRuns,
  syncAccountsFromEnv,
} from "./accounts.js";
import { fetchItemCookiesLive } from "./portal.js";
import { refreshAccount } from "./refresh.js";
import { logRun } from "./db.js";
import { KEEP_ACCESS_LOGS, listAccessLogs, logAccess } from "./access.js";
import { refundAttempt, takeAttempt } from "./ratelimit.js";
import { renderAbout, renderIndex, renderLlms, renderRobots, renderSitemap, siteUrl } from "./seo.js";

declare module "fastify" {
  interface FastifyRequest {
    user: Principal | null;
  }
  interface FastifyContextConfig {
    /** Tanpa nilai ini sebuah rute /api HANYA untuk admin. */
    access?: "public" | "user";
  }
}

assertServerConfig();
syncAccountsFromEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDist = join(__dirname, "../../web/dist");

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  trustProxy: config.trustProxy || false,
});

await app.register(fastifyCookie);
// wildcard:true (default) -- melayani file di web/dist per-request (bukan daftar
// rute statis yang di-scan sekali saat startup), supaya build UI baru (hash file
// berubah) langsung kebaca tanpa perlu restart proses web.
await app.register(fastifyStatic, { root: uiDist });

const COOKIE_NAME = "cv_session";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Rute yang juga boleh diakses role "user": melihat data dan mengambil cookie. */
const USER = { config: { access: "user" as const } };

app.decorateRequest("user", null);

app.addHook("onRequest", async (req, reply) => {
  // Cek pola rute yang BENAR-BENAR dicocokkan router, bukan req.url mentah: router
  // men-decode URL, jadi "/%61pi/accounts" tetap masuk ke "/api/accounts".
  if (!req.routeOptions.url?.startsWith("/api/")) return;
  const { access } = req.routeOptions.config;
  if (access === "public") return;
  req.user = principalFor(verifySession(req.cookies[COOKIE_NAME]));
  if (!req.user) return reply.code(401).send({ error: "Not signed in" });
  if (access !== "user" && req.user.role !== "admin") return reply.code(403).send({ error: "Admin access required" });
});

app.post<{ Body: { username?: unknown; password?: unknown } }>("/api/login", { config: { access: "public" } }, async (req, reply) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const { retryAfterSec, firstBlock } = takeAttempt(req.ip);
  if (retryAfterSec) {
    const message = `Too many failed attempts. Try again in ${plural(Math.ceil(retryAfterSec / 60), "minute")}.`;
    if (firstBlock) logAccess(req, "login", { ok: false, username, message: "Blocked: too many failed attempts" });
    reply.code(429).header("Retry-After", retryAfterSec);
    return { error: message };
  }
  const user = username && typeof password === "string" ? await authenticate(username, password) : null;
  if (!user) {
    logAccess(req, "login", { ok: false, username, message: "Wrong username or password" });
    reply.code(401);
    return { error: "Wrong username or password" };
  }
  refundAttempt(req.ip);
  logAccess(req, "login", { ok: true, username: user.username });
  const token = makeSession(user, config.sessionTtlSec);
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    path: "/",
    maxAge: config.sessionTtlSec,
  });
  return { username: user.username, role: user.role };
});

app.get("/api/me", USER, async (req) => ({ username: req.user!.username, role: req.user!.role }));

// ---------- manajemen user (khusus admin) ----------

app.get("/api/users", async () => listUsers());

app.post<{ Body: { username?: unknown; password?: unknown } }>("/api/users", async (req, reply) => {
  const username = normalizeUsername(req.body?.username);
  const problem = usernameProblem(username) ?? passwordProblem(req.body?.password);
  if (problem) {
    reply.code(400);
    return { error: problem };
  }
  if (!(await createUser(username, req.body.password as string))) {
    reply.code(409);
    return { error: "Username already exists" };
  }
  reply.code(201);
  return { ok: true };
});

app.put<{ Params: { id: string }; Body: { password?: unknown } }>("/api/users/:id/password", async (req, reply) => {
  const problem = passwordProblem(req.body?.password);
  if (problem) {
    reply.code(400);
    return { error: problem };
  }
  if (!(await setPassword(Number(req.params.id), req.body.password as string))) {
    reply.code(404);
    return { error: "User not found" };
  }
  return { ok: true };
});

app.delete<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
  if (!deleteUser(Number(req.params.id))) {
    reply.code(404);
    return { error: "User not found" };
  }
  return { ok: true };
});

app.post("/api/logout", USER, async (req, reply) => {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
  logAccess(req, "logout", { ok: true });
  return { ok: true };
});

app.get("/api/accounts", USER, async () => {
  const accounts = listAccounts();
  return accounts.map((a, i) => ({
    id: a.id,
    label: a.label,
    email: a.email,
    status: a.status,
    lastCheckedAt: a.last_checked_at,
    lastRefreshedAt: a.last_refreshed_at,
    expiresAt: a.expires_at,
    lastError: a.last_error,
    appCount: listPortalApps(a.id).length,
    isPrimary: i === 0,
  }));
});

app.get<{ Params: { id: string } }>("/api/accounts/:id", USER, async (req, reply) => {
  const accounts = listAccounts();
  const idx = accounts.findIndex((a) => a.id === req.params.id);
  if (idx === -1) {
    reply.code(404);
    return { error: "Account not found" };
  }
  const a = accounts[idx]!;
  return {
    id: a.id,
    label: a.label,
    email: a.email,
    status: a.status,
    lastCheckedAt: a.last_checked_at,
    lastRefreshedAt: a.last_refreshed_at,
    expiresAt: a.expires_at,
    lastError: a.last_error,
    appCount: listPortalApps(a.id).length,
    isPrimary: idx === 0,
  };
});

/** Katalog app (Netflix, Canva, dst). Disinkron otomatis oleh worker, murni metadata. */
app.get<{ Params: { id: string } }>("/api/accounts/:id/apps", USER, async (req) => {
  const apps = listPortalApps(req.params.id);
  return apps.map((a) => ({
    appId: a.app_id,
    name: a.name,
    category: a.category,
    targetType: a.target_type,
    logo: a.logo,
    url: a.url,
    note: a.note,
    isDesktopOnly: !!a.is_desktop_only,
    itemCount: listPortalItems(req.params.id, a.app_id).length,
  }));
});

/** Item/slot akun di dalam 1 app. */
app.get<{ Params: { id: string; appId: string } }>("/api/accounts/:id/apps/:appId/items", USER, async (req) => {
  return listPortalItems(req.params.id, req.params.appId).map((it) => ({
    itemId: it.item_id,
    itemName: it.item_name,
    url: it.url,
    lastFetchedAt: it.last_fetched_at,
    lastCookieCount: it.last_cookie_count,
    lastError: it.last_error,
  }));
});

const refreshing = new Set<string>();

/** Trigger login ulang manual untuk 1 akun (tombol "Refresh" di dashboard). */
app.post<{ Params: { id: string } }>("/api/accounts/:id/refresh", async (req, reply) => {
  const { id } = req.params;
  if (refreshing.has(id)) {
    reply.code(409);
    return { error: "This account is already being refreshed, please wait." };
  }
  refreshing.add(id);
  try {
    const res = await refreshAccount(id, "manual");
    if (!res.ok) {
      reply.code(502);
      return { error: res.error };
    }
    return { ok: true, cookieCount: res.cookieCount };
  } finally {
    refreshing.delete(id);
  }
});

/**
 * Trigger login ulang untuk SEMUA akun aktif, satu per satu (bukan paralel,
 * supaya tidak membebani backend sekaligus). Akun pertama (primary) tetap
 * dicoba walau akun lain gagal -- kegagalan 1 akun tidak menghentikan yang lain.
 */
app.post("/api/accounts/refresh-all", async () => {
  const accounts = listAccounts();
  const results: { id: string; ok: boolean; error?: string; cookieCount?: number }[] = [];
  for (const a of accounts) {
    if (refreshing.has(a.id)) {
      results.push({ id: a.id, ok: false, error: "already refreshing" });
      continue;
    }
    refreshing.add(a.id);
    try {
      const res = await refreshAccount(a.id, "manual");
      results.push({ id: a.id, ...res });
    } finally {
      refreshing.delete(a.id);
    }
  }
  return { results };
});

/**
 * Ambil cookie untuk 1 item -- SELALU manual (dipicu tombol "Get" di
 * dashboard), tidak pernah otomatis. Beberapa app (mis. Netflix) punya limit
 * harian di sisi portal untuk klaim item baru; endpoint ini hanya dipanggil
 * sekali per klik pengguna.
 */
app.post<{ Params: { id: string; itemId: string } }>("/api/accounts/:id/items/:itemId/fetch", USER, async (req, reply) => {
  const { id: accountId, itemId } = req.params;
  const t0 = Date.now();
  const item = getPortalItem(accountId, itemId);
  const itemLabel = item?.item_name ?? itemId;
  const logGet = (ok: boolean, message?: string, cookieCount?: number) =>
    logAccess(req, "cookie-get", { ok, accountId, itemId, message, cookieCount });
  if (!item) {
    logGet(false, "Item not found");
    reply.code(404);
    return { error: "Item not found. Refresh the app catalog first." };
  }
  const portalCookies = latestCookies(accountId);
  const accessToken = portalCookies?.find((c) => c.name === "accessToken")?.value;
  if (!accessToken) {
    logRun(accountId, "item-fetch", false, `${itemLabel}: no valid login session yet`, Date.now() - t0);
    logGet(false, "No valid login session yet");
    reply.code(409);
    return { error: "No valid login session for this account yet. Wait for the worker to sign in." };
  }
  const res = await fetchItemCookiesLive(accessToken, itemId);
  if (!res.ok) {
    markItemFetch(accountId, itemId, { error: res.error });
    logRun(accountId, "item-fetch", false, `${itemLabel}: ${res.error}`, Date.now() - t0);
    logGet(false, res.error);
    reply.code(502);
    return { error: res.error };
  }
  saveItemCookies(accountId, itemId, res.cookies);
  markItemFetch(accountId, itemId, { cookieCount: res.cookies.length, error: null });
  logRun(accountId, "item-fetch", true, `${itemLabel}: user fetched ${res.cookies.length} cookies`, Date.now() - t0);
  logGet(true, undefined, res.cookies.length);
  return { ok: true, cookieCount: res.cookies.length };
});

/** Export format Cookie-Editor JSON untuk 1 item/app tujuan, siap import ke ekstensi. */
app.get<{ Params: { id: string; itemId: string } }>("/api/accounts/:id/items/:itemId/cookies.json", USER, async (req, reply) => {
  const cookies = latestItemCookies(req.params.id, req.params.itemId);
  if (!cookies) {
    reply.code(404);
    return { error: "No cookies for this item yet. Click 'Get' in the dashboard first." };
  }
  if (req.method !== "HEAD") {
    logAccess(req, "cookie-download", { ok: true, accountId: req.params.id, itemId: req.params.itemId, cookieCount: cookies.length });
  }
  reply.header("Content-Disposition", `attachment; filename="${req.params.itemId}-cookies.json"`);
  return cookies;
});

/** Export cookie sesi premiumportal.id sendiri (accessToken/refreshToken). */
app.get<{ Params: { id: string } }>("/api/accounts/:id/cookies.json", async (req, reply) => {
  const cookies = latestCookies(req.params.id);
  if (!cookies) {
    reply.code(404);
    return { error: "No cookie snapshot for this account yet" };
  }
  if (req.method !== "HEAD") {
    logAccess(req, "session-download", { ok: true, accountId: req.params.id, cookieCount: cookies.length });
  }
  reply.header("Content-Disposition", `attachment; filename="${req.params.id}-cookies.json"`);
  return cookies;
});

app.get("/api/runs", async (req) => {
  const limit = Number((req.query as { limit?: string }).limit) || 50;
  return recentRuns(Math.min(limit, 1000));
});

/** Riwayat akses: type=auth (login/logout) atau type=cookie (ambil/unduh cookie). */
app.get("/api/access-logs", async (req) => {
  const q = req.query as { type?: string; page?: string; ip?: string };
  const page = Math.min(Math.max(Math.floor(Number(q.page)) || 1, 1), KEEP_ACCESS_LOGS);
  return listAccessLogs(q.type === "cookie" ? "cookie" : "auth", page, typeof q.ip === "string" ? q.ip.trim() : "");
});

// ---------- halaman publik & SEO ----------

/** index.html dibaca per request, supaya build UI baru langsung terpakai. */
async function sendIndex(req: FastifyRequest, reply: FastifyReply, path: string | null) {
  const html = await readFile(join(uiDist, "index.html"), "utf8");
  return reply
    .type("text/html; charset=utf-8")
    .header("Cache-Control", "no-cache")
    .send(renderIndex(html, siteUrl(req), path));
}

app.get("/", (req, reply) => sendIndex(req, reply, "/"));
app.get("/index.html", (req, reply) => sendIndex(req, reply, "/"));

const publicPages = [
  ["/about", "text/html; charset=utf-8", renderAbout],
  ["/robots.txt", "text/plain; charset=utf-8", renderRobots],
  ["/sitemap.xml", "application/xml; charset=utf-8", renderSitemap],
  ["/llms.txt", "text/plain; charset=utf-8", renderLlms],
] as const;
for (const [url, type, render] of publicPages) {
  app.get(url, async (req, reply) => reply.type(type).send(render(siteUrl(req))));
}

app.setNotFoundHandler((req, reply) => {
  if (req.raw.url?.startsWith("/api/")) {
    reply.code(404).send({ error: "Not found" });
    return;
  }
  // Nama file yang tidak ada (gambar, skrip, dsb) harus 404, bukan halaman aplikasi.
  if (/\.[a-z0-9]{1,8}$/i.test(req.url.split("?")[0]!)) {
    reply.code(404).type("text/plain").send("Not found");
    return;
  }
  // Halaman dalam aplikasi (/logs, /users, dst): jangan diindeks.
  return sendIndex(req, reply, null);
});

app
  .listen({ port: config.port, host: config.host })
  .then(() => app.log.info(`cookie-vault web listening on ${config.host}:${config.port}`))
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
