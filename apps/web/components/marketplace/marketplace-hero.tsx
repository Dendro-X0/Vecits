import Link from "next/link";
import { Handshake, LayoutGrid, Sparkles, Upload, UserCircle } from "lucide-react";

import { PostJobCta } from "@/components/marketplace/post-job-cta";
import { Button } from "@/components/ui/button";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";
import { buildMarketplaceHref } from "@/lib/marketplace/node";

const TRUST_COLUMNS = [
  {
    label: "Browse",
    detail: "No account required"
  },
  {
    label: "Exchange",
    detail: "Credits, barter, or shared work"
  },
  {
    label: "Proof",
    detail: "Verifiable event history"
  }
] as const;

export function MarketplaceHero() {
  const query = STATIC_QUERY_PARAMS;
  const lanesHref = buildMarketplaceHref("/marketplace/lanes", query);
  const importHref = buildMarketplaceHref("/dashboard/builder", query, {
    step: "offer",
    import: "discovery"
  });

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/80 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Open marketplace · secure milestone payouts
        </div>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find trusted work. <span className="text-gradient">Get paid with confidence.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Collaboration rewards are customizable — credits, barter, or shared digital work such as
          game and music projects and software resources. Everything settles in milestones, released
          only when each one is accepted.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button nativeButton={false} render={<a href="#listings" />} size="lg">
            Browse listings
          </Button>
          <PostJobCta size="lg" variant="outline" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link
            href="/marketplace/mutual-aid"
            className="inline-flex items-center gap-1.5 transition hover:text-foreground"
          >
            <Handshake className="h-3.5 w-3.5" />
            Mutual aid
          </Link>
          <Link
            href={lanesHref}
            className="inline-flex items-center gap-1.5 transition hover:text-foreground"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Lane catalog
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 transition hover:text-foreground"
          >
            <UserCircle className="h-3.5 w-3.5" />
            Identity workspace
          </Link>
        </div>

        <div className="mx-auto mt-14 max-w-3xl overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-muted/40 to-muted/10">
          <ul className="grid divide-y divide-border/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {TRUST_COLUMNS.map((column) => (
              <li key={column.label} className="px-4 py-4 text-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {column.label}
                </p>
                <p className="mt-1 text-sm text-foreground/90">{column.detail}</p>
              </li>
            ))}
          </ul>

          <div className="border-t border-border/50 px-5 py-3 text-center sm:px-6">
            <Link
              href={importHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              Import a discovery draft in the builder
              <span className="text-xs text-muted-foreground/80">· draft ≠ live</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
