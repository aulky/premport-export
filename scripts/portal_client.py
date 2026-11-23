#!/usr/bin/env python3
"""
Klien login premiumportal.id yang tahan Cloudflare.

Kenapa tidak pakai Playwright/browser: endpoint login portal ini (Next.js
Server Action) di-blok Cloudflare bot-management untuk permintaan yang
berasal dari Chromium yang dikendalikan otomatisasi (headless ATAU headed),
walau halaman login-nya sendiri bisa termuat. curl_cffi meniru TLS/JA3
fingerprint Chrome asli sehingga lolos pemeriksaan tsb.

Catatan penting hasil riset:
- Hash header `next-action` berubah tiap kali Next.js di-build ulang, jadi
  TIDAK boleh di-hardcode -> selalu digali ulang dari bundle JS yang sedang
  live (lihat find_action()).
- Satu `requests.Session()` (satu koneksi/TLS context) harus dipakai dari
  awal (GET apapun) sampai pemanggilan action; sesi baru yang langsung
  POST tanpa GET apa pun lebih dulu akan ditolak 401 oleh backend meskipun
  token valid.

Protokol CLI: baca satu baris JSON dari stdin, tulis satu baris JSON ke stdout.
Input : {"email": str, "password": str, "accessToken": str|null}
Output: {"ok": true, "accessToken": str, "refreshToken": str,
         "premiumExpiresAt": str|null, "packageName": str|null,
         "relogged": bool}
      | {"ok": false, "error": str}
"""
import sys
import json
import re
from curl_cffi import requests

BASE = "https://premiumportal.id"
UA_IMPERSONATE = "chrome120"


def find_action(session: "requests.Session", path: str, action_name: str) -> str | None:
    r = session.get(f"{BASE}{path}", timeout=20)
    chunk_paths = sorted(set(re.findall(r"/_next/static/chunks/[A-Za-z0-9._-]+\.js", r.text)))
    pattern = re.compile(r'\("([a-f0-9]{30,50})"[^()]*,"' + re.escape(action_name) + r'"\)')
    for chunk in chunk_paths:
        body = session.get(f"{BASE}{chunk}", timeout=20).text
        m = pattern.search(body)
        if m:
            return m.group(1)
    return None


def call_action(session, referer_path, action_name_hash, args):
    headers = {
        "accept": "text/x-component",
        "content-type": "text/plain;charset=UTF-8",
        "next-action": action_name_hash,
        "referer": f"{BASE}{referer_path}",
        "origin": BASE,
    }
    r = session.post(f"{BASE}{referer_path}", headers=headers, data=json.dumps(args), timeout=25)
    return r


def extract_data_line(body: str) -> dict | None:
    """RSC flight payload: cari baris '<id>:{...}' yang berisi {"success":...}."""
    for line in body.split("\n"):
        idx = line.find(":{")
        if idx == -1 or idx > 4:
            continue
        candidate = line[idx + 1 :]
        if '"success"' not in candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def get_packages(session) -> dict:
    """Panggil getUserPackages di halaman dashboard; mengembalikan dict parsed."""
    pkg_hash = find_action(session, "/dashboard", "getUserPackages")
    if not pkg_hash:
        return {"success": False, "errors": "getUserPackages action tidak ditemukan (markup portal berubah?)"}
    r = call_action(session, "/dashboard", pkg_hash, [])
    parsed = extract_data_line(r.text)
    if parsed is None:
        return {"success": False, "errors": f"respons tidak terduga (status {r.status_code})"}
    return parsed


def do_login(session, email, password) -> dict:
    login_hash = find_action(session, "/auth/login", "loginAction")
    if not login_hash:
        return {"ok": False, "error": "loginAction hash tidak ditemukan (markup login berubah?)"}
    r = call_action(session, "/auth/login", login_hash, [{"email": email, "password": password}, {"publicIp": "0.0.0.0"}])
    m = re.search(r'"accessToken":"(.*?)"', r.text)
    m2 = re.search(r'"refreshToken":"(.*?)"', r.text)
    if not m:
        msg = "Email atau password salah, atau akun diblokir."
        err_m = re.search(r'"errors":"(.*?)"', r.text)
        if err_m:
            msg = err_m.group(1)
        return {"ok": False, "error": msg}
    return {"ok": True, "accessToken": m.group(1), "refreshToken": m2.group(1) if m2 else None}


def main():
    raw = sys.stdin.read()
    try:
        req = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"ok": False, "error": "input stdin bukan JSON valid"}))
        return

    email = req.get("email")
    password = req.get("password")
    access_token = req.get("accessToken")

    session = requests.Session(impersonate=UA_IMPERSONATE)
    relogged = False

    try:
        if access_token:
            session.cookies.set("accessToken", access_token, domain="premiumportal.id")
            pkg = get_packages(session)
            if not pkg.get("success"):
                access_token = None  # token basi/invalid -> paksa login ulang di bawah

        if not access_token:
            if not email or not password:
                print(json.dumps({"ok": False, "error": "accessToken kosong dan email/password tidak diberikan"}))
                return
            login_res = do_login(session, email, password)
            if not login_res.get("ok"):
                print(json.dumps({"ok": False, "error": login_res.get("error", "login gagal")}))
                return
            access_token = login_res["accessToken"]
            refresh_token = login_res.get("refreshToken")
            session.cookies.set("accessToken", access_token, domain="premiumportal.id")
            relogged = True
            pkg = get_packages(session)
        else:
            refresh_token = None  # token lama dipakai ulang; refreshToken tidak kita ketahui lagi di sini

        if not pkg.get("success"):
            print(json.dumps({"ok": False, "error": pkg.get("errors", "gagal mengambil status akun")}))
            return

        data = pkg.get("data", {}).get("data", {}) if isinstance(pkg.get("data"), dict) else {}
        print(
            json.dumps(
                {
                    "ok": True,
                    "accessToken": access_token,
                    "refreshToken": refresh_token,
                    "premiumExpiresAt": data.get("premiumExpiresAt"),
                    "packageName": (data.get("subscriptionPackage") or {}).get("packageName"),
                    "relogged": relogged,
                }
            )
        )
    except Exception as e:  # noqa: BLE001 - selalu laporkan sebagai JSON, jangan traceback mentah
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))


if __name__ == "__main__":
    main()
