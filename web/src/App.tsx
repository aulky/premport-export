import { useEffect, useState } from "react";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { AccountPage } from "@/pages/AccountPage";
import { AppsPage } from "@/pages/AppsPage";
import { LogsPage } from "@/pages/LogsPage";
import { TutorialPage } from "@/pages/TutorialPage";
import { AppShell } from "@/components/AppShell";
import { UsersPage } from "@/pages/UsersPage";
import { api, type MeDto } from "@/lib/api";
import { MeContext } from "@/lib/me";
import { ThemeContext, useThemeState } from "@/lib/theme";

function parseAccountId(pathname: string): string | null {
  const m = /^\/accounts\/([^/]+)\/?$/.exec(pathname);
  return m ? decodeURIComponent(m[1]!) : null;
}

function parseAppsAccountId(pathname: string): string | null {
  const m = /^\/apps\/([^/]+)\/?$/.exec(pathname);
  return m ? decodeURIComponent(m[1]!) : null;
}

export function App() {
  const theme = useThemeState();
  const [me, setMe] = useState<MeDto | null | undefined>(undefined); // undefined = masih dicek
  const [path, setPath] = useState(() => window.location.pathname);
  // Pesan di halaman login setelah sesi berakhir sendiri (bukan logout manual).
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
    const onUnauthorized = () => {
      setSessionNotice((prev) => prev ?? "Your session has expired. Please sign in again.");
      setMe(null);
    };
    window.addEventListener("unauthorized", onUnauthorized);
    return () => window.removeEventListener("unauthorized", onUnauthorized);
  }, []);

  // Auto-logout tepat saat sesi berakhir, tanpa menunggu pengguna mengklik apa pun
  // dulu (lihat SESSION_TTL_SEC/"/api/settings/session" di server).
  useEffect(() => {
    if (!me?.expiresAt) return;
    const msLeft = me.expiresAt * 1000 - Date.now();
    const expire = () => {
      setSessionNotice("Your session has expired. Please sign in again.");
      setMe(null);
    };
    if (msLeft <= 0) {
      expire();
      return;
    }
    const t = window.setTimeout(expire, msLeft);
    return () => window.clearTimeout(t);
  }, [me?.expiresAt]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(to: string) {
    window.history.pushState({}, "", to);
    setPath(to);
  }

  function handleLogout() {
    setSessionNotice(null);
    setMe(null);
    navigate("/");
  }

  if (me === undefined) return null;
  if (!me) {
    return (
      <ThemeContext.Provider value={theme}>
        <Login
          notice={sessionNotice}
          onSuccess={(who) => {
            setSessionNotice(null);
            navigate("/");
            setMe(who);
          }}
        />
      </ThemeContext.Provider>
    );
  }
  const isAdmin = me.role === "admin";

  const accountId = parseAccountId(path);
  let page: React.ReactNode;
  if (accountId) {
    page = <AccountPage accountId={accountId} onBack={() => navigate("/")} />;
  } else if (path === "/apps" || path.startsWith("/apps/")) {
    const appsAccountId = parseAppsAccountId(path);
    page = <AppsPage accountId={appsAccountId} onSelectAccount={(id) => navigate(`/apps/${encodeURIComponent(id)}`)} />;
  } else if (path === "/logs" && isAdmin) {
    page = <LogsPage />;
  } else if (path === "/users" && isAdmin) {
    page = <UsersPage />;
  } else if (path === "/tutorial") {
    page = <TutorialPage />;
  } else {
    page = <Dashboard onOpenAccount={(id) => navigate(`/accounts/${encodeURIComponent(id)}`)} onOpenLogs={() => navigate("/logs")} />;
  }

  return (
    <ThemeContext.Provider value={theme}>
      <MeContext.Provider value={me}>
        <AppShell path={path} navigate={navigate} onLogout={handleLogout}>
          {page}
        </AppShell>
      </MeContext.Provider>
    </ThemeContext.Provider>
  );
}
