import { useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { dismissToast, toastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : CircleAlert;
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex animate-pop-in items-start gap-3 rounded-xl border border-l-4 border-border bg-popover px-3.5 py-3 text-popover-foreground shadow-raised",
              t.tone === "success" ? "border-l-success-foreground" : "border-l-destructive",
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", t.tone === "success" ? "text-success-foreground" : "text-destructive")} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-snug">{t.title}</div>
              {t.description && <div className="mt-0.5 break-words text-xs text-muted-foreground">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
