import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { api, type AccountDto } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { AppsExplorer } from "@/components/AppsExplorer";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/lib/me";

export function AccountPage({ accountId, onBack }: { accountId: string; onBack: () => void }) {
  const isAdmin = useIsAdmin();
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
      <PageHeader
        leading={
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
        }
        title={
          <>
            <span className="truncate">{account?.label ?? accountId}</span>
            <span className="hidden items-center gap-2 md:flex">
              {account?.isPrimary && <Badge variant="secondary">Primary</Badge>}
              {account && <StatusBadge status={account.status} />}
            </span>
          </>
        }
        subtitle={account?.email}
        actions={
          isAdmin && (
          <>
            <Button
              variant="secondary"
              disabled={!account || (account.status !== "valid" && account.status !== "expired")}
              onClick={() => account && window.open(api.cookiesUrl(account.id), "_blank")}
              aria-label="Export session"
              title="Export session"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export session</span>
            </Button>
            <Button variant="outline" disabled={refreshing} onClick={() => void handleRefresh()} aria-label="Refresh" title="Refresh">
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Signing in…" : "Refresh"}</span>
            </Button>
          </>
          )
        }
      />

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
