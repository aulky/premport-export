import { assertWorkerConfig, config } from "./config.js";
import { now, logRun } from "./db.js";
import { getAccount, latestCookies, markStatus, syncAccountsFromEnv } from "./accounts.js";
import { checkSessionAlive, closeBrowser } from "./portal.js";
import { refreshAccount } from "./refresh.js";

assertWorkerConfig();
syncAccountsFromEnv();

let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

const inFlight = new Set<string>();

async function refresh(accountId: string) {
  const acc = getAccount(accountId);
  if (!acc) return;
  console.log(`[worker] login ${acc.label} (${acc.email})${acc.id === config.accounts[0]?.id ? " [primary]" : ""}...`);
  const res = await refreshAccount(accountId);
  if (!res.ok) {
    console.warn(`[worker] FAILED ${acc.label}: ${res.error} -- will retry automatically (backoff, other accounts keep running)`);
  } else {
    console.log(`[worker] OK ${acc.label}: ${res.cookieCount} cookies saved`);
  }
}

async function tick() {
  for (const creds of config.accounts) {
    if (stopping) return;
    if (inFlight.has(creds.id)) continue;
    const acc = getAccount(creds.id);
    if (!acc) continue;
    // Hindari race dengan refresh manual yang dipicu dari tombol dashboard (server.ts).
    if (acc.status === "refreshing") continue;

    const nowSec = now();
    if (acc.next_attempt_at && acc.next_attempt_at > nowSec) continue;

    const dueForCheck = !acc.last_checked_at || nowSec - acc.last_checked_at >= config.worker.checkIntervalSec;
    const nearExpiry = acc.expires_at !== null && acc.expires_at - nowSec <= config.worker.refreshBeforeSec;
    const neverLoggedIn = !acc.last_refreshed_at;

    if (!dueForCheck && !nearExpiry && !neverLoggedIn) continue;

    inFlight.add(creds.id);
    (async () => {
      try {
        if (neverLoggedIn || nearExpiry) {
          await refresh(creds.id);
          return;
        }
        // sesi mungkin masih berlaku: verifikasi dulu sebelum login ulang
        const cookies = latestCookies(creds.id) ?? [];
        const t0 = Date.now();
        const alive = cookies.length ? await checkSessionAlive(cookies) : false;
        markStatus(creds.id, { status: alive ? "valid" : "expired" }, "checked");
        logRun(creds.id, "check", alive, alive ? "session still alive" : "session detected as expired", Date.now() - t0);
        if (!alive) await refresh(creds.id);
      } catch (e) {
        console.error(`[worker] unexpected error for ${creds.id}:`, e);
        markStatus(creds.id, { status: "error", last_error: (e as Error).message }, "checked");
      } finally {
        inFlight.delete(creds.id);
      }
    })();
  }
}

console.log(`[worker] start. active accounts: ${config.accounts.length}, tick=${config.worker.tickSec}s`);
const timer = setInterval(() => void tick(), config.worker.tickSec * 1000);
void tick();

async function shutdown() {
  clearInterval(timer);
  await closeBrowser();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
