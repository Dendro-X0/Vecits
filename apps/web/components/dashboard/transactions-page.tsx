"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  ChartLine,
  CheckCircle2,
  Circle,
  LayoutGrid,
  NotebookPen,
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
import { useDesktopNodeReady } from "@/lib/desktop/use-desktop-node-ready";
import { useDesktopNodeRetry } from "@/lib/desktop/use-desktop-node-retry";
import {
  loadTransactions,
  type TransactionOrderSummary,
  type TransactionsState
} from "@/lib/dashboard/load-transactions";
import type { TransactionProgressStep } from "@/lib/dashboard/transaction-progress";
import type { MilestoneProgressSummary } from "@/lib/dashboard/transaction-progress";
import {
  filterOrdersByRole,
  parseRoleFilter,
  roleFilterLabel,
  type RoleFilter
} from "@/lib/dashboard/workspace-role";
import { loadWorkspaceSummaries, type OrderWorkspaceSummary } from "@/lib/workspace/order-notes";
import { flushDueOrderReminders } from "@/lib/workspace/order-reminders";
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

function RoleFilterTabs({
  active,
  buyerCount,
  providerCount,
  onChange
}: {
  active: RoleFilter;
  buyerCount: number;
  providerCount: number;
  onChange: (filter: RoleFilter) => void;
}) {
  const tabs: { id: RoleFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: buyerCount + providerCount },
    { id: "buyer", label: "Buying", count: buyerCount },
    { id: "provider", label: "Selling", count: providerCount }
  ];

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition",
            active === tab.id
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] tabular-nums">{tab.count}</span>
        </button>
      ))}
    </div>
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

