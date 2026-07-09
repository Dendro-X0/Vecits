import { Suspense } from "react";

import { TransactionBuilderPanel } from "@/components/dashboard/transaction-builder-panel";

export default function DashboardBuilderPage() {
  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading builder…</p>}>
        <TransactionBuilderPanel />
      </Suspense>
    </div>
  );
}
