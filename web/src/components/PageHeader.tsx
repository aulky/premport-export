import { createContext, useContext } from "react";
import { ChevronDown, LogOut, Menu, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MeContext } from "@/lib/me";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Aksi milik AppShell yang dipakai header di setiap halaman. */
export const ShellContext = createContext<{ openMenu: () => void; logout: () => void }>({
  openMenu: () => {},
  logout: () => {},
});

const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function initialsOf(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/** Trigger di kanan atas header: avatar + nama, dropdown berisi tema dan Log out. */
function ProfileMenu({ onLogout }: { onLogout: () => void }) {
  const me = useContext(MeContext);
  const { pref, setPref } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Account menu"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand text-[11px] text-brand-foreground">{initialsOf(me.username || "?")}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{me.username}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 pb-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{me.username}</div>
          </div>
          <Badge variant={me.role === "admin" ? "highlight" : "secondary"} className="capitalize">
            {me.role}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2.5 py-1.5">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Appearance</div>
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPref(value)}
                title={label}
                aria-pressed={pref === value}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  pref === value ? "bg-card text-foreground shadow-panel" : "hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Header yang menempel di atas saat halaman digulir (konten terlihat samar di
 * baliknya). Menu profil (avatar + nama, dropdown tema & Log out) selalu di
 * kanan, setelah aksi milik halaman.
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
        <ProfileMenu onLogout={logout} />
      </div>
    </header>
  );
}
