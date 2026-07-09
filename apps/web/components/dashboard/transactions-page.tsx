"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  ChartLine,
  CheckCircle2,
  Circle,
  LayoutGrid,
  PackageOpen,
  Sparkles,
  UserCircle,
  WifiOff
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadActiveSession } from "@/lib/auth/session";
import {
  loadTransactions,
  type TransactionOrderSummary,
  type TransactionsState
} from "@/lib/dashboard/load-transactions";
import type { TransactionProgressStep } from "@/lib/dashboard/transaction-progress";
import { cn, truncatePubkey } from "@/lib/utils";

type TransactionsStatus = "signed-out" | "loading" | "live" | "empty" | "error";

function resolveStatus(
  pubkey: string | null,
  loading: boolean,
  state: TransactionsState | null
): TransactionsStatus {
  if (!pubkey) {
    return "signed-out";
  }
  if (loading || !state) {
    return "loading";
  }
  return state.kind;
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: {
  icon: typeof PackageOpen;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex flex-col items-center px-5 py-8 text-center sm:px-6 sm:py-9">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/60">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-base font-medium sm:text-lg">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button nativeButton={false} render={<Link href={primaryHref} />}>
            {primaryLabel}
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={secondaryHref} />}
            variant="outline"
          >
            {secondaryLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsScaffoldCard() {
  return (
    <Card className="hidden border-border/70 lg:block">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Queue preview</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Exchanges appear here sorted by what needs you first.
            </p>
          </div>
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          {["Needs action", "In progress", "Complete"].map((item) => (
            <div key={item} className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item}</p>
              <div className="mt-1 h-3.5 w-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StepIndicator({ steps }: { steps: TransactionProgressStep[] }) {
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

function TransactionOrderCard({ order }: { order: TransactionOrderSummary }) {
  const laneLabel = order.serviceType.replace(/-/g, " ");

  return (
    <Card className={order.progress.needsViewerAction ? "border-primary/30" : undefined}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="lane">{laneLabel}</Badge>
              <Badge variant="outline">{order.role === "buyer" ? "Buying" : "Selling"}</Badge>
              {order.progress.needsViewerAction ? (
                <Badge variant="default">Action needed</Badge>
              ) : order.progress.isComplete ? (
                <Badge variant="success">Complete</Badge>
              ) : (
                <Badge variant="muted">In progress</Badge>
              )}
            </div>
            <div>
              <p className="font-mono text-sm font-medium">{order.orderId}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Offer <span className="font-mono text-foreground">{order.offerId}</span>
              </p>
            </div>
          </div>
          <Badge variant={order.orderStatus === "closed" ? "success" : "outline"}>
            {order.orderStatus}
          </Badge>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium">{order.progress.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{order.progress.detail}</p>
        </div>

        <StepIndicator steps={order.progress.steps} />

        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={order.orderHref} />}>
            {order.progress.nextActionLabel ?? "View order"}
            <ArrowRight className="size-4" />
          </Button>
          {order.progress.builderHref ? (
            <Button
              nativeButton={false}
              render={<Link href={order.progress.builderHref} />}
              variant="outline"
            >
              Guided builder
            </Button>
          ) : null}
          <Button
            nativeButton={false}
            render={<Link href={`/marketplace/offers/${encodeURIComponent(order.offerId)}`} />}
            variant="outline"
          >
            View offer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TransactionsPage() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TransactionsState | null>(null);
  const status = resolveStatus(pubkey, loading, state);

  useEffect(() => {
    const session = loadActiveSession();
    setPubkey(session?.publicKeyHex ?? null);
  }, []);

  useEffect(() => {
    if (!pubkey) {
      setLoading(false);
      setState(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadTransactions(pubkey).then((next) => {
      if (!cancelled) {
        setState(next);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const actionCount =
    state?.kind === "live"
      ? state.orders.filter((order) => order.progress.needsViewerAction).length
      : 0;
  const completeCount =
    state?.kind === "live" ? state.orders.filter((order) => order.progress.isComplete).length : 0;
  const inProgressCount =
    state?.kind === "live" ? state.orders.length - actionCount - completeCount : 0;

  return (
    <div className="w-full space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {status === "live" && actionCount > 0 ? (
          <Badge variant="default">
            {actionCount} need{actionCount === 1 ? "s" : ""} you
          </Badge>
        ) : null}
        {pubkey ? (
          <span className="font-mono text-xs text-muted-foreground">
            {truncatePubkey(pubkey, 8, 8)}
          </span>
        ) : null}
      </div>

      {status === "signed-out" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <EmptyPanel
            icon={UserCircle}
            title="Sign in to see your transactions"
            description="Orders you buy or sell on this node appear here with clear next steps."
            primaryHref="/sign-in"
            primaryLabel="Sign in"
            secondaryHref="/marketplace"
            secondaryLabel="Browse"
          />
          <TransactionsScaffoldCard />
        </div>
      ) : null}

      {status === "loading" ? (
        <Card className="border-border/70">
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            Loading transactions from your node…
          </CardContent>
        </Card>
      ) : null}

      {status === "error" && state?.kind === "error" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <EmptyPanel
            icon={WifiOff}
            title="Could not reach your node"
            description={state.message}
            primaryHref="/dashboard/settings"
            primaryLabel="Settings"
            secondaryHref="/marketplace"
            secondaryLabel="Browse"
          />
          <TransactionsScaffoldCard />
        </div>
      ) : null}

      {status === "empty" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <EmptyPanel
            icon={ArrowLeftRight}
            title="No transactions yet"
            description="When you place or receive an order on this node, progress will show up here with the next action to take."
            primaryHref="/marketplace"
            primaryLabel="Browse"
            secondaryHref="/dashboard/builder"
            secondaryLabel="Publish"
          />
          <TransactionsScaffoldCard />
        </div>
      ) : null}

      {status === "live" && state?.kind === "live" ? (
        <div className="space-y-5">
          <Card className="border-border/70">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Transactions context</p>
                <p className="text-sm text-muted-foreground">
                  Kernel-backed order state from{" "}
                  <span className="font-medium text-foreground">{state.nodeLabel}</span>
                  {state.asOf ? ` · as_of ${state.asOf}` : ""}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Action-priority queue
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total orders</p>
                <p className="text-3xl font-semibold tracking-tight">{state.orders.length}</p>
                <p className="text-xs text-muted-foreground">Loaded from participant order view</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Needs action</p>
                <p className="text-3xl font-semibold tracking-tight">{actionCount}</p>
                <p className="text-xs text-muted-foreground">Requires your next exchange step</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">In progress</p>
                <p className="text-3xl font-semibold tracking-tight">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">Active and not yet completed</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Completed</p>
                <p className="text-3xl font-semibold tracking-tight">{completeCount}</p>
                <p className="text-xs text-muted-foreground">Orders with final settlement state</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-medium text-foreground">Queue health</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orders are sorted with action-required exchanges first, then in-progress, then complete.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                <ChartLine className="size-3.5" />
                Prioritized by workflow state
              </div>
            </CardContent>
          </Card>

          {state.asOf ? (
            <p className="text-xs text-muted-foreground">Kernel as_of {state.asOf}</p>
          ) : null}
          {state.orders.map((order) => (
            <TransactionOrderCard key={order.orderId} order={order} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
