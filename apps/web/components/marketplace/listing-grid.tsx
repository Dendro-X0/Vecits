import { PackageOpen } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { ListingCard } from "@/components/marketplace/listing-card";
import type { MarketplaceListing } from "@/lib/marketplace/listings";

type ListingGridProps = {
  listings: MarketplaceListing[];
  searchParams: QueryParams;
  signedIn?: boolean;
  emptyMessage?: string;
};

export function ListingGrid({
  listings,
  searchParams,
  signedIn = false,
  emptyMessage = "No listings match your filters yet."
}: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
          <PackageOpen className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">Nothing here yet</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard
          key={listing.offer_id}
          listing={listing}
          searchParams={searchParams}
          signedIn={signedIn}
        />
      ))}
    </div>
  );
}
