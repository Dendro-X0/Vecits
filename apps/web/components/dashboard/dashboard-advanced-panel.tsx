"use client";

import Link from "next/link";
import { ExternalLink, Wrench } from "lucide-react";

import { OperationsCommandTools } from "@/app/components/operations-command-tools";
import { KernelTruthBanner } from "@/components/marketplace/kernel-truth-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const READINESS_COMMANDS = [
  { label: "Run full preflight", command: "npm run v1:preflight" },
  { label: "Run full readiness", command: "npm run v1:readiness" },
  { label: "Rerun GA6 drill", command: "npm run v1:ga6-drill" }
] as const;

const EVIDENCE_EXPORT_COMMANDS = [
  {
    label: "Refresh evidence manifest",
    command: "npm run v1:evidence-manifest",
    runnableAction: "refresh_evidence_manifest" as const
  },
  {
    label: "Refresh artifact prune plan",
    command: "npm run v1:artifact-prune-plan",
    runnableAction: "refresh_artifact_prune_plan" as const
  },
  {
    label: "Refresh export audit log plan",
    command: "npm run v1:export-audit-log-plan",
    runnableAction: "refresh_export_audit_log_plan" as const
  },
  { label: "Run lane fixture checks", command: "npm run v1:lane-fixtures", runnableAction: "run_lane_fixture_checks" as const }
] as const;

export function DashboardAdvancedContent({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-3xl space-y-6 p-4 sm:p-6"}>
      {!embedded ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold tracking-tight">Advanced</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Operator workflows for preflight, evidence export, and lane fixture checks. These run
            against your local workspace and node — not required for everyday marketplace use.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight">Operator tools</h3>
          <p className="text-sm text-muted-foreground">
            Preflight drills, evidence export, and the legacy console for maintainers.
          </p>
        </div>
      )}

      <KernelTruthBanner variant="banner" />

      <Card>
        <CardHeader>
          <CardTitle>Offer builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Import discovery drafts and sign ServiceOffer events from the Identity workspace —
            available on desktop without the legacy operator console.
          </p>
          <Link
            href="/dashboard/builder#import"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Open publish flow
            <ExternalLink className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness drills</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationsCommandTools title="Preflight & GA6" commands={[...READINESS_COMMANDS]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence export</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationsCommandTools
            title="Export workflow"
            commands={[...EVIDENCE_EXPORT_COMMANDS]}
            refreshAfterRun
            showReloadButton
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy operator console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The full debug console (fixture quickstart, onboarding builders, triage history) remains
            available for power users but is no longer linked from primary navigation.
          </p>
          <Link
            href="/operator"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Open legacy operator console
            <ExternalLink className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardAdvancedPanel() {
  return <DashboardAdvancedContent />;
}
