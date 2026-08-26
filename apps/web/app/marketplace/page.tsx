import { Suspense } from "react";

import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { MarketplaceLiveBrowse } from "@/components/marketplace/marketplace-live-browse";
import { MarketplaceTrustNotes } from "@/components/marketplace/marketplace-trust-notes";

export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceLiveBrowse activeSection="all" toolbarPathname="/marketplace">
        <MarketplaceHero />
        <div className="pt-6">
          <MarketplaceTrustNotes />
        </div>
      </MarketplaceLiveBrowse>
    </Suspense>
  );
}
