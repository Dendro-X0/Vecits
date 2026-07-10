import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Coins, UserRound } from "lucide-react";

import type { QueryParams } from "@/app/explorer/lib";
import { ListingTrustBadges } from "@/components/marketplace/provider-trust-signals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import type { MarketplaceListing } from "@/lib/marketplace/listings";
import { formatCredits, formatServiceType, truncatePubkey } from "@/lib/utils";

type ListingCardProps = {
  listing: MarketplaceListing;
  searchParams: QueryParams;
  signedIn?: boolean;
};

export function ListingCard({ listing, searchParams, signedIn = false }: ListingCardProps) {
  const detailHref = buildMarketplaceHref(
    `/marketplace/offers/${listing.offer_id}`,
    searchParams
  );

  return (
    <Card className="group flex h-full flex-col transition hover:border-sky-400/25 hover:shadow-[0_20px_60px_-30px_rgba(56,189,248,0.35)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="lane">{formatServiceType(listing.service_type)}</Badge>
          {listing.showcase ? <Badge variant="muted">Showcase</Badge> : null}
          {listing.status === "active" ? <Badge variant="success">Active</Badge> : null}
        </div>
        <CardTitle className="line-clamp-2 text-base leading-snug">{listing.title}</CardTitle>
        <p className="line-clamp-2 text-sm text-muted-foreground">{listing.subtitle}</p>
      </CardHeader>

      <CardContent className="mt-auto space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="surface-panel rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              Price
            </div>
            <p className="font-medium text-foreground">
              {formatCredits(listing.price_per_unit_credits)}
            </p>
          </div>
          <div className="surface-panel rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
              Fit score
            </div>
            <p className="font-medium text-foreground">{listing.discovery_score}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRound className="h-4 w-4 shrink-0" />
            <span>{truncatePubkey(listing.provider_pub_key)}</span>
          </div>
          <ListingTrustBadges serviceType={listing.service_type} snippet={listing.trustSnippet} />
        </div>
      </CardContent>

      <CardFooter className="gap-2 pt-4">
        <Link
          href={detailHref}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium text-foreground transition hover:bg-accent"
        >
          View listing
        </Link>
        {signedIn ? (
          <Link
            href={detailHref}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:bg-sky-300"
          >
            Start exchange
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Sign in to start
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

export function ListingCardCompact({
  listing,
  searchParams
}: {
  listing: MarketplaceListing;
  searchParams: QueryParams;
}) {
  const detailHref = buildMarketplaceHref(
    `/marketplace/offers/${listing.offer_id}`,
    searchParams
  );

  return (
    <Link
      href={detailHref}
      className="surface-panel group flex items-center justify-between gap-4 rounded-xl p-4 transition hover:border-primary/20 hover:bg-accent/50"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{listing.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatCredits(listing.price_per_unit_credits)} · {truncatePubkey(listing.provider_pub_key)}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}
