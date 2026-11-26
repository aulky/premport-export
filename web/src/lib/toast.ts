// Notifikasi kanan atas. Store kecil di luar React supaya bisa dipanggil dari
// mana saja; ditampilkan oleh <Toaster /> (lihat components/Toaster.tsx).
export interface Toast {
  id: number;
  tone: "success" | "error";
  title: string;
  description?: string;
}

const MAX_VISIBLE = 4;
const DURATION_MS = { success: 4000, error: 7000 };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: Toast[]) {
  toasts = next;
  listeners.forEach((notify) => notify());
}

export function dismissToast(id: number) {
  set(toasts.filter((t) => t.id !== id));
}

function show(tone: Toast["tone"], title: string, description?: string) {
  const id = nextId++;
  set([...toasts, { id, tone, title, description }].slice(-MAX_VISIBLE));
  window.setTimeout(() => dismissToast(id), DURATION_MS[tone]);
}

export const toast = {
  success: (title: string, description?: string) => show("success", title, description),
  error: (title: string, description?: string) => show("error", title, description),
};

export const toastStore = {
  subscribe(notify: () => void) {
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  },
  get: () => toasts,
};
