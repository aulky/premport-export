import { useCallback, useEffect, useRef, useState } from "react";
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
import { toast } from "@/lib/toast";

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
  // Hanya sesi yang tadinya aktif yang bisa "berakhir". Pengunjung baru juga
  // mendapat 401 dari /api/me, tapi dia tidak boleh melihat pesan sesi habis.
  const signedIn = useRef(false);
  useEffect(() => {
    signedIn.current = !!me;
  }, [me]);

  const endSession = useCallback(() => {
    if (!signedIn.current) return;
    signedIn.current = false;
    setSessionNotice("Your session has expired. Please sign in again.");
    setMe(null);
    window.history.replaceState({}, "", "/login");
    setPath("/login");
  }, []);

  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
    window.addEventListener("unauthorized", endSession);
    return () => window.removeEventListener("unauthorized", endSession);
  }, [endSession]);

  // Auto-logout tepat saat sesi berakhir, tanpa menunggu pengguna mengklik apa pun
  // dulu (lihat SESSION_TTL_SEC/"/api/settings/session" di server).
  useEffect(() => {
    if (!me?.expiresAt) return;
    const msLeft = me.expiresAt * 1000 - Date.now();
    const t = window.setTimeout(endSession, Math.max(0, msLeft));
    return () => window.clearTimeout(t);
  }, [me?.expiresAt, endSession]);

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
    navigate("/login");
  }

  // Halaman login ada di /login (landing page publik di "/"). Samakan URL dengan
  // yang tampil: belum login -> /login, sudah login tapi masih di /login -> "/".
  useEffect(() => {
    if (me === undefined) return;
    const want = me ? (path === "/login" ? "/" : null) : path === "/login" ? null : "/login";
    if (want) {
      window.history.replaceState({}, "", want);
      setPath(want);
    }
  }, [me, path]);

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
            toast.success("Signed in", `Welcome, ${who.username}.`);
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
