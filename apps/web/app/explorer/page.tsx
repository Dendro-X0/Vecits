import Link from "next/link";
import { Database, Fingerprint, Radar, Scale, ShieldCheck, ShoppingBag, Wallet, Waypoints } from "lucide-react";

import { ExplorerShell } from "./components/explorer-shell";

const EXPLORER_DESTINATIONS = [
  {
    href: "/explorer/offers",
    title: "Offer Explorer",
    description: "Inspect one published offer and verify shareable offer state.",
    icon: ShoppingBag
  },
  {
    href: "/explorer/orders",
    title: "Order Explorer",
    description: "Trace a single order and its related references.",
    icon: Database
  },
  {
    href: "/explorer/milestones",
    title: "Milestone Explorer",
    description: "Check milestone-level progress and payout state.",
    icon: ShieldCheck
  },
  {
    href: "/explorer/reputation",
    title: "Reputation Explorer",
    description: "Review deterministic reputation outputs and history.",
    icon: Scale
  },
  {
    href: "/explorer/discovery",
    title: "Discovery Explorer",
    description: "Compare ranked listings with policy-aware filters.",
    icon: Radar
  },
  {
    href: "/explorer/identity",
    title: "Identity Explorer",
    description: "Resolve identity records and node-backed identity state.",
    icon: Fingerprint
  },
  {
    href: "/explorer/balance",
    title: "Balance Explorer",
    description: "Inspect wallet and balance responses from the node.",
    icon: Wallet
  },
  {
    href: "/explorer/policy",
    title: "Policy Explorer",
    description: "Inspect current policy and update history in one place.",
    icon: Waypoints
  }
] as const;

export default function ExplorerIndexPage() {
  return (
    <ExplorerShell title="Explorer">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Choose a query surface based on what you need to verify. Each route keeps URL-backed
            context so links can be copied into issues, handoffs, or operator notes without losing
            the state you were examining.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {EXPLORER_DESTINATIONS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:border-primary/20 hover:bg-muted/40 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-primary">
                    <item.icon className="size-4" />
                  </span>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground transition group-hover:text-primary">{item.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">Suggested workflow</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">1. Scope</p>
              <p className="mt-1 text-sm text-foreground">Set node URL and optional `as_of` snapshot.</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">2. Inspect</p>
              <p className="mt-1 text-sm text-foreground">Open the route that matches the state you want to verify.</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">3. Share</p>
              <p className="mt-1 text-sm text-foreground">Copy the URL or JSON response for reproducible review.</p>
            </div>
          </div>
        </aside>
      </section>
    </ExplorerShell>
  );
}
