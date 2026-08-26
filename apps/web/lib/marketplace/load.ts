import type { QueryParams } from "@/app/explorer/lib";
import { getSingleParam } from "@/app/explorer/lib";
import { filterListingsByQuery } from "@/components/marketplace/marketplace-toolbar";
import type { SortOption } from "@/lib/marketplace/lanes";
import {
  enrichListing,
  sortListings,
  type MarketplaceListing
} from "@/lib/marketplace/listings";
import { fetchMarketplaceDiscovery } from "@/lib/marketplace/node";
import { loadListingTrustSnippets } from "@/lib/marketplace/trust-signals";

export type MarketplaceListingsLoad = {
  listings: MarketplaceListing[];
  showcase: boolean;
  mockMode: boolean;
  baseUrl: string;
  asOf?: string;
  error?: string;
};

async function attachTrustSnippets(
  baseUrl: string,
  listings: MarketplaceListing[],
  asOf?: string
): Promise<MarketplaceListing[]> {
  const snippets = await loadListingTrustSnippets(baseUrl, listings, asOf);
  return listings.map((listing) => {
    const snippet = snippets.get(listing.provider_pub_key.toLowerCase());
    return snippet ? { ...listing, trustSnippet: snippet } : listing;
  });
}

/**
 * Live discovery only — never injects showcase/demo offers.
 * Empty node → empty listings; unreachable node → error + empty listings.
 */
export async function loadLiveMarketplaceListings(
  searchParams: QueryParams,
  options: { serviceType?: string; mutualAidOnly?: boolean } = {}
): Promise<MarketplaceListingsLoad> {
  const discovery = await fetchMarketplaceDiscovery(searchParams, {
    serviceType: options.serviceType,
    limit: 48,
    alphaDefaults: true
  });

  if (!discovery.ok) {
    return {
      listings: [],
      showcase: false,
      mockMode: false,
      baseUrl: discovery.baseUrl,
      error:
        discovery.error ??
        "Unable to reach live marketplace data on this node. Check kernel connection settings."
    };
  }

  let listings = discovery.offers.map(enrichListing);
  if (options.mutualAidOnly) {
    listings = listings.filter((listing) => listing.service_type === "project-maintenance");
  }

  if (listings.length === 0) {
    return {
      listings: [],
      showcase: false,
      mockMode: false,
      baseUrl: discovery.baseUrl,
      asOf: discovery.view.as_of
    };
  }

  return {
    listings: await attachTrustSnippets(discovery.baseUrl, listings, discovery.view.as_of),
    showcase: false,
    mockMode: false,
    baseUrl: discovery.baseUrl,
    asOf: discovery.view.as_of
  };
}

/** @deprecated Prefer loadLiveMarketplaceListings — alias kept for existing imports. */
export async function loadMarketplaceListings(
  searchParams: QueryParams,
  options: { serviceType?: string; mutualAidOnly?: boolean } = {}
): Promise<MarketplaceListingsLoad> {
  return loadLiveMarketplaceListings(searchParams, options);
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
