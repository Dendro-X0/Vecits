import { ShieldCheck } from "lucide-react";

type MarketplaceTrustBarProps = {
  nodeLabel: string;
  asOf?: string;
  showcase?: boolean;
};

export function MarketplaceTrustBar({ nodeLabel, asOf, showcase }: MarketplaceTrustBarProps) {
  return (
    <div className="border-b border-border bg-muted/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Viewing marketplace on <span className="text-foreground">{nodeLabel}</span>
          {asOf ? (
            <>
              {" "}
              · kernel replay <span className="text-foreground">{asOf}</span>
            </>
          ) : null}
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span className="hidden sm:inline">
          Credits are in-protocol coordination units — not fiat money. No ads. Ranking by alignment,
          not traffic games.
        </span>
        {showcase ? (
          <>
            <span className="hidden h-3 w-px bg-border md:block" />
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-warning">
              Showcase listings — connect a node for live kernel data
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
