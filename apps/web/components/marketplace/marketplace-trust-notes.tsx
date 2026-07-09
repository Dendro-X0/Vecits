import { AlertTriangle, ChevronDown, Info } from "lucide-react";

export function MarketplaceTrustNotes() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <details className="group rounded-xl border border-border bg-muted/30 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
          <span className="flex items-start gap-2 text-sm">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Kernel trust notes</span>
              <span className="ml-2 text-muted-foreground">
                Settlement is kernel-enforced; discovery scores are informational.
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180"
          />
        </summary>
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Vectis credits are non-transferable protocol units, not fiat money. Off-platform
              payment is outside kernel enforcement.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Discovery rankings are informational scores from kernel replay, not guarantees or
              endorsements.
            </span>
          </p>
        </div>
      </details>
    </section>
  );
}
