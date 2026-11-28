// Pembatas request, semuanya di memori: proses web hanya satu (lihat
// ecosystem.config.cjs), dan hitungan boleh hilang saat restart.
//
// Lapisan pertahanan saat ada yang membanjiri server:
//   1. requestLimiter -- semua request per IP (halaman, aset, API).
//   2. apiLimiter     -- request /api per IP, lebih ketat.
//   3. takeAttempt    -- percobaan login per IP (5 per 15 menit).
//   4. passwordGate   -- hashing password (scrypt, berat untuk CPU) dibatasi
//      sekian yang berjalan bersamaan; sisanya antre, dan kalau antrean penuh
//      langsung ditolak. Ini yang menjaga server tetap hidup kalau serangan
//      datang dari banyak IP sekaligus.

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
/** Batas jumlah IP yang dilacak per pembatas, supaya memori tidak bisa dibuat membengkak. */
const MAX_KEYS = 50_000;

type Entry = { count: number; resetAt: number };

/** Satu pelanggan IPv6 biasanya memegang seluruh /64, jadi dihitung sebagai satu. */
export function keyFor(ip: string): string {
  if (!ip.includes(":") || ip.includes(".")) return ip; // IPv4, termasuk ::ffff:a.b.c.d
  const [head = "", tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const gap = tail === undefined ? 0 : Math.max(8 - left.length - right.length, 0);
  return [...left, ...Array<string>(gap).fill("0"), ...right].slice(0, 4).join(":");
}

/** Buang entri yang sudah kedaluwarsa; kalau masih terlalu banyak, buang yang paling lama. */
function prune<T extends Entry>(map: Map<string, T>, now: number) {
  if (map.size < MAX_KEYS) return;
  for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
  for (const k of map.keys()) {
    if (map.size < MAX_KEYS * 0.9) break;
    map.delete(k);
  }
}

/** Fixed window per IP: maksimal `max` request per `windowMs`. */
export class WindowLimiter {
  private hits = new Map<string, Entry>();
  constructor(
    readonly max: number,
    readonly windowMs: number,
  ) {}

  /** 0 = boleh lanjut; lebih dari 0 = detik sampai boleh mencoba lagi. */
  hit(ip: string, now = Date.now()): number {
    const key = keyFor(ip);
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      prune(this.hits, now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count++;
    return entry.count > this.max ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }
}

/** Semua request (halaman, aset, API): 600 per menit per IP. */
export const requestLimiter = new WindowLimiter(600, 60_000);
/** Request /api: 240 per menit per IP (dashboard normal memakai belasan per menit). */
export const apiLimiter = new WindowLimiter(240, 60_000);

// ---------- percobaan login ----------

const attempts = new Map<string, Entry & { reported: boolean }>();

/**
 * Pesan satu percobaan SEBELUM password diperiksa, supaya request paralel tidak
 * bisa melewati batas. `retryAfterSec` 0 berarti boleh lanjut; `firstBlock`
 * true hanya pada penolakan pertama (dipakai agar riwayat tidak dibanjiri).
 */
export function takeAttempt(ip: string, now = Date.now()): { retryAfterSec: number; firstBlock: boolean } {
  const key = keyFor(ip);
  let entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    prune(attempts, now);
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

// ---------- antrean hashing password ----------

export class BusyError extends Error {
  constructor() {
    super("Server busy");
  }
}

/**
 * Jalankan paling banyak `limit` tugas sekaligus; maksimal `queueMax` menunggu,
 * sisanya langsung ditolak dengan BusyError (tanpa menyentuh CPU).
 */
export function createGate(limit: number, queueMax: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active < limit) active++;
    else if (waiting.length >= queueMax) throw new BusyError();
    else await new Promise<void>((resolve) => waiting.push(resolve)); // slot diserahkan langsung oleh yang selesai
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

/** scrypt memakai thread pool libuv (default 4 thread): sisakan untuk I/O lain. */
export const passwordGate = createGate(2, 20);
