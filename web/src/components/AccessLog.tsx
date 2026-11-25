import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X } from "lucide-react";
import { api, type AccessLogDto } from "@/lib/api";
import { Pagination, pageCountOf } from "@/components/Pagination";
import { plural } from "@/lib/utils";

const EVENT_LABEL: Record<AccessLogDto["event"], string> = {
  login: "Sign-in",
  logout: "Sign-out",
  "cookie-get": "Get cookie",
  "cookie-download": "Download cookie",
  "session-download": "Download session cookie",
};

const formatTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" });

/** Ringkasan "Chrome · Windows"; user-agent lengkap tetap ada di tooltip. */
function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const find = (list: [RegExp, string][]) => list.find(([re]) => re.test(ua))?.[1];
  const browser = find([
    [/Edg\//, "Edge"],
    [/OPR\//, "Opera"],
    [/Firefox\//, "Firefox"],
    [/Chrome\/|CriOS\//, "Chrome"],
    [/Safari\//, "Safari"],
  ]);
  const os = find([
    [/Windows/, "Windows"],
    [/Android/, "Android"],
    [/iPhone|iPad/, "iOS"],
    [/Mac OS X/, "macOS"],
    [/Linux/, "Linux"],
  ]);
  return browser ? [browser, os].filter(Boolean).join(" · ") : ua.slice(0, 40);
}

export function AccessLog({ type, ip, onIpChange }: { type: "auth" | "cookie"; ip: string; onIpChange: (ip: string) => void }) {
  const [data, setData] = useState<{ rows: AccessLogDto[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPage(1), [ip]);

  useEffect(() => {
    let stale = false; // abaikan respons filter lama yang datang terlambat
    const load = () =>
      api
        .accessLogs(type, page, ip.trim())
        .then((r) => {
          if (stale) return;
          setData(r);
          setError(null);
          if (page > pageCountOf(r.total)) setPage(pageCountOf(r.total));
        })
        .catch((e: Error) => !stale && setError(e.message));
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => {
      stale = true;
      clearInterval(t);
    };
  }, [type, page, ip]);

  const rows = data?.rows;

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardDescription>
          {type === "auth"
            ? "Who signed in to the dashboard, including attempts with a wrong password."
            : "Which cookies were fetched and downloaded. Click an IP to see only its activity."}
        </CardDescription>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Filter by IP…" value={ip} onChange={(e) => onIpChange(e.target.value)} />
          </div>
          {ip && (
            <Button size="sm" variant="outline" onClick={() => onIpChange("")}>
              <X className="size-4" /> Clear filter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!rows ? (
          <Skeleton className="h-12 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history{ip ? " for this IP" : ""} yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <button
                    type="button"
                    className="font-mono font-semibold text-brand underline-offset-2 hover:underline"
                    onClick={() => onIpChange(r.ip)}
                  >
                    {r.ip}
                  </button>
                  {r.username && <span className="font-semibold">{r.username}</span>}
                  <Badge variant={r.ok ? "success" : "destructive"}>
                    {EVENT_LABEL[r.event] ?? r.event}
                    {r.ok ? "" : " failed"}
                  </Badge>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatTime(r.at)}</span>
                </div>
                {type === "cookie" && (
                  <p className="text-sm text-foreground">
                    {[r.app_name, r.item_name ?? r.item_id].filter(Boolean).join(" → ") || "Account session"}
                    <span className="text-muted-foreground">
                      {" · "}
                      {r.account_label ?? r.account_id}
                      {r.cookie_count !== null && ` · ${plural(r.cookie_count, "cookie")}`}
                    </span>
                  </p>
                )}
                <p className="break-words text-xs text-muted-foreground" title={r.user_agent ?? ""}>
                  {device(r.user_agent)}
                  {r.message && ` · ${r.message}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination page={page} total={data.total} onChange={setPage} />}
      </CardContent>
    </Card>
  );
}
