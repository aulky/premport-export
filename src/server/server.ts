import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertServerConfig, config } from "./config.js";
import { makeSession, safeEqual, verifySession } from "./crypto.js";
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

app.addHook("onRequest", async (req, reply) => {
  // Cek pola rute yang BENAR-BENAR dicocokkan router, bukan req.url mentah: router
  // men-decode URL, jadi "/%61pi/accounts" tetap masuk ke "/api/accounts".
  const route = req.routeOptions.url;
  if (!route?.startsWith("/api/") || route === "/api/login") return;
  const token = req.cookies[COOKIE_NAME];
  if (!verifySession(token)) {
    reply.code(401).send({ error: "Belum login" });
  }
});

app.post<{ Body: { password: string } }>("/api/login", async (req, reply) => {
  const { password } = req.body ?? ({} as { password: string });
  if (typeof password !== "string" || !safeEqual(password, config.adminPassword)) {
    logAccess(req, "login", { ok: false, message: "Password salah" });
    reply.code(401);
    return { error: "Password salah" };
  }
  logAccess(req, "login", { ok: true });
  const token = makeSession(config.sessionTtlSec);
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    path: "/",
    maxAge: config.sessionTtlSec,
  });
  return { ok: true };
});

app.post("/api/logout", async (req, reply) => {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
  logAccess(req, "logout", { ok: true });
  return { ok: true };
});

app.get("/api/accounts", async () => {
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

app.get<{ Params: { id: string } }>("/api/accounts/:id", async (req, reply) => {
  const accounts = listAccounts();
  const idx = accounts.findIndex((a) => a.id === req.params.id);
  if (idx === -1) {
    reply.code(404);
    return { error: "Akun tidak ditemukan" };
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
app.get<{ Params: { id: string } }>("/api/accounts/:id/apps", async (req) => {
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
app.get<{ Params: { id: string; appId: string } }>("/api/accounts/:id/apps/:appId/items", async (req) => {
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
    return { error: "Akun ini sedang di-refresh, tunggu sebentar." };
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
      results.push({ id: a.id, ok: false, error: "sedang direfresh" });
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
app.post<{ Params: { id: string; itemId: string } }>("/api/accounts/:id/items/:itemId/fetch", async (req, reply) => {
  const { id: accountId, itemId } = req.params;
  const t0 = Date.now();
  const item = getPortalItem(accountId, itemId);
  const itemLabel = item?.item_name ?? itemId;
  const logGet = (ok: boolean, message?: string, cookieCount?: number) =>
    logAccess(req, "cookie-get", { ok, accountId, itemId, message, cookieCount });
  if (!item) {
    logGet(false, "Item tidak ditemukan");
    reply.code(404);
    return { error: "Item tidak ditemukan. Coba refresh katalog app dulu." };
  }
  const portalCookies = latestCookies(accountId);
  const accessToken = portalCookies?.find((c) => c.name === "accessToken")?.value;
  if (!accessToken) {
    logRun(accountId, "item-fetch", false, `${itemLabel}: belum ada sesi login yang valid`, Date.now() - t0);
    logGet(false, "Belum ada sesi login yang valid");
    reply.code(409);
    return { error: "Belum ada sesi login yang valid untuk akun ini. Tunggu worker login dulu." };
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
  logRun(accountId, "item-fetch", true, `${itemLabel}: user mengambil ${res.cookies.length} cookie`, Date.now() - t0);
  logGet(true, undefined, res.cookies.length);
  return { ok: true, cookieCount: res.cookies.length };
});

/** Export format Cookie-Editor JSON untuk 1 item/app tujuan, siap import ke ekstensi. */
app.get<{ Params: { id: string; itemId: string } }>("/api/accounts/:id/items/:itemId/cookies.json", async (req, reply) => {
  const cookies = latestItemCookies(req.params.id, req.params.itemId);
  if (!cookies) {
    reply.code(404);
    return { error: "Belum ada cookie untuk item ini. Klik 'Get' dulu di dashboard." };
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
    return { error: "Belum ada snapshot cookie untuk akun ini" };
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

app.setNotFoundHandler((req, reply) => {
  if (req.raw.url?.startsWith("/api/")) {
    reply.code(404).send({ error: "Not found" });
    return;
  }
  reply.sendFile("index.html");
});

app
  .listen({ port: config.port, host: config.host })
  .then(() => app.log.info(`cookie-vault web listening on ${config.host}:${config.port}`))
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
