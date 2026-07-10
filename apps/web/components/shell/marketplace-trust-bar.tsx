import { ShieldCheck } from "lucide-react";

import { TrustPhaseLabel } from "@/components/dashboard/trust-phase-label";

type MarketplaceTrustBarProps = {
  nodeLabel: string;
  asOf?: string;
  mockMode?: boolean;
};

export function MarketplaceTrustBar({ nodeLabel, asOf, mockMode }: MarketplaceTrustBarProps) {
  return (
    <div className="border-b border-border bg-muted/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Viewing marketplace on <span className="text-foreground">{nodeLabel}</span>
          {asOf ? (
            <>
              {" "}
              · event history at <span className="text-foreground">{asOf}</span>
            </>
          ) : null}
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <TrustPhaseLabel compact />
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span className="hidden sm:inline">
          Credits are in-protocol units, not fiat money. No ads. No paid ranking.
        </span>
        {mockMode ? (
          <>
            <span className="hidden h-3 w-px bg-border md:block" />
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-warning">
              Mock mode enabled — sample listings are shown
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
