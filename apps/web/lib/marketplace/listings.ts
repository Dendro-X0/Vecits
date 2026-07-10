import type { DiscoveryOfferRow } from "@new-start/sdk-ts";

import type { SortOption } from "./lanes";
import type { ListingTrustSnippet } from "./trust-signals";

export type MarketplaceListing = DiscoveryOfferRow & {
  title: string;
  subtitle: string;
  deliveryMode?: string;
  showcase?: boolean;
  trustSnippet?: ListingTrustSnippet;
};

const UNIT_HINTS: Record<string, string> = {
  "software-fixes": "Bounded fix per issue",
  "feature-work": "Feature increment delivery",
  documentation: "Structured doc deliverable",
  translation: "Localization package",
  testing: "Verification report",
  research: "Research brief artifact",
  "project-maintenance": "Maintenance continuation task",
  "compute-job": "Deterministic compute job"
};

export function enrichListing(offer: DiscoveryOfferRow): MarketplaceListing {
  const laneLabel = offer.service_type.replace(/-/g, " ");
  return {
    ...offer,
    title: `${capitalizeWords(laneLabel)} — ${offer.offer_id}`,
    subtitle: UNIT_HINTS[offer.service_type] ?? "In-protocol service exchange"
  };
}

export function sortListings(
  listings: MarketplaceListing[],
  sort: SortOption
): MarketplaceListing[] {
  const copy = [...listings];

  switch (sort) {
    case "credits-asc":
      return copy.sort((a, b) => a.price_per_unit_credits - b.price_per_unit_credits);
    case "credits-desc":
      return copy.sort((a, b) => b.price_per_unit_credits - a.price_per_unit_credits);
    case "reputation":
      return copy.sort((a, b) => b.global_score - a.global_score);
    case "newest":
      return copy.sort(
        (a, b) =>
          new Date(b.offer_expires_at).getTime() - new Date(a.offer_expires_at).getTime()
      );
    case "alignment":
    default:
      return copy.sort((a, b) => b.discovery_score - a.discovery_score);
  }
}

export const SHOWCASE_LISTINGS: MarketplaceListing[] = [
  {
    offer_id: "showcase-software-fix",
    provider_pub_key: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0",
    service_type: "software-fixes",
    status: "active",
    price_per_unit_credits: 120,
    offer_expires_at: "2026-12-01T00:00:00Z",
    global_score: 84,
    lane_score: 72,
    discovery_score: 91,
    created_event_id: "showcase-event-1",
    title: "Fix failing CI on Rust crate",
    subtitle: "Bounded fix per issue · artifact delivery",
    deliveryMode: "artifact",
    showcase: true
  },
  {
    offer_id: "showcase-documentation",
    provider_pub_key: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737",
    service_type: "documentation",
    status: "active",
    price_per_unit_credits: 90,
    offer_expires_at: "2026-12-01T00:00:00Z",
    global_score: 76,
    lane_score: 68,
    discovery_score: 82,
    created_event_id: "showcase-event-2",
    title: "API reference refresh for open-source SDK",
    subtitle: "Structured doc deliverable",
    deliveryMode: "artifact",
    showcase: true
  },
  {
    offer_id: "showcase-maintenance",
    provider_pub_key: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0",
    service_type: "project-maintenance",
    status: "active",
    price_per_unit_credits: 160,
    offer_expires_at: "2026-12-01T00:00:00Z",
    global_score: 88,
    lane_score: 80,
    discovery_score: 86,
    created_event_id: "showcase-event-3",
    title: "Unblock stalled maintainer backlog",
    subtitle: "Mutual aid · maintenance continuation",
    deliveryMode: "artifact",
    showcase: true
  },
  {
    offer_id: "showcase-research",
    provider_pub_key: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737",
    service_type: "research",
    status: "active",
    price_per_unit_credits: 140,
    offer_expires_at: "2026-12-01T00:00:00Z",
    global_score: 71,
    lane_score: 65,
    discovery_score: 74,
    created_event_id: "showcase-event-4",
    title: "Lane economics brief with hashed deliverable",
    subtitle: "Research brief artifact",
    deliveryMode: "artifact",
    showcase: true
  },
  {
    offer_id: "showcase-testing",
    provider_pub_key: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0",
    service_type: "testing",
    status: "active",
    price_per_unit_credits: 95,
    offer_expires_at: "2026-12-01T00:00:00Z",
    global_score: 79,
    lane_score: 70,
    discovery_score: 77,
    created_event_id: "showcase-event-5",
    title: "Reproduction report for flaky integration suite",
    subtitle: "Verification report",
    deliveryMode: "artifact",
    showcase: true
  },
  {
    offer_id: "showcase-compute",
    provider_pub_key: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737",
    service_type: "compute-job",
    status: "active",
    price_per_unit_credits: 220,
    offer_expires_at: "2026-12-01T00:00:00Z",
    global_score: 83,
    lane_score: 77,
    discovery_score: 80,
    created_event_id: "showcase-event-6",
    title: "Deterministic batch transform with job receipt",
    subtitle: "Receipt-based compute delivery",
    deliveryMode: "receipt",
    showcase: true
  }
];

function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
