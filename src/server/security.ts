// Content-Security-Policy untuk halaman HTML.
//
// Script inline hanya diizinkan lewat hash SHA-256 isinya (dihitung dari HTML
// yang benar-benar dikirim), bukan 'unsafe-inline'. Jadi kalau ada HTML asing
// yang lolos ke halaman -- mis. catatan app dari provider yang ditampilkan apa
// adanya -- <script> dan atribut onerror=/onclick= di dalamnya tidak dijalankan.
import { createHash } from "node:crypto";

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const cache = new Map<string, string>();

function scriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const [, attrs = "", body = ""] of html.matchAll(INLINE_SCRIPT)) {
    // Script eksternal diatur 'self'; JSON-LD hanya data, tidak dijalankan.
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']?application\/ld\+json/i.test(attrs) || !body) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

export function contentSecurityPolicy(html: string): string {
  const hashes = scriptHashes(html).join(" ");
  const cached = cache.get(hashes);
  if (cached) return cached;
  const policy = [
    "default-src 'self'",
    `script-src 'self'${hashes ? ` ${hashes}` : ""}`,
    // Tailwind/React memakai atribut style; tidak bisa menjalankan kode.
    "style-src 'self' 'unsafe-inline'",
    // Ikon app diambil dari situs masing-masing.
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  if (cache.size > 50) cache.clear();
  cache.set(hashes, policy);
  return policy;
}
