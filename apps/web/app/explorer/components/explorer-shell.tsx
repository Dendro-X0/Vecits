import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Database, Fingerprint, Radar, Scale, Search, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import { KernelTruthNotice } from "../../components/kernel-truth-notice";
import {
  legacyButtonStyle,
  legacyCodePanelStyle,
  legacyInputStyle,
  legacyInvalidInputStyle,
  legacyPanelStyle
} from "@/lib/ui/theme-surfaces";
import { ExplorerDefaultsBar } from "./explorer-defaults-bar";

const EXPLORER_SECTIONS = [
  {
    href: "/explorer/offers",
    label: "Offers",
    icon: ShoppingBag,
    description: "Inspect a single published service offer."
  },
  {
    href: "/explorer/orders",
    label: "Orders",
    icon: Database,
    description: "Review order state and references."
  },
  {
    href: "/explorer/milestones",
    label: "Milestones",
    icon: ShieldCheck,
    description: "Trace milestone status through kernel state."
  },
  {
    href: "/explorer/reputation",
    label: "Reputation",
    icon: Scale,
    description: "Inspect deterministic reputation outputs."
  },
  {
    href: "/explorer/discovery",
    label: "Discovery",
    icon: Radar,
    description: "Rank active offers with shareable filters."
  },
  {
    href: "/explorer/identity",
    label: "Identity",
    icon: Fingerprint,
    description: "Look up identity state and linked records."
  },
  {
    href: "/explorer/balance",
    label: "Balance",
    icon: Wallet,
    description: "Read balances from the authoritative node."
  },
  {
    href: "/explorer/policy",
    label: "Policy",
    icon: Search,
    description: "Inspect active policy and update history."
  }
] as const;

const EXPLORER_INTRO: Record<string, string> = {
  Explorer: "Move through node-backed query surfaces with one shared context, one visual language, and links you can pass around as evidence.",
  "Offer Explorer": "Inspect one published offer in a clean, shareable workspace built for debugging, verification, and operator review.",
  "Order Explorer": "Open a single order snapshot and verify the exact state the node returns for that exchange.",
  "Milestone Explorer": "Check milestone progression, references, and timing from the same kernel-backed context.",
  "Reputation Explorer": "Review deterministic reputation outputs and history without leaving the explorer workflow.",
  "Discovery Explorer": "Explore ranked offers with policy-aware filters, shareable links, and enough context to compare results quickly.",
  "Identity Explorer": "Resolve identity state with a focused shell that keeps query context and results easy to scan.",
  "Balance Explorer": "Inspect balances from the authoritative node with the same scoped defaults and copyable results.",
  "Policy Explorer": "Trace active policy responses and update history in one place without dropping your current context."
};

export function ExplorerShell(props: { title: string; children: ReactNode }) {
  const activeSection =
    EXPLORER_SECTIONS.find(section => props.title.startsWith(section.label.slice(0, -1)) || props.title === section.label) ??
    null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
        <p className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:opacity-90">
            <span aria-hidden="true">←</span>
            Back to home
          </Link>
        </p>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-primary/90">
              Authoritative query workspace
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{props.title}</h1>
                {activeSection ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                    <activeSection.icon className="size-3.5" />
                    {activeSection.label}
                  </span>
                ) : null}
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {EXPLORER_INTRO[props.title] ?? EXPLORER_INTRO.Explorer}
              </p>
            </div>

            <nav className="flex flex-wrap gap-2" aria-label="Explorer sections">
              {EXPLORER_SECTIONS.map(section => {
                const selected = activeSection?.href === section.href;
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={
                      selected && props.title !== "Explorer"
                        ? "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground shadow-sm transition"
                        : "inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/20 hover:bg-muted/40 hover:text-foreground"
                    }
                    title={section.description}
                  >
                    <section.icon className="size-4" />
                    {section.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
            <p className="text-sm font-medium text-foreground">Why this shell exists</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Explorer surfaces keep `base_url` and `as_of` aligned so you can compare offers,
              orders, discovery results, and policy state with one durable context.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Context</p>
                <p className="mt-1 text-sm text-foreground">Scoped defaults follow you across routes.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Output</p>
                <p className="mt-1 text-sm text-foreground">Responses stay shareable, copyable, and kernel-backed.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Suspense fallback={null}>
        <ExplorerDefaultsBar />
      </Suspense>

      <KernelTruthNotice variant="banner" className="mt-4" />

      <div className="mt-4">{props.children}</div>
    </main>
  );
}

export const panelStyle = legacyPanelStyle;
export const inputStyle = legacyInputStyle;
export const invalidInputStyle = legacyInvalidInputStyle;

export const helperTextStyle = {
  marginTop: "-0.25rem",
  marginBottom: "0.65rem",
  opacity: 0.72,
  fontSize: "0.9rem"
} as const;

export const fieldErrorStyle = {
  marginTop: "-0.25rem",
  marginBottom: "0.65rem",
  color: "var(--destructive)",
  fontSize: "0.9rem"
} as const;

export const buttonStyle = legacyButtonStyle;
export const jsonStyle = legacyCodePanelStyle;

