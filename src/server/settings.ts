// Masa aktif sesi login, bisa diatur admin dari dashboard (lihat
// /api/settings/session di server.ts) tanpa perlu restart proses atau edit
// .env. Disimpan di tabel kv yang sudah ada (lihat db.ts).
import { getKv, setKv } from "./db.js";
import { config } from "./config.js";

/** Batas bawah: cukup untuk tidak mengganggu pengguna di tengah kerja normal. */
export const SESSION_TTL_MIN_SEC = 60;
/** Batas atas: sengaja dibuat pendek (1 hari) supaya token yang dicuri/disalin
 * tidak bisa dipakai lama-lama -- lihat juga session_version untuk pembatalan
 * instan saat ada login baru. */
export const SESSION_TTL_MAX_SEC = 24 * 60 * 60;

const KEY = "session_ttl_sec";

const clamp = (sec: number) => Math.min(Math.max(Math.floor(sec), SESSION_TTL_MIN_SEC), SESSION_TTL_MAX_SEC);

export function getSessionTtlSec(): number {
  const stored = getKv(KEY);
  // Batas atas/bawah hanya ditegakkan pada nilai yang diatur admin lewat UI (lihat
  // setSessionTtlSec) -- SESSION_TTL_SEC di .env tetap dipercaya apa adanya, sama
  // seperti nilai env lain di config.ts, supaya tetap bisa dipakai untuk testing.
  if (stored && Number.isFinite(Number(stored))) return clamp(Number(stored));
  return config.sessionTtlSec;
}

/** Hanya berlaku untuk login BARU -- token yang sudah terbit tidak berubah masa berlakunya. */
export function setSessionTtlSec(sec: number): number {
  const ttl = clamp(sec);
  setKv(KEY, String(ttl));
  return ttl;
}
