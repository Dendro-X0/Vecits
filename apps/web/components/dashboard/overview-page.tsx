"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadActiveSession } from "@/lib/auth/session";
import { loadLiveOverviewStats, type LiveOverviewStats } from "@/lib/dashboard/load-live-overview";
import {
  SHOWCASE_ACTIVITY,
  SHOWCASE_KPIS,
  SHOWCASE_LANE_BARS
} from "@/lib/dashboard/showcase-stats";
import { truncatePubkey } from "@/lib/utils";

export function OverviewPage() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<LiveOverviewStats | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);

  useEffect(() => {
    setPubkey(loadActiveSession()?.publicKeyHex ?? null);
  }, []);

  useEffect(() => {
    if (!pubkey) {
      setLiveStats(null);
      return;
    }

    let cancelled = false;
    setLoadingLive(true);
    void loadLiveOverviewStats(pubkey).then((stats) => {
      if (!cancelled) {
        setLiveStats(stats);
        setLoadingLive(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const kpis = liveStats?.kpis ?? SHOWCASE_KPIS;
  const laneBars = liveStats?.laneBars ?? SHOWCASE_LANE_BARS;
  const activity = liveStats?.activity ?? SHOWCASE_ACTIVITY;
  const maxLaneCount = Math.max(...laneBars.map((bar) => bar.count), 1);
  const usingLive = Boolean(pubkey && liveStats);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Coordination metrics from kernel replay — credits, not fiat.
          </p>
          {pubkey ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Identity {truncatePubkey(pubkey, 8, 8)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              <Link href="/sign-in" className="text-primary underline underline-offset-4">
                Sign in
              </Link>{" "}
              to personalize this workspace.
            </p>
          )}
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {usingLive
            ? `Live · ${liveStats?.nodeLabel ?? "node"} · as_of ${liveStats?.asOf ?? "—"}`
            : loadingLive
              ? "Loading live stats…"
              : "Showcase data · sign in + connect a node for live stats"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{usingLive ? "Offers by lane" : "Work by lane"}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {usingLive ? "Your active marketplace listings" : "Completed projects grouped by service type"}
              </p>
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
                    style={{ width: `${maxLaneCount > 0 ? (bar.count / maxLaneCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Latest exchange events</p>
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

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-medium">My exchanges</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Place orders from marketplace listings, fund escrow on the order page, then track progress
              here as the loop matures.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Browse marketplace
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
