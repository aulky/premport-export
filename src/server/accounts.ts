import { config, type AccountConfig } from "./config.js";
import { db, now } from "./db.js";
import { decrypt, encrypt } from "./crypto.js";
import type { EditorCookie } from "./cookies.js";

export interface AccountRow {
  id: string;
  label: string;
  email: string;
  active: number;
  status: "unknown" | "valid" | "expired" | "refreshing" | "error";
  last_checked_at: number | null;
  last_refreshed_at: number | null;
  expires_at: number | null;
  last_error: string | null;
  fail_count: number;
  next_attempt_at: number;
}

/** Sinkronkan daftar akun dari .env ke tabel accounts (upsert, non-destructive). */
export function syncAccountsFromEnv() {
  const seen = new Set<string>();
  const upsert = db.prepare(`
    INSERT INTO accounts(id, label, email, active)
    VALUES (@id, @label, @email, 1)
    ON CONFLICT(id) DO UPDATE SET label=excluded.label, email=excluded.email, active=1
  `);
  const tx = db.transaction((accs: AccountConfig[]) => {
    for (const a of accs) {
      upsert.run(a);
      seen.add(a.id);
    }
    // akun yang sudah dihapus dari .env dinonaktifkan, bukan dihapus (snapshot historis tetap ada)
    const rows = db.prepare("SELECT id FROM accounts").all() as { id: string }[];
    for (const r of rows) {
      if (!seen.has(r.id)) db.prepare("UPDATE accounts SET active=0 WHERE id=?").run(r.id);
    }
  });
  tx(config.accounts);
}

export function credentialsFor(id: string): { email: string; password: string } | null {
  const a = config.accounts.find((x) => x.id === id);
  return a ? { email: a.email, password: a.password } : null;
}

/** Diurutkan sesuai nomor ACCOUNT_N di .env (akun 1 = primary), bukan alfabetis. */
export function listAccounts(): AccountRow[] {
  return db
    .prepare("SELECT * FROM accounts WHERE active=1 ORDER BY CAST(SUBSTR(id, 5) AS INTEGER)")
    .all() as AccountRow[];
}

export function getAccount(id: string): AccountRow | undefined {
  return db.prepare("SELECT * FROM accounts WHERE id=?").get(id) as AccountRow | undefined;
}

