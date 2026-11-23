import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LogIn, ShieldCheck, RefreshCcw, Cookie, Search } from "lucide-react";
import { api, type AccountDto, type RunDto } from "@/lib/api";

function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}d lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`;
  return `${Math.floor(s / 86400)}h lalu`;
}

const KIND_META: Record<string, { label: string; icon: typeof LogIn; tone: string }> = {
  login: { label: "Login / refresh", icon: LogIn, tone: "text-brand" },
  check: { label: "Cek sesi", icon: ShieldCheck, tone: "text-muted-foreground" },
  "apps-sync": { label: "Sinkron katalog app", icon: RefreshCcw, tone: "text-highlight" },
  "item-fetch": { label: "Ambil cookie (Get)", icon: Cookie, tone: "text-success-foreground" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "item-fetch", label: "Ambil cookie" },
  { key: "login", label: "Login / refresh" },
  { key: "apps-sync", label: "Sinkron app" },
  { key: "check", label: "Cek sesi" },
];

export function LogsPage() {
  const [runs, setRuns] = useState<RunDto[] | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [r, a] = await Promise.all([api.runs(300), api.accounts()]);
      setRuns(r);
      setAccounts(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, []);

  const labelFor = useMemo(() => {
    const m = new Map(accounts.map((a) => [a.id, a.label]));
    return (id: string) => m.get(id) ?? id;
  }, [accounts]);

  const filtered = useMemo(() => {
    if (!runs) return null;
    const q = search.trim().toLowerCase();
    return runs.filter((r) => {
      if (filter !== "all" && r.kind !== filter) return false;
      if (!q) return true;
      return labelFor(r.account_id).toLowerCase().includes(q) || (r.message ?? "").toLowerCase().includes(q);
    });
  }, [runs, filter, search, labelFor]);

  return (
    <div className="min-h-full bg-background">
      <header className="hidden border-b border-border bg-card/70 px-6 py-4 backdrop-blur lg:block">
        <h1 className="font-mono text-lg font-semibold text-brand">Logs</h1>
        <p className="text-sm text-muted-foreground">Riwayat login, pengecekan sesi, sinkron app, dan pengambilan cookie.</p>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="lg:hidden">Logs</CardTitle>
            <CardDescription className="lg:hidden">
              Riwayat login, pengecekan sesi, sinkron app, dan pengambilan cookie.
            </CardDescription>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Cari akun atau pesan log…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={filter === f.key ? "default" : "outline"}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!filtered ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada log yang cocok.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {filtered.map((r) => {
                  const meta = KIND_META[r.kind] ?? { label: r.kind, icon: ShieldCheck, tone: "text-muted-foreground" };
                  const Icon = meta.icon;
                  return (
                    <li key={r.id} className="flex items-start gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${meta.tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="font-medium text-foreground">{labelFor(r.account_id)}</span>
                          <Badge variant={r.ok ? "success" : "destructive"}>{meta.label}</Badge>
                          {!r.ok && <span className="text-xs text-destructive">gagal</span>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={r.message ?? ""}>
                          {r.message}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}
