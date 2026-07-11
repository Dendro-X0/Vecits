import { Suspense } from "react";

import { PhysicalHandoffWizard } from "@/components/transport/physical-handoff-wizard";

type HandoffPageProps = {
  searchParams: Promise<{ order?: string }>;
};

export default async function DashboardHandoffPage({ searchParams }: HandoffPageProps) {
  const params = await searchParams;

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">In-person handoff</h1>
          <p className="text-sm text-muted-foreground">
            Experimental <code>physical-handoff</code> wizard — dual ack hashes, review before sign,
            optional offline queue.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading wizard…</p>}>
          <PhysicalHandoffWizard initialOrderId={params.order ?? null} />
        </Suspense>
      </div>
    </div>
  );
}
