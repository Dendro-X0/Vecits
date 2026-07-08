import type { QueryParams } from "@/app/explorer/lib";
import { CategorySidebar } from "@/components/marketplace/category-sidebar";
import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { ListingGridWithSession } from "@/components/marketplace/listing-grid-with-session";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { MarketplaceToolbar } from "@/components/marketplace/marketplace-toolbar";
import { MarketplaceTrustBar } from "@/components/shell/marketplace-trust-bar";
import { loadMarketplaceListings, prepareListings } from "@/lib/marketplace/load";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

export default async function MarketplacePage() {
  const params = STATIC_QUERY_PARAMS;
  const loaded = await loadMarketplaceListings(params);
  const listings = prepareListings(loaded.listings, params);

  return (
    <>
      <MarketplaceTrustBar
        nodeLabel={loaded.baseUrl}
        asOf={loaded.asOf}
        showcase={loaded.showcase}
      />
      <MarketplaceHero />
      <section id="listings" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-3">
          <KernelTruthBanner variant="offProtocol" />
          <KernelTruthBanner variant="discovery" />
        </div>

        {loaded.error ? (
          <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
            {loaded.error}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <CategorySidebar searchParams={params} activeSection="all" />
          <div className="space-y-6">
            <MarketplaceToolbar searchParams={params} total={listings.length} />
            <ListingGridWithSession listings={listings} searchParams={params} />
          </div>
        </div>
      </section>
    </>
  );
}
