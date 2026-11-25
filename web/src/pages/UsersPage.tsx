import { useEffect, useState } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { api, type UserDto } from "@/lib/api";

const formatTime = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

export function UsersPage() {
  const [users, setUsers] = useState<UserDto[] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // baris yang sedang diganti passwordnya / menunggu konfirmasi hapus
  const [editing, setEditing] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => api.users().then(setUsers, (e: Error) => setMessage({ ok: false, text: e.message }));

  useEffect(() => {
    void load();
  }, []);

  /** true kalau berhasil. */
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
      await load();
      return true;
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api.createUser(username, password), `User "${username.trim().toLowerCase()}" added.`)) {
      setUsername("");
      setPassword("");
    }
  }

  async function savePassword(e: React.FormEvent, u: UserDto) {
    e.preventDefault();
    if (await run(() => api.setUserPassword(u.id, newPassword), `Password changed for "${u.username}".`)) {
      setEditing(null);
      setNewPassword("");
    }
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader title="Users" subtitle="Create and manage dashboard accounts." />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Add user</CardTitle>
            <CardDescription>Users can view accounts and fetch or download app cookies. They cannot add or manage anything.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void addUser(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="new-username">Username</Label>
                <Input id="new-username" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="new-password">Password (min. 8 characters)</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy || !username || !password}>
                <UserPlus className="size-4" /> Add user
              </Button>
            </form>
          </CardContent>
        </Card>

        {message && <p className={`text-sm ${message.ok ? "text-success-foreground" : "text-destructive"}`}>{message.text}</p>}

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
                        <div className="truncate text-sm font-semibold">{u.username}</div>
                        <div className="text-xs text-muted-foreground">Last sign-in: {formatTime(u.lastLoginAt)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
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
