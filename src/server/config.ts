// Muat .env langsung di kode (bukan andalkan flag CLI), supaya tetap jalan
// apapun cara prosesnya dieksekusi (pm2 fork/cluster, systemd, dsb).
import { readFileSync } from "node:fs";

const envFile = new URL("../../.env", import.meta.url);
const presetKeys = new Set(Object.keys(process.env));
try {
  process.loadEnvFile(envFile);
  keepHashInPasswords(readFileSync(envFile, "utf8"));
} catch {
  // .env tidak ada (mis. env sudah diset lewat pm2/systemd) -> lanjut pakai process.env apa adanya
}

/**
 * Parser .env bawaan Node menganggap "#" pada nilai tanpa kutip sebagai awal
 * komentar, jadi password seperti abc#123 terpotong jadi "abc". Khusus baris
 * password, nilai tanpa kutip diambil utuh sampai akhir baris (konsekuensinya
 * baris password tidak boleh diberi komentar di belakangnya).
 */
function keepHashInPasswords(text: string) {
  const line = /^[ \t]*(?:export[ \t]+)?(ADMIN_PASSWORD|ACCOUNT_\d+_PASSWORD)[ \t]*=(.*)$/gm;
  for (const [, key, rest] of text.matchAll(line)) {
    const value = rest.trim();
    // env yang sudah diset dari luar tetap menang; nilai berkutip sudah benar diparse Node
    if (presetKeys.has(key) || /^["'`]/.test(value)) continue;
    process.env[key] = value;
  }
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
        label: str(`ACCOUNT_${n}_LABEL`) || email || `Account ${n}`,
        email,
        password,
      };
    })
    .filter((a) => a.email && a.password);
}

/** Hanya origin http(s) yang diterima; nilai lain diabaikan dengan peringatan. */
function publicOrigin(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
  } catch {
    // ditangani di bawah
  }
  console.warn("PUBLIC_URL ignored: use a full address such as https://example.com");
  return "";
}

export const config = {
  // Alamat publik dashboard untuk pratinjau tautan, sitemap, dan canonical URL.
  publicUrl: publicOrigin(str("PUBLIC_URL")),
  port: num(env.PORT, 3000),
  host: str("HOST", "0.0.0.0"),
  dbPath: str("DB_PATH", "./data/cookies.db"),
  secretKey: str("SECRET_KEY"),
  adminPassword: env.ADMIN_PASSWORD ?? "",
  // Sesi login dashboard pendek secara sengaja (lihat settings.ts untuk batas
  // yang boleh diatur admin dari UI): token ditandatangani & membawa "exp"
  // sendiri, jadi walau cookie-nya disalin, ia otomatis tidak berlaku lagi
  // setelah ini -- dan login baru membatalkan sesi lama (lihat session_version).
  sessionTtlSec: num(env.SESSION_TTL_SEC, 15 * 60),
  secureCookie: bool("COOKIE_SECURE", false),
  // Proxy yang header X-Forwarded-For-nya dipercaya untuk menentukan IP asli.
  trustProxy: str("TRUST_PROXY", "loopback"),

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
  if (config.secretKey.length < 16) problems.push("SECRET_KEY must be at least 16 characters");
  if (config.adminPassword.length < 8) problems.push("ADMIN_PASSWORD must be at least 8 characters");
  if (problems.length) {
    console.error("Invalid .env configuration:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}

export function assertWorkerConfig() {
  const problems: string[] = [];
  if (config.secretKey.length < 16) problems.push("SECRET_KEY must be at least 16 characters");
  if (!config.accounts.length) problems.push("No ACCOUNT_n_EMAIL / ACCOUNT_n_PASSWORD defined");
  if (problems.length) {
    console.error("Invalid .env configuration:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}
