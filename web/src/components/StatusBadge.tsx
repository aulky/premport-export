import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { AccountDto } from "@/lib/api";

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const MAP: Record<AccountDto["status"], { label: string; variant: Variant }> = {
  valid: { label: "Active", variant: "success" },
  expired: { label: "Expired", variant: "warning" },
  refreshing: { label: "Refreshing…", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
  unknown: { label: "Not checked", variant: "secondary" },
};

export function StatusBadge({ status }: { status: AccountDto["status"] }) {
  const m = MAP[status] ?? MAP.unknown;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
