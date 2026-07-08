import { Suspense } from "react";

import { MarketplaceEventBuilder } from "@/app/components/marketplace-event-builder";

export default function DashboardBuilderPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div id="import" className="space-y-1 scroll-mt-20">
        <h2 className="text-xl font-semibold tracking-tight">Offer builder</h2>
        <p className="text-sm text-muted-foreground">
          Sign and submit marketplace events against your local node. Import discovery drafts from
          `offer-drafts.jsonl` to prefill ServiceOffer fields.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading builder…</p>}>
        <MarketplaceEventBuilder />
      </Suspense>
    </div>
  );
}
