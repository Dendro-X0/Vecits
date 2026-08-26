import { Badge } from "@/components/ui/badge";
import {
  formatOfferStatusLabel,
  getStatusIcon
} from "@/lib/marketplace/status-icons";
import { cn } from "@/lib/utils";

type StatusBadgeVariant = "success" | "muted" | "outline" | "default";

type StatusBadgeProps = {
  /** Kernel status (`active`, `expired`, …) or display tokens (`showcase`, `kernel`). */
  status: string;
  variant?: StatusBadgeVariant;
  className?: string;
  label?: string;
};

function defaultVariantForStatus(status: string): StatusBadgeVariant {
  const key = status.trim().toLowerCase();
  if (key === "active" || key === "kernel") return "success";
  if (key === "showcase") return "muted";
  if (key === "expired" || key === "closed") return "outline";
  return "outline";
}

export function StatusBadge({
  status,
  variant,
  className,
  label
}: StatusBadgeProps) {
  const Icon = getStatusIcon(status);
  const text = label ?? formatOfferStatusLabel(status);

  return (
    <Badge
      variant={variant ?? defaultVariantForStatus(status)}
      className={cn("gap-1.5", className)}
      title={text}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {text}
    </Badge>
  );
}
