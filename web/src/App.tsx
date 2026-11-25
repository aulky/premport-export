import { useEffect, useState } from "react";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { AccountPage } from "@/pages/AccountPage";
import { AppsPage } from "@/pages/AppsPage";
import { LogsPage } from "@/pages/LogsPage";
import { TutorialPage } from "@/pages/TutorialPage";
import { AppShell } from "@/components/AppShell";
import { APP_NAME } from "@/components/Logo";

function parseAccountId(pathname: string): string | null {
  const m = /^\/accounts\/([^/]+)\/?$/.exec(pathname);
  return m ? decodeURIComponent(m[1]!) : null;
}

function parseAppsAccountId(pathname: string): string | null {
  const m = /^\/apps\/([^/]+)\/?$/.exec(pathname);
  return m ? decodeURIComponent(m[1]!) : null;
}

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    fetch("/api/accounts", { credentials: "include" })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

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
    setAuthed(false);
    navigate("/");
  }

  if (authed === null) return null;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const accountId = parseAccountId(path);
  let page: React.ReactNode;
  let title = APP_NAME;
  if (accountId) {
    page = <AccountPage accountId={accountId} onBack={() => navigate("/")} />;
    title = "Akun";
  } else if (path === "/apps" || path.startsWith("/apps/")) {
    const appsAccountId = parseAppsAccountId(path);
    page = <AppsPage accountId={appsAccountId} onSelectAccount={(id) => navigate(`/apps/${encodeURIComponent(id)}`)} />;
    title = "Apps";
  } else if (path === "/logs") {
    page = <LogsPage />;
    title = "Logs";
  } else if (path === "/tutorial") {
    page = <TutorialPage />;
    title = "Tutorial";
  } else {
    page = <Dashboard onOpenAccount={(id) => navigate(`/accounts/${encodeURIComponent(id)}`)} onOpenLogs={() => navigate("/logs")} />;
  }

  return (
    <AppShell path={path} navigate={navigate} onLogout={handleLogout} title={title}>
      {page}
    </AppShell>
  );
}
