import { MarketplaceConnectionRecovery } from "@/components/marketplace/marketplace-connection-recovery";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { MarketplaceStatusPanel } from "@/components/marketplace/marketplace-status-panel";
import { MarketplaceListingsSection } from "@/components/marketplace/marketplace-listings-section";
import { MarketplaceTrustNotes } from "@/components/marketplace/marketplace-trust-notes";
import { MarketplaceTrustBarLive } from "@/components/shell/marketplace-trust-bar-live";
import { loadMarketplaceListings, prepareListings } from "@/lib/marketplace/load";
import {
  humanizeMarketplaceError,
  isMarketplaceConnectionError
} from "@/lib/marketplace/status-message";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

export default async function MarketplacePage() {
  const params = STATIC_QUERY_PARAMS;
  const loaded = await loadMarketplaceListings(params);
  const listings = prepareListings(loaded.listings, params);
  const connectionError = isMarketplaceConnectionError(loaded, listings.length);

  return (
    <>
      <MarketplaceConnectionRecovery connectionError={connectionError} />
      <MarketplaceTrustBarLive
        nodeLabel={loaded.baseUrl}
        asOf={loaded.asOf}
        mockMode={loaded.mockMode}
      />
      {connectionError ? (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <MarketplaceStatusPanel
            variant="connection-error"
            message={humanizeMarketplaceError(loaded.error)}
          />
        </section>
      ) : (
        <>
          <MarketplaceHero />
          <section className="mx-auto max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
            <KernelTruthBanner variant="offProtocol" />
          </section>
          <section id="listings" className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
            <MarketplaceTrustNotes />

            {loaded.mockMode && loaded.error ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
                {loaded.error}
              </div>
            ) : null}

            <MarketplaceListingsSection
              searchParams={params}
              listings={listings}
              loaded={loaded}
              activeSection="all"
            />
          </section>
        </>
      )}
    </>
  );
}
