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
import {
  loadListingTrustSnippets,
  showcaseListingTrustSnippet
} from "@/lib/marketplace/trust-signals";

const MOCK_MODE_ENABLED = process.env.NEXT_PUBLIC_VECTIS_MOCK_MODE === "1";

async function attachTrustSnippets(
  baseUrl: string,
  listings: MarketplaceListing[],
  asOf?: string,
  showcase = false
): Promise<MarketplaceListing[]> {
  if (showcase) {
    return listings.map((listing) => ({
      ...listing,
      trustSnippet: showcaseListingTrustSnippet(listing)
    }));
  }

  const snippets = await loadListingTrustSnippets(baseUrl, listings, asOf);
  return listings.map((listing) => {
    const snippet = snippets.get(listing.provider_pub_key.toLowerCase());
    return snippet ? { ...listing, trustSnippet: snippet } : listing;
  });
}

export async function loadMarketplaceListings(
  searchParams: QueryParams,
  options: { serviceType?: string; mutualAidOnly?: boolean } = {}
): Promise<{
  listings: MarketplaceListing[];
  showcase: boolean;
  mockMode: boolean;
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
    if (!MOCK_MODE_ENABLED) {
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
    let listings = SHOWCASE_LISTINGS;
    if (options.serviceType) {
      listings = listings.filter((listing) => listing.service_type === options.serviceType);
    }
    if (options.mutualAidOnly) {
      listings = listings.filter((listing) => listing.service_type === "project-maintenance");
    }
    return {
      listings: await attachTrustSnippets(discovery.baseUrl, listings, undefined, true),
      showcase: true,
      mockMode: true,
      baseUrl: discovery.baseUrl,
      error:
        discovery.error ??
        "Live node unavailable. Mock mode is enabled, so showcase listings are displayed."
    };
  }

  let listings = discovery.offers.map(enrichListing);
  if (options.mutualAidOnly) {
    listings = listings.filter((listing) => listing.service_type === "project-maintenance");
  }

  if (listings.length === 0) {
    if (!MOCK_MODE_ENABLED) {
      return {
        listings: [],
        showcase: false,
        mockMode: false,
        baseUrl: discovery.baseUrl,
        asOf: discovery.view.as_of
      };
    }
    return {
      listings: await attachTrustSnippets(discovery.baseUrl, SHOWCASE_LISTINGS, undefined, true),
      showcase: true,
      mockMode: true,
      baseUrl: discovery.baseUrl,
      asOf: discovery.view.as_of,
      error: "No live listings on this node. Mock mode is enabled, so showcase previews are shown."
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

export function prepareListings(
  listings: MarketplaceListing[],
  searchParams: QueryParams
): MarketplaceListing[] {
  const query = getSingleParam(searchParams, "q");
  const sort = (getSingleParam(searchParams, "sort") || "newest") as SortOption;
  const filtered = filterListingsByQuery(listings, query);
  return sortListings(filtered, sort);
}
