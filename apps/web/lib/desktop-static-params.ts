import { MARKETPLACE_LANES } from "@/lib/marketplace/lanes";
import { SHOWCASE_LISTINGS } from "@/lib/marketplace/listings";

export function marketplaceOfferStaticParams() {
  return SHOWCASE_LISTINGS.map((listing) => ({ id: listing.offer_id }));
}

export function marketplaceOrderStaticParams() {
  return [{ id: "showcase-order" }];
}

export function marketplaceLaneStaticParams() {
  return MARKETPLACE_LANES.map((lane) => ({ lane: lane.id }));
}
