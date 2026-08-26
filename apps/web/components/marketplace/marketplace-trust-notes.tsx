import { AlertTriangle, ChevronDown, Info } from "lucide-react";

/**
 * Single closed disclosure for kernel truth + credit/off-protocol risk.
 * Keeps browse chrome compact; expand only when the reader wants detail.
 */
export function MarketplaceTrustNotes() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <details className="group rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">
              <span className="font-medium text-foreground">Kernel truth &amp; credits</span>
              <span className="ml-2 text-muted-foreground">
                Rankings are informational · credits are not fiat
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180"
          />
        </summary>

        <div className="mt-3 space-y-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Discovery:</span> Rankings are
            informational scores from kernel replay. They are not payment guarantees or
            off-platform trust endorsements.
          </p>
          <p>
            <span className="font-medium text-foreground">Settlement:</span> Authoritative
            protocol state comes from the Rust kernel API. This client signs events and displays
            kernel responses — it does not settle balances locally.
          </p>
          <p className="flex items-start gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            />
            <span>
              Vectis credits are non-transferable protocol units, not fiat money. Off-platform
              payment (PayPal, gift cards, “activation fees”) is outside kernel enforcement — not a
              Vectis deal. Settlement stays on the event log with escrow and evidence. Provider
              admission (sponsor vouches) is separate from milestone settlement.
            </span>
          </p>
        </div>
      </details>
    </section>
  );
}
