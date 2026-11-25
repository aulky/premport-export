import { now, logRun } from "./db.js";
import { getAccount, markStatus, saveSnapshot, syncPortalApps, credentialsFor } from "./accounts.js";
import { loginAndCapture, listPortalAppsLive } from "./portal.js";

/**
 * Login ulang 1 akun + simpan snapshot cookie + sinkron katalog app.
 * Dipakai worker.ts (otomatis, terjadwal) MAUPUN server.ts (tombol "Refresh"
 * manual di dashboard) -- logikanya harus identik supaya hasilnya konsisten.
 */
export async function refreshAccount(
  accountId: string,
  source: "worker" | "manual" = "worker",
): Promise<{ ok: boolean; error?: string; cookieCount?: number }> {
  const acc = getAccount(accountId);
  const creds = credentialsFor(accountId);
  if (!acc || !creds) return { ok: false, error: "Account not found / not defined in .env" };

  const tag = source === "manual" ? "manual (dashboard button)" : "automatic (worker)";
  const t0 = Date.now();
  markStatus(accountId, { status: "refreshing" });
  const res = await loginAndCapture(creds.email, creds.password);

  if (!res.ok) {
    const failCount = acc.fail_count + 1;
    const backoffSec = Math.min(3600, 60 * 2 ** Math.min(failCount, 6));
    markStatus(
      accountId,
      { status: "error", last_error: res.error ?? "login failed", fail_count: failCount, next_attempt_at: now() + backoffSec },
      "checked",
    );
    logRun(accountId, "login", false, `[${tag}] ${res.error ?? "login failed"}`, Date.now() - t0);
    return { ok: false, error: res.error ?? "login failed" };
  }

  saveSnapshot(accountId, res.cookies, res.expiresAt);
  markStatus(accountId, { status: "valid", last_error: null, expires_at: res.expiresAt, fail_count: 0, next_attempt_at: 0 }, "refreshed");
  logRun(
    accountId,
    "login",
    true,
    `[${tag}] ${res.cookies.length} cookies${res.expiresAt ? `, exp ${new Date(res.expiresAt * 1000).toISOString()}` : ""}`,
    Date.now() - t0,
  );

  if (res.accessToken) {
    const t1 = Date.now();
    const appsRes = await listPortalAppsLive(res.accessToken);
    if (appsRes.ok) {
      syncPortalApps(accountId, appsRes.apps);
      const totalItems = appsRes.apps.reduce((n, a) => n + a.items.length, 0);
      logRun(accountId, "apps-sync", true, `${appsRes.apps.length} app, ${totalItems} item`, Date.now() - t1);
    } else {
      logRun(accountId, "apps-sync", false, appsRes.error, Date.now() - t1);
    }
  }

  return { ok: true, cookieCount: res.cookies.length };
}
