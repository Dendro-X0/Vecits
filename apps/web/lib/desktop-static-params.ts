import { MARKETPLACE_LANES } from "@/lib/marketplace/lanes";
import { SHOWCASE_LISTINGS } from "@/lib/marketplace/listings";

const MOCK_MODE_ENABLED = process.env.NEXT_PUBLIC_VECTIS_MOCK_MODE === "1";

export function marketplaceOfferStaticParams() {
  if (!MOCK_MODE_ENABLED) {
    return [];
  }
  return SHOWCASE_LISTINGS.map((listing) => ({ id: listing.offer_id }));
}

export function marketplaceOrderStaticParams() {
  if (!MOCK_MODE_ENABLED) {
    return [];
  }
  return [{ id: "showcase-order" }];
}

export function marketplaceLaneStaticParams() {
  return MARKETPLACE_LANES.map((lane) => ({ lane: lane.id }));
}
