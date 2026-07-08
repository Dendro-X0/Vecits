import type { QueryParams } from "@/app/explorer/lib";
import { getSingleParam } from "@/app/explorer/lib";
import { filterListingsByQuery } from "@/components/marketplace/marketplace-toolbar";
import type { SortOption } from "@/lib/marketplace/lanes";
import {
  enrichListing,
  SHOWCASE_LISTINGS,
  sortListings,
  type MarketplaceListing
} from "@/lib/marketplace/listings";
import { fetchMarketplaceDiscovery } from "@/lib/marketplace/node";

export async function loadMarketplaceListings(
  searchParams: QueryParams,
  options: { serviceType?: string; mutualAidOnly?: boolean } = {}
): Promise<{
  listings: MarketplaceListing[];
  showcase: boolean;
  baseUrl: string;
  asOf?: string;
  error?: string;
}> {
  const discovery = await fetchMarketplaceDiscovery(searchParams, {
    serviceType: options.serviceType,
    limit: 48,
    alphaDefaults: true
  });

  if (!discovery.ok) {
    let listings = SHOWCASE_LISTINGS;
    if (options.serviceType) {
      listings = listings.filter((listing) => listing.service_type === options.serviceType);
    }
    if (options.mutualAidOnly) {
      listings = listings.filter((listing) => listing.service_type === "project-maintenance");
    }
    return {
      listings,
      showcase: true,
      baseUrl: discovery.baseUrl,
      error: discovery.error
    };
  }

  let listings = discovery.offers.map(enrichListing);
  if (options.mutualAidOnly) {
    listings = listings.filter((listing) => listing.service_type === "project-maintenance");
  }

  if (listings.length === 0) {
    return {
      listings: SHOWCASE_LISTINGS,
      showcase: true,
      baseUrl: discovery.baseUrl,
      asOf: discovery.view.as_of,
      error: "No live listings on this node — showing showcase previews."
    };
  }

  return {
    listings,
    showcase: false,
    baseUrl: discovery.baseUrl,
    asOf: discovery.view.as_of
  };
}

export function prepareListings(
  listings: MarketplaceListing[],
  searchParams: QueryParams
): MarketplaceListing[] {
  const query = getSingleParam(searchParams, "q");
  const sort = (getSingleParam(searchParams, "sort") || "newest") as SortOption;
  const filtered = filterListingsByQuery(listings, query);
  return sortListings(filtered, sort);
}
