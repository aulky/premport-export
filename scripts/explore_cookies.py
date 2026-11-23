#!/usr/bin/env python3
"""
Uji coba apps_client.py dengan 1 item nyata dari akun pertama di .env.
Jalankan: python scripts/explore_cookies.py
lalu copy-paste semua output ke chat.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from portal_client import do_login
from curl_cffi import requests


def run_apps_client(payload: dict) -> dict:
    proc = subprocess.run(
        [sys.executable, os.path.join(HERE, "apps_client.py")],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=40,
    )
    if proc.stderr.strip():
        print("stderr:", proc.stderr[:500])
    return json.loads(proc.stdout.strip().split("\n")[-1])


def main():
    env_path = os.path.join(os.path.dirname(HERE), ".env")
    env = {}
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k] = v

    session = requests.Session(impersonate="chrome120")
    print(">> login ...")
    login_res = do_login(session, env["ACCOUNT_1_EMAIL"], env["ACCOUNT_1_PASSWORD"])
    if not login_res.get("ok"):
        print("LOGIN GAGAL:", login_res.get("error"))
        sys.exit(1)
    token = login_res["accessToken"]
    print(">> login ok\n")

    print(">> mode=list")
    listing = run_apps_client({"mode": "list", "accessToken": token})
    if not listing.get("ok"):
        print("LIST GAGAL:", listing.get("error"))
        sys.exit(1)
    apps = listing["apps"]
    print(f"total apps: {len(apps)}")
    for a in apps[:15]:
        print(f"  - {a['name']!r} category={a.get('category')} targetType={a.get('targetType')} items={len(a['items'])}")

    target = next((a for a in apps if a.get("name") == "Netflix" and a["items"]), None) or next(
        (a for a in apps if a.get("targetType") == "cookies" and a["items"]), None
    )
    if not target:
        print("Tidak ada app cookies dengan item. Berhenti.")
        return
    item = target["items"][0]
    print(f"\n>> mode=get-cookies app={target['name']!r} item={item['itemName']!r} itemId={item['itemId']}")
    cookies_res = run_apps_client(
        {"mode": "get-cookies", "accessToken": token, "itemId": item["itemId"], "url": item["url"]}
    )
    print(json.dumps(cookies_res, indent=2, ensure_ascii=False)[:5000])


if __name__ == "__main__":
    main()
