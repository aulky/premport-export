import { useEffect, useState } from "react";
import { CalendarClock, Clock, KeyRound, LogOut, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { api, type SessionSettingsDto, type UserDto } from "@/lib/api";
import { toast } from "@/lib/toast";

const formatTime = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { dateStyle: "medium" });

const minutesOf = (sec: number) => Math.round(sec / 60);

/** input type="date" (YYYY-MM-DD, waktu lokal) -> akhir hari itu (unix seconds). */
const endOfDayToUnix = (dateStr: string): number => Math.floor(new Date(`${dateStr}T23:59:59`).getTime() / 1000);
/** unix seconds -> input type="date" value, di zona waktu lokal (bukan UTC) supaya tidak geser hari. */
function unixToDateInput(sec: number): string {
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Sesi login & tombol sign-out darurat -- lihat /api/settings/session dan /api/users/:id/sign-out di server. */
function SessionSecurityCard() {
  const [settings, setSettings] = useState<SessionSettingsDto | null>(null);
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.sessionSettings().then(
      (s) => {
        setSettings(s);
        setMinutes(String(minutesOf(s.ttlSec)));
      },
      (e: Error) => setLoadError(e.message),
    );
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ttlSec } = await api.setSessionTtl(Math.round(Number(minutes) * 60));
      setSettings((s) => (s ? { ...s, ttlSec } : s));
      setMinutes(String(minutesOf(ttlSec)));
      toast.success("Session lifetime saved", `New logins now expire after ${minutesOf(ttlSec)} minute(s). Already-signed-in sessions keep their old expiry.`);
    } catch (e) {
      toast.error("Could not save", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!settings) return <Skeleton className="h-24 w-full" />;
  const minMinutes = Math.max(1, Math.ceil(settings.minSec / 60));
  const maxMinutes = Math.floor(settings.maxSec / 60);

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" /> Session security
        </CardTitle>
        <CardDescription>
          Every login (admin included) gets a short-lived, signed session that expires on its own -- and signing in again anywhere
          immediately invalidates the previous session, even if it hasn't expired yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-ttl">Session lifetime (minutes)</Label>
            <Input
              id="session-ttl"
              type="number"
              min={minMinutes}
              max={maxMinutes}
              step={1}
              className="w-40"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !minutes}>
            Save
          </Button>
          <p className="basis-full text-xs text-muted-foreground">
            Allowed range: {minMinutes}-{maxMinutes} minutes. Applies to new sign-ins only.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<UserDto[] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [expiresOn, setExpiresOn] = useState(""); // tanggal opsional saat membuat user baru
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // baris yang sedang diganti passwordnya / menunggu konfirmasi hapus
  const [editing, setEditing] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  // baris yang sedang diatur masa berlaku sesinya sendiri
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState("");
  const [defaultTtlSec, setDefaultTtlSec] = useState<number | null>(null);
  // baris yang sedang diatur tanggal kedaluwarsa akunnya (langganan)
  const [editingExpiry, setEditingExpiry] = useState<number | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const load = () => api.users().then(setUsers, (e: Error) => setLoadError(e.message));

  useEffect(() => {
    void load();
    api.sessionSettings().then((s) => setDefaultTtlSec(s.ttlSec));
  }, []);

  /** true kalau berhasil. */
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
      return true;
    } catch (e) {
      toast.error("Action failed", (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const expiresAt = expiresOn ? endOfDayToUnix(expiresOn) : null;
    const label = expiresAt ? ` (expires ${formatDate(expiresAt)})` : "";
    if (await run(() => api.createUser(username, password, expiresAt), `User "${username.trim().toLowerCase()}" added${label}.`)) {
      setUsername("");
      setPassword("");
      setExpiresOn("");
    }
  }

  async function savePassword(e: React.FormEvent, u: UserDto) {
    e.preventDefault();
    if (await run(() => api.setUserPassword(u.id, newPassword), `Password changed for "${u.username}".`)) {
      setEditing(null);
      setNewPassword("");
    }
  }

  async function saveSessionTtl(e: React.FormEvent, u: UserDto) {
    e.preventDefault();
    const sec = Math.round(Number(sessionMinutes) * 60);
    if (await run(() => api.setUserSessionTtl(u.id, sec), `Session lifetime for "${u.username}" set to ${sessionMinutes} minute(s).`)) {
      setEditingSession(null);
    }
  }

  async function useDefaultSessionTtl(u: UserDto) {
    if (await run(() => api.setUserSessionTtl(u.id, null), `Session lifetime for "${u.username}" reset to the default.`)) {
      setEditingSession(null);
    }
  }

  async function saveExpiry(e: React.FormEvent, u: UserDto) {
    e.preventDefault();
    const expiresAt = endOfDayToUnix(expiryDate);
    if (await run(() => api.setUserExpiry(u.id, expiresAt), `"${u.username}" is now valid through ${formatDate(expiresAt)}.`)) {
      setEditingExpiry(null);
    }
  }

  async function clearExpiry(u: UserDto) {
    if (await run(() => api.setUserExpiry(u.id, null), `"${u.username}" no longer expires.`)) {
      setEditingExpiry(null);
    }
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader title="Users" subtitle="Create and manage dashboard accounts." />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <SessionSecurityCard />

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Add user</CardTitle>
            <CardDescription>Users can view accounts and fetch or download app cookies. They cannot add or manage anything.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void addUser(e)} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="new-username">Username</Label>
                <Input id="new-username" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="new-password">Password (min. 8 characters)</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-expires">Expires on (optional)</Label>
                <Input id="new-expires" type="date" className="w-40" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy || !username || !password}>
                <UserPlus className="size-4" /> Add user
              </Button>
            </form>
          </CardContent>
        </Card>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>The admin account comes from ADMIN_PASSWORD in .env and is not listed here.</CardDescription>
          </CardHeader>
          <CardContent>
            {!users ? (
              <Skeleton className="h-12 w-full" />
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-col gap-2 rounded-xl border border-border/60 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold">{u.username}</div>
                          <Badge variant={u.active ? "success" : "warning"}>{u.active ? "Active" : "Inactive"}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last sign-in: {formatTime(u.lastLoginAt)}
                          {" · "}
                          Valid: {u.expiresAt != null ? `until ${formatDate(u.expiresAt)}` : "no expiry"}
                          {" · "}
                          Session:{" "}
                          {u.sessionTtlSec != null
                            ? `${minutesOf(u.sessionTtlSec)} min (custom)`
                            : `default${defaultTtlSec != null ? ` (${minutesOf(defaultTtlSec)} min)` : ""}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingExpiry(editingExpiry === u.id ? null : u.id);
                            setExpiryDate(u.expiresAt != null ? unixToDateInput(u.expiresAt) : "");
                          }}
                        >
                          <CalendarClock className="size-3.5" /> Validity
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingSession(editingSession === u.id ? null : u.id);
                            setSessionMinutes(u.sessionTtlSec != null ? String(minutesOf(u.sessionTtlSec)) : "");
                          }}
                        >
                          <Clock className="size-3.5" /> Session
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void run(() => api.signOutUser(u.id), `"${u.username}" was signed out of every session.`)}
                        >
                          <LogOut className="size-3.5" /> Sign out
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(editing === u.id ? null : u.id);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="size-3.5" /> Password
                        </Button>
                        {deleting === u.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => void run(() => api.deleteUser(u.id), `User "${u.username}" deleted.`).then(() => setDeleting(null))}
                            >
                              Confirm delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setDeleting(u.id)}>
                            <Trash2 className="size-3.5" /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                    {editing === u.id && (
                      <form onSubmit={(e) => void savePassword(e, u)} className="flex gap-2">
                        <Input
                          type="password"
                          autoFocus
                          autoComplete="new-password"
                          placeholder="New password (min. 8 characters)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button type="submit" size="sm" disabled={busy || !newPassword}>
                          Save
                        </Button>
                      </form>
                    )}
                    {editingExpiry === u.id && (
                      <form onSubmit={(e) => void saveExpiry(e, u)} className="flex flex-wrap items-center gap-2">
                        <Input type="date" autoFocus className="w-40" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                        <Button type="submit" size="sm" disabled={busy || !expiryDate}>
                          Save
                        </Button>
                        {u.expiresAt != null && (
                          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void clearExpiry(u)}>
                            No expiry
                          </Button>
                        )}
                      </form>
                    )}
                    {editingSession === u.id && (
                      <form onSubmit={(e) => void saveSessionTtl(e, u)} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          autoFocus
                          min={1}
                          step={1}
                          className="w-28"
                          placeholder="Minutes"
                          value={sessionMinutes}
                          onChange={(e) => setSessionMinutes(e.target.value)}
                        />
                        <Button type="submit" size="sm" disabled={busy || !sessionMinutes}>
                          Save
                        </Button>
                        {u.sessionTtlSec != null && (
                          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void useDefaultSessionTtl(u)}>
                            Use default
                          </Button>
                        )}
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
