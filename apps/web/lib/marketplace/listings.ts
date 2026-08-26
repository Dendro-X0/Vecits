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

/** Protocol max for ServiceOffer.unitDefinition. */
export const UNIT_DEFINITION_MAX = 200;

const UNIT_HINTS: Record<string, string> = {
  "software-fixes": "Bounded fix per issue",
  "feature-work": "Feature increment delivery",
  documentation: "Structured doc deliverable",
  translation: "Localization package",
  testing: "Verification report",
  research: "Research brief artifact",
  "project-maintenance": "Collab · credits, barter, or shared resources",
  "compute-job": "Deterministic compute job"
};

/** Split title + description packed into unitDefinition (newline-separated). */
export function parseUnitDefinition(unit: string): { title: string; description: string } {
  const trimmed = unit.trim();
  if (!trimmed) {
    return { title: "", description: "" };
  }
  const breakAt = trimmed.indexOf("\n");
  if (breakAt < 0) {
    return { title: trimmed, description: "" };
  }
  return {
    title: trimmed.slice(0, breakAt).trim(),
    description: trimmed.slice(breakAt + 1).trim()
  };
}

/** Pack title + description into unitDefinition within the protocol length cap. */
export function composeUnitDefinition(title: string, description: string): string {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    return trimmedTitle.slice(0, UNIT_DEFINITION_MAX);
  }
  const separator = "\n";
  const titleBudget = Math.min(trimmedTitle.length, UNIT_DEFINITION_MAX - separator.length - 1);
  const safeTitle = trimmedTitle.slice(0, Math.max(titleBudget, 0));
  const remaining = UNIT_DEFINITION_MAX - safeTitle.length - separator.length;
  if (remaining <= 0) {
    return safeTitle.slice(0, UNIT_DEFINITION_MAX);
  }
  return `${safeTitle}${separator}${trimmedDescription.slice(0, remaining)}`;
}

export function enrichListing(offer: DiscoveryOfferRow): MarketplaceListing {
  const copy = listingCopyFromUnitDefinition(offer.unit_definition ?? "", offer.service_type);
  return {
    ...offer,
    title: copy.title,
    subtitle: copy.subtitle
  };
}

/** Build display title/subtitle from a packed unitDefinition string. */
export function listingCopyFromUnitDefinition(
  unitDefinition: string,
  serviceType: string
): { title: string; subtitle: string } {
  const { title, description } = parseUnitDefinition(unitDefinition);
  const laneLabel = capitalizeWords(serviceType.replace(/-/g, " "));
  return {
    title: title || laneLabel || "Untitled offer",
    subtitle:
      description || UNIT_HINTS[serviceType] || "In-protocol service exchange"
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
    unit_definition: "Fix failing CI on Rust crate\nBounded fix per issue · artifact delivery",
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
    unit_definition: "API reference refresh for open-source SDK\nStructured doc deliverable",
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
    unit_definition: "Unblock stalled maintainer backlog\nMutual aid · maintenance continuation",
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
    unit_definition: "Lane economics brief with hashed deliverable\nResearch brief artifact",
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
    unit_definition: "Reproduction report for flaky integration suite\nVerification report",
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
    unit_definition: "Deterministic batch transform with job receipt\nReceipt-based compute delivery",
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
