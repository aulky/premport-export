// Muat .env langsung di kode (bukan andalkan flag CLI), supaya tetap jalan
// apapun cara prosesnya dieksekusi (pm2 fork/cluster, systemd, dsb).
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // .env tidak ada (mis. env sudah diset lewat pm2/systemd) -> lanjut pakai process.env apa adanya
}

const env = process.env;

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : d;
};
const str = (k: string, d = "") => (env[k] ?? d).trim();
const bool = (k: string, d: boolean) => (env[k] === undefined ? d : env[k] === "true");

export interface AccountConfig {
  id: string;
  label: string;
  email: string;
  password: string;
}

/** Dibaca dari ACCOUNT_1_LABEL / ACCOUNT_1_EMAIL / ACCOUNT_1_PASSWORD, ACCOUNT_2_..., dst. */
function loadAccounts(): AccountConfig[] {
  const nums = new Set<number>();
  for (const k of Object.keys(env)) {
    const m = /^ACCOUNT_(\d+)_(EMAIL|PASSWORD)$/.exec(k);
    if (m) nums.add(Number(m[1]));
  }
  return [...nums]
    .sort((a, b) => a - b)
    .map((n) => {
      const email = str(`ACCOUNT_${n}_EMAIL`);
      const password = env[`ACCOUNT_${n}_PASSWORD`] ?? "";
      return {
        id: `acc-${n}`,
        label: str(`ACCOUNT_${n}_LABEL`) || email || `Akun ${n}`,
        email,
        password,
      };
    })
    .filter((a) => a.email && a.password);
}

export const config = {
  port: num(env.PORT, 3000),
  host: str("HOST", "0.0.0.0"),
  dbPath: str("DB_PATH", "./data/cookies.db"),
  secretKey: str("SECRET_KEY"),
  adminPassword: env.ADMIN_PASSWORD ?? "",
  sessionTtlSec: num(env.SESSION_TTL_SEC, 60 * 60 * 12),
  secureCookie: bool("COOKIE_SECURE", false),

  portal: {
    name: str("PORTAL_NAME", "Premium Portal"),
  },

  worker: {
    tickSec: num(env.WORKER_TICK_SEC, 15),
    checkIntervalSec: num(env.CHECK_INTERVAL_SEC, 300),
    refreshBeforeSec: num(env.REFRESH_BEFORE_SEC, 600),
    keepSnapshots: num(env.KEEP_SNAPSHOTS, 5),
    maxFailBeforeBackoff: num(env.MAX_FAIL_BEFORE_BACKOFF, 3),
  },

  get accounts(): AccountConfig[] {
    return loadAccounts();
  },
};

export function assertServerConfig() {
  const problems: string[] = [];
  if (config.secretKey.length < 16) problems.push("SECRET_KEY minimal 16 karakter");
  if (config.adminPassword.length < 8) problems.push("ADMIN_PASSWORD minimal 8 karakter");
  if (problems.length) {
    console.error("Konfigurasi .env belum benar:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}

export function assertWorkerConfig() {
  const problems: string[] = [];
  if (config.secretKey.length < 16) problems.push("SECRET_KEY minimal 16 karakter");
  if (!config.accounts.length) problems.push("Belum ada ACCOUNT_n_EMAIL / ACCOUNT_n_PASSWORD");
  if (problems.length) {
    console.error("Konfigurasi .env belum benar:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}
