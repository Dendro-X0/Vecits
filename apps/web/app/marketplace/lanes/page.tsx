import Link from "next/link";

import { MarketplaceLaneCatalog } from "@/components/marketplace/marketplace-lane-catalog";
import { MarketplaceTrustBar } from "@/components/shell/marketplace-trust-bar";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";

export default function MarketplaceLanesPage() {
  const query = STATIC_QUERY_PARAMS;

  return (
    <>
      <MarketplaceTrustBar nodeLabel={process.env.NEXT_PUBLIC_NODE_API_BASE_URL ?? "http://127.0.0.1:7878"} />
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Lane catalog
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Pick the right lane</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Community lanes use artifact delivery with guided defaults. Specialized lanes require
            strict evidence formats — confirm operator runbooks before publishing.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Canonical reference:{" "}
            <Link href="/help/deal-flow" className="text-primary hover:underline">
              deal flow guide
            </Link>{" "}
            and maintainer lane template catalog in project docs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <MarketplaceLaneCatalog searchParams={query} />
      </section>
    </>
  );
}
