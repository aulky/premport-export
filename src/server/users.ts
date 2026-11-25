import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";
import { fingerprint, safeEqual } from "./crypto.js";
import { db, getKv, now, setKv } from "./db.js";

/**
 * Akun dashboard. Satu admin dari .env (username "admin" + ADMIN_PASSWORD) dan
 * sejumlah user biasa yang dibuat admin, disimpan di SQLite.
 */
export type Role = "admin" | "user";
export const ADMIN_USERNAME = "admin";
const ADMIN_ID = 0; // user di database mulai dari 1

export interface Principal {
  id: number;
  username: string;
  role: Role;
  /** Berubah kalau password berubah, sehingga sesi lama otomatis tidak berlaku. */
  stamp: string;
  /** Naik setiap login baru / sign-out dipaksa admin -- lihat session_version di db.ts. */
  ver: number;
  /** Masa berlaku sesi KHUSUS akun ini (detik), atau null untuk pakai default global. */
  sessionTtlSec: number | null;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: number;
  last_login_at: number | null;
  session_version: number;
  session_ttl_sec: number | null;
  expires_at: number | null;
}

export type AuthResult = { ok: true; principal: Principal } | { ok: false; reason: "invalid" | "expired" };

const isExpired = (expiresAt: number | null, t = now()) => expiresAt != null && expiresAt <= t;

const derive = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("base64")}.${(await derive(password, salt, 32)).toString("base64")}`;
}

async function matches(password: string, stored: string) {
  const [salt, hash] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  return timingSafeEqual(await derive(password, salt!, hash!.length), hash!);
}

// dipakai saat username tidak ada, supaya lama respons tidak membocorkan keberadaannya
const dummyHash = hashPassword(randomBytes(16).toString("hex"));

const byId = (id: number) => db.prepare("SELECT * FROM users WHERE id=?").get(id) as UserRow | undefined;

// Admin tidak punya baris di tabel users (lihat ADMIN_ID), jadi versi sesinya
// disimpan di kv -- sama perannya dengan kolom session_version user biasa.
const ADMIN_VER_KEY = "admin_session_version";
const adminVersion = () => Number(getKv(ADMIN_VER_KEY) ?? 0) || 0;

const admin = (ver = adminVersion()): Principal => ({
  id: ADMIN_ID,
  username: ADMIN_USERNAME,
  role: "admin",
  stamp: fingerprint(config.adminPassword),
  ver,
  sessionTtlSec: null, // admin selalu pakai default global
});

const asPrincipal = (u: UserRow): Principal => ({
  id: u.id,
  username: u.username,
  role: "user",
  stamp: fingerprint(u.password_hash),
  ver: u.session_version,
  sessionTtlSec: u.session_ttl_sec,
});

export const normalizeUsername = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

/**
 * Setiap login sukses menaikkan session_version-nya SENDIRI, sehingga token
 * sesi lama (di tab/perangkat lain) langsung tidak valid lagi -- hanya satu
 * sesi yang aktif per akun kapan saja, dan setiap login baru memaksa yang lama logout.
 * Akun yang sudah lewat expires_at-nya (mis. langganan 7 hari habis) ditolak
 * walau username/password-nya benar -- lihat juga setUserExpiry().
 */
export async function authenticate(username: string, password: string): Promise<AuthResult> {
  if (username === ADMIN_USERNAME) {
    if (!safeEqual(password, config.adminPassword)) return { ok: false, reason: "invalid" };
    const ver = adminVersion() + 1;
    setKv(ADMIN_VER_KEY, String(ver));
    return { ok: true, principal: admin(ver) };
  }
  const row = db.prepare("SELECT * FROM users WHERE username=?").get(username) as UserRow | undefined;
  const ok = await matches(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) return { ok: false, reason: "invalid" };
  if (isExpired(row.expires_at)) return { ok: false, reason: "expired" };
  const ver = row.session_version + 1;
  db.prepare("UPDATE users SET last_login_at=?, session_version=? WHERE id=?").run(now(), ver, row.id);
  return { ok: true, principal: asPrincipal({ ...row, session_version: ver }) };
}

/** Pemilik sesi, atau null kalau user sudah dihapus, passwordnya sudah diganti,
 * akunnya sudah kedaluwarsa, atau sesi ini sudah digantikan oleh login yang
 * lebih baru (ver tidak cocok). */
export function principalFor(session: { uid: number; stamp: string; ver: number } | null): Principal | null {
  if (!session) return null;
  const row = session.uid === ADMIN_ID ? undefined : byId(session.uid);
  if (row && isExpired(row.expires_at)) return null;
  const who = session.uid === ADMIN_ID ? admin() : row ? asPrincipal(row) : null;
  return who && who.stamp === session.stamp && who.ver === session.ver ? who : null;
}

/** Admin bisa memaksa user tertentu logout dari semua sesinya seketika, tanpa perlu menunggu
 * token-nya kedaluwarsa atau mengganti passwordnya. Mengembalikan false kalau user tidak ada. */
export function signOutUser(id: number): boolean {
  const res = db.prepare("UPDATE users SET session_version=session_version+1 WHERE id=?").run(id);
  return res.changes === 1;
}

export function usernameProblem(username: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return "Username must be 3-32 characters: letters, numbers, dot, dash, or underscore";
  if (username === ADMIN_USERNAME) return "That username is reserved";
  return null;
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8 || password.length > 200) return "Password must be 8-200 characters";
  return null;
}

export function listUsers() {
  const rows = db
    .prepare(
      "SELECT id, username, created_at AS createdAt, last_login_at AS lastLoginAt, session_ttl_sec AS sessionTtlSec, expires_at AS expiresAt FROM users ORDER BY username",
    )
    .all() as { expiresAt: number | null }[];
  const t = now();
  return rows.map((r) => ({ ...r, active: !isExpired(r.expiresAt, t) }));
}

/** false kalau username sudah dipakai. expiresAt null = tidak pernah kedaluwarsa. */
export async function createUser(username: string, password: string, expiresAt: number | null = null): Promise<boolean> {
  const hash = await hashPassword(password);
  const res = db
    .prepare("INSERT INTO users(username, password_hash, created_at, expires_at) VALUES (?,?,?,?) ON CONFLICT(username) DO NOTHING")
    .run(username, hash, now(), expiresAt);
  return res.changes === 1;
}

export async function setPassword(id: number, password: string): Promise<boolean> {
  return db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(await hashPassword(password), id).changes === 1;
}

export function deleteUser(id: number): boolean {
  return db.prepare("DELETE FROM users WHERE id=?").run(id).changes === 1;
}

/** ttlSec null -> kembali pakai default global. Mengembalikan false kalau user tidak ada. */
export function setUserSessionTtl(id: number, ttlSec: number | null): boolean {
  return db.prepare("UPDATE users SET session_ttl_sec=? WHERE id=?").run(ttlSec, id).changes === 1;
}

/** expiresAt null = tidak pernah kedaluwarsa. Boleh berupa waktu yang sudah lewat, supaya
 * admin juga bisa pakai ini untuk langsung menonaktifkan akun tanpa menghapusnya. */
export function setUserExpiry(id: number, expiresAt: number | null): boolean {
  return db.prepare("UPDATE users SET expires_at=? WHERE id=?").run(expiresAt, id).changes === 1;
}
