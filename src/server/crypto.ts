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

export function makeSession(ttlSec: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = `${exp}.${randomBytes(8).toString("hex")}`;
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const body = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), sign(body))) return false;
  return Number(body.split(".")[0]) > Date.now() / 1000;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}
