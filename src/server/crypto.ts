import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

const key = () => createHash("sha256").update("enc:" + config.secretKey).digest();

/** AES-256-GCM. Format: base64(iv).base64(tag).base64(ciphertext) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ct] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

const sign = (data: string) => createHmac("sha256", "sess:" + config.secretKey).update(data).digest("base64url");

/** Sidik jari rahasia (butuh SECRET_KEY), untuk menandai versi password di dalam sesi. */
export const fingerprint = (value: string) => sign("stamp:" + value).slice(0, 22);

export function makeSession(user: { id: number; stamp: string; ver: number }, ttlSec: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = Buffer.from(JSON.stringify({ uid: user.id, stamp: user.stamp, ver: user.ver, exp })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Isi sesi kalau tanda tangannya sah dan belum kedaluwarsa. `ver` dicocokkan
 * oleh principalFor() terhadap versi TERKINI user itu -- begitu dia login lagi
 * (di tab/perangkat lain) versi naik dan sesi ini otomatis tidak berlaku lagi,
 * walau tanda tangan & exp-nya masih sah.
 */
export function verifySession(token: string | undefined): { uid: number; stamp: string; ver: number; exp: number } | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), sign(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!(data.exp > Date.now() / 1000)) return null;
    // ver tidak ada di token lama (sebelum fitur ini) -> dianggap versi 0, sama
    // seperti versi awal user baru, jadi tidak memaksa logout massal saat upgrade.
    return { uid: data.uid, stamp: data.stamp, ver: Number(data.ver) || 0, exp: data.exp };
  } catch {
    return null; // format sesi versi lama -> harus login ulang
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}
