import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";
import { db, now } from "./db.js";

/** Riwayat akses dashboard: siapa (akun, IP, perangkat) login dan mengambil cookie apa. */

const AUTH_EVENTS = ["login", "logout"] as const;
const COOKIE_EVENTS = ["cookie-get", "cookie-download", "session-download"] as const;
export type AccessType = "auth" | "cookie";
export type AccessEvent = (typeof AUTH_EVENTS)[number] | (typeof COOKIE_EVENTS)[number];

/** Batas baris per jenis. Dipisah supaya banjir login gagal tidak menghapus riwayat cookie. */
export const KEEP_ACCESS_LOGS = 10_000;

export interface AccessEntry {
  ok: boolean;
  /** Hanya untuk login/logout tanpa req.user (mis. login gagal). */
  username?: string;
  accountId?: string;
  itemId?: string;
  cookieCount?: number;
  message?: string;
}

export interface AccessLogRow {
  id: number;
  at: number;
  event: AccessEvent;
  ok: number;
  ip: string;
  user_agent: string | null;
  username: string | null;
  account_id: string | null;
  account_label: string | null;
  app_name: string | null;
  item_id: string | null;
  item_name: string | null;
  cookie_count: number | null;
  message: string | null;
}

const eventsOf = (type: AccessType) => (type === "auth" ? AUTH_EVENTS : COOKIE_EVENTS);
const placeholders = (list: readonly string[]) => list.map(() => "?").join(",");

export function logAccess(req: FastifyRequest, event: AccessEvent, entry: AccessEntry) {
  const { accountId, itemId } = entry;
  // Nama akun/app/item disalin ke baris log, supaya riwayat tetap terbaca
  // walaupun katalog berubah atau akun dihapus dari .env.
  const account = accountId
    ? (db.prepare("SELECT label FROM accounts WHERE id=?").get(accountId) as { label: string } | undefined)
    : undefined;
  const item =
    accountId && itemId
      ? (db
          .prepare(
            `SELECT i.item_name, a.name AS app_name FROM portal_items i
             LEFT JOIN portal_apps a ON a.account_id=i.account_id AND a.app_id=i.app_id
             WHERE i.account_id=? AND i.item_id=?`,
          )
          .get(accountId, itemId) as { item_name: string | null; app_name: string | null } | undefined)
      : undefined;

  db.prepare(
    `INSERT INTO access_logs(at, event, ok, ip, user_agent, username, account_id, account_label, app_name, item_id, item_name, cookie_count, message)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    now(),
    event,
    entry.ok ? 1 : 0,
    req.ip.replace(/^::ffff:/, ""),
    req.headers["user-agent"]?.slice(0, 300) ?? null,
    (entry.username ?? req.user?.username)?.slice(0, 64) || null,
    accountId?.slice(0, 100) ?? null,
    account?.label ?? null,
    item?.app_name ?? null,
    itemId?.slice(0, 200) ?? null,
    item?.item_name ?? null,
    entry.cookieCount ?? null,
    entry.message?.slice(0, 500) ?? null,
  );

  const group = eventsOf((AUTH_EVENTS as readonly string[]).includes(event) ? "auth" : "cookie");
  const inGroup = placeholders(group);
  db.prepare(
    `DELETE FROM access_logs WHERE event IN (${inGroup}) AND id <=
     (SELECT id FROM access_logs WHERE event IN (${inGroup}) ORDER BY id DESC LIMIT 1 OFFSET ?)`,
  ).run(...group, ...group, KEEP_ACCESS_LOGS);
}

export const ACCESS_PAGE_SIZE = 10;

/** Satu halaman, terbaru dulu. IP lengkap dicocokkan persis, potongan IP dicocokkan sebagian. */
export function listAccessLogs(type: AccessType, page: number, ip = ""): { rows: AccessLogRow[]; total: number } {
  const events = eventsOf(type);
  const params: string[] = [...events];
  let where = `event IN (${placeholders(events)})`;
  if (ip) {
    where += isIP(ip) ? " AND ip = ?" : " AND instr(ip, ?) > 0";
    params.push(ip);
  }
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM access_logs WHERE ${where}`).get(...params) as { total: number };
  const rows = db
    .prepare(`SELECT * FROM access_logs WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, ACCESS_PAGE_SIZE, (page - 1) * ACCESS_PAGE_SIZE) as AccessLogRow[];
  return { rows, total };
}
