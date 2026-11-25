import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { api, type AccountDto } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { AppsExplorer } from "@/components/AppsExplorer";

export function AccountPage({ accountId, onBack }: { accountId: string; onBack: () => void }) {
  const [account, setAccount] = useState<AccountDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setAccount(await api.account(accountId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await api.refreshAccount(accountId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-full bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-semibold text-brand">{account?.label ?? accountId}</h1>
              {account?.isPrimary && <Badge variant="secondary">Primary</Badge>}
              {account && <StatusBadge status={account.status} />}
            </div>
            <p className="text-sm text-muted-foreground">{account?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={!account || (account.status !== "valid" && account.status !== "expired")}
            onClick={() => account && window.open(api.cookiesUrl(account.id), "_blank")}
          >
            <Download className="size-4" />
            Export session
          </Button>
          <Button variant="outline" disabled={refreshing} onClick={() => void handleRefresh()}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Signing in…" : "Refresh"}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
        {account?.lastError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {account.lastError}
          </p>
        )}

        <AppsExplorer accountId={accountId} />

        {error && <p className="text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}
