import { useState } from "react";
import { LayoutDashboard, LayoutGrid, ScrollText, BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarSection,
  SidebarItem,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { ShellContext } from "@/components/PageHeader";
import { api } from "@/lib/api";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" || p.startsWith("/accounts/") },
  { to: "/apps", label: "Apps", icon: LayoutGrid, match: (p: string) => p.startsWith("/apps") },
  { to: "/logs", label: "Logs", icon: ScrollText, match: (p: string) => p === "/logs" },
  { to: "/tutorial", label: "Tutorial", icon: BookOpen, match: (p: string) => p === "/tutorial" },
];

function SidebarContent({ path, navigate }: { path: string; navigate: (to: string) => void }) {
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
    </Sidebar>
  );
}

export function AppShell({
  path,
  navigate,
  onLogout,
  children,
}: {
  path: string;
  navigate: (to: string) => void;
  onLogout: () => void;
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
        <SidebarContent path={path} navigate={navigate} />
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
            />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-y-auto">
        <ShellContext.Provider value={{ openMenu: () => setMobileOpen(true), logout: () => void handleLogout() }}>
          {children}
        </ShellContext.Provider>
      </div>
    </div>
  );
}
