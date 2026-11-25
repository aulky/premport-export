import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";

const path = resolve(config.dbPath);
mkdirSync(dirname(path), { recursive: true });

export const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  email TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at INTEGER,
  last_refreshed_at INTEGER,
  expires_at INTEGER,
  last_error TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  cookies_enc TEXT NOT NULL,
  cookie_count INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_snap_acc ON snapshots(account_id, id DESC);

-- Katalog app (Netflix, Canva, dst.) dari GET /extensions/init/full.
-- Aman disinkron otomatis -- hanya metadata, tidak menyentuh kuota per-app.
CREATE TABLE IF NOT EXISTS portal_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  target_type TEXT,
  logo TEXT,
  url TEXT,
  note TEXT,
  is_desktop_only INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  last_synced_at INTEGER NOT NULL,
  UNIQUE(account_id, app_id)
);

-- Item/slot akun per app (mis. "Netflix 5", "Netflix 6", ...).
CREATE TABLE IF NOT EXISTS portal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_synced_at INTEGER NOT NULL,
  last_fetched_at INTEGER,
  last_cookie_count INTEGER,
  last_error TEXT,
  UNIQUE(account_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_items_app ON portal_items(account_id, app_id);

-- Hasil fetch cookie per item -- HANYA terisi lewat aksi manual "Get" di
-- dashboard (lihat accounts.ts/server.ts), tidak pernah lewat worker otomatis,
-- supaya tidak melanggar limit harian per-app (mis. Netflix 10x/24 jam).
CREATE TABLE IF NOT EXISTS item_cookie_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cookies_enc TEXT NOT NULL,
  cookie_count INTEGER NOT NULL,
  captured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_cookie ON item_cookie_snapshots(account_id, item_id, id DESC);

-- Kredensial (username/password) untuk item app bertipe "autofill" (mis.
-- MediaFire, QuillBot, Bloomberg) -- app ini membagikan akun lewat
-- username/password, bukan cookie. HANYA terisi lewat aksi manual
-- "Get"/"Refresh" di dashboard, sama seperti item_cookie_snapshots. Hanya
-- baris TERBARU yang disimpan (bukan histori) supaya password lama tidak
-- menumpuk di database.
CREATE TABLE IF NOT EXISTS item_creds_snapshots (
  account_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  creds_enc TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, item_id)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ok INTEGER NOT NULL,
  message TEXT,
  duration_ms INTEGER,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_at ON runs(at DESC);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);

-- Riwayat akses dashboard (lihat access.ts).
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  event TEXT NOT NULL,
  ok INTEGER NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT,
  account_id TEXT,
  account_label TEXT,
  app_name TEXT,
  item_id TEXT,
  item_name TEXT,
  cookie_count INTEGER,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_event ON access_logs(event, id DESC);

-- Akun dashboard dengan role "user" (admin berasal dari .env, lihat users.ts).
-- AUTOINCREMENT: id user yang dihapus tidak dipakai ulang oleh sesi lama.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  -- Naik setiap kali user ini login, atau saat admin memaksa sign-out (lihat
  -- users.ts). Nilainya ditanam di dalam token sesi: begitu versi di sini naik,
  -- SEMUA token lama (termasuk yang masih "valid" secara tanda tangan & belum
  -- kedaluwarsa) langsung ditolak -- login baru otomatis membatalkan sesi lama.
  session_version INTEGER NOT NULL DEFAULT 0,
  -- Masa berlaku sesi KHUSUS user ini (detik), dibuat admin per-user (lihat
  -- /api/users/:id/session di server.ts). NULL = pakai nilai default global
  -- (settings.ts / "Session security" di halaman Users).
  session_ttl_sec INTEGER
);
`);

// Kolom tambahan untuk database buatan versi sebelumnya. IMMEDIATE karena web dan
// worker bisa start bersamaan.
db.transaction(() => {
  const accessLogCols = db.pragma("table_info(access_logs)") as { name: string }[];
  if (!accessLogCols.some((c) => c.name === "username")) db.exec("ALTER TABLE access_logs ADD COLUMN username TEXT");
  const itemCols = db.pragma("table_info(portal_items)") as { name: string }[];
  if (!itemCols.some((c) => c.name === "last_creds_fetched_at")) db.exec("ALTER TABLE portal_items ADD COLUMN last_creds_fetched_at INTEGER");
  if (!itemCols.some((c) => c.name === "last_creds_error")) db.exec("ALTER TABLE portal_items ADD COLUMN last_creds_error TEXT");
  const userCols = db.pragma("table_info(users)") as { name: string }[];
  if (!userCols.some((c) => c.name === "session_version")) db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0");
  if (!userCols.some((c) => c.name === "session_ttl_sec")) db.exec("ALTER TABLE users ADD COLUMN session_ttl_sec INTEGER");
}).immediate();

export const now = () => Math.floor(Date.now() / 1000);

export function setKv(key: string, value: string) {
  db.prepare("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
export function getKv(key: string): string | undefined {
  return (db.prepare("SELECT value FROM kv WHERE key=?").get(key) as { value: string } | undefined)?.value;
}

export type RunKind = "check" | "login" | "apps-sync" | "item-fetch";

export function logRun(accountId: string, kind: RunKind, ok: boolean, message: string, durationMs: number) {
  db.prepare("INSERT INTO runs(account_id,kind,ok,message,duration_ms,at) VALUES(?,?,?,?,?,?)").run(
    accountId,
    kind,
    ok ? 1 : 0,
    message.slice(0, 500),
    durationMs,
    now(),
  );
  db.prepare("DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY id DESC LIMIT 1000)").run();
}
