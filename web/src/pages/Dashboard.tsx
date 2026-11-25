import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { api, type AccountDto, type RunDto } from "@/lib/api";

function timeAgo(ts: number | null) {
  if (!ts) return "—";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`;
  return `${Math.floor(s / 86400)}h lalu`;
}

function untilText(ts: number | null) {
  if (!ts) return "—";
  const s = ts - Math.floor(Date.now() / 1000);
  if (s <= 0) return "kadaluarsa";
  if (s < 3600) return `${Math.floor(s / 60)}m lagi`;
  if (s < 86400) return `${Math.floor(s / 3600)}j lagi`;
  return `${Math.floor(s / 86400)}h lagi`;
}

export function Dashboard({ onOpenAccount, onOpenLogs }: { onOpenAccount: (id: string) => void; onOpenLogs: () => void }) {
  const [accounts, setAccounts] = useState<AccountDto[] | null>(null);
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [search, setSearch] = useState("");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [a, r] = await Promise.all([api.accounts(), api.runs(30)]);
      setAccounts(a);
      setRuns(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, []);

  const summary = useMemo(() => {
    const list = accounts ?? [];
    return {
      total: list.length,
      valid: list.filter((a) => a.status === "valid").length,
      error: list.filter((a) => a.status === "error" || a.status === "expired").length,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const list = accounts ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => a.label.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [accounts, search]);

  async function refreshOne(id: string) {
    setRefreshingId(id);
    setError(null);
    try {
      await api.refreshAccount(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshingId(null);
    }
  }

  async function refreshAll() {
    setRefreshingAll(true);
    setError(null);
    try {
      await api.refreshAll();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshingAll(false);
    }
  }

  return (
    <div className="min-h-full bg-background">
      <header className="hidden items-center justify-between border-b border-border bg-card/70 px-6 py-4 backdrop-blur lg:flex">
        <div>
          <h1 className="font-mono text-lg font-semibold text-brand">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Status akun dan cookie, selalu up to date</p>
        </div>
        <Button variant="secondary" disabled={refreshingAll} onClick={() => void refreshAll()}>
          <RefreshCw className={`size-4 ${refreshingAll ? "animate-spin" : ""}`} />
          {refreshingAll ? "Me-refresh semua…" : "Refresh All"}
        </Button>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <Button className="lg:hidden" variant="secondary" disabled={refreshingAll} onClick={() => void refreshAll()}>
          <RefreshCw className={`size-4 ${refreshingAll ? "animate-spin" : ""}`} />
          {refreshingAll ? "Me-refresh semua…" : "Refresh All"}
        </Button>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total akun" value={summary.total} />
          <StatCard label="Aktif" value={summary.valid} tone="success" />
          <StatCard label="Perlu perhatian" value={summary.error} tone="destructive" />
        </div>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Akun & cookie</CardTitle>
            <CardDescription>
              Worker login ulang otomatis sebelum sesi kadaluarsa. Akun pertama (<strong>Primary</strong>) tetap dicoba
              terus-menerus walau akun lain gagal login.
            </CardDescription>
            <div className="relative mt-2 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Cari akun…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {!accounts ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada akun. Tambahkan <code>ACCOUNT_1_EMAIL</code> / <code>ACCOUNT_1_PASSWORD</code> di{" "}
                <code>.env</code>, lalu restart worker.
              </p>
            ) : filteredAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada akun yang cocok dengan pencarian.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Akun</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dicek</TableHead>
                    <TableHead>Sesi habis</TableHead>
                    <TableHead>Apps</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          {a.label}
                          {a.isPrimary && <Badge variant="secondary">Primary</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                        {a.status === "error" && a.lastError && (
                          <div className="mt-1 max-w-56 truncate text-xs text-destructive" title={a.lastError}>
                            {a.lastError}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{timeAgo(a.lastCheckedAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{untilText(a.expiresAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => onOpenAccount(a.id)}>
                          {a.appCount} app
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" disabled={refreshingId === a.id} onClick={() => void refreshOne(a.id)}>
                            <RefreshCw className={`size-3.5 ${refreshingId === a.id ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={a.status !== "valid" && a.status !== "expired"}
                            onClick={() => window.open(api.cookiesUrl(a.id), "_blank")}
                          >
                            Export cookie.json
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Aktivitas terbaru</CardTitle>
                <CardDescription>Login, cek sesi, sinkron app, & pengambilan cookie.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenLogs()}>
                Lihat semua log
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {runs.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                  <span className="truncate text-muted-foreground">
                    <span className={r.ok ? "text-success-foreground" : "text-destructive"}>
                      {r.ok ? "✓" : "✗"}
                    </span>{" "}
                    <span className="font-medium text-foreground">{r.account_id}</span> · {r.kind} — {r.message}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.at)}</span>
                </li>
              ))}
              {runs.length === 0 && <p className="text-muted-foreground">Belum ada aktivitas.</p>}
            </ul>
          </CardContent>
        </Card>
      </main>

      {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex flex-col gap-1 pt-6">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={
            "text-3xl font-semibold font-mono " +
            (tone === "success" ? "text-success-foreground" : tone === "destructive" ? "text-destructive" : "text-brand")
          }
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
