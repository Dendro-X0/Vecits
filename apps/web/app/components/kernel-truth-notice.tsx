import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { cn } from "@/lib/utils";

type KernelTruthNoticeProps = {
  variant?: "banner" | "session" | "discovery" | "offProtocol";
  className?: string;
};

const SESSION_COPY =
  "Session checklist tracks events accepted by the kernel in this browser tab only. Refresh explorer views or replay for authoritative order/milestone status.";

export function KernelTruthNotice({ variant = "banner", className }: KernelTruthNoticeProps) {
  if (variant === "session") {
    return (
      <div
        className={cn(
          "mb-3 flex gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground",
          className
        )}
      >
        <p>
          <span className="font-medium text-foreground">Kernel truth:</span> {SESSION_COPY}
        </p>
      </div>
    );
  }

  if (variant === "offProtocol" || variant === "discovery" || variant === "banner") {
    return (
      <KernelTruthBanner
        variant={variant}
        className={cn(variant === "banner" ? "mb-0" : "mb-3", className)}
      />
    );
  }

  return null;
}

export function OffProtocolPaymentWarning() {
  return <KernelTruthNotice variant="offProtocol" />;
}
