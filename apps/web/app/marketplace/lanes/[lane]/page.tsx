import { MarketplaceConnectionRecovery } from "@/components/marketplace/marketplace-connection-recovery";
import { MarketplaceListingsSection } from "@/components/marketplace/marketplace-listings-section";
import { MarketplaceStatusPanel } from "@/components/marketplace/marketplace-status-panel";
import { loadMarketplaceListings, prepareListings } from "@/lib/marketplace/load";
import {
  humanizeMarketplaceError,
  isMarketplaceConnectionError
} from "@/lib/marketplace/status-message";
import { MarketplaceTrustBarLive } from "@/components/shell/marketplace-trust-bar-live";
import { getLaneById } from "@/lib/marketplace/lanes";
import { marketplaceLaneStaticParams } from "@/lib/desktop-static-params";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

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
  const query = STATIC_QUERY_PARAMS;
  const laneMeta = getLaneById(lane);
  const loaded = await loadMarketplaceListings(query, { serviceType: lane });
  const listings = prepareListings(loaded.listings, query);
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
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Category</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                {laneMeta?.label ?? lane.replace(/-/g, " ")}
              </h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                {laneMeta?.description ??
                  "Browse in-protocol service offers in this lane with kernel-confirmed terms."}
              </p>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <MarketplaceListingsSection
              searchParams={query}
              listings={listings}
              loaded={loaded}
              activeLane={lane}
              toolbarPathname={`/marketplace/lanes/${lane}`}
            />
          </section>
        </>
      )}
    </>
  );
}
