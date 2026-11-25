import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 10;

export const pageCountOf = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

export function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const pages = pageCountOf(total);
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Halaman">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="size-4" /> Sebelumnya
      </Button>
      <span className="text-center text-xs tabular-nums text-muted-foreground">
        Halaman {page} dari {pages} · {total} entri
      </span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Berikutnya <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
