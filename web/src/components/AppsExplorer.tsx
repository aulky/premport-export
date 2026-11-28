import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Copy, Download, ExternalLink, Eye, EyeOff, RefreshCw, Search } from "lucide-react";
import { api, type AppDto, type CredsDto, type ItemDto, type ListAccountDto } from "@/lib/api";
import { plural } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";
import { toast } from "@/lib/toast";

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
  autofill: "Account credentials (Get available)",
  list: "Account list (Get available)",
  link: "Direct link",
};

/** "autofill" dan "list" sama-sama menampilkan username/password per item, beda di mana fetch-nya dipicu. */
const isCredsType = (targetType: string | null) => targetType === "autofill" || targetType === "list";

/** Baris username/password untuk 1 item "autofill" -- disembunyikan sampai diklik. */
function CredsRow({ creds }: { creds: CredsDto }) {
  const [shown, setShown] = useState(false);
  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy", "The browser blocked clipboard access.");
    }
  }
  const field = (label: string, value: string | null, mask: boolean) =>
    value && (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-xs">{mask && !shown ? "•".repeat(Math.min(value.length, 14)) : value}</span>
        <Button size="icon-sm" variant="ghost" className="size-6 shrink-0" title={`Copy ${label.toLowerCase()}`} onClick={() => void copy(label, value)}>
          <Copy className="size-3" />
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-secondary px-2.5 py-2">
      {field("Username", creds.username, false)}
      <div className="flex items-center gap-1.5">
        {field("Password", creds.password, true)}
        {creds.password && (
          <Button size="icon-sm" variant="ghost" className="size-6 shrink-0" title={shown ? "Hide password" : "Show password"} onClick={() => setShown((v) => !v)}>
            {shown ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </Button>
        )}
      </div>
      {creds.url && (
        <a href={creds.url} target="_blank" rel="noreferrer" className="truncate text-xs text-brand underline-offset-2 hover:underline">
          {creds.url}
        </a>
      )}
    </div>
  );
}