export function markStatus(
  id: string,
  patch: Partial<Pick<AccountRow, "status" | "last_error" | "expires_at" | "fail_count" | "next_attempt_at">>,
  touch: "checked" | "refreshed" | "none" = "none",
) {
  const fields: string[] = [];
  const vals: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k}=@${k}`);
    vals[k] = v;
  }
  if (touch === "checked") {
    fields.push("last_checked_at=@t");
    vals.t = now();
  }
  if (touch === "refreshed") {
    fields.push("last_checked_at=@t", "last_refreshed_at=@t");
    vals.t = now();
  }
  if (!fields.length) return;
  db.prepare(`UPDATE accounts SET ${fields.join(", ")} WHERE id=@id`).run(vals);
}

export function saveSnapshot(accountId: string, cookies: EditorCookie[], expiresAt: number | null) {
  db.prepare(
    "INSERT INTO snapshots(account_id, cookies_enc, cookie_count, captured_at, expires_at) VALUES (?,?,?,?,?)",
  ).run(accountId, encrypt(JSON.stringify(cookies)), cookies.length, now(), expiresAt);
  const keep = config.worker.keepSnapshots;
  db.prepare(
    `DELETE FROM snapshots WHERE account_id=? AND id NOT IN
     (SELECT id FROM snapshots WHERE account_id=? ORDER BY id DESC LIMIT ?)`,
  ).run(accountId, accountId, keep);
}

export function latestCookies(accountId: string): EditorCookie[] | null {
  const row = db
    .prepare("SELECT cookies_enc FROM snapshots WHERE account_id=? ORDER BY id DESC LIMIT 1")
    .get(accountId) as { cookies_enc: string } | undefined;
  if (!row) return null;
  return JSON.parse(decrypt(row.cookies_enc));
}

export interface PortalAppInput {
  appId: string;
  name: string;
  category?: string | null;
  targetType?: string | null;
  logo?: string | null;
  url?: string | null;
  note?: string | null;
  isDesktopOnly?: boolean;
  items: { itemId: string; itemName?: string | null; url?: string | null }[];
}

/** Sinkronkan katalog app + item dari GET /extensions/init/full. Aman dijalankan otomatis (hanya metadata). */
export function syncPortalApps(accountId: string, apps: PortalAppInput[]) {
  const t = now();
  const upsertApp = db.prepare(`
    INSERT INTO portal_apps(account_id, app_id, name, category, target_type, logo, url, note, is_desktop_only, active, last_synced_at)
    VALUES (@accountId, @appId, @name, @category, @targetType, @logo, @url, @note, @isDesktopOnly, 1, @t)
    ON CONFLICT(account_id, app_id) DO UPDATE SET
      name=excluded.name, category=excluded.category, target_type=excluded.target_type, logo=excluded.logo,
      url=excluded.url, note=excluded.note, is_desktop_only=excluded.is_desktop_only, active=1, last_synced_at=excluded.last_synced_at
  `);
  const upsertItem = db.prepare(`
    INSERT INTO portal_items(account_id, app_id, item_id, item_name, url, active, last_synced_at)
    VALUES (@accountId, @appId, @itemId, @itemName, @url, 1, @t)
    ON CONFLICT(account_id, item_id) DO UPDATE SET
      item_name=excluded.item_name, url=excluded.url, active=1, last_synced_at=excluded.last_synced_at
  `);
  const tx = db.transaction(() => {
    for (const a of apps) {
      upsertApp.run({
        accountId,
        t,
        appId: a.appId,
        name: a.name,
        category: a.category ?? null,
        targetType: a.targetType ?? null,
        logo: a.logo ?? null,
        url: a.url ?? null,
        note: a.note ?? null,
        isDesktopOnly: a.isDesktopOnly ? 1 : 0,
      });
      for (const it of a.items) {
        upsertItem.run({ accountId, t, appId: a.appId, itemId: it.itemId, itemName: it.itemName ?? null, url: it.url ?? null });
      }
    }
    if (apps.length) {
      const appIds = apps.map((a) => a.appId);
      const ph = appIds.map(() => "?").join(",");
      db.prepare(`UPDATE portal_apps SET active=0 WHERE account_id=? AND app_id NOT IN (${ph})`).run(accountId, ...appIds);
      const itemIds = apps.flatMap((a) => a.items.map((i) => i.itemId));
      if (itemIds.length) {
        const ph2 = itemIds.map(() => "?").join(",");
        db.prepare(`UPDATE portal_items SET active=0 WHERE account_id=? AND item_id NOT IN (${ph2})`).run(accountId, ...itemIds);
      }
    }
  });
  tx();
}

export interface PortalAppRow {
  app_id: string;
  name: string;
  category: string | null;
  target_type: string | null;
  logo: string | null;
  url: string | null;
  note: string | null;
  is_desktop_only: number;
}
export interface PortalItemRow {
  app_id: string;
  item_id: string;
  item_name: string | null;
  url: string | null;
  last_fetched_at: number | null;
  last_cookie_count: number | null;
  last_error: string | null;
}

export function listPortalApps(accountId: string): PortalAppRow[] {
  return db
    .prepare("SELECT app_id, name, category, target_type, logo, url, note, is_desktop_only FROM portal_apps WHERE account_id=? AND active=1 ORDER BY name")
    .all(accountId) as PortalAppRow[];
}

export function listPortalItems(accountId: string, appId: string): PortalItemRow[] {
  return db
    .prepare(
      "SELECT app_id, item_id, item_name, url, last_fetched_at, last_cookie_count, last_error FROM portal_items WHERE account_id=? AND app_id=? AND active=1 ORDER BY item_name",
    )
    .all(accountId, appId) as PortalItemRow[];
}

export function getPortalItem(accountId: string, itemId: string): (PortalItemRow & { url: string | null }) | undefined {
  return db
    .prepare("SELECT app_id, item_id, item_name, url, last_fetched_at, last_cookie_count, last_error FROM portal_items WHERE account_id=? AND item_id=?")
    .get(accountId, itemId) as PortalItemRow | undefined;
}

export function markItemFetch(accountId: string, itemId: string, patch: { cookieCount?: number; error?: string | null }) {
  db.prepare("UPDATE portal_items SET last_fetched_at=?, last_cookie_count=?, last_error=? WHERE account_id=? AND item_id=?").run(
    now(),
    patch.cookieCount ?? null,
    patch.error ?? null,
    accountId,
    itemId,
  );
}

const KEEP_ITEM_SNAPSHOTS = 3;

export function saveItemCookies(accountId: string, itemId: string, cookies: EditorCookie[]) {
  db.prepare("INSERT INTO item_cookie_snapshots(account_id, item_id, cookies_enc, cookie_count, captured_at) VALUES (?,?,?,?,?)").run(
    accountId,
    itemId,
    encrypt(JSON.stringify(cookies)),
    cookies.length,
    now(),
  );
  db.prepare(
    `DELETE FROM item_cookie_snapshots WHERE account_id=? AND item_id=? AND id NOT IN
     (SELECT id FROM item_cookie_snapshots WHERE account_id=? AND item_id=? ORDER BY id DESC LIMIT ?)`,
  ).run(accountId, itemId, accountId, itemId, KEEP_ITEM_SNAPSHOTS);
}

export function latestItemCookies(accountId: string, itemId: string): EditorCookie[] | null {
  const row = db
    .prepare("SELECT cookies_enc FROM item_cookie_snapshots WHERE account_id=? AND item_id=? ORDER BY id DESC LIMIT 1")
    .get(accountId, itemId) as { cookies_enc: string } | undefined;
  if (!row) return null;
  return JSON.parse(decrypt(row.cookies_enc));
}

export function recentRuns(limit = 50) {
  return db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT ?").all(limit);
}
