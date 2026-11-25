import { createContext, useContext } from "react";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Aksi milik AppShell yang dipakai header di setiap halaman. */
export const ShellContext = createContext<{ openMenu: () => void; logout: () => void }>({
  openMenu: () => {},
  logout: () => {},
});

/**
 * Header yang menempel di atas saat halaman digulir (konten terlihat samar di
 * baliknya). Tombol Log out selalu di kanan, setelah aksi milik halaman.
 */
export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { openMenu, logout } = useContext(ShellContext);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/70 bg-card/60 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button className="lg:hidden" variant="ghost" size="icon-sm" onClick={openMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        {leading}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-mono text-lg font-semibold text-brand">{title}</h1>
          {subtitle && <p className="hidden truncate text-sm text-muted-foreground sm:block">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Button variant="outline" onClick={logout} aria-label="Log out" title="Log out">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
