import Link from "next/link";

import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { MarketplaceStatusPanel } from "@/components/marketplace/marketplace-status-panel";
import { MarketplaceListingsSection } from "@/components/marketplace/marketplace-listings-section";
import { MarketplaceTrustNotes } from "@/components/marketplace/marketplace-trust-notes";
import { Button } from "@/components/ui/button";
import { MarketplaceTrustBar } from "@/components/shell/marketplace-trust-bar";
import { loadMarketplaceListings, prepareListings } from "@/lib/marketplace/load";
import { humanizeMarketplaceError } from "@/lib/marketplace/status-message";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

export default async function MarketplacePage() {
  const params = STATIC_QUERY_PARAMS;
  const loaded = await loadMarketplaceListings(params);
  const listings = prepareListings(loaded.listings, params);
  const connectionError = Boolean(loaded.error) && listings.length === 0 && !loaded.mockMode;

  return (
    <>
      <MarketplaceTrustBar
        nodeLabel={loaded.baseUrl}
        asOf={loaded.asOf}
        mockMode={loaded.mockMode}
      />
      {connectionError ? (
        <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <MarketplaceStatusPanel
            variant="connection-error"
            message={humanizeMarketplaceError(loaded.error)}
          />
          <div className="surface-card px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight">Get connected in 2 steps</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Start your Vectis node on this device.</li>
              <li>Confirm the node URL in Settings, then refresh this page.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href="/dashboard/settings" />} size="sm">
                Settings
              </Button>
              <Button nativeButton={false} render={<Link href="/dashboard" />} variant="outline" size="sm">
                Track progress
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      <MarketplaceHero />
      <section id="listings" className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {!connectionError ? <MarketplaceTrustNotes /> : null}

        {loaded.mockMode && loaded.error ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
            {loaded.error}
          </div>
        ) : null}

        {connectionError ? (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Listings and filters will appear here once your node connection is healthy.
          </div>
        ) : (
          <MarketplaceListingsSection
            searchParams={params}
            listings={listings}
            loaded={loaded}
            activeSection="all"
          />
        )}
      </section>
    </>
  );
}
