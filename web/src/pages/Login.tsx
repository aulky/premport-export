import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, type MeDto } from "@/lib/api";
import { APP_NAME, Logo } from "@/components/Logo";

export function Login({ onSuccess, notice }: { onSuccess: (me: MeDto) => void; notice?: string | null }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSuccess(await api.login(username, password));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-backdrop flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-raised">
        <CardHeader className="items-center justify-items-center gap-2 text-center">
          <Logo className="mb-1 size-16" />
          <CardTitle className="text-xl tracking-tight text-foreground">{APP_NAME}</CardTitle>
          <CardDescription>Sign in to view and export cookies.</CardDescription>
        </CardHeader>
        <CardContent>
          {notice && (
            <Alert variant="warning" className="mb-4">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={busy || !username || !password}>
              {busy ? "Checking…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <a href="/about" className="text-brand underline-offset-4 hover:underline">
              About this tool
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
