"use client";

import { useSearchParams } from "next/navigation";

import { PhysicalHandoffWizard } from "@/components/transport/physical-handoff-wizard";

export function DashboardHandoffContent() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get("order");

  return <PhysicalHandoffWizard initialOrderId={initialOrderId} />;
}
