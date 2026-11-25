import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Download, RefreshCw, Search } from "lucide-react";
import { api, type AppDto, type ItemDto } from "@/lib/api";

function timeAgo(ts: number | null) {
  if (!ts) return "belum pernah";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}d lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`;
  return `${Math.floor(s / 86400)}h lalu`;
}

const TARGET_LABEL: Record<string, string> = {
  cookies: "Cookie (bisa di-Get)",
  autofill: "Auto-isi form",
  list: "Daftar akun",
  link: "Link langsung",
};

/** Katalog app + item/slot 1 akun -- search, pilih app, pilih item, Get cookie, download. */
export function AppsExplorer({ accountId }: { accountId: string }) {
  const [apps, setApps] = useState<AppDto[] | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppDto | null>(null);
  const [items, setItems] = useState<ItemDto[] | null>(null);
  const [appSearch, setAppSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setApps(null);
    setSelectedApp(null);
    setAppSearch("");
    void api.apps(accountId).then(setApps);
  }, [accountId]);

  useEffect(() => {
    if (!selectedApp) {
      setItems(null);
      return;
    }
    setItems(null);
    void api.items(accountId, selectedApp.appId).then(setItems);
  }, [accountId, selectedApp]);

  async function reloadItems() {
    if (!selectedApp) return;
    setItems(await api.items(accountId, selectedApp.appId));
  }

  async function handleGet(itemId: string) {
    setBusyItem(itemId);
    setError(null);
    try {
      await api.fetchItemCookies(accountId, itemId);
      await reloadItems();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyItem(null);
    }
  }

  const filteredApps = useMemo(() => {
    if (!apps) return null;
    const q = appSearch.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.name.toLowerCase().includes(q) || (a.category ?? "").toLowerCase().includes(q));
  }, [apps, appSearch]);

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (it.itemName ?? it.itemId).toLowerCase().includes(q));
  }, [items, itemSearch]);

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {selectedApp && (
            <button type="button" onClick={() => setSelectedApp(null)} className="rounded-full p-1 hover:bg-accent" aria-label="Kembali ke daftar app">
              <ChevronLeft className="size-4" />
            </button>
          )}
          {selectedApp ? selectedApp.name : "Daftar app"}
        </CardTitle>
        <CardDescription>
          {selectedApp
            ? "Klik \"Get\" untuk mengambil cookie item ini (manual, 1x per klik -- beberapa app punya limit harian dari penyedia)."
            : "Katalog disinkron otomatis saat login/refresh. Cari untuk mempersempit."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={selectedApp ? "Cari item/slot akun…" : "Cari app (Netflix, ChatGPT, dst.)…"}
            value={selectedApp ? itemSearch : appSearch}
            onChange={(e) => (selectedApp ? setItemSearch(e.target.value) : setAppSearch(e.target.value))}
          />
        </div>

        {!selectedApp && (
          <ul className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto">
            {filteredApps === null && (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            )}
            {filteredApps?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {apps?.length === 0
                  ? "Belum ada katalog app. Klik \"Refresh\" akun ini, atau tunggu worker login sekali."
                  : "Tidak ada app yang cocok dengan pencarian."}
              </p>
            )}
            {filteredApps?.map((app) => (
              <li key={app.appId}>
                <button
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{app.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {app.category && <span className="capitalize">{app.category}</span>}
                      <span>·</span>
                      <span>{app.itemCount} item</span>
                    </div>
                  </div>
                  <Badge variant={app.targetType === "cookies" ? "success" : "secondary"}>
                    {TARGET_LABEL[app.targetType ?? ""] ?? app.targetType ?? "?"}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedApp && (
          <div className="flex flex-col gap-2">
            {selectedApp.note && (
              <div
                className="rounded-lg bg-warning/60 px-3 py-2 text-xs text-warning-foreground [&_p]:m-0"
                dangerouslySetInnerHTML={{ __html: selectedApp.note }}
              />
            )}
            {selectedApp.targetType !== "cookies" && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                App ini pakai metode <strong>{TARGET_LABEL[selectedApp.targetType ?? ""] ?? selectedApp.targetType}</strong>,
                belum didukung export cookie otomatis di dashboard ini.
              </p>
            )}
            <ul className="flex max-h-[24rem] flex-col gap-1.5 overflow-y-auto">
              {filteredItems === null && (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              )}
              {filteredItems?.length === 0 && items !== null && (
                <p className="text-sm text-muted-foreground">Tidak ada item yang cocok dengan pencarian.</p>
              )}
              {filteredItems?.map((item) => (
                <li key={item.itemId} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.itemName ?? item.itemId}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.lastCookieCount != null ? `${item.lastCookieCount} cookie · ${timeAgo(item.lastFetchedAt)}` : "belum pernah diambil"}
                      {item.lastError && <span className="text-destructive"> · {item.lastError}</span>}
                    </div>
                  </div>
                  {selectedApp.targetType === "cookies" && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant="secondary" disabled={busyItem === item.itemId} onClick={() => void handleGet(item.itemId)}>
                        <RefreshCw className={`size-3.5 ${busyItem === item.itemId ? "animate-spin" : ""}`} />
                        Get
                      </Button>
                      {item.lastCookieCount != null && (
                        <Button
                          size="icon-sm"
                          variant="outline"
                          title="Export cookie.json (format Cookie-Editor)"
                          onClick={() => window.open(api.itemCookiesUrl(accountId, item.itemId), "_blank")}
                        >
                          <Download className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
