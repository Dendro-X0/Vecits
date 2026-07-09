"use client";

import Link from "next/link";
import {
  BarChart3,
  Clock3,
  LayoutGrid,
  PackageOpen,
  Sparkles,
  UserCircle,
  WifiOff
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadActiveSession } from "@/lib/auth/session";
import {
  loadLiveOverviewStats,
  type LiveOverviewState
} from "@/lib/dashboard/load-live-overview";
import { truncatePubkey } from "@/lib/utils";

type OverviewStatus = "signed-out" | "loading" | "live" | "empty" | "error";

function resolveStatus(
  pubkey: string | null,
  loading: boolean,
  state: LiveOverviewState | null
): OverviewStatus {
  if (!pubkey) {
    return "signed-out";
  }
  if (loading || !state) {
    return "loading";
  }
  return state.kind;
}

function StatusBadge({
  status,
  state,
  pubkey
}: {
  status: OverviewStatus;
  state: LiveOverviewState | null;
  pubkey: string | null;
}) {
  const labels: Record<OverviewStatus, string> = {
    "signed-out": "Signed out",
    loading: "Loading…",
    live:
      state?.kind === "live"
        ? `Live · ${state.stats.nodeLabel}${state.stats.asOf ? ` · as_of ${state.stats.asOf}` : ""}`
        : "Live",
    empty:
      state?.kind === "empty"
        ? `Connected · no activity yet${state.asOf ? ` · as_of ${state.asOf}` : ""}`
        : "No activity yet",
    error: state?.kind === "error" ? `Connection issue · ${state.nodeLabel}` : "Connection issue"
  };

  const tone =
    status === "live"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "error"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{labels[status]}</span>
      {pubkey ? (
        <span className="font-mono text-xs text-muted-foreground">
          {truncatePubkey(pubkey, 8, 8)}
        </span>
      ) : null}
    </div>
  );
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

function WorkspaceScaffoldCard() {
  return (
    <Card className="hidden border-border/70 lg:block">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Workspace preview</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Metrics and charts load here once your identity connects.
          </p>
        </div>
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="grid gap-2 sm:grid-cols-3">
          {["Offers", "Orders", "Escrow"].map((item) => (
            <div key={item} className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item}</p>
              <div className="mt-1.5 h-4 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Lane trend</p>
            <p className="text-[11px] text-muted-foreground">Chart area</p>
          </div>
          <div className="h-16 rounded-md bg-muted/50" />
        </div>
      </CardContent>
    </Card>
  );
}

function LiveOverviewContent({ state }: { state: Extract<LiveOverviewState, { kind: "live" }> }) {
  const { kpis, laneBars, activity } = state.stats;
  const maxLaneCount = Math.max(...laneBars.map((bar) => bar.count), 1);

  return (
    <>
      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Workspace context</p>
            <p className="text-sm text-muted-foreground">
              Kernel-backed values from <span className="font-medium text-foreground">{state.stats.nodeLabel}</span>
              {state.stats.asOf ? ` · as_of ${state.stats.asOf}` : ""}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Coordination canvas
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold tracking-tight">{kpi.value}</p>
              <p className="text-sm text-primary">{kpi.delta}</p>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Offers by lane</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Your active marketplace listings</p>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            {laneBars.map((bar) => (
              <div key={bar.lane}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="capitalize">{bar.lane}</span>
                  <span className="text-muted-foreground">{bar.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${maxLaneCount > 0 ? (bar.count / maxLaneCount) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Latest events from your identity</p>
            </div>
            <Clock3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent events for this identity.</p>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.when}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-medium">Continue in the marketplace</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Place orders, fund escrow, and complete exchanges from listing and order pages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/dashboard/transactions" />}>
              Track transactions
            </Button>
            <Button nativeButton={false} render={<Link href="/marketplace" />} variant="outline">
              Browse
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/builder" />}
              variant="outline"
            >
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function OverviewPage() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [overviewState, setOverviewState] = useState<LiveOverviewState | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);

  useEffect(() => {
    setPubkey(loadActiveSession()?.publicKeyHex ?? null);
  }, []);

  useEffect(() => {
    if (!pubkey) {
      setOverviewState(null);
      return;
    }

    let cancelled = false;
    setLoadingLive(true);
    void loadLiveOverviewStats(pubkey).then((state) => {
      if (!cancelled) {
        setOverviewState(state);
        setLoadingLive(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const status = resolveStatus(pubkey, loadingLive, overviewState);

  return (
    <div className="w-full space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <StatusBadge status={status} state={overviewState} pubkey={pubkey} />
      </div>

      {status === "signed-out" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <EmptyPanel
            icon={UserCircle}
            title="Sign in to see your workspace"
            description="Create or unlock a local identity to view live offers, orders, and exchange activity from your node."
            primaryHref="/sign-in"
            primaryLabel="Sign in"
            secondaryHref="/marketplace"
            secondaryLabel="Browse"
          />
          <WorkspaceScaffoldCard />
        </div>
      ) : null}

      {status === "loading" ? (
        <Card className="border-border/70">
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            Loading activity from your node…
          </CardContent>
        </Card>
      ) : null}

      {status === "error" && overviewState?.kind === "error" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <EmptyPanel
            icon={WifiOff}
            title="Could not reach your node"
            description={
              overviewState.message ||
              "Check that your kernel is running and that connection settings point to the correct node URL."
            }
            primaryHref="/dashboard/settings"
            primaryLabel="Settings"
            secondaryHref="/marketplace"
            secondaryLabel="Browse"
          />
          <WorkspaceScaffoldCard />
        </div>
      ) : null}

      {status === "empty" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <EmptyPanel
            icon={PackageOpen}
            title="No marketplace activity yet"
            description="You are connected, but this identity has no offers or exchange events yet. Browse listings or publish your first offer to get started."
            primaryHref="/marketplace"
            primaryLabel="Browse"
            secondaryHref="/dashboard/builder"
            secondaryLabel="Publish"
          />
          <WorkspaceScaffoldCard />
        </div>
      ) : null}

      {status === "live" && overviewState?.kind === "live" ? (
        <LiveOverviewContent state={overviewState} />
      ) : null}
    </div>
  );
}
