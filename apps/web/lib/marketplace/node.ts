import { NodeClient, type DiscoveryOfferRow, type DiscoveryView } from "@new-start/sdk-ts";

import type { QueryParams } from "@/app/explorer/lib";
import {
  getOptionalParam,
  validateAsOf,
  validateBaseUrl
} from "@/app/explorer/lib";
import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";

export type MarketplaceDiscoveryResult =
  | {
      ok: true;
      baseUrl: string;
      view: DiscoveryView;
      offers: DiscoveryOfferRow[];
    }
  | {
      ok: false;
      baseUrl: string;
      error: string;
    };

export function resolveMarketplaceNodeUrl(searchParams: QueryParams): string {
  const baseFromQuery = getOptionalParam(searchParams, "base_url");
  if (baseFromQuery && !validateBaseUrl(baseFromQuery)) {
    return baseFromQuery;
  }
  return resolveNodeClientBaseUrl();
}

export async function fetchMarketplaceDiscovery(
  searchParams: QueryParams,
  options: {
    serviceType?: string;
    limit?: number;
    alphaDefaults?: boolean;
  } = {}
): Promise<MarketplaceDiscoveryResult> {
  const baseUrl = resolveMarketplaceNodeUrl(searchParams);
  const asOf = getOptionalParam(searchParams, "as_of");
  const baseUrlError = validateBaseUrl(getOptionalParam(searchParams, "base_url"));
  const asOfError = validateAsOf(getOptionalParam(searchParams, "as_of"));

  if (baseUrlError) {
    return { ok: false, baseUrl, error: baseUrlError };
  }
  if (asOfError) {
    return { ok: false, baseUrl, error: asOfError };
  }

  try {
    const client = new NodeClient({ baseUrl });
    const view = await client.getDiscovery({
      as_of: asOf,
      service_type: options.serviceType,
      limit: options.limit ?? 24,
      alpha_defaults: options.alphaDefaults ?? true
    });

    return {
      ok: true,
      baseUrl,
      view,
      offers: view.data.offers
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl,
      error: error instanceof Error ? error.message : "Failed to load marketplace listings"
    };
  }
}

export function buildMarketplaceHref(
  path: string,
  searchParams: QueryParams,
  patch: Record<string, string | undefined | null> = {}
): string {
  const params = new URLSearchParams();

  const scopedBaseUrl = getOptionalParam(searchParams, "base_url");
  const scopedAsOf = getOptionalParam(searchParams, "as_of");
  if (scopedBaseUrl) {
    params.set("base_url", scopedBaseUrl);
  }
  if (scopedAsOf) {
    params.set("as_of", scopedAsOf);
  }

  for (const [key, value] of Object.entries(patch)) {
    const normalized = value?.trim();
    if (!normalized) {
      params.delete(key);
    } else {
      params.set(key, normalized);
    }
  }

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
