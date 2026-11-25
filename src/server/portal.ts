import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { EditorCookie } from "./cookies.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, "../../scripts");
const PYTHON = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

/**
 * premiumportal.id ada di balik Cloudflare bot-management yang memblokir
 * request login/API dari Chromium otomatisasi (Playwright headless MAUPUN
 * headed) -- lihat scripts/portal_client.py untuk riset lengkapnya. Semua
 * komunikasi ke portal karena itu lewat skrip Python (curl_cffi, TLS
 * fingerprint Chrome asli), dipanggil sebagai subprocess dari sini.
 */
function runPython<T>(script: string, input: unknown, timeoutMs = 45_000): Promise<T | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [join(SCRIPTS_DIR, script)], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ ok: false, error: `Timed out waiting for ${script} (${timeoutMs / 1000}s)` });
    }, timeoutMs);

    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Failed to run Python (${PYTHON}): ${e.message}. Make sure Python 3 + curl_cffi are installed.` });
    });
    proc.on("close", () => {
      clearTimeout(timer);
      const line = stdout.trim().split("\n").pop() ?? "";
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ ok: false, error: `Invalid output from ${script}. stderr: ${stderr.slice(0, 300)}` });
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

// ---------- portal_client.py: login & status langganan premiumportal.id ----------

interface ClientOk {
  ok: true;
  accessToken: string;
  refreshToken: string | null;
  premiumExpiresAt: string | null;
  packageName: string | null;
  relogged: boolean;
}
type ClientResult = ClientOk | { ok: false; error: string };

function runPortalClient(input: { email?: string; password?: string; accessToken?: string | null }) {
  return runPython<ClientOk>("portal_client.py", input);
}

export interface LoginResult {
  ok: boolean;
  cookies: EditorCookie[];
  accessToken?: string;
  expiresAt: number | null;
  error?: string;
}

function toCookieSnapshot(accessToken: string, refreshToken: string | null): EditorCookie[] {
  // JWT accessToken menyimpan "exp" sendiri (~24 jam); dipakai sebagai expirationDate.
  let exp: number | undefined;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    exp = typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    exp = undefined;
  }
  const base = (name: string, value: string): EditorCookie => ({
    domain: "premiumportal.id",
    hostOnly: true,
    httpOnly: false,
    name,
    path: "/",
    sameSite: "lax",
    secure: true,
    session: !exp,
    storeId: "0",
    value,
    ...(exp ? { expirationDate: exp } : {}),
  });
  const cookies = [base("accessToken", accessToken)];
  if (refreshToken) cookies.push(base("refreshToken", refreshToken));
  return cookies;
}

/** Login penuh (email+password) -> cookie sesi dashboard premiumportal.id. */
export async function loginAndCapture(email: string, password: string): Promise<LoginResult> {
  const res = (await runPortalClient({ email, password, accessToken: null })) as ClientResult;
  if (!res.ok) return { ok: false, cookies: [], expiresAt: null, error: res.error };

  const cookies = toCookieSnapshot(res.accessToken, res.refreshToken);
  const premiumExpiresAt = res.premiumExpiresAt ? Math.floor(new Date(res.premiumExpiresAt).getTime() / 1000) : null;
  return { ok: true, cookies, accessToken: res.accessToken, expiresAt: premiumExpiresAt };
}

/**
 * Cek apakah accessToken yang tersimpan masih valid, tanpa login ulang
 * (hanya dianggap valid kalau backend benar-benar menerimanya).
 */
export async function checkSessionAlive(cookies: EditorCookie[]): Promise<boolean> {
  const accessToken = cookies.find((c) => c.name === "accessToken")?.value;
  if (!accessToken) return false;
  const res = (await runPortalClient({ accessToken })) as ClientResult;
  return res.ok;
}

export async function closeBrowser() {
  // tidak ada browser untuk ditutup lagi (login lewat curl_cffi/python, bukan Playwright)
}

// ---------- apps_client.py: katalog app + cookie per item (consumer-api) ----------

export interface PortalAppItem {
  itemId: string;
  itemName: string | null;
  url: string | null;
}
export interface PortalApp {
  appId: string;
  name: string;
  category: string | null;
  targetType: string | null;
  logo: string | null;
  url: string | null;
  note: string | null;
  isDesktopOnly: boolean;
  items: PortalAppItem[];
}
type ListAppsResult = { ok: true; apps: PortalApp[] } | { ok: false; error: string };

/** Daftar app + item (aman dipanggil otomatis -- hanya metadata, bukan klaim cookie). */
export function listPortalAppsLive(accessToken: string) {
  return runPython<{ ok: true; apps: PortalApp[] }>("apps_client.py", { mode: "list", accessToken });
}

type GetCookiesResult = { ok: true; cookies: EditorCookie[] } | { ok: false; error: string };

/**
 * Ambil cookie 1 item spesifik. HANYA dipanggil atas aksi eksplisit pengguna
 * (klik "Get" di dashboard) -- beberapa app punya limit harian (mis. Netflix
 * 10x/24 jam di sisi portal), jangan pernah dipanggil otomatis/massal.
 */
export function fetchItemCookiesLive(accessToken: string, itemId: string) {
  return runPython<{ ok: true; cookies: EditorCookie[] }>("apps_client.py", { mode: "get-cookies", accessToken, itemId });
}

export interface PortalCreds {
  url: string | null;
  username: string | null;
  password: string | null;
}
type GetCredsResult = ({ ok: true } & PortalCreds) | { ok: false; error: string };

/**
 * Username/password untuk app bertipe "autofill" (mis. MediaFire, QuillBot,
 * Bloomberg) -- app ini membagikan akun lewat kredensial, bukan cookie.
 * Sama seperti fetchItemCookiesLive: HANYA dipanggil atas aksi eksplisit
 * pengguna (klik "Get"/"Refresh"), tidak pernah otomatis.
 */
export function fetchItemCredsLive(accessToken: string, itemId: string) {
  return runPython<{ ok: true } & PortalCreds>("apps_client.py", { mode: "get-creds", accessToken, itemId });
}

export type { ListAppsResult, GetCookiesResult, GetCredsResult };
