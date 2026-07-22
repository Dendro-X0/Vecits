import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type KernelTruthBannerProps = {
  variant?: "banner" | "discovery" | "offProtocol";
  className?: string;
};

const COPY = {
  banner:
    "Authoritative protocol state comes from the Rust kernel API only. This client signs events and displays kernel responses — it does not settle balances locally.",
  discovery:
    "Discovery rankings are informational scores from kernel replay. They are not payment guarantees or off-platform trust endorsements.",
  offProtocol:
    "Vectis credits are non-transferable protocol units, not fiat money. Off-platform payment is outside kernel enforcement — escrow and acceptance must stay in the event log. A paid cloud host is not required; desktop and community nodes are valid production."
};

export function KernelTruthBanner({
  variant = "banner",
  className
}: KernelTruthBannerProps) {
  const isWarning = variant === "offProtocol";
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed",
        isWarning
          ? "border-warning/30 bg-warning/10 text-foreground"
          : "border-border bg-muted/50 text-muted-foreground",
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isWarning ? "text-warning" : "text-primary")} />
      <p>
        <span className="font-medium text-foreground">Kernel truth:</span> {COPY[variant]}
      </p>
    </div>
  );
}
