import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { TRUST_PHASE_LABEL } from "@/lib/dashboard/trust-bootstrap";
import { cn } from "@/lib/utils";

type TrustPhaseLabelProps = {
  className?: string;
  compact?: boolean;
};

export function TrustPhaseLabel({ className, compact = false }: TrustPhaseLabelProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
        {TRUST_PHASE_LABEL}
      </Badge>
      {!compact ? (
        <Link
          href="/help/trust-bootstrap"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          What this means
        </Link>
      ) : null}
    </div>
  );
}