/** Katalog app + item/slot 1 akun -- search, pilih app, pilih item, Get cookie, download. */
export function AppsExplorer({ accountId }: { accountId: string }) {
  const [apps, setApps] = useState<AppDto[] | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppDto | null>(null);
  const [items, setItems] = useState<ItemDto[] | null>(null);
  const [appSearch, setAppSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [busyApp, setBusyApp] = useState(false);
  const [creds, setCreds] = useState<Record<string, CredsDto>>({});
  const [hasFetchedList, setHasFetchedList] = useState(false);

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
    setCreds({});
    setHasFetchedList(false);
    void api.items(accountId, selectedApp.appId).then(setItems);
  }, [accountId, selectedApp]);

  async function reloadItems() {
    if (!selectedApp) return;
    setItems(await api.items(accountId, selectedApp.appId));
  }

  async function handleGet(itemId: string) {
    setBusyItem(itemId);
    try {
      const { cookieCount } = await api.fetchItemCookies(accountId, itemId);
      toast.success("Cookies fetched", plural(cookieCount, "cookie"));
      await reloadItems();
    } catch (e) {
      toast.error("Could not fetch cookies", (e as Error).message);
    } finally {
      setBusyItem(null);
    }
  }

  /** "Get"/"Refresh" -- selalu ambil ulang dari provider dan langsung tampilkan hasilnya. */
  async function handleGetCreds(itemId: string) {
    setBusyItem(itemId);
    try {
      const res = await api.fetchItemCreds(accountId, itemId);
      setCreds((c) => ({ ...c, [itemId]: res }));
      toast.success("Credentials fetched");
      await reloadItems();
    } catch (e) {
      toast.error("Could not fetch credentials", (e as Error).message);
    } finally {
      setBusyItem(null);
    }
  }

  /** "View" -- tampilkan kredensial yang sudah tersimpan, tanpa memanggil provider lagi. */
  async function handleViewCreds(itemId: string) {
    setBusyItem(itemId);
    try {
      setCreds((c) => ({ ...c, [itemId]: null as unknown as CredsDto }));
      const res = await api.itemCreds(accountId, itemId);
      setCreds((c) => ({ ...c, [itemId]: res }));
    } catch (e) {
      toast.error("Could not load credentials", (e as Error).message);
      setCreds((c) => {
        const { [itemId]: _drop, ...rest } = c;
        return rest;
      });
    } finally {
      setBusyItem(null);
    }
  }

  /**
   * App bertipe "list" -- 1 klik mengambil SEMUA akun yang tersedia untuk app
   * ini sekaligus (bukan per item, beda dari autofill), lalu langsung
   * ditampilkan di bawah tiap item yang sesuai.
   */
  async function handleGetListAccounts() {
    if (!selectedApp) return;
    setBusyApp(true);
    try {
      const res = await api.fetchListAccounts(accountId, selectedApp.appId);
      setCreds((c) => {
        const next = { ...c };
        for (const a of res.accounts as ListAccountDto[]) next[a.itemId] = a;
        return next;
      });
      setHasFetchedList(true);
      toast.success("Accounts fetched", plural(res.accounts.length, "account"));
      await reloadItems();
    } catch (e) {
      toast.error("Could not fetch accounts", (e as Error).message);
    } finally {
      setBusyApp(false);
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
          {selectedApp && <AppIcon url={selectedApp.url} className="size-6" />}
          {selectedApp ? selectedApp.name : "App list"}
          {selectedApp?.url && (
            <a
              href={selectedApp.url}
              target="_blank"
              rel="noreferrer"
              title={`Open ${selectedApp.name}'s website`}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          {selectedApp?.targetType === "list" && (
            <Button size="sm" variant="secondary" className="ml-auto" disabled={busyApp} onClick={() => void handleGetListAccounts()}>
              <RefreshCw className={`size-3.5 ${busyApp ? "animate-spin" : ""}`} />
              {hasFetchedList ? "Refresh accounts" : "Get accounts"}
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {selectedApp
            ? selectedApp.targetType === "list"
              ? "Click \"Get accounts\" to fetch every account currently available for this app (manual, once per click)."
              : "Click \"Get\" to fetch this item's cookies or credentials (manual, once per click -- some apps have a daily limit set by the provider)."
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
                  <AppIcon url={app.url} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{app.name}</div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                      {app.category && <span className="truncate capitalize">{app.category}</span>}
                      {app.category && <span>·</span>}
                      <span>{plural(app.itemCount, "item")}</span>
                    </div>
                    {/* Layar sempit: badge di bawah nama supaya nama app tidak terpotong. */}
                    <Badge
                      variant={app.targetType === "cookies" || isCredsType(app.targetType) ? "success" : "secondary"}
                      className="mt-1.5 max-w-full whitespace-normal text-left sm:hidden"
                    >
                      {TARGET_LABEL[app.targetType ?? ""] ?? app.targetType ?? "?"}
                    </Badge>
                  </div>
                  <Badge
                    variant={app.targetType === "cookies" || isCredsType(app.targetType) ? "success" : "secondary"}
                    className="hidden shrink-0 sm:inline-flex"
                  >
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
            {selectedApp.targetType !== "cookies" && !isCredsType(selectedApp.targetType) && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                This app uses the <strong>{TARGET_LABEL[selectedApp.targetType ?? ""] ?? selectedApp.targetType}</strong>,
                method; automatic cookie export is not supported for it yet.
              </p>
            )}
            {selectedApp.targetType === "list" && (
              <p className="rounded-lg bg-warning/60 px-3 py-2 text-xs text-warning-foreground">
                The provider resets this login info weekly (and it may change at any other time too) -- if it stops
                working, click <strong>Refresh accounts</strong> above.
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
                <li key={item.itemId} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.itemName ?? item.itemId}</div>
                      <div className="text-xs text-muted-foreground">
                        {isCredsType(selectedApp.targetType)
                          ? item.lastCredsFetchedAt != null
                            ? `fetched ${timeAgo(item.lastCredsFetchedAt)}`
                            : "never fetched"
                          : item.lastCookieCount != null
                            ? `${plural(item.lastCookieCount, "cookie")} · ${timeAgo(item.lastFetchedAt)}`
                            : "never fetched"}
                        {(isCredsType(selectedApp.targetType) ? item.lastCredsError : item.lastError) && (
                          <span className="text-destructive"> · {isCredsType(selectedApp.targetType) ? item.lastCredsError : item.lastError}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {(item.url ?? selectedApp.url) && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={`Open ${item.itemName ?? "item"}'s website`}
                          onClick={() => window.open(item.url ?? selectedApp.url ?? undefined, "_blank")}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      )}
                      {selectedApp.targetType === "cookies" && (
                        <>
                          <Button size="sm" variant="secondary" disabled={busyItem === item.itemId} onClick={() => void handleGet(item.itemId)}>
                            <RefreshCw className={`size-3.5 ${busyItem === item.itemId ? "animate-spin" : ""}`} />
                            Get
                          </Button>
                          {item.lastCookieCount != null && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              title="Export cookie.json (format Cookie-Editor)"
                              onClick={() => {
                                window.open(api.itemCookiesUrl(accountId, item.itemId), "_blank");
                                toast.success("Download started", item.itemName ?? item.itemId);
                              }}
                            >
                              <Download className="size-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                      {selectedApp.targetType === "autofill" && (
                        <>
                          {item.hasCreds && !creds[item.itemId] && (
                            <Button size="sm" variant="outline" disabled={busyItem === item.itemId} onClick={() => void handleViewCreds(item.itemId)}>
                              <Eye className="size-3.5" />
                              View
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" disabled={busyItem === item.itemId} onClick={() => void handleGetCreds(item.itemId)}>
                            <RefreshCw className={`size-3.5 ${busyItem === item.itemId ? "animate-spin" : ""}`} />
                            {item.hasCreds ? "Refresh" : "Get"}
                          </Button>
                        </>
                      )}
                      {selectedApp.targetType === "list" && item.hasCreds && !creds[item.itemId] && (
                        <Button size="sm" variant="outline" disabled={busyItem === item.itemId} onClick={() => void handleViewCreds(item.itemId)}>
                          <Eye className="size-3.5" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                  {isCredsType(selectedApp.targetType) && creds[item.itemId] && <CredsRow creds={creds[item.itemId]!} />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
