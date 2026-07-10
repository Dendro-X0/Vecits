import type { QueryParams } from "@/app/explorer/lib";
import { getOptionalParam, getSingleParam } from "@/app/explorer/lib";
import { DiscoveryDraftImportCta } from "@/components/marketplace/discovery-draft-import-cta";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import type { SortOption } from "@/lib/marketplace/lanes";
import { buildMarketplaceHref } from "@/lib/marketplace/node";

type MarketplaceToolbarProps = {
  searchParams: QueryParams;
  total: number;
  signedIn?: boolean;
  pathname?: string;
};

export function MarketplaceToolbar({
  searchParams,
  total,
  signedIn = false,
  pathname = "/marketplace"
}: MarketplaceToolbarProps) {
  const currentSort = (getSingleParam(searchParams, "sort") || "newest") as SortOption;
  const query = getSingleParam(searchParams, "q");

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Listings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} {total === 1 ? "service" : "services"} · no paid placement, no promoted slots
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <DiscoveryDraftImportCta searchParams={searchParams} />
        <MarketplaceFilters
        pathname={pathname}
        initialQuery={query}
        initialSort={currentSort}
        signedIn={signedIn}
        baseUrl={getOptionalParam(searchParams, "base_url")}
        asOf={getOptionalParam(searchParams, "as_of")}
        />
      </div>
    </div>
  );
}

export function filterListingsByQuery<T extends { title: string; subtitle: string; service_type: string }>(
  listings: T[],
  query: string
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return listings;
  }
  return listings.filter(
    (listing) =>
      listing.title.toLowerCase().includes(normalized) ||
      listing.subtitle.toLowerCase().includes(normalized) ||
      listing.service_type.toLowerCase().includes(normalized)
  );
}

export function buildSortedMarketplaceHref(
  searchParams: QueryParams,
  sort: SortOption
): string {
  return buildMarketplaceHref("/marketplace", searchParams, { sort });
}
