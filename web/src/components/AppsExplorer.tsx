import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Download, RefreshCw, Search } from "lucide-react";
import { api, type AppDto, type ItemDto } from "@/lib/api";

function timeAgo(ts: number | null) {
  if (!ts) return "never";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TARGET_LABEL: Record<string, string> = {
  cookies: "Cookie (Get available)",
  autofill: "Form autofill",
  list: "Account list",
  link: "Direct link",
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
            <button type="button" onClick={() => setSelectedApp(null)} className="rounded-full p-1 hover:bg-accent" aria-label="Back to app list">
              <ChevronLeft className="size-4" />
            </button>
          )}
          {selectedApp ? selectedApp.name : "App list"}
        </CardTitle>
        <CardDescription>
          {selectedApp
            ? "Click \"Get\" to fetch this item's cookies (manual, once per click -- some apps have a daily limit set by the provider)."
            : "The catalog syncs automatically on sign-in/refresh. Search to narrow it down."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={selectedApp ? "Search items/account slots…" : "Search apps (Netflix, ChatGPT, etc.)…"}
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
                  ? "No app catalog yet. Wait for the worker to sign in once, or ask an admin to refresh this account."
                  : "No apps match your search."}
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
                This app uses the <strong>{TARGET_LABEL[selectedApp.targetType ?? ""] ?? selectedApp.targetType}</strong>,
                method; automatic cookie export is not supported for it yet.
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
                <p className="text-sm text-muted-foreground">No items match your search.</p>
              )}
              {filteredItems?.map((item) => (
                <li key={item.itemId} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.itemName ?? item.itemId}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.lastCookieCount != null ? `${item.lastCookieCount} cookie · ${timeAgo(item.lastFetchedAt)}` : "never fetched"}
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
