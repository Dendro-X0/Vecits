import Link from "next/link";
import { ArrowRight, Handshake, Sparkles, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MarketplaceHero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_42%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-16">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/80 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Open marketplace · secure milestone payouts
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Find trusted work. <span className="text-gradient">Get paid with confidence.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Browse services and community support without ads or paid ranking. Work is completed
              in milestones, and payouts are released only when each milestone is accepted.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button nativeButton={false} render={<a href="#listings" />} size="lg">
              Browse listings
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/marketplace/mutual-aid" />}
              variant="outline"
              size="lg"
            >
              <Handshake className="h-4 w-4" />
              Mutual aid
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard" />}
              variant="ghost"
              size="lg"
            >
              <UserCircle className="h-4 w-4" />
              Identity workspace
            </Button>
          </div>
        </div>

        <div className="surface-card space-y-5 p-6">
          <div>
            <p className="text-sm font-medium text-foreground">Why people trust this marketplace</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Built for contributors who want fair rules instead of marketplace games.
            </p>
          </div>

          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Listings are not boosted by ads or paid placement.
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Milestone payouts follow shared kernel rules, not admin discretion.
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Anyone can browse. Sign in with a local key to post offers and accept work.
            </li>
          </ul>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Browse</p>
              <p className="mt-1 text-sm font-medium">No account required</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Exchange</p>
              <p className="mt-1 text-sm font-medium">Milestone payouts</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Proof</p>
              <p className="mt-1 text-sm font-medium">Verifiable event history</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
