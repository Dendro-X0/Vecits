import type { LucideIcon } from "lucide-react";
import { CheckCircle2, CircleDashed, Eye, Shield, XCircle } from "lucide-react";

/** Offer / listing status → lucide icon. Unknown statuses fall back to a neutral mark. */
const STATUS_ICONS: Record<string, LucideIcon> = {
  active: CheckCircle2,
  expired: XCircle,
  closed: CircleDashed,
  showcase: Eye,
  kernel: Shield
};

export function getStatusIcon(status: string): LucideIcon {
  return STATUS_ICONS[status.trim().toLowerCase()] ?? CircleDashed;
}

export function formatOfferStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "expired") return "Expired";
  if (normalized === "closed") return "Closed";
  if (normalized === "showcase") return "Showcase";
  if (normalized === "kernel") return "Kernel";
  if (!normalized) return "Unknown";
  return normalized.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
