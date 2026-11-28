import { useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Moon, ShieldCheck, Sun, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, type MeDto } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { APP_NAME, Logo } from "@/components/Logo";

const HIGHLIGHTS = [
  { icon: Zap, title: "Always-fresh sessions", text: "Accounts are signed in again before their cookies expire." },
  { icon: KeyRound, title: "One-click export", text: "Download cookies as Cookie-Editor JSON, ready to import." },
  { icon: ShieldCheck, title: "Encrypted at rest", text: "Every cookie is stored with AES-256-GCM." },
];

/**
 * Latar "aurora": dua cahaya lembut yang bergeser sangat pelan di atas grid
 * tipis. Murni CSS (lihat .login-* di globals.css), ringan, dan berhenti
 * sendiri kalau pengguna memilih reduced motion.
 */
function AnimatedBackdrop() {
  return (
    <div aria-hidden="true" className="login-scene">
      <div className="login-aurora login-aurora-a" />
      <div className="login-aurora login-aurora-b" />
      <div className="login-grid" />
    </div>
  );
}

function ThemeToggle() {
  const { resolved, setPref } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="grid size-10 place-content-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function Login({ onSuccess, notice }: { onSuccess: (me: MeDto) => void; notice?: string | null }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
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

  const trackCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  return (
    <div className="login-root relative isolate flex min-h-dvh flex-col overflow-hidden text-white">
      <AnimatedBackdrop />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-3">
          <Logo className="size-10 drop-shadow-lg" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Cookie Scraping</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/60">Tools</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-7 px-5 py-6 sm:gap-10 sm:px-8 sm:py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-12">
        {/* Kolom kiri: pesan produk. Di HP diringkas jadi judul saja. */}
        <section className="login-rise text-center lg:text-left">
          <h1 className="text-balance text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Fresh session cookies,{" "}
            <span className="login-gradient-text">ready to import.</span>
          </h1>
          <p className="mx-auto mt-5 hidden max-w-xl text-pretty sm:block text-base text-white/70 sm:text-lg lg:mx-0">
            {APP_NAME} keeps your accounts signed in, scrapes their cookies, and hands them to you as a file your browser
            can import in seconds.
          </p>
          <ul className="mt-9 hidden gap-4 lg:grid">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-content-center rounded-xl border border-white/15 bg-white/10 text-teal-200 backdrop-blur-md">
                  <Icon className="size-5" />
                </span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-white/65">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Kolom kanan: kartu form. */}
        <section className="login-rise login-rise-delay mx-auto w-full max-w-md lg:max-w-none lg:justify-self-end">
          <div className="login-card relative rounded-3xl p-px">
            <div className="rounded-[calc(1.5rem-1px)] bg-card/95 p-6 text-card-foreground shadow-2xl backdrop-blur-xl sm:p-9">
              <div className="mb-7">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back</h2>
                <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">Sign in to view and export cookies.</p>
              </div>

              {notice && (
                <Alert variant="warning" className="mb-5">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username">Username</Label>
                  <InputGroup start={<User />}>
                    <Input
                      id="username"
                      autoFocus
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-12 text-base sm:text-[15px]"
                      placeholder="Your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      aria-invalid={!!error || undefined}
                    />
                  </InputGroup>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <InputGroup
                    start={<LockKeyhole />}
                    end={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="grid size-9 place-content-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                  >
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="h-12 text-base sm:text-[15px]"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={trackCaps}
                      onKeyUp={trackCaps}
                      onBlur={() => setCapsLock(false)}
                      aria-invalid={!!error || undefined}
                      aria-describedby={capsLock ? "caps-hint" : undefined}
                    />
                  </InputGroup>
                  {capsLock && (
                    <p id="caps-hint" className="text-xs font-medium text-warning-foreground">
                      Caps Lock is on.
                    </p>
                  )}
                </div>

                <div aria-live="polite">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <Button type="submit" size="lg" className="group h-12 w-full text-base" disabled={busy || !username || !password}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-7 flex flex-col items-center gap-1 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                <span>Accounts are created by an administrator.</span>
                <a href="/about" className="font-medium text-brand underline-offset-4 hover:underline">
                  About {APP_NAME}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-5 pb-5 text-center text-xs text-white/45 sm:px-8">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