function DeadlineBadge({
  hint
}: {
  hint: NonNullable<TransactionOrderSummary["progress"]["deadlineHint"]>;
}) {
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
  if (summaries.length <= 1) {
    return null;
  }

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

function TransactionOrderCard({
  order,
  workspaceSummary
}: {
  order: TransactionOrderSummary;
  workspaceSummary?: OrderWorkspaceSummary;
}) {
  const laneLabel = order.serviceType.replace(/-/g, " ");

  return (
    <Card className={order.progress.needsViewerAction ? "border-primary/30" : undefined}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="lane">{laneLabel}</Badge>
              <Badge variant="outline">{order.role === "buyer" ? "Buying" : "Selling"}</Badge>
              {order.progress.milestoneTotal > 1 ? (
                <Badge variant="outline">
                  {order.progress.activeMilestoneIndex} of {order.progress.milestoneTotal} milestones
                </Badge>
              ) : null}
              {order.progress.deadlineHint ? (
                <DeadlineBadge hint={order.progress.deadlineHint} />
              ) : null}
              {workspaceSummary?.hasNote ? (
                <Badge variant="outline" className="border-warning/40 text-warning">
                  <NotebookPen className="mr-1 size-3" />
                  Note
                </Badge>
              ) : null}
              {workspaceSummary?.reminderDue ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                  <Bell className="mr-1 size-3" />
                  Reminder due
                </Badge>
              ) : workspaceSummary?.hasReminder ? (
                <Badge variant="outline">
                  <Bell className="mr-1 size-3" />
                  Reminder set
                </Badge>
              ) : null}
              {order.progress.needsViewerAction ? (
                <Badge variant="default">Action needed</Badge>
              ) : order.progress.isDisputed ? (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Dispute open
                </Badge>
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
          {order.progress.deadlineHint ? (
            <p className="mt-2 text-xs text-muted-foreground">{order.progress.deadlineHint.detail}</p>
          ) : null}
        </div>

        <MilestoneProgressStrip summaries={order.progress.milestoneSummaries} />

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
          {order.progress.disputeBuilderHref ? (
            <Button
              nativeButton={false}
              render={<Link href={order.progress.disputeBuilderHref} />}
              variant="outline"
            >
              {order.progress.isDisputed ? "Resolve dispute" : "Open dispute"}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TransactionsState | null>(null);
  const [workspaceSummaries, setWorkspaceSummaries] = useState<
    Map<string, OrderWorkspaceSummary>
  >(new Map());
  const nodeReady = useDesktopNodeReady();
  const roleFilter = parseRoleFilter(searchParams.get("role"));
  const status = resolveStatus(pubkey, loading, state);

  const reloadTransactions = () => {
    if (!pubkey) {
      return;
    }
    setLoading(true);
    void loadTransactions(pubkey).then((next) => {
      setState(next);
      setLoading(false);
    });
  };

  useEffect(() => {
    const session = loadActiveSession();
    setPubkey(session?.publicKeyHex ?? null);
  }, []);

  useEffect(() => {
    if (!pubkey || !nodeReady) {
      if (pubkey && !nodeReady) {
        setLoading(true);
      }
      if (!pubkey) {
        setLoading(false);
        setState(null);
      }
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

    const session = loadActiveSession();
    if (session) {
      void flushDueOrderReminders(session);
    }

    return () => {
      cancelled = true;
    };
  }, [pubkey, nodeReady]);

  useDesktopNodeRetry(state?.kind === "error", reloadTransactions);

  useEffect(() => {
    if (!pubkey || state?.kind !== "live") {
      setWorkspaceSummaries(new Map());
      return;
    }

    const session = loadActiveSession();
    if (!session) {
      return;
    }

    let cancelled = false;
    void loadWorkspaceSummaries(
      session,
      state.orders.map((order) => order.orderId)
    ).then((summaries) => {
      if (!cancelled) {
        setWorkspaceSummaries(summaries);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pubkey, state]);

  function setRoleFilter(filter: RoleFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("role");
    } else {
      params.set("role", filter);
    }
    const query = params.toString();
    router.replace(query ? `/dashboard/transactions?${query}` : "/dashboard/transactions", {
      scroll: false
    });
  }

  const liveOrders = state?.kind === "live" ? state.orders : [];
  const filteredOrders = filterOrdersByRole(liveOrders, roleFilter);
  const roleSummary = state?.kind === "live" ? state.roleSummary : null;

  const queueSource =
    roleFilter === "buyer"
      ? roleSummary?.buyer
      : roleFilter === "provider"
        ? roleSummary?.provider
        : null;

  const actionCount = queueSource
    ? queueSource.needsAction
    : liveOrders.filter((order) => order.progress.needsViewerAction).length;
  const completeCount = queueSource
    ? queueSource.complete
    : liveOrders.filter((order) => order.progress.isComplete).length;
  const inProgressCount = queueSource
    ? queueSource.inProgress
    : liveOrders.length - actionCount - completeCount;
  const totalCount = queueSource ? queueSource.total : liveOrders.length;

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
                  {state.roleSummary.primaryLabel} · kernel-backed order state from{" "}
                  <span className="font-medium text-foreground">{state.nodeLabel}</span>
                  {state.asOf ? ` · as_of ${state.asOf}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{state.roleSummary.hint}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Action-priority queue
              </div>
            </CardContent>
          </Card>

          <RoleFilterTabs
            active={roleFilter}
            buyerCount={state.roleSummary.buyer.total}
            providerCount={state.roleSummary.provider.total}
            onChange={setRoleFilter}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {roleFilterLabel(roleFilter)}
                </p>
                <p className="text-3xl font-semibold tracking-tight">{totalCount}</p>
                <p className="text-xs text-muted-foreground">
                  {roleFilter === "all"
                    ? `${state.roleSummary.buyer.total} buying · ${state.roleSummary.provider.total} selling`
                    : "Filtered from participant order view"}
                </p>
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
          {filteredOrders.length === 0 ? (
            <Card className="border-border/70">
              <CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">
                No {roleFilter === "buyer" ? "buying" : "selling"} orders in this queue yet.
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <TransactionOrderCard
                key={order.orderId}
                order={order}
                workspaceSummary={workspaceSummaries.get(order.orderId)}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
