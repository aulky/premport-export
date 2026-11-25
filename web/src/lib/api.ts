export interface AccountDto {
  id: string;
  label: string;
  email: string;
  status: "unknown" | "valid" | "expired" | "refreshing" | "error";
  lastCheckedAt: number | null;
  lastRefreshedAt: number | null;
  expiresAt: number | null;
  lastError: string | null;
  appCount: number;
  isPrimary: boolean;
}

export interface AppDto {
  appId: string;
  name: string;
  category: string | null;
  targetType: string | null;
  logo: string | null;
  url: string | null;
  note: string | null;
  isDesktopOnly: boolean;
  itemCount: number;
}

export interface ItemDto {
  itemId: string;
  itemName: string | null;
  url: string | null;
  lastFetchedAt: number | null;
  lastCookieCount: number | null;
  lastError: string | null;
}

export interface RunDto {
  id: number;
  account_id: string;
  kind: "check" | "login" | "apps-sync" | "item-fetch";
  ok: number;
  message: string | null;
  duration_ms: number;
  at: number;
}

export interface MeDto {
  username: string;
  role: "admin" | "user";
}

export interface UserDto {
  id: number;
  username: string;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface AccessLogDto {
  id: number;
  at: number;
  event: "login" | "logout" | "cookie-get" | "cookie-download" | "session-download";
  ok: number;
  ip: string;
  user_agent: string | null;
  username: string | null;
  account_id: string | null;
  account_label: string | null;
  app_name: string | null;
  item_id: string | null;
  item_name: string | null;
  cookie_count: number | null;
  message: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // Fastify menolak (400) request yang punya header Content-Type: application/json
  // tapi body-nya kosong -- jadi header itu hanya disertakan kalau memang ada body.
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    // sesi habis / user dihapus di tengah jalan -> kembali ke halaman login
    if (res.status === 401 && path !== "/api/login") window.dispatchEvent(new Event("unauthorized"));
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    req<MeDto>("/api/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => req<MeDto>("/api/me"),
  users: () => req<UserDto[]>("/api/users"),
  createUser: (username: string, password: string) =>
    req<{ ok: true }>("/api/users", { method: "POST", body: JSON.stringify({ username, password }) }),
  setUserPassword: (id: number, password: string) =>
    req<{ ok: true }>(`/api/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  deleteUser: (id: number) => req<{ ok: true }>(`/api/users/${id}`, { method: "DELETE" }),
  logout: () => req<{ ok: true }>("/api/logout", { method: "POST" }),
  accounts: () => req<AccountDto[]>("/api/accounts"),
  account: (accountId: string) => req<AccountDto>(`/api/accounts/${accountId}`),
  apps: (accountId: string) => req<AppDto[]>(`/api/accounts/${accountId}/apps`),
  items: (accountId: string, appId: string) => req<ItemDto[]>(`/api/accounts/${accountId}/apps/${encodeURIComponent(appId)}/items`),
  fetchItemCookies: (accountId: string, itemId: string) =>
    req<{ ok: true; cookieCount: number }>(`/api/accounts/${accountId}/items/${encodeURIComponent(itemId)}/fetch`, { method: "POST", body: "{}" }),
  refreshAccount: (accountId: string) =>
    req<{ ok: true; cookieCount: number }>(`/api/accounts/${accountId}/refresh`, { method: "POST", body: "{}" }),
  refreshAll: () => req<{ results: { id: string; ok: boolean; error?: string; cookieCount?: number }[] }>("/api/accounts/refresh-all", { method: "POST", body: "{}" }),
  runs: (limit = 50) => req<RunDto[]>(`/api/runs?limit=${limit}`),
  accessLogs: (type: "auth" | "cookie", page: number, ip: string) =>
    req<{ rows: AccessLogDto[]; total: number }>(`/api/access-logs?${new URLSearchParams({ type, page: String(page), ip })}`),
  cookiesUrl: (accountId: string) => `/api/accounts/${accountId}/cookies.json`,
  itemCookiesUrl: (accountId: string, itemId: string) => `/api/accounts/${accountId}/items/${encodeURIComponent(itemId)}/cookies.json`,
};
