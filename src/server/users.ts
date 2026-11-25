import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";
import { fingerprint, safeEqual } from "./crypto.js";
import { db, now } from "./db.js";

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
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: number;
  last_login_at: number | null;
}

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

const admin = (): Principal => ({
  id: ADMIN_ID,
  username: ADMIN_USERNAME,
  role: "admin",
  stamp: fingerprint(config.adminPassword),
});

const asPrincipal = (u: UserRow): Principal => ({
  id: u.id,
  username: u.username,
  role: "user",
  stamp: fingerprint(u.password_hash),
});

export const normalizeUsername = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export async function authenticate(username: string, password: string): Promise<Principal | null> {
  if (username === ADMIN_USERNAME) return safeEqual(password, config.adminPassword) ? admin() : null;
  const row = db.prepare("SELECT * FROM users WHERE username=?").get(username) as UserRow | undefined;
  const ok = await matches(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) return null;
  db.prepare("UPDATE users SET last_login_at=? WHERE id=?").run(now(), row.id);
  return asPrincipal(row);
}

/** Pemilik sesi, atau null kalau user sudah dihapus / passwordnya sudah diganti. */
export function principalFor(session: { uid: number; stamp: string } | null): Principal | null {
  if (!session) return null;
  const row = session.uid === ADMIN_ID ? undefined : byId(session.uid);
  const who = session.uid === ADMIN_ID ? admin() : row ? asPrincipal(row) : null;
  return who && who.stamp === session.stamp ? who : null;
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
  return db
    .prepare("SELECT id, username, created_at AS createdAt, last_login_at AS lastLoginAt FROM users ORDER BY username")
    .all();
}

/** false kalau username sudah dipakai. */
export async function createUser(username: string, password: string): Promise<boolean> {
  const hash = await hashPassword(password);
  const res = db
    .prepare("INSERT INTO users(username, password_hash, created_at) VALUES (?,?,?) ON CONFLICT(username) DO NOTHING")
    .run(username, hash, now());
  return res.changes === 1;
}

export async function setPassword(id: number, password: string): Promise<boolean> {
  return db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(await hashPassword(password), id).changes === 1;
}

export function deleteUser(id: number): boolean {
  return db.prepare("DELETE FROM users WHERE id=?").run(id).changes === 1;
}
