import type { TransactionBuilderStep } from "@/lib/dashboard/transaction-progress";

export function buildBuilderHref(
  step: TransactionBuilderStep,
  orderId?: string | null
): string {
  const params = new URLSearchParams({ step });
  if (orderId?.trim()) {
    params.set("order", orderId.trim());
  }
  return `/dashboard/builder?${params.toString()}`;
}

export function buildDisputeBuilderHref(orderId?: string | null, step: "dispute" | "settle" = "dispute"): string {
  const params = new URLSearchParams({ branch: "dispute", step });
  if (orderId?.trim()) {
    params.set("order", orderId.trim());
  }
  return `/dashboard/builder?${params.toString()}`;
}
