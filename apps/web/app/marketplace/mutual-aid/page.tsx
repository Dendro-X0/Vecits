import { Handshake } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { CategorySidebar } from "@/components/marketplace/category-sidebar";
import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { ListingGridWithSession } from "@/components/marketplace/listing-grid-with-session";
import { MarketplaceToolbar } from "@/components/marketplace/marketplace-toolbar";
import { loadMarketplaceListings, prepareListings } from "@/lib/marketplace/load";
import { MarketplaceTrustBar } from "@/components/shell/marketplace-trust-bar";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

export default async function MutualAidPage() {
  const params = STATIC_QUERY_PARAMS;
  const loaded = await loadMarketplaceListings(params, { mutualAidOnly: true });
  const listings = prepareListings(loaded.listings, params);

  return (
    <>
      <MarketplaceTrustBar
        nodeLabel={loaded.baseUrl}
        asOf={loaded.asOf}
        showcase={loaded.showcase}
      />
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Handshake className="h-3.5 w-3.5 text-primary" />
            Mutual aid shelf
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight">
            Community maintenance and peer support work
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Browse stalled-project continuation, documentation debt, and other aid-shaped lanes.
            Same protocol settlement — different defaults and tone.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <KernelTruthBanner variant="offProtocol" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <CategorySidebar searchParams={params} activeSection="mutual-aid" />
          <div className="space-y-6">
            <MarketplaceToolbar
              searchParams={params}
              total={listings.length}
              pathname="/marketplace/mutual-aid"
            />
            <ListingGridWithSession
              listings={listings}
              searchParams={params}
              emptyMessage="No mutual aid listings on this node yet. Try the full marketplace or connect another operator store."
            />
          </div>
        </div>
      </section>
    </>
  );
}
