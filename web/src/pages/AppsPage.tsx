import { useEffect, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AppsExplorer } from "@/components/AppsExplorer";
import { api, type AccountDto } from "@/lib/api";

/** Halaman khusus untuk menjelajah katalog app + ambil cookie, lintas akun. */
export function AppsPage({ accountId, onSelectAccount }: { accountId: string | null; onSelectAccount: (id: string) => void }) {
  const [accounts, setAccounts] = useState<AccountDto[] | null>(null);

  useEffect(() => {
    void api.accounts().then((list) => {
      setAccounts(list);
      if (!accountId && list.length > 0) onSelectAccount(list[0]!.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = accounts?.find((a) => a.id === accountId) ?? null;

  return (
    <div className="min-h-full bg-background">
      <header className="hidden border-b border-border bg-card/70 px-6 py-4 backdrop-blur lg:block">
        <h1 className="font-mono text-lg font-semibold text-brand">Apps</h1>
        <p className="text-sm text-muted-foreground">Jelajahi katalog app & ambil cookie per item/slot akun.</p>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Akun</label>
          {!accounts ? (
            <Skeleton className="h-10 w-full max-w-xs" />
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada akun. Tambahkan dulu lewat .env.</p>
          ) : (
            <Select value={accountId ?? undefined} onValueChange={onSelectAccount}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Pilih akun…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label} {a.isPrimary && <Badge variant="secondary">Primary</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selected && <AppsExplorer accountId={selected.id} />}
      </main>
    </div>
  );
}
