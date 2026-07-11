import { MARKETPLACE_LANES } from "@/lib/marketplace/lanes";
import { SHOWCASE_LISTINGS } from "@/lib/marketplace/listings";

const isDesktopExport = process.env.TAURI_BUILD === "1";
const mockModeEnabled = process.env.NEXT_PUBLIC_VECTIS_MOCK_MODE === "1";

function shouldExportMarketplacePlaceholders() {
  return isDesktopExport || mockModeEnabled;
}

export function marketplaceOfferStaticParams() {
  if (!shouldExportMarketplacePlaceholders()) {
    return [];
  }
  return SHOWCASE_LISTINGS.map((listing) => ({ id: listing.offer_id }));
}

export function marketplaceOrderStaticParams() {
  if (!shouldExportMarketplacePlaceholders()) {
    return [];
  }
  return [{ id: "showcase-order" }];
}

export function marketplaceLaneStaticParams() {
  return MARKETPLACE_LANES.map((lane) => ({ lane: lane.id }));
}
