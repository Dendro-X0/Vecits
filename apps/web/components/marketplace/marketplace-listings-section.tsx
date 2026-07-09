import type { QueryParams } from "@/app/explorer/lib";
import { CategorySidebar } from "@/components/marketplace/category-sidebar";
import { ListingGridWithSession } from "@/components/marketplace/listing-grid-with-session";
import { MarketplaceStatusPanel } from "@/components/marketplace/marketplace-status-panel";
import { MarketplaceToolbar } from "@/components/marketplace/marketplace-toolbar";
import type { MarketplaceListing } from "@/lib/marketplace/listings";
import { humanizeMarketplaceError } from "@/lib/marketplace/status-message";

type MarketplaceListingsSectionProps = {
  searchParams: QueryParams;
  listings: MarketplaceListing[];
  loaded: {
    error?: string;
    mockMode: boolean;
  };
  activeSection?: "all" | "mutual-aid";
  activeLane?: string;
  toolbarPathname?: string;
  emptyMessage?: string;
};

export function MarketplaceListingsSection({
  searchParams,
  listings,
  loaded,
  activeSection,
  activeLane,
  toolbarPathname,
  emptyMessage
}: MarketplaceListingsSectionProps) {
  const connectionError = loaded.error && listings.length === 0 && !loaded.mockMode;

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <CategorySidebar
        searchParams={searchParams}
        activeSection={activeSection}
        activeLane={activeLane}
      />
      <div className="space-y-6">
        <MarketplaceToolbar
          searchParams={searchParams}
          total={listings.length}
          pathname={toolbarPathname}
        />
        {connectionError ? (
          <MarketplaceStatusPanel
            variant="connection-error"
            message={humanizeMarketplaceError(loaded.error)}
          />
        ) : listings.length === 0 ? (
          <MarketplaceStatusPanel variant="empty" mockMode={loaded.mockMode} />
        ) : (
          <ListingGridWithSession
            listings={listings}
            searchParams={searchParams}
            emptyMessage={emptyMessage}
          />
        )}
      </div>
    </div>
  );
}
