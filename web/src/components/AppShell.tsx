import { useState } from "react";
import { LayoutDashboard, LayoutGrid, ScrollText, BookOpen, Menu, X, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarSection,
  SidebarItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { APP_NAME, Logo } from "@/components/Logo";
import { api } from "@/lib/api";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" || p.startsWith("/accounts/") },
  { to: "/apps", label: "Apps", icon: LayoutGrid, match: (p: string) => p.startsWith("/apps") },
  { to: "/logs", label: "Logs", icon: ScrollText, match: (p: string) => p === "/logs" },
  { to: "/tutorial", label: "Tutorial", icon: BookOpen, match: (p: string) => p === "/tutorial" },
];

function SidebarContent({ path, navigate, onLogout }: { path: string; navigate: (to: string) => void; onLogout: () => void }) {
  return (
    <Sidebar className="h-full w-full rounded-none p-3 ring-0 border-r border-sidebar-border">
      <SidebarHeader>
        <Logo className="size-9 shrink-0" />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-tight">Cookie Scraping</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/60">Tools</div>
        </div>
      </SidebarHeader>

      <SidebarSection label="Menu">
        {NAV.map((item) => (
          <SidebarItem key={item.to} icon={<item.icon />} active={item.match(path)} onClick={() => navigate(item.to)}>
            {item.label}
          </SidebarItem>
        ))}
      </SidebarSection>

      <SidebarFooter>
        <SidebarItem icon={<LogOut />} onClick={onLogout}>
          Log out
        </SidebarItem>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({
  path,
  navigate,
  onLogout,
  title,
  children,
}: {
  path: string;
  navigate: (to: string) => void;
  onLogout: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    setMobileOpen(false);
    try {
      await api.logout();
    } finally {
      onLogout();
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar -- tetap tampil di layar besar */}
      <div className="hidden shrink-0 lg:flex lg:w-60">
        <SidebarContent path={path} navigate={navigate} onLogout={() => void handleLogout()} />
      </div>

      {/* Drawer -- overlay di layar kecil/medium */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full w-60 shadow-raised">
            <SidebarContent
              path={path}
              navigate={(to) => {
                setMobileOpen(false);
                navigate(to);
              }}
              onLogout={() => void handleLogout()}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen((o) => !o)} aria-label="Open menu">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Logo className="size-7 shrink-0" />
          <span className="text-sm font-semibold text-brand">{title ?? APP_NAME}</span>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
