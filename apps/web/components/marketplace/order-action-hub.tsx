"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadActiveSession } from "@/lib/auth/session";
import { deriveTransactionProgress } from "@/lib/dashboard/transaction-progress";
import type {
  MilestoneProgressSummary,
  TransactionProgressStep
} from "@/lib/dashboard/transaction-progress";
import type { OrderDeadlineHint } from "@/lib/dashboard/order-deadline-hints";
import {
  compensationModeLabel,
  type OfferCompensationSummary
} from "@/lib/marketplace/offer-normalize";
import type { NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";
import {
  isOrderParticipant,
  loadOrderWorkspaceSummary,
  type OrderWorkspaceSummary
} from "@/lib/workspace/order-notes";
import { cn } from "@/lib/utils";

type OrderActionHubProps = {
  exchange: NormalizedOrderExchange;
  compensation: OfferCompensationSummary | null;
  offerHref: string;
  onScrollToActions: () => void;
};

export function OrderActionHub({
  exchange,
  compensation,
  offerHref,
  onScrollToActions
}: OrderActionHubProps) {
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<OrderWorkspaceSummary | null>(null);

  useEffect(() => {
    const session = loadActiveSession();
    setPublicKeyHex(session?.publicKeyHex ?? null);
  }, []);

  useEffect(() => {
    const session = loadActiveSession();
    if (!session || !isOrderParticipant(exchange, session.publicKeyHex)) {
      setWorkspaceSummary(null);
      return;
    }

    let cancelled = false;
    void loadOrderWorkspaceSummary(session, exchange.orderId).then((summary) => {
      if (!cancelled) {
        setWorkspaceSummary(summary.hasNote || summary.hasReminder ? summary : null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [exchange]);

  const viewerRole = useMemo(() => {
    if (!publicKeyHex) {
      return null;
    }
    if (publicKeyHex === exchange.buyerPubKey) {
      return "buyer" as const;
    }
    if (publicKeyHex === exchange.providerPubKey) {
      return "provider" as const;
    }
    return null;
  }, [exchange.buyerPubKey, exchange.providerPubKey, publicKeyHex]);

  const progress = useMemo(() => {
    if (!viewerRole) {
      return null;
    }
    return deriveTransactionProgress(exchange, viewerRole);
  }, [exchange, viewerRole]);

  const roleLabel =
    viewerRole === "buyer" ? "Buying" : viewerRole === "provider" ? "Selling" : null;

  return (
    <div className="space-y-4">
      {compensation ? (
        <Card className="border-border/70 bg-muted/15">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Locked offer terms</p>
              <Badge variant="outline">{compensationModeLabel(compensation.compensationMode)}</Badge>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {compensation.termsHash ? (
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Terms hash</p>
                  <p className="mt-1 font-mono text-foreground">{compensation.termsHash}</p>
                </div>
              ) : null}
              {compensation.compensationMode !== "credits" && compensation.barterTerms ? (
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Barter terms</p>
                  <p className="mt-1 text-foreground">{compensation.barterTerms}</p>
                </div>
              ) : null}
              {compensation.barterTags.length > 0 ? (
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Barter tags</p>
                  <p className="mt-1 text-foreground">{compensation.barterTags.join(", ")}</p>
                </div>
              ) : null}
            </div>
            <Link href={offerHref} className="inline-flex text-sm text-primary hover:underline">
              View full offer
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card
        className={cn(
          progress?.needsViewerAction ? "border-primary/35 bg-primary/5" : "border-border/70"
        )}
      >
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {roleLabel ? <Badge variant="outline">{roleLabel}</Badge> : null}
            {progress?.milestoneTotal && progress.milestoneTotal > 1 ? (
              <Badge variant="outline">
                {progress.activeMilestoneIndex} of {progress.milestoneTotal} milestones
              </Badge>
            ) : null}
            {progress?.deadlineHint ? <DeadlineBadge hint={progress.deadlineHint} /> : null}
            {workspaceSummary?.hasNote ? (
              <Badge variant="outline" className="border-warning/40 text-warning">
                <NotebookPen className="mr-1 size-3" />
                Local note
              </Badge>
            ) : null}
            {progress?.needsViewerAction ? (
              <Badge variant="default">Your turn</Badge>
            ) : progress?.isDisputed ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                Dispute open
              </Badge>
            ) : progress?.isComplete ? (
              <Badge variant="success">Complete</Badge>
            ) : progress ? (
              <Badge variant="muted">In progress</Badge>
            ) : publicKeyHex ? (
              <Badge variant="muted">Read-only</Badge>
            ) : null}
          </div>

          {!publicKeyHex ? (
            <>
              <div>
                <p className="text-base font-medium text-foreground">Sign in to continue this exchange</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unlock the next protocol step for this order as the buyer or provider.
                </p>
              </div>
              <Button nativeButton={false} render={<Link href="/sign-in" />}>
                Sign in
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : progress ? (
            <>
              <div>
                <p className="text-base font-medium text-foreground">{progress.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{progress.detail}</p>
              </div>

              <StepIndicator steps={progress.steps} />

              {progress.milestoneSummaries.length > 1 ? (
                <MilestoneProgressStrip summaries={progress.milestoneSummaries} />
              ) : null}
              {progress.deadlineHint ? (
                <p className="text-xs text-muted-foreground">{progress.deadlineHint.detail}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {progress.isDisputed && progress.disputeBuilderHref ? (
                  <Button nativeButton={false} render={<Link href={progress.disputeBuilderHref} />}>
                    {progress.nextActionLabel ?? "Resolve dispute"}
                    <ArrowRight className="size-4" />
                  </Button>
                ) : progress.needsViewerAction && progress.nextActionLabel ? (
                  <Button type="button" onClick={onScrollToActions}>
                    {progress.nextActionLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                ) : progress.isComplete ? (
                  <Button
                    nativeButton={false}
                    render={<Link href="/dashboard/transactions" />}
                    variant="outline"
                  >
                    View transactions
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={onScrollToActions}>
                    View exchange details
                  </Button>
                )}
                {progress.builderHref ? (
                  <Button
                    nativeButton={false}
                    render={<Link href={progress.builderHref} />}
                    variant="outline"
                  >
                    Guided builder
                  </Button>
                ) : null}
                {progress.disputeBuilderHref && !progress.isDisputed ? (
                  <Button
                    nativeButton={false}
                    render={<Link href={progress.disputeBuilderHref} />}
                    variant="outline"
                  >
                    Open dispute
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are signed in, but this order does not include your identity as buyer or provider.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepIndicator({
  steps
}: {
  steps: TransactionProgressStep[];
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {steps.map((step) => (
        <li
          key={step.id}
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
            step.state === "done"
              ? "border-primary/20 bg-primary/5"
              : step.state === "current"
                ? "border-primary/30 bg-primary/10"
                : "border-border bg-muted/30 text-muted-foreground"
          )}
        >
          {step.state === "done" ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
          ) : (
            <Circle
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                step.state === "current" ? "text-primary" : "text-muted-foreground"
              )}
            />
          )}
          <span className="leading-snug">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function DeadlineBadge({ hint }: { hint: OrderDeadlineHint }) {
  const tone =
    hint.kind === "order_expired" || hint.kind === "past_due"
      ? "border-destructive/40 text-destructive"
      : "border-amber-500/40 text-amber-700 dark:text-amber-300";

  return (
    <Badge variant="outline" className={tone} title={hint.detail}>
      {hint.label}
    </Badge>
  );
}

function MilestoneProgressStrip({ summaries }: { summaries: MilestoneProgressSummary[] }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {summaries.map((milestone) => (
        <li
          key={milestone.id}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs",
            milestone.phase === "active"
              ? "border-primary/30 bg-primary/10 text-foreground"
              : milestone.phase === "complete"
                ? "border-primary/20 bg-primary/5 text-foreground"
                : milestone.phase === "disputed"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/30 text-muted-foreground"
          )}
        >
          <span className="font-medium">{milestone.label}</span>
          <span className="ml-2 text-muted-foreground">{milestone.status}</span>
        </li>
      ))}
    </ol>
  );
}
