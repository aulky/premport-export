// Batas percobaan login yang gagal per IP. Disimpan di memori: proses web hanya
// satu (lihat ecosystem.config.cjs), dan hitungan boleh hilang saat restart.
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
const PRUNE_AT = 10_000;

const attempts = new Map<string, { count: number; resetAt: number; reported: boolean }>();

/** Satu pelanggan IPv6 biasanya memegang seluruh /64, jadi dihitung sebagai satu. */
function keyFor(ip: string): string {
  if (!ip.includes(":") || ip.includes(".")) return ip; // IPv4, termasuk ::ffff:a.b.c.d
  const [head = "", tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const gap = tail === undefined ? 0 : Math.max(8 - left.length - right.length, 0);
  return [...left, ...Array<string>(gap).fill("0"), ...right].slice(0, 4).join(":");
}

/**
 * Pesan satu percobaan SEBELUM password diperiksa, supaya request paralel tidak
 * bisa melewati batas. `retryAfterSec` 0 berarti boleh lanjut; `firstBlock`
 * true hanya pada penolakan pertama (dipakai agar riwayat tidak dibanjiri).
 */
export function takeAttempt(ip: string, now = Date.now()): { retryAfterSec: number; firstBlock: boolean } {
  if (attempts.size >= PRUNE_AT) {
    for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  }
  const key = keyFor(ip);
  let entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS, reported: false };
    attempts.set(key, entry);
  }
  if (entry.count < MAX_FAILURES) {
    entry.count++;
    return { retryAfterSec: 0, firstBlock: false };
  }
  const firstBlock = !entry.reported;
  entry.reported = true;
  return { retryAfterSec: Math.ceil((entry.resetAt - now) / 1000), firstBlock };
}

/**
 * Login berhasil tidak dihitung. Sengaja hanya mengembalikan percobaan itu,
 * bukan menghapus hitungan: kalau tidak, pemilik akun biasa bisa menyetel
 * ulang batasnya di sela-sela menebak password admin.
 */
export function refundAttempt(ip: string): void {
  const entry = attempts.get(keyFor(ip));
  if (entry && entry.count > 0) entry.count--;
}
