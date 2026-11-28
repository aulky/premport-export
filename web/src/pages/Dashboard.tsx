import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleCheck, Download, KeyRound, LayoutGrid, RefreshCw, Search, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { api, type AccountDto, type RunDto } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/lib/me";
import { cn, plural } from "@/lib/utils";
import { toast } from "@/lib/toast";

function timeAgo(ts: number | null) {
  if (!ts) return "—";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function untilText(ts: number | null) {
  if (!ts) return "—";
  const s = ts - Math.floor(Date.now() / 1000);
  if (s <= 0) return "expired";
  if (s < 3600) return `${Math.floor(s / 60)}m left`;
  if (s < 86400) return `${Math.floor(s / 3600)}h left`;
  return `${Math.floor(s / 86400)}d left`;
}

const RUN_ICON: Record<RunDto["kind"], LucideIcon> = {
  check: CircleCheck,
  login: KeyRound,
  "apps-sync": LayoutGrid,
  "item-fetch": Download,
};

export function Dashboard({ onOpenAccount, onOpenLogs }: { onOpenAccount: (id: string) => void; onOpenLogs: () => void }) {
  const isAdmin = useIsAdmin();
  const [accounts, setAccounts] = useState<AccountDto[] | null>(null);
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [search, setSearch] = useState("");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [a, r] = await Promise.all([api.accounts(), isAdmin ? api.runs(30) : Promise.resolve([])]);
      setAccounts(a);
      setRuns(r);
      setError(null);
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
    const label = accounts?.find((a) => a.id === id)?.label ?? id;
    try {
      await api.refreshAccount(id);
      toast.success("Account refreshed", label);
      await load();
    } catch (e) {
      toast.error(`Could not refresh ${label}`, (e as Error).message);
    } finally {
      setRefreshingId(null);
    }
  }

  async function refreshAll() {
    setRefreshingAll(true);
    try {
      const { results } = await api.refreshAll();
      const failed = results.filter((r) => !r.ok).length;
      if (failed) toast.error("Refresh finished with errors", `${failed} of ${plural(results.length, "account")} failed.`);
      else toast.success("All accounts refreshed", plural(results.length, "account"));
      await load();
    } catch (e) {
      toast.error("Could not refresh accounts", (e as Error).message);
    } finally {
      setRefreshingAll(false);
    }
  }

  function actionsFor(a: AccountDto) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshingId === a.id}
          onClick={() => void refreshOne(a.id)}
          aria-label={`Refresh ${a.label}`}
          title="Refresh"
        >
          <RefreshCw className={`size-3.5 ${refreshingId === a.id ? "animate-spin" : ""}`} />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={a.status !== "valid" && a.status !== "expired"}
          onClick={() => {
            window.open(api.cookiesUrl(a.id), "_blank");
            toast.success("Download started", `cookie.json for ${a.label}`);
          }}
        >
          Export cookie.json
        </Button>
      </>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Dashboard"
        subtitle="Account and cookie status, always up to date"
        actions={
          isAdmin && (
          <Button variant="secondary" disabled={refreshingAll} onClick={() => void refreshAll()} aria-label="Refresh All" title="Refresh All">
            <RefreshCw className={`size-4 ${refreshingAll ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshingAll ? "Refreshing all…" : "Refresh All"}</span>
          </Button>
          )
        }
      />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <StatCard label="Total accounts" value={summary.total} icon={Users} />
          <StatCard
            label="Active"
            value={summary.valid}
            icon={CircleCheck}
            tone="success"
            share={summary.total ? summary.valid / summary.total : undefined}
          />
          <StatCard label="Needs attention" value={summary.error} icon={TriangleAlert} tone={summary.error ? "destructive" : undefined} />
        </div>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Accounts & cookies</CardTitle>
            <CardDescription>
              The worker signs in again automatically before a session expires. The first account (<strong>Primary</strong>)
              keeps being retried even if other accounts fail to sign in.
            </CardDescription>
            <div className="relative mt-2 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                No accounts yet. An admin has to add <code>ACCOUNT_1_EMAIL</code> / <code>ACCOUNT_1_PASSWORD</code> to{" "}
                <code>.env</code> and restart the worker.
              </p>
            ) : filteredAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts match your search.</p>
            ) : (
              <>
              {/* Layar kecil: satu kartu per akun, supaya status dan tombol aksi
                  tidak tersembunyi di balik tabel yang harus digeser ke samping. */}
              <ul className="flex flex-col gap-3 md:hidden">
                {filteredAccounts.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border bg-surface/60 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                          {a.label}
                          {a.isPrimary && <Badge variant="secondary">Primary</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.status === "error" && a.lastError && (
                      <p className="mt-2 line-clamp-2 text-xs text-destructive" title={a.lastError}>
                        {a.lastError}
                      </p>
                    )}
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Checked</dt>
                        <dd className="font-medium">{timeAgo(a.lastCheckedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Session ends</dt>
                        <dd className="font-medium">{untilText(a.expiresAt)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-3">
                      <Button variant="outline" size="sm" onClick={() => onOpenAccount(a.id)}>
                        {plural(a.appCount, "app")}
                      </Button>
                      {isAdmin && <div className="ml-auto flex items-center gap-1.5">{actionsFor(a)}</div>}
                    </div>
                  </li>
                ))}
              </ul>
              <Table containerClassName="hidden md:block">
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checked</TableHead>
                    <TableHead>Session ends</TableHead>
                    <TableHead>Apps</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                          {plural(a.appCount, "app")}
                        </Button>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">{actionsFor(a)}</div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
        <Card className="shadow-panel">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Sign-ins, session checks, app sync, and cookie fetches.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenLogs()}>
                View all logs
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col text-sm">
              {runs.slice(0, 8).map((r) => {
                const Icon = RUN_ICON[r.kind] ?? CircleCheck;
                return (
                  <li key={r.id} className="flex items-center gap-3 border-b border-border/60 py-2.5 first:pt-0 last:border-0 last:pb-0">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-content-center rounded-lg",
                        r.ok ? "bg-secondary text-muted-foreground" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{r.account_id}</span>
                        <span className="text-muted-foreground"> · {r.kind}</span>
                      </div>
                      <div className={cn("truncate text-xs", r.ok ? "text-muted-foreground" : "text-destructive")} title={r.message ?? ""}>
                        {r.message || (r.ok ? "Done" : "Failed")}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(r.at)}</span>
                  </li>
                );
              })}
              {runs.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
            </ul>
          </CardContent>
        </Card>
        )}
      </main>

      {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  share,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "success" | "destructive";
  /** 0..1 -- kalau diisi, tampil sebagai bar tipis di bawah angka. */
  share?: number;
}) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-start justify-between gap-3 max-sm:px-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs leading-tight font-medium text-muted-foreground sm:text-sm">{label}</span>
          <span className={cn("text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl", tone === "destructive" && "text-destructive")}>
            {value}
          </span>
          {share !== undefined && (
            <div className="mt-1 hidden items-center gap-2 sm:flex">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-success-foreground/70 transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{Math.round(share * 100)}%</span>
            </div>
          )}
        </div>
        <span
          className={cn(
            "hidden size-10 shrink-0 place-content-center rounded-lg sm:grid",
            tone === "success"
              ? "bg-success text-success-foreground"
              : tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : "bg-accent text-brand",
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
