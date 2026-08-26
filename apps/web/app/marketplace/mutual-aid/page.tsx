import { Handshake } from "lucide-react";
import { Suspense } from "react";

import { MarketplaceLiveBrowse } from "@/components/marketplace/marketplace-live-browse";

export default function MutualAidPage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceLiveBrowse
        mutualAidOnly
        activeSection="mutual-aid"
        toolbarPathname="/marketplace/mutual-aid"
      >
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Handshake className="h-3.5 w-3.5 text-primary" />
              Mutual aid shelf
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight">
              Community maintenance and peer support work
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Collaboration rewards are fully customizable — from shared digital work (game and music
              projects) to software resource exchange, credits, or barter. Vectis settles each deal
              on the same milestone protocol, with payouts released only when work is accepted.
            </p>
          </div>
        </section>
      </MarketplaceLiveBrowse>
    </Suspense>
  );
}
