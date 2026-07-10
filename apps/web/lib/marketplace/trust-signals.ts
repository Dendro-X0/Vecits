import { NodeClient } from "@new-start/sdk-ts";

import { loadProviderEligibility, type ProviderEligibility } from "@/lib/dashboard/trust-bootstrap";

export type ProviderReputationSnapshot = {
  globalScore: number | null;
  laneScore: number | null;
  providerAccepts: number;
  hasReputation: boolean;
};

export type ProviderTrustSignals = {
  eligibility: ProviderEligibility;
  reputation: ProviderReputationSnapshot;
  deliveryHistoryLabel: string;
  asOf?: string;
};

export type ListingTrustSnippet = {
  laneScore: number | null;
  globalScore: number | null;
  providerAccepts: number;
  deliveryHistoryLabel: string;
  eligibilityMet: boolean;
  vouchWeight: number;
  threshold: number;
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseReputationSnapshot(
  data: Record<string, unknown> | null | undefined,
  serviceType: string
): ProviderReputationSnapshot {
  if (!data) {
    return {
      globalScore: null,
      laneScore: null,
      providerAccepts: 0,
      hasReputation: false
    };
  }

  const globalScore = readNumber(data.global_score ?? data.globalScore);
  const lanes = readRecord(data.lanes);
  const laneEntry = lanes?.[serviceType] ?? null;
  const laneRecord = readRecord(laneEntry);
  const laneScore = laneRecord
    ? readNumber(laneRecord.score)
    : readNumber(data.lane_score ?? data.laneScore);

  const components = readRecord(data.components);
  const providerAccepts = readNumber(components?.provider_accepts ?? components?.providerAccepts) ?? 0;

  return {
    globalScore,
    laneScore,
    providerAccepts,
    hasReputation: globalScore !== null || laneScore !== null || providerAccepts > 0
  };
}

export function formatDeliveryHistoryLabel(providerAccepts: number): string {
  if (providerAccepts <= 0) {
    return "New provider";
  }
  if (providerAccepts === 1) {
    return "1 completed acceptance";
  }
  return `${providerAccepts} completed acceptances`;
}

export async function loadProviderTrustSignals(
  baseUrl: string,
  providerPubKey: string,
  serviceType: string,
  asOf?: string
): Promise<ProviderTrustSignals | null> {
  const normalizedKey = providerPubKey.trim().toLowerCase();
  if (!normalizedKey) {
    return null;
  }

  try {
    const client = new NodeClient({ baseUrl });
    const [eligibility, reputationView] = await Promise.all([
      loadProviderEligibility(normalizedKey, { baseUrl, asOf }),
      client.getReputation(normalizedKey, asOf).catch(() => null)
    ]);

    if (!eligibility) {
      return null;
    }

    const reputation = parseReputationSnapshot(
      (reputationView?.data as Record<string, unknown> | null) ?? null,
      serviceType
    );

    return {
      eligibility,
      reputation,
      deliveryHistoryLabel: formatDeliveryHistoryLabel(reputation.providerAccepts),
      asOf: reputationView?.as_of
    };
  } catch {
    return null;
  }
}

export async function loadListingTrustSnippets(
  baseUrl: string,
  listings: Array<{ provider_pub_key: string; service_type: string }>,
  asOf?: string
): Promise<Map<string, ListingTrustSnippet>> {
  const uniqueProviders = [...new Set(listings.map((listing) => listing.provider_pub_key.toLowerCase()))];
  const snippets = new Map<string, ListingTrustSnippet>();

  await Promise.all(
    uniqueProviders.map(async (providerPubKey) => {
      const listing = listings.find(
        (item) => item.provider_pub_key.toLowerCase() === providerPubKey
      );
      if (!listing) {
        return;
      }

      const signals = await loadProviderTrustSignals(
        baseUrl,
        providerPubKey,
        listing.service_type,
        asOf
      );
      if (!signals) {
        return;
      }

      snippets.set(providerPubKey, {
        laneScore: signals.reputation.laneScore,
        globalScore: signals.reputation.globalScore,
        providerAccepts: signals.reputation.providerAccepts,
        deliveryHistoryLabel: signals.deliveryHistoryLabel,
        eligibilityMet: signals.eligibility.thresholdMet,
        vouchWeight: signals.eligibility.incomingActiveVouchWeight,
        threshold: signals.eligibility.threshold
      });
    })
  );

  return snippets;
}

export function showcaseListingTrustSnippet(listing: {
  global_score: number;
  lane_score: number;
}): ListingTrustSnippet {
  return {
    laneScore: listing.lane_score,
    globalScore: listing.global_score,
    providerAccepts: listing.global_score > 0 ? 1 : 0,
    deliveryHistoryLabel:
      listing.global_score > 0 ? "Showcase preview" : formatDeliveryHistoryLabel(0),
    eligibilityMet: true,
    vouchWeight: 2,
    threshold: 2
  };
}
