import { Suspense } from "react";

import { TransactionsPage } from "@/components/dashboard/transactions-page";

export default function DashboardTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          Loading transactions…
        </div>
      }
    >
      <TransactionsPage />
    </Suspense>
  );
}
