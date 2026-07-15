import { Handshake } from "lucide-react";

import { MarketplaceConnectionRecovery } from "@/components/marketplace/marketplace-connection-recovery";
import { MarketplaceListingsSection } from "@/components/marketplace/marketplace-listings-section";
import { MarketplaceStatusPanel } from "@/components/marketplace/marketplace-status-panel";
import { loadMarketplaceListings, prepareListings } from "@/lib/marketplace/load";
import {
  humanizeMarketplaceError,
  isMarketplaceConnectionError
} from "@/lib/marketplace/status-message";
import { MarketplaceTrustBarLive } from "@/components/shell/marketplace-trust-bar-live";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

export default async function MutualAidPage() {
  const params = STATIC_QUERY_PARAMS;
  const loaded = await loadMarketplaceListings(params, { mutualAidOnly: true });
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
            <MarketplaceListingsSection
              searchParams={params}
              listings={listings}
              loaded={loaded}
              activeSection="mutual-aid"
              toolbarPathname="/marketplace/mutual-aid"
            />
          </section>
        </>
      )}
    </>
  );
}
