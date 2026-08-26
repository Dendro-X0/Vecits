import { Suspense } from "react";

import { MarketplaceLiveBrowse } from "@/components/marketplace/marketplace-live-browse";
import { getLaneById } from "@/lib/marketplace/lanes";
import { marketplaceLaneStaticParams } from "@/lib/desktop-static-params";

export function generateStaticParams() {
  return marketplaceLaneStaticParams();
}

export const dynamicParams = false;

export default async function LaneMarketplacePage({
  params
}: {
  params: Promise<{ lane: string }>;
}) {
  const { lane } = await params;
  const laneMeta = getLaneById(lane);

  return (
    <Suspense fallback={null}>
      <MarketplaceLiveBrowse
        serviceType={lane}
        activeLane={lane}
        toolbarPathname={`/marketplace/lanes/${lane}`}
      >
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Category
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {laneMeta?.label ?? lane.replace(/-/g, " ")}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {laneMeta?.description ??
                "Browse in-protocol service offers in this lane with kernel-confirmed terms."}
            </p>
          </div>
        </section>
      </MarketplaceLiveBrowse>
    </Suspense>
  );
}
