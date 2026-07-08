import Link from "next/link";
import { ArrowRight, Handshake, Sparkles } from "lucide-react";

export function MarketplaceHero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.12),transparent_45%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-16">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Freelance work & mutual aid on-protocol
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Find aligned work. <span className="text-gradient">Settle with confidence.</span>
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Browse services and community maintenance without ads or platform traffic games.
            Exchange value through escrow milestones and kernel-confirmed settlement — not
            traditional currency.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#listings"
              className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground transition hover:bg-sky-300"
            >
              Browse listings
            </a>
            <Link
              href="/marketplace/mutual-aid"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-muted px-6 text-base font-medium text-foreground transition hover:bg-accent"
            >
              <Handshake className="h-4 w-4" />
              Mutual aid
            </Link>
          </div>
        </div>

        <div className="surface-card p-5">
          <p className="text-sm font-medium text-foreground">How this marketplace differs</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Matching by alignment between your needs and provider history — not promoted slots.
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Settlement rules live in the protocol kernel, not operator discretion.
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Guest browsing is open. Sign in with a local key to post offers and start exchanges.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
