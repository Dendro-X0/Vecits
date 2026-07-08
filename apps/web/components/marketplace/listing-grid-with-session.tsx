"use client";

import { useEffect, useState } from "react";

import { ListingGrid } from "@/components/marketplace/listing-grid";
import type { QueryParams } from "@/app/explorer/lib";
import { loadActiveSession } from "@/lib/auth/session";
import type { MarketplaceListing } from "@/lib/marketplace/listings";

type ListingGridWithSessionProps = {
  listings: MarketplaceListing[];
  searchParams: QueryParams;
  emptyMessage?: string;
};

export function ListingGridWithSession({
  listings,
  searchParams,
  emptyMessage
}: ListingGridWithSessionProps) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(loadActiveSession()));
  }, []);

  return (
    <ListingGrid
      listings={listings}
      searchParams={searchParams}
      signedIn={signedIn}
      emptyMessage={emptyMessage}
    />
  );
}
