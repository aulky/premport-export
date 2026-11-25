#!/usr/bin/env python3
"""
Klien untuk API aplikasi/cookie premiumportal.id (consumer-api.premiumportal.id),
ditemukan lewat reverse-engineering static/background/index.js ekstensi resmi
"Premium Portal Extension". Terpisah dari portal_client.py (yang menangani
login & status langganan) supaya tidak mengganggu alur yang sudah stabil.

Endpoint (semua butuh header Authorization: Bearer <accessToken>):
  GET  /extensions/init/full   -> daftar app + item/slot akun yang bisa diklaim
  POST /extensions/get-cookies {"itemId": <items[]._id>, "url": <items[].url>}
                                -> cookie siap pakai untuk 1 item tsb

PENTING: beberapa app (terbukti dari teks di dalam kode ekstensi sendiri,
mis. Netflix: "dibatasi untuk pilih 10 akun dalam 24 jam") punya limit
pengambilan per hari. JANGAN panggil get-cookies untuk semua item sekaligus
secara otomatis -- hanya dipanggil satu-persatu, atas aksi eksplisit (klik
"Get" di dashboard), supaya tidak membakar kuota / memicu banned.

Protokol CLI: baca satu baris JSON dari stdin, tulis satu baris JSON ke stdout.

Mode "list" -- input: {"mode":"list","accessToken":str}
  output: {"ok":true,"apps":[{appId,name,category,targetType,logo,url,note,
                               items:[{itemId,itemName,url}]}]}
        | {"ok":false,"error":str}

Mode "get-cookies" -- input: {"mode":"get-cookies","accessToken":str,"itemId":str}
  (url tidak diperlukan: itemId cukup, endpoint aslinya
   GET /extensions/get-cookies/{itemId} -- bukan POST dengan body seperti
   dugaan awal; bentuk ini ditemukan lewat percobaan langsung, bukan dari
   kode ekstensi.)
  output: {"ok":true,"cookies":[...format Cookie-Editor, identik persis...]}
        | {"ok":false,"error":str}
"""
import json
import sys

from curl_cffi import requests

API = "https://consumer-api.premiumportal.id"


def _get(session, headers, path):
    r = session.get(f"{API}{path}", headers=headers, timeout=25)
    return r


def list_apps(session, headers):
    r = _get(session, headers, "/extensions/init/full")
    if r.status_code != 200:
        return {"ok": False, "error": f"init/full status {r.status_code}: {r.text[:300]}"}
    try:
        payload = r.json()
    except Exception:
        return {"ok": False, "error": f"init/full bukan JSON: {r.text[:300]}"}
    apps_raw = (payload.get("data") or {}).get("application") or []
    apps = []
    for a in apps_raw:
        items = [
            {"itemId": it.get("_id"), "itemName": it.get("itemName"), "url": it.get("url")}
            for it in (a.get("items") or [])
        ]
        apps.append(
            {
                "appId": a.get("_id"),
                "name": a.get("name"),
                "category": a.get("category"),
                "targetType": a.get("targetType"),
                "logo": a.get("logo"),
                "url": a.get("url"),
                "note": a.get("note"),
                "isDesktopOnly": a.get("isDesktopOnly"),
                "items": items,
            }
        )
    return {"ok": True, "apps": apps}


# Nama-nama field cookie umum yang kemungkinan dipakai backend; kita coba semua
# supaya tahan terhadap variasi kapitalisasi (expirationDate vs expires vs expiry).
def _normalize_cookie(raw: dict) -> dict | None:
    name = raw.get("name")
    value = raw.get("value")
    domain = raw.get("domain")
    if not name or value is None or not domain:
        return None
    exp = raw.get("expirationDate") or raw.get("expires") or raw.get("expiry")
    host_only = raw.get("hostOnly")
    if host_only is None:
        host_only = not str(domain).startswith(".")
    same_site_raw = (raw.get("sameSite") or "unspecified").lower()
    same_site_map = {
        "no_restriction": "no_restriction",
        "none": "no_restriction",
        "lax": "lax",
        "strict": "strict",
    }
    out = {
        "domain": domain,
        "hostOnly": bool(host_only),
        "httpOnly": bool(raw.get("httpOnly", False)),
        "name": name,
        "path": raw.get("path") or "/",
        "sameSite": same_site_map.get(same_site_raw, "unspecified"),
        "secure": bool(raw.get("secure", True)),
        "session": exp is None,
        "storeId": "0",
        "value": value,
    }
    if exp is not None:
        try:
            out["expirationDate"] = float(exp)
        except (TypeError, ValueError):
            pass
    return out


def _find_cookie_list(node):
    """Cari array cookie di dalam struktur response apapun bentuknya."""
    if isinstance(node, list):
        if node and isinstance(node[0], dict) and "name" in node[0] and "value" in node[0]:
            return node
        for item in node:
            found = _find_cookie_list(item)
            if found:
                return found
        return None
    if isinstance(node, dict):
        for key in ("items", "cookies", "data"):
            if key in node:
                found = _find_cookie_list(node[key])
                if found:
                    return found
        for v in node.values():
            found = _find_cookie_list(v)
            if found:
                return found
    return None


def get_cookies(session, headers, item_id):
    # Kontrak asli: GET /extensions/get-cookies/{itemId} -> {"data":{"items":[...]}}
    # (ditemukan lewat percobaan langsung; kode ekstensi memanggilnya dengan
    # {itemId, url} sebagai argumen fungsi React-Query, bukan body HTTP).
    r = _get(session, headers, f"/extensions/get-cookies/{item_id}")
    if r.status_code != 200:
        return {"ok": False, "error": f"get-cookies status {r.status_code}: {r.text[:400]}"}
    try:
        payload = r.json()
    except Exception:
        return {"ok": False, "error": f"get-cookies bukan JSON: {r.text[:400]}"}
    raw_list = _find_cookie_list(payload)
    if raw_list is None:
        return {"ok": False, "error": "unrecognized response format (cookie structure not found)"}
    cookies = [c for c in (_normalize_cookie(rc) for rc in raw_list) if c is not None]
    return {"ok": True, "cookies": cookies}


def main():
    req = json.loads(sys.stdin.read())
    mode = req.get("mode")
    access_token = req.get("accessToken")
    if not access_token:
        print(json.dumps({"ok": False, "error": "accessToken is required"}))
        return

    session = requests.Session(impersonate="chrome120")
    # "pemanasan" sesi -- lihat catatan di portal_client.py: request pertama di
    # sesi baru harus GET biasa dulu sebelum action/API lain diterima backend.
    session.get("https://premiumportal.id/", timeout=20)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    if mode == "list":
        result = list_apps(session, headers)
    elif mode == "get-cookies":
        item_id = req.get("itemId")
        if not item_id:
            result = {"ok": False, "error": "itemId is required"}
        else:
            result = get_cookies(session, headers, item_id)
    else:
        result = {"ok": False, "error": f"unknown mode: {mode!r}"}

    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))
