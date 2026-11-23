#!/usr/bin/env python3
"""
Skrip EKSPLORASI (bukan bagian worker produksi) untuk memetakan API asli
yang dipakai ekstensi "Premium Portal Extension" (consumer-api.premiumportal.id),
ditemukan lewat analisis statis static/background/index.js ekstensi tsb:

  ENDPOINT.INIT   = '/extensions/init/full'   (daftar app/group yang bisa diakses)
  ENDPOINT.COOKIE = '/extensions/get-cookies' (cookie siap pakai per app)
  auth            = header "Authorization: Bearer <accessToken>"

Cara pakai:
  python scripts/explore_apps.py

Lalu copy-paste SELURUH output terminal (termasuk JSON mentahnya) kembali ke chat.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from portal_client import do_login  # reuse logika yang sudah ada
from curl_cffi import requests

BASE = "https://premiumportal.id"
API = "https://consumer-api.premiumportal.id"


def main():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    env = {}
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k] = v

    email = env.get("ACCOUNT_1_EMAIL")
    password = env.get("ACCOUNT_1_PASSWORD")
    if not email or not password:
        print("ACCOUNT_1_EMAIL / ACCOUNT_1_PASSWORD tidak ada di .env")
        sys.exit(1)

    session = requests.Session(impersonate="chrome120")
    print(">> login ke premiumportal.id ...")
    login_res = do_login(session, email, password)
    if not login_res.get("ok"):
        print("LOGIN GAGAL:", login_res.get("error"))
        sys.exit(1)
    token = login_res["accessToken"]
    print(">> login ok, token didapat.\n")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    print("=" * 70)
    print("GET /extensions/init/full")
    print("=" * 70)
    r = session.get(f"{API}/extensions/init/full", headers=headers, timeout=25)
    print("status:", r.status_code)
    try:
        parsed = r.json()
        print(json.dumps(parsed, indent=2, ensure_ascii=False)[:6000])
    except Exception:
        print(r.text[:3000])

    print()
    print("=" * 70)
    print("GET /groups/all")
    print("=" * 70)
    r2 = session.get(f"{API}/groups/all", headers=headers, timeout=25)
    print("status:", r2.status_code)
    try:
        print(json.dumps(r2.json(), indent=2, ensure_ascii=False)[:3000])
    except Exception:
        print(r2.text[:1500])

    print()
    print("=" * 70)
    print("GET /extensions/get-cookies (tanpa parameter, buat lihat pesan error-nya)")
    print("=" * 70)
    r3 = session.get(f"{API}/extensions/get-cookies", headers=headers, timeout=25)
    print("status:", r3.status_code)
    try:
        print(json.dumps(r3.json(), indent=2, ensure_ascii=False)[:2000])
    except Exception:
        print(r3.text[:1000])


if __name__ == "__main__":
    main()
