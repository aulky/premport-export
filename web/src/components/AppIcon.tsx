import { useEffect, useState } from "react";
import { AppWindow } from "lucide-react";
import { faviconUrl } from "@/lib/favicon";

/** Ikon 1 app (favicon situs tujuan), dengan fallback kalau gambarnya gagal dimuat. */
export function AppIcon({ url, className = "size-7" }: { url: string | null; className?: string }) {
  const src = faviconUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary ${className}`}>
      {src && !failed ? (
        <img src={src} alt="" className="size-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        <AppWindow className="size-3.5 text-muted-foreground" />
      )}
    </div>
  );
}
