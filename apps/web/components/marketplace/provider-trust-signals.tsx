import Link from "next/link";
import { BadgeCheck, Shield, UserRound } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProviderTrustSignals } from "@/lib/marketplace/trust-signals";
import { formatServiceType, truncatePubkey } from "@/lib/utils";

type ProviderTrustSignalsCardProps = {
  providerPubKey: string;
  serviceType: string;
  signals: ProviderTrustSignals | null;
  showcase?: boolean;
};

export function ProviderTrustSignalsCard({
  providerPubKey,
  serviceType,
  signals,
  showcase = false
}: ProviderTrustSignalsCardProps) {
  const laneLabel = formatServiceType(serviceType);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider trust</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <DetailRow icon={UserRound} label="Public key" value={truncatePubkey(providerPubKey)} />

        {showcase ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
            Showcase listing — trust metrics below are sample values, not live kernel replay.
          </p>
        ) : null}

        {signals ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Admission (vouches)
                </p>
                <p className="mt-1 font-medium text-foreground">
                  Weight {signals.eligibility.incomingActiveVouchWeight} / threshold{" "}
                  {signals.eligibility.threshold}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {signals.eligibility.thresholdMet
                    ? "Met policy minimum to publish offers"
                    : "Below policy minimum — offer may be rejected on-node"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Delivery history
                </p>
                <p className="mt-1 font-medium text-foreground">{signals.deliveryHistoryLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  From kernel reputation components (replay-visible accepts)
                </p>
              </div>
            </div>

            {signals.reputation.hasReputation ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Reputation scores
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {signals.reputation.globalScore !== null ? (
                    <Badge variant="outline">Global {signals.reputation.globalScore}</Badge>
                  ) : null}
                  {signals.reputation.laneScore !== null ? (
                    <Badge variant="outline">
                      {laneLabel} lane {signals.reputation.laneScore}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Informational scores from kernel replay — not payment guarantees or endorsements.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No reputation record yet for this provider on this node.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Admission</span> (sponsor vouches) unlocks
              offer publish. <span className="font-medium text-foreground">Settlement</span> on each
              order still follows locked escrow and accept rules.
            </p>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-muted-foreground">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <p>Trust signals unavailable — check node connection or try again later.</p>
          </div>
        )}

        <Link
          href="/help/trust-bootstrap"
          className="inline-flex text-xs text-primary hover:underline"
        >
          How trust bootstrap works
        </Link>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ListingTrustBadges({
  serviceType,
  snippet
}: {
  serviceType: string;
  snippet?: {
    laneScore: number | null;
    globalScore: number | null;
    deliveryHistoryLabel: string;
    eligibilityMet: boolean;
  } | null;
}) {
  if (!snippet) {
    return null;
  }

  const laneLabel = formatServiceType(serviceType);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {snippet.laneScore !== null ? (
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="size-3.5 text-primary" />
          {laneLabel} lane {snippet.laneScore}
        </span>
      ) : snippet.globalScore !== null ? (
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="size-3.5 text-primary" />
          Rep {snippet.globalScore}
        </span>
      ) : null}
      <span className="text-border">·</span>
      <span>{snippet.deliveryHistoryLabel}</span>
      {!snippet.eligibilityMet ? (
        <>
          <span className="text-border">·</span>
          <span className="text-amber-700 dark:text-amber-300">Below admission threshold</span>
        </>
      ) : null}
    </div>
  );
}
