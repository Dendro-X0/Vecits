import { NodeApiError, NodeClient } from "@new-start/sdk-ts";
import Link from "next/link";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ContributionCreditBuilder } from "@/app/components/contribution-credit-builder";
import { FixtureQuickstart } from "@/app/components/fixture-quickstart";
import { IdentityCreateForm } from "@/app/components/identity-create-form";
import { MarketplaceEventBuilder } from "@/app/components/marketplace-event-builder";
import { OnboardingWizard } from "@/app/components/onboarding-wizard";
import {
  OperationsCommandTools,
  type OperationsCommandRunnableAction,
  type OperationsCommandToolItem
} from "@/app/components/operations-command-tools";

type ReplayPreview = {
  asOf: string;
  source: string;
  appliedEventCount: number;
  invalidEventCount: number;
};

type ReplayPreviewResult =
  | { ok: true; preview: ReplayPreview }
  | { ok: false; message: string };

type Ga6DrillPreview = {
  runId: string;
  runDir: string;
  invalidEventCount: {
    nodeA: number;
    nodeB: number;
    nodeC: number;
  };
  appliedEventCount: {
    nodeA: number;
    nodeB: number;
    nodeC: number;
  };
  appliedEventCountEqual: {
    nodeAvsNodeB: boolean;
    nodeAvsNodeC: boolean;
  };
  replayParity: {
    nodeAvsNodeB: boolean;
    nodeAvsNodeC: boolean;
  };
  discoveryParity: {
    nodeAvsNodeB: boolean;
    nodeAvsNodeC: boolean;
  };
};

type Ga6DrillPreviewResult =
  | { ok: true; preview: Ga6DrillPreview }
  | { ok: false; message: string };

type PreflightCheckPreview = {
  gate: string;
  status: string;
  command: string | null;
};

type PreflightPreview = {
  runId: string;
  runDir: string;
  overallStatus: string;
  failedGate: string | null;
  checks: PreflightCheckPreview[];
};

type PreflightPreviewResult =
  | { ok: true; preview: PreflightPreview }
  | { ok: false; message: string };

type LaneFixtureCheckPreview = {
  runId: string;
  runDir: string;
  overallStatus: string;
  failedCheck: string | null;
  checks: Array<{
    name: string;
    status: string;
    command: string | null;
  }>;
};

type LaneFixtureCheckPreviewResult =
  | { ok: true; preview: LaneFixtureCheckPreview }
  | { ok: false; message: string };

type RunStatus = "passed" | "failed";

type OperationsHistoryItem = {
  runId: string;
  runDir: string;
  status: RunStatus;
  summary: string;
  ageSummary: string;
  isStale: boolean;
  isPinned: boolean;
  noteSummary: string | null;
  tags: string[];
};

type OperationsHistoryResult =
  | { ok: true; items: OperationsHistoryItem[] }
  | { ok: false; message: string };

type TriageCommand = {
  label: string;
  command: string;
  runnableAction?: OperationsCommandRunnableAction;
};

type LifecycleLaneSummary = {
  totalRuns: number;
  pinnedRuns: number;
  notedRuns: number;
  taggedRuns: number;
  pruneCandidates: string[];
  latestRunId: string | null;
  latestRunDir: string | null;
  latestAgeSummary: string;
  latestStale: boolean;
};

type OperationsLifecycleSummary = {
  preflight: LifecycleLaneSummary;
  ga6: LifecycleLaneSummary;
  laneFixtures: LifecycleLaneSummary;
};

type OperationsLifecycleResult =
  | { ok: true; summary: OperationsLifecycleSummary }
  | { ok: false; message: string };

type EvidenceManifestPreview = {
  filePath: string;
  analysisAsOf: string;
  analysisAsOfMs: number;
  overallStatus: string;
  latestPreflightStatus: string;
  latestGa6Status: string;
  latestLaneFixtureStatus: string;
  preflightPruneCandidates: number;
  ga6PruneCandidates: number;
  laneFixturePruneCandidates: number;
  commands: {
    generateManifest: string | null;
    generateLaneFixtures: string | null;
    preflightPrunePreview: string | null;
    preflightPruneDryRun: string | null;
    ga6PrunePreview: string | null;
    ga6PruneDryRun: string | null;
    laneFixturePrunePreview: string | null;
    laneFixturePruneDryRun: string | null;
  };
};

type EvidenceManifestPreviewResult =
  | { ok: true; preview: EvidenceManifestPreview }
  | { ok: false; message: string };

type ArtifactPrunePlanPreview = {
  filePath: string;
  analysisAsOf: string;
  analysisAsOfMs: number;
  totalCandidates: number;
  preflightCandidates: number;
  ga6Candidates: number;
  laneFixtureCandidates: number;
  preflightCommands: {
    preview: string | null;
    dryRun: string | null;
    apply: string | null;
  };
  ga6Commands: {
    preview: string | null;
    dryRun: string | null;
    apply: string | null;
  };
  laneFixtureCommands: {
    preview: string | null;
    dryRun: string | null;
    apply: string | null;
  };
};

type ArtifactPrunePlanPreviewResult =
  | { ok: true; preview: ArtifactPrunePlanPreview }
  | { ok: false; message: string };

type ExportAuditLogPlanPreview = {
  filePath: string;
  analysisAsOf: string;
  analysisAsOfMs: number;
  logPath: string;
  lineCount: number;
  keepCount: number;
  pruneCandidateCount: number;
  currentBytes: number;
  projectedBytesAfterApply: number;
  maxBytes: number;
  overMaxBytes: boolean;
  projectedOverMaxBytes: boolean;
  commands: {
    generatePlan: string | null;
    reproducibleSnapshot: string | null;
    applyCleanup: string | null;
  };
  applyResult: {
    applied: boolean;
    changed: boolean;
    archivePath: string | null;
    warning: string | null;
  };
};

type ExportAuditLogPlanPreviewResult =
  | { ok: true; preview: ExportAuditLogPlanPreview }
  | { ok: false; message: string };

type ExportExecutionAuditItem = {
  recordedAt: string;
  action: string;
  actionLabel: string;
  status: RunStatus;
  durationMs: number;
  exitCode: number | null;
  artifactPathHints: string[];
  ageSummary: string;
};

type ExportExecutionAuditActionSummary = {
  action: string;
  actionLabel: string;
  latestStatus: RunStatus;
  latestRecordedAt: string;
  latestAgeSummary: string;
  latestArtifactPathHints: string[];
  failureStreak: number;
  lastSuccessAt: string | null;
  lastSuccessAgeSummary: string | null;
};

type ExportExecutionAuditSummary = {
  byAction: ExportExecutionAuditActionSummary[];
  failingLatestActions: string[];
  totalEntries: number;
};

type ExportExecutionAuditResult =
  | { ok: true; logPath: string; items: ExportExecutionAuditItem[]; summary: ExportExecutionAuditSummary }
  | { ok: false; logPath: string; message: string };

type FocusChecklistStatus = "pass" | "attention" | "fail";
type FocusChecklistFilter =
  | "all"
  | "non-pass"
  | "stale"
  | "stale-non-pass"
  | "critical-stale";
type CriticalCopyGroupMode = "show" | "hide";
type HistoryFocus = "all" | "preflight" | "ga6" | "lane-fixtures";

type FocusChecklistLink = {
  label: string;
  href: string;
};

type FocusChecklistAgeBadgeTone = "ok" | "warn" | "critical" | "unknown";

type FocusChecklistAgeBadge = {
  label: string;
  tone: FocusChecklistAgeBadgeTone;
  staleHint: string | null;
};

type FocusChecklistItem = {
  key: string;
  label: string;
  status: FocusChecklistStatus;
  summary: string;
  triageCommands: TriageCommand[];
  quickLinks: FocusChecklistLink[];
  ageBadges: FocusChecklistAgeBadge[];
  staleSource: "run age" | "export artifact age";
};

type HomeFixtureLane = {
  label: string;
  lane: string;
  description: string;
};

type Phase2Link = {
  label: string;
  description: string;
  href: string;
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

const PREFLIGHT_RUN_PREFIX = "preflight-";
const GA6_RUN_PREFIX = "runbook-dryrun-";
const LANE_FIXTURE_RUN_PREFIX = "lane-fixture-check-";
const PREFLIGHT_STALE_HOURS = 36;
const GA6_STALE_HOURS = 8 * 24;
const LANE_FIXTURE_STALE_HOURS = 7 * 24;
const PRUNE_RETENTION_HOURS = 14 * 24;
const KEEP_RECENT_RUNS = 5;
const RUN_PIN_SENTINELS = [".pinned", ".keep", "PINNED.md"];
const RUN_NOTE_FILE = "OPERATIONS_NOTE.txt";
const RUN_TAGS_FILE = "INCIDENT_TAGS.txt";
const ALPHA_WORKFLOW_LINKS = [
  {
    label: "Start onboarding",
    description: "Create identity and sponsor-request drafts for invite-only entry.",
    href: "#onboarding-wizard"
  },
  {
    label: "Open software discovery",
    description: "Inspect deterministic alpha discovery results for the primary software lane.",
    href: "/explorer/discovery?service_type=software-fixes&alpha_defaults=1"
  },
  {
    label: "Launch accept flow starter",
    description: "Preconfigure the marketplace builder for the default accepted-path alpha flow.",
    href: "/?builder_starter=alpha-accept#marketplace-event-builder"
  },
  {
    label: "Launch dispute flow starter",
    description: "Preconfigure the marketplace builder for the timeout/dispute alpha flow.",
    href: "/?builder_starter=alpha-timeout#marketplace-event-builder"
  },
  {
    label: "Launch project maintenance starter",
    description: "Preconfigure the marketplace builder for the stalled-project maintenance lane.",
    href: "/?builder_starter=project-maintenance#marketplace-event-builder"
  },
  {
    label: "Open contribution builder",
    description: "Jump to claim/attest/mint/spend flows for non-escrow contribution work.",
    href: "#contribution-credit-builder"
  },
  {
    label: "Open fixture bundles",
    description: "Jump to the checked-in lane fixture commands and reproducible bundle shortcuts.",
    href: "#fixture-quickstart"
  }
] as const;

const ALPHA_LANE_STARTERS = [
  {
    label: "Software Fixes",
    description: "Default alpha lane for narrow artifact-verifiable fixes.",
    href: "/?builder_lane=software-fixes&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Small Feature Work",
    description: "Bounded feature increment flow with milestone-first defaults.",
    href: "/?builder_lane=feature-work&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Documentation",
    description: "Doc-update workflow starter for structured written deliverables.",
    href: "/?builder_lane=documentation&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Translation",
    description: "Translation-package starter for artifact-backed language work.",
    href: "/?builder_lane=translation&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Testing",
    description: "Test-report starter for reproduction and verification lanes.",
    href: "/?builder_lane=testing&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Research",
    description: "Research-brief starter for structured analysis outputs.",
    href: "/?builder_lane=research&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Project Maintenance",
    description: "Maintenance-task starter for stalled-project continuation work.",
    href: "/?builder_lane=project-maintenance&builder_flow=accept#marketplace-event-builder"
  }
] as const;

const ALPHA_DISPUTE_LANE_STARTERS = [
  {
    label: "Software Fixes Dispute",
    description: "Start the dispute path for deterministic timeout/deadlock testing in the default software lane.",
    href: "/?builder_lane=software-fixes&builder_flow=dispute#marketplace-event-builder"
  },
  {
    label: "Testing Dispute",
    description: "Open a dispute-path test-report flow for rejection, dispute, and timeout rehearsal.",
    href: "/?builder_lane=testing&builder_flow=dispute#marketplace-event-builder"
  },
  {
    label: "Research Dispute",
    description: "Start the dispute path for structured research outputs that need settlement-edge validation.",
    href: "/?builder_lane=research&builder_flow=dispute#marketplace-event-builder"
  },
  {
    label: "Project Maintenance Dispute",
    description: "Open the stalled-project maintenance lane directly in dispute mode for timeout/deadlock drills.",
    href: "/?builder_lane=project-maintenance&builder_flow=dispute#marketplace-event-builder"
  }
] as const;

const NON_SOFTWARE_FIXTURE_LANES: HomeFixtureLane[] = [
  {
    label: "Feature Work Fixture Bundle",
    lane: "feature-work",
    description: "Checked-in feature increment fixture pair with direct accept/dispute launchers and result shortcuts."
  },
  {
    label: "Documentation Fixture Bundle",
    lane: "documentation",
    description: "Checked-in documentation lane fixtures with direct result inspection after ingest."
  },
  {
    label: "Translation Fixture Bundle",
    lane: "translation",
    description: "Checked-in translation lane fixtures for reproducible accept and dispute-path rehearsal."
  },
  {
    label: "Testing Fixture Bundle",
    lane: "testing",
    description: "Checked-in testing lane fixtures for verification/report workflows and timeout coverage."
  },
  {
    label: "Research Fixture Bundle",
    lane: "research",
    description: "Checked-in research brief fixtures with direct starter and inspection links."
  },
  {
    label: "Project Maintenance Fixture Bundle",
    lane: "project-maintenance",
    description: "Checked-in stalled-project support fixtures with direct lane launchers and deterministic state shortcuts."
  },
  {
    label: "Compute Job Fixture Bundle",
    lane: "compute-job",
    description: "Phase 2 / experimental compute receipt fixtures kept separate from the completed Phase 1 closed-alpha lane set."
  }
] as const;

const PHASE2_COMPUTE_LINKS: Phase2Link[] = [
  {
    label: "Launch compute accept starter",
    description:
      "Open the builder preconfigured for the compute-job accept path with the strict receipt template.",
    href: "/?builder_lane=compute-job&builder_flow=accept#marketplace-event-builder"
  },
  {
    label: "Launch compute dispute starter",
    description:
      "Open the compute-job dispute path to rehearse receipt-template timeout and rejection handling.",
    href: "/?builder_lane=compute-job&builder_flow=dispute#marketplace-event-builder"
  },
  {
    label: "Open compute discovery",
    description:
      "Inspect discovery output for the compute-job lane without mixing it into the completed Phase 1 lane set.",
    href: "/explorer/discovery?service_type=compute-job&alpha_defaults=0"
  },
  {
    label: "Open compute fixture bundles",
    description:
      "Jump to the checked-in compute-job accept/dispute bundles in the fixture quickstart section.",
    href: "#fixture-quickstart"
  }
] as const;
const EVIDENCE_MANIFEST_PREFIX = "operations-evidence-manifest";
const ARTIFACT_PRUNE_PLAN_PREFIX = "operations-artifact-prune-plan";
const EXPORT_AUDIT_LOG_PLAN_PREFIX = "operations-export-audit-log-plan";
const EXPORT_EXECUTION_AUDIT_LOG_NAME = "operations-export-execution-log.jsonl";
const EVIDENCE_EXPORT_STALE_HOURS = 24;

function parseGa6Preview(
  parsed: {
    run_id?: string;
    run_dir?: string;
    validation?: {
      invalid_event_count?: { node_a?: number; node_b?: number; node_c?: number };
      applied_event_count?: { node_a?: number; node_b?: number; node_c?: number };
      applied_event_count_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
      replay_state_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
      discovery_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
    };
  },
  fallbackRunName: string,
  runsDir: string
): Ga6DrillPreview | null {
  const invalidEventCount = parsed.validation?.invalid_event_count;
  const appliedEventCount = parsed.validation?.applied_event_count;
  const appliedEventCountEqual = parsed.validation?.applied_event_count_equal;
  const replayStateEqual = parsed.validation?.replay_state_equal;
  const discoveryEqual = parsed.validation?.discovery_equal;

  if (
    typeof invalidEventCount?.node_a !== "number" ||
    typeof invalidEventCount.node_b !== "number" ||
    typeof invalidEventCount.node_c !== "number" ||
    typeof appliedEventCount?.node_a !== "number" ||
    typeof appliedEventCount.node_b !== "number" ||
    typeof appliedEventCount.node_c !== "number" ||
    typeof appliedEventCountEqual?.node_a_vs_node_b !== "boolean" ||
    typeof appliedEventCountEqual.node_a_vs_node_c !== "boolean" ||
    typeof replayStateEqual?.node_a_vs_node_b !== "boolean" ||
    typeof replayStateEqual.node_a_vs_node_c !== "boolean" ||
    typeof discoveryEqual?.node_a_vs_node_b !== "boolean" ||
    typeof discoveryEqual.node_a_vs_node_c !== "boolean"
  ) {
    return null;
  }

  return {
    runId: parsed.run_id ?? fallbackRunName,
    runDir: parsed.run_dir ?? path.join(runsDir, fallbackRunName),
    invalidEventCount: {
      nodeA: invalidEventCount.node_a,
      nodeB: invalidEventCount.node_b,
      nodeC: invalidEventCount.node_c
    },
    appliedEventCount: {
      nodeA: appliedEventCount.node_a,
      nodeB: appliedEventCount.node_b,
      nodeC: appliedEventCount.node_c
    },
    appliedEventCountEqual: {
      nodeAvsNodeB: appliedEventCountEqual.node_a_vs_node_b,
      nodeAvsNodeC: appliedEventCountEqual.node_a_vs_node_c
    },
    replayParity: {
      nodeAvsNodeB: replayStateEqual.node_a_vs_node_b,
      nodeAvsNodeC: replayStateEqual.node_a_vs_node_c
    },
    discoveryParity: {
      nodeAvsNodeB: discoveryEqual.node_a_vs_node_b,
      nodeAvsNodeC: discoveryEqual.node_a_vs_node_c
    }
  };
}

function parsePreflightPreview(
  parsed: {
    run_id?: string;
    run_dir?: string;
    overall_status?: string;
    failed_gate?: string | null;
    checks?: Array<{ gate?: string; status?: string; command?: string }>;
  },
  fallbackRunName: string,
  runsDir: string
): PreflightPreview {
  return {
    runId: parsed.run_id ?? fallbackRunName,
    runDir: parsed.run_dir ?? path.join(runsDir, fallbackRunName),
    overallStatus: parsed.overall_status ?? "unknown",
    failedGate: parsed.failed_gate ?? null,
    checks: (parsed.checks ?? []).map(check => ({
      gate: check.gate ?? "unknown",
      status: check.status ?? "unknown",
      command: check.command ?? null
    }))
  };
}

function parseLaneFixturePreview(
  parsed: {
    run_id?: string;
    run_dir?: string;
    overall_status?: string;
    failed_check?: string | null;
    checks?: Array<{ name?: string; status?: string; command?: string }>;
  },
  fallbackRunName: string,
  runsDir: string
): LaneFixtureCheckPreview {
  return {
    runId: parsed.run_id ?? fallbackRunName,
    runDir: parsed.run_dir ?? path.join(runsDir, fallbackRunName),
    overallStatus: parsed.overall_status ?? "unknown",
    failedCheck: parsed.failed_check ?? null,
    checks: (parsed.checks ?? []).map(check => ({
      name: check.name ?? "unknown",
      status: check.status ?? "unknown",
      command: check.command ?? null
    }))
  };
}

function ga6FailureReasons(preview: Ga6DrillPreview): string[] {
  const reasons: string[] = [];
  if (preview.invalidEventCount.nodeA !== 0) {
    reasons.push("invalid events on node A");
  }
  if (preview.invalidEventCount.nodeB !== 0) {
    reasons.push("invalid events on node B");
  }
  if (preview.invalidEventCount.nodeC !== 0) {
    reasons.push("invalid events on node C");
  }
  if (!preview.appliedEventCountEqual.nodeAvsNodeB) {
    reasons.push("applied-event parity mismatch A/B");
  }
  if (!preview.appliedEventCountEqual.nodeAvsNodeC) {
    reasons.push("applied-event parity mismatch A/C");
  }
  if (!preview.replayParity.nodeAvsNodeB) {
    reasons.push("replay parity mismatch A/B");
  }
  if (!preview.replayParity.nodeAvsNodeC) {
    reasons.push("replay parity mismatch A/C");
  }
  if (!preview.discoveryParity.nodeAvsNodeB) {
    reasons.push("discovery parity mismatch A/B");
  }
  if (!preview.discoveryParity.nodeAvsNodeC) {
    reasons.push("discovery parity mismatch A/C");
  }
  return reasons;
}

function preflightStatus(preview: PreflightPreview): RunStatus {
  return preview.overallStatus === "passed" ? "passed" : "failed";
}

function laneFixtureStatus(preview: LaneFixtureCheckPreview): RunStatus {
  return preview.overallStatus === "passed" ? "passed" : "failed";
}

function ga6Status(preview: Ga6DrillPreview): RunStatus {
  return ga6FailureReasons(preview).length === 0 ? "passed" : "failed";
}

function parseRunTimestampMs(runId: string, prefix: string): number | null {
  if (!runId.startsWith(prefix)) {
    return null;
  }
  const raw = runId.slice(prefix.length);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function formatAgeSummary(timestampMs: number | null, nowMs: number): string {
  if (timestampMs === null) {
    return "age unknown";
  }
  const ageHours = Math.max(0, (nowMs - timestampMs) / (1000 * 60 * 60));
  if (ageHours < 1) {
    return "<1h";
  }
  if (ageHours < 24) {
    return `${ageHours.toFixed(1)}h`;
  }
  return `${(ageHours / 24).toFixed(1)}d`;
}

function summarizeArtifactHints(paths: string[]): string | null {
  if (paths.length === 0) {
    return null;
  }
  const [first, ...rest] = paths;
  if (rest.length === 0) {
    return compactDisplayPath(first);
  }
  return `${compactDisplayPath(first)} (+${rest.length} more)`;
}

function compactDisplayPath(pathValue: string, tailSegments = 3): string {
  if (!pathValue) {
    return pathValue;
  }
  const normalized = pathValue.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= tailSegments) {
    return normalized;
  }
  const drivePrefix = /^[A-Za-z]:$/.test(parts[0]) ? `${parts[0]}/` : "";
  const tail = parts.slice(-tailSegments).join("/");
  return `${drivePrefix}.../${tail}`;
}

function isStale(timestampMs: number | null, staleAfterHours: number, nowMs: number): boolean {
  if (timestampMs === null) {
    return false;
  }
  const ageHours = (nowMs - timestampMs) / (1000 * 60 * 60);
  return ageHours > staleAfterHours;
}

async function hasRunPinMarker(runDir: string): Promise<boolean> {
  for (const marker of RUN_PIN_SENTINELS) {
    try {
      await fs.access(path.join(runDir, marker));
      return true;
    } catch {
      // marker not present
    }
  }
  return false;
}

async function readOptionalTrimmedFile(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function loadRunAnnotations(runDir: string): Promise<{ noteSummary: string | null; tags: string[] }> {
  const note = await readOptionalTrimmedFile(path.join(runDir, RUN_NOTE_FILE));
  const tagsRaw = await readOptionalTrimmedFile(path.join(runDir, RUN_TAGS_FILE));
  const tags =
    tagsRaw?.split(/[,\n]/).map(part => part.trim()).filter(Boolean) ?? [];
  const uniqueTags = Array.from(new Set(tags));
  const noteSummary =
    note && note.length > 64 ? `${note.slice(0, 64)}...` : note;
  return { noteSummary, tags: uniqueTags };
}

function pruneCandidates(
  runs: Array<{ runDir: string; timestampMs: number | null; pinned: boolean }>,
  nowMs: number
): string[] {
  const keepCutoff = runs.slice(0, KEEP_RECENT_RUNS).map(run => run.runDir);
  const keepSet = new Set(keepCutoff);
  return runs
    .filter(run => {
      if (keepSet.has(run.runDir)) {
        return false;
      }
      if (run.pinned) {
        return false;
      }
      if (run.timestampMs === null) {
        return false;
      }
      const ageHours = (nowMs - run.timestampMs) / (1000 * 60 * 60);
      return ageHours > PRUNE_RETENTION_HOURS;
    })
    .map(run => run.runDir);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function findLatestArtifactJson(
  runsDir: string,
  prefix: string
): Promise<{ filePath: string; fileName: string } | null> {
  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const files = entries.filter(
    entry => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".json")
  );
  if (files.length === 0) {
    return null;
  }
  const withStats = await Promise.all(
    files.map(async file => {
      const filePath = path.join(runsDir, file.name);
      const stat = await fs.stat(filePath);
      return { filePath, fileName: file.name, mtimeMs: stat.mtimeMs };
    })
  );
  withStats.sort((left, right) => right.mtimeMs - left.mtimeMs || right.fileName.localeCompare(left.fileName));
  return { filePath: withStats[0].filePath, fileName: withStats[0].fileName };
}

function parseIsoTimestampMs(iso: string): number | null {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function addCommandUnique(
  commands: TriageCommand[],
  label: string,
  command: string | null,
  runnableAction?: OperationsCommandRunnableAction
): void {
  if (!command) {
    return;
  }
  const existing = commands.find(item => item.command === command);
  if (existing) {
    if (!existing.runnableAction && runnableAction) {
      existing.runnableAction = runnableAction;
    }
    return;
  }
  commands.push({ label, command, runnableAction });
}

function toCommandToolItems(commands: TriageCommand[]): OperationsCommandToolItem[] {
  return commands.map(item => ({
    label: item.label,
    command: item.command,
    runnableAction: item.runnableAction
  }));
}

function staleExportReasons(
  analysisAsOfMs: number,
  latestRunMs: number | null,
  nowMs: number
): string[] {
  const reasons: string[] = [];
  const ageHours = (nowMs - analysisAsOfMs) / (1000 * 60 * 60);
  if (ageHours > EVIDENCE_EXPORT_STALE_HOURS) {
    reasons.push(`older than ${EVIDENCE_EXPORT_STALE_HOURS}h`);
  }
  if (latestRunMs !== null && analysisAsOfMs < latestRunMs) {
    reasons.push("predates latest run artifacts");
  }
  return reasons;
}

function ageBadgeToneForTimestamp(timestampMs: number | null, nowMs: number): FocusChecklistAgeBadgeTone {
  if (timestampMs === null) {
    return "unknown";
  }
  const ageHours = (nowMs - timestampMs) / (1000 * 60 * 60);
  if (ageHours > 7 * 24) {
    return "critical";
  }
  if (ageHours > 24) {
    return "warn";
  }
  return "ok";
}

function ageBadgeThresholdLabel(tone: FocusChecklistAgeBadgeTone): string {
  if (tone === "critical") {
    return ">7d";
  }
  if (tone === "warn") {
    return ">24h";
  }
  if (tone === "ok") {
    return "<=24h";
  }
  return "unknown";
}

function buildAgeBadge(
  label: string,
  timestampMs: number | null,
  nowMs: number
): FocusChecklistAgeBadge {
  const tone = ageBadgeToneForTimestamp(timestampMs, nowMs);
  let staleHint: string | null = null;
  if (tone === "critical") {
    staleHint = `${label} exceeds 7d`;
  } else if (tone === "warn") {
    staleHint = `${label} exceeds 24h`;
  } else if (tone === "unknown") {
    staleHint = `${label} age unknown`;
  }
  return {
    label: `${label}: ${formatAgeSummary(timestampMs, nowMs)} [${ageBadgeThresholdLabel(tone)}]`,
    tone,
    staleHint
  };
}

function staleSeverityFromBadges(
  badges: FocusChecklistAgeBadge[]
): "ok" | "watch" | "critical" {
  if (badges.some(badge => badge.tone === "critical")) {
    return "critical";
  }
  if (badges.some(badge => badge.tone === "warn" || badge.tone === "unknown")) {
    return "watch";
  }
  return "ok";
}

function renderFocusStatus(status: FocusChecklistStatus): string {
  if (status === "pass") {
    return "pass";
  }
  if (status === "fail") {
    return "fail";
  }
  return "attention";
}

function getSearchParamSingle(params: HomeSearchParams, key: string): string | null {
  const value = params[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) {
      return entry;
    }
  }
  return null;
}

function parseFocusChecklistFilter(raw: string | null): FocusChecklistFilter {
  if (
    raw === "non-pass" ||
    raw === "stale" ||
    raw === "stale-non-pass" ||
    raw === "critical-stale"
  ) {
    return raw;
  }
  return "all";
}

function buildFocusFilterHref(params: HomeSearchParams, nextFilter: FocusChecklistFilter): string {
  const nextQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "focus_filter") {
      continue;
    }
    if (typeof value === "string") {
      nextQuery.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        nextQuery.append(key, entry);
      }
    }
  }
  if (nextFilter !== "all") {
    nextQuery.set("focus_filter", nextFilter);
  }
  const query = nextQuery.toString();
  return query.length > 0 ? `/?${query}` : "/";
}

function parseHistoryFocus(raw: string | null): HistoryFocus {
  if (raw === "preflight" || raw === "ga6" || raw === "lane-fixtures") {
    return raw;
  }
  return "all";
}

function buildHistoryFocusHref(params: HomeSearchParams, nextFocus: HistoryFocus): string {
  const nextQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "history_focus") {
      continue;
    }
    if (typeof value === "string") {
      nextQuery.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        nextQuery.append(key, entry);
      }
    }
  }
  if (nextFocus !== "all") {
    nextQuery.set("history_focus", nextFocus);
  }
  const query = nextQuery.toString();
  return query.length > 0 ? `/?${query}` : "/";
}

function parseCriticalCopyGroupMode(raw: string | null): CriticalCopyGroupMode {
  return raw === "hide" ? "hide" : "show";
}

function buildCriticalCopyGroupHref(
  params: HomeSearchParams,
  nextMode: CriticalCopyGroupMode
): string {
  const nextQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "critical_copy") {
      continue;
    }
    if (typeof value === "string") {
      nextQuery.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        nextQuery.append(key, entry);
      }
    }
  }
  if (nextMode === "hide") {
    nextQuery.set("critical_copy", "hide");
  }
  const query = nextQuery.toString();
  return query.length > 0 ? `/?${query}` : "/";
}

function withCriticalCopyInHomeHref(
  rawHref: string,
  nextMode: CriticalCopyGroupMode
): string {
  const [pathWithQuery, hashPart] = rawHref.split("#", 2);
  const [pathname, queryPart] = pathWithQuery.split("?", 2);
  const query = new URLSearchParams(queryPart ?? "");
  if (nextMode === "hide") {
    query.set("critical_copy", "hide");
  } else {
    query.delete("critical_copy");
  }
  const nextQuery = query.toString();
  const hashSuffix = hashPart ? `#${hashPart}` : "";
  return `${pathname}${nextQuery.length > 0 ? `?${nextQuery}` : ""}${hashSuffix}`;
}

function withFocusFilterInRouteHref(
  rawHref: string,
  activeFilter: FocusChecklistFilter
): string {
  const [pathWithQuery, hashPart] = rawHref.split("#", 2);
  const [pathname, queryPart] = pathWithQuery.split("?", 2);
  const query = new URLSearchParams(queryPart ?? "");
  if (activeFilter === "all") {
    query.delete("focus_filter");
  } else {
    query.set("focus_filter", activeFilter);
  }
  const nextQuery = query.toString();
  const hashSuffix = hashPart ? `#${hashPart}` : "";
  return `${pathname}${nextQuery.length > 0 ? `?${nextQuery}` : ""}${hashSuffix}`;
}

function resolveFocusShortcutHref(
  rawHref: string,
  params: HomeSearchParams,
  activeFilter: FocusChecklistFilter
): string {
  if (rawHref.startsWith("#")) {
    return `${buildFocusFilterHref(params, activeFilter)}${rawHref}`;
  }
  if (rawHref.startsWith("/")) {
    return withFocusFilterInRouteHref(rawHref, activeFilter);
  }
  return rawHref;
}

async function loadReplayPreview(): Promise<ReplayPreviewResult> {
  const baseUrl = process.env.NODE_API_BASE_URL ?? "http://127.0.0.1:7878";
  const client = new NodeClient({ baseUrl });
  try {
    const replay = await client.replay();
    const appliedEventIds = (replay.data.applied_event_ids as unknown[]) ?? [];
    const invalidEvents = (replay.data.invalid_events as unknown[]) ?? [];
    return {
      ok: true,
      preview: {
        asOf: replay.as_of,
        source: replay.source,
        appliedEventCount: appliedEventIds.length,
        invalidEventCount: invalidEvents.length
      }
    };
  } catch (error) {
    const message =
      error instanceof NodeApiError
        ? `${error.message} (status ${error.status})`
        : error instanceof Error
          ? error.message
          : "unknown error";
    return { ok: false, message };
  }
}

async function loadGa6DrillPreview(): Promise<Ga6DrillPreviewResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidateRuns = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(GA6_RUN_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const run of candidateRuns) {
      const summaryPath = path.join(runsDir, run.name, "ga6-drill-summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          validation?: {
            invalid_event_count?: { node_a?: number; node_b?: number; node_c?: number };
            applied_event_count?: { node_a?: number; node_b?: number; node_c?: number };
            applied_event_count_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
            replay_state_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
            discovery_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
          };
        };
        const preview = parseGa6Preview(parsed, run.name, runsDir);
        if (!preview) {
          continue;
        }
        return { ok: true, preview };
      } catch {
        // keep scanning older runs
      }
    }

    return { ok: false, message: "no GA6 drill summary found under target/tmp" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading GA6 summaries";
    return { ok: false, message };
  }
}

async function loadPreflightPreview(): Promise<PreflightPreviewResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidateRuns = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(PREFLIGHT_RUN_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const run of candidateRuns) {
      const summaryPath = path.join(runsDir, run.name, "preflight-summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          overall_status?: string;
          failed_gate?: string | null;
          checks?: Array<{ gate?: string; status?: string; command?: string }>;
        };
        return { ok: true, preview: parsePreflightPreview(parsed, run.name, runsDir) };
      } catch {
        // keep scanning older runs
      }
    }

    return { ok: false, message: "no preflight summary found under target/tmp" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading preflight summaries";
    return { ok: false, message };
  }
}

async function loadLaneFixturePreview(): Promise<LaneFixtureCheckPreviewResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidateRuns = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(LANE_FIXTURE_RUN_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const run of candidateRuns) {
      const summaryPath = path.join(runsDir, run.name, "lane-fixture-check-summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          overall_status?: string;
          failed_check?: string | null;
          checks?: Array<{ name?: string; status?: string; command?: string }>;
        };
        return { ok: true, preview: parseLaneFixturePreview(parsed, run.name, runsDir) };
      } catch {
        // keep scanning older runs
      }
    }

    return { ok: false, message: "no lane fixture summary found under target/tmp" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading lane fixture summaries";
    return { ok: false, message };
  }
}

async function loadRecentPreflightHistory(limit: number): Promise<OperationsHistoryResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const nowMs = Date.now();
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidateRuns = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(PREFLIGHT_RUN_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    const items: OperationsHistoryItem[] = [];
    for (const run of candidateRuns) {
      if (items.length >= limit) {
        break;
      }
      const summaryPath = path.join(runsDir, run.name, "preflight-summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          overall_status?: string;
          failed_gate?: string | null;
          checks?: Array<{ gate?: string; status?: string; command?: string }>;
        };
        const preview = parsePreflightPreview(parsed, run.name, runsDir);
        const passedCount = preview.checks.filter(check => check.status === "passed").length;
        const timestampMs = parseRunTimestampMs(preview.runId, PREFLIGHT_RUN_PREFIX);
        const pinned = await hasRunPinMarker(preview.runDir);
        const annotations = await loadRunAnnotations(preview.runDir);
        items.push({
          runId: preview.runId,
          runDir: preview.runDir,
          status: preflightStatus(preview),
          summary:
            preflightStatus(preview) === "passed"
              ? `${passedCount}/${preview.checks.length} checks passed`
              : `failed gate: ${preview.failedGate ?? "unknown"}`,
          ageSummary: formatAgeSummary(timestampMs, nowMs),
          isStale: isStale(timestampMs, PREFLIGHT_STALE_HOURS, nowMs),
          isPinned: pinned,
          noteSummary: annotations.noteSummary,
          tags: annotations.tags
        });
      } catch {
        // skip invalid summaries
      }
    }

    if (items.length === 0) {
      return { ok: false, message: "no preflight summary history found under target/tmp" };
    }
    return { ok: true, items };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading preflight history";
    return { ok: false, message };
  }
}

async function loadRecentGa6History(limit: number): Promise<OperationsHistoryResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const nowMs = Date.now();
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidateRuns = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(GA6_RUN_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    const items: OperationsHistoryItem[] = [];
    for (const run of candidateRuns) {
      if (items.length >= limit) {
        break;
      }
      const summaryPath = path.join(runsDir, run.name, "ga6-drill-summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          validation?: {
            invalid_event_count?: { node_a?: number; node_b?: number; node_c?: number };
            applied_event_count?: { node_a?: number; node_b?: number; node_c?: number };
            applied_event_count_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
            replay_state_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
            discovery_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
          };
        };
        const preview = parseGa6Preview(parsed, run.name, runsDir);
        if (!preview) {
          continue;
        }
        const failures = ga6FailureReasons(preview);
        const timestampMs = parseRunTimestampMs(preview.runId, GA6_RUN_PREFIX);
        const pinned = await hasRunPinMarker(preview.runDir);
        const annotations = await loadRunAnnotations(preview.runDir);
        items.push({
          runId: preview.runId,
          runDir: preview.runDir,
          status: ga6Status(preview),
          summary: failures.length === 0 ? "all parity checks passed" : failures.join("; "),
          ageSummary: formatAgeSummary(timestampMs, nowMs),
          isStale: isStale(timestampMs, GA6_STALE_HOURS, nowMs),
          isPinned: pinned,
          noteSummary: annotations.noteSummary,
          tags: annotations.tags
        });
      } catch {
        // skip invalid summaries
      }
    }

    if (items.length === 0) {
      return { ok: false, message: "no GA6 summary history found under target/tmp" };
    }
    return { ok: true, items };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error while reading GA6 history";
    return { ok: false, message };
  }
}

async function loadRecentLaneFixtureHistory(limit: number): Promise<OperationsHistoryResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const nowMs = Date.now();
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const candidateRuns = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(LANE_FIXTURE_RUN_PREFIX))
      .sort((a, b) => b.name.localeCompare(a.name));

    const items: OperationsHistoryItem[] = [];
    for (const run of candidateRuns) {
      if (items.length >= limit) {
        break;
      }
      const summaryPath = path.join(runsDir, run.name, "lane-fixture-check-summary.json");
      try {
        const raw = await fs.readFile(summaryPath, "utf8");
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          overall_status?: string;
          failed_check?: string | null;
          checks?: Array<{ name?: string; status?: string; command?: string }>;
        };
        const preview = parseLaneFixturePreview(parsed, run.name, runsDir);
        const passedCount = preview.checks.filter(check => check.status === "passed").length;
        const timestampMs = parseRunTimestampMs(preview.runId, LANE_FIXTURE_RUN_PREFIX);
        const pinned = await hasRunPinMarker(preview.runDir);
        const annotations = await loadRunAnnotations(preview.runDir);
        items.push({
          runId: preview.runId,
          runDir: preview.runDir,
          status: laneFixtureStatus(preview),
          summary:
            laneFixtureStatus(preview) === "passed"
              ? `${passedCount}/${preview.checks.length} checks passed`
              : `failed check: ${preview.failedCheck ?? "unknown"}`,
          ageSummary: formatAgeSummary(timestampMs, nowMs),
          isStale: isStale(timestampMs, LANE_FIXTURE_STALE_HOURS, nowMs),
          isPinned: pinned,
          noteSummary: annotations.noteSummary,
          tags: annotations.tags
        });
      } catch {
        // skip invalid summaries
      }
    }

    if (items.length === 0) {
      return { ok: false, message: "no lane fixture summary history found under target/tmp" };
    }
    return { ok: true, items };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading lane fixture history";
    return { ok: false, message };
  }
}

async function loadLaneRunMetadata(
  runsDir: string,
  prefix: string,
  staleAfterHours: number
): Promise<
  Array<{
    runId: string;
    runDir: string;
    timestampMs: number | null;
    pinned: boolean;
    stale: boolean;
    notePresent: boolean;
    tagged: boolean;
  }>
> {
  const nowMs = Date.now();
  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const candidateRuns = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .sort((a, b) => b.name.localeCompare(a.name));

  const runs: Array<{
    runId: string;
    runDir: string;
    timestampMs: number | null;
    pinned: boolean;
    stale: boolean;
    notePresent: boolean;
    tagged: boolean;
  }> = [];
  for (const run of candidateRuns) {
    const summaryName =
      prefix === PREFLIGHT_RUN_PREFIX
        ? "preflight-summary.json"
        : prefix === GA6_RUN_PREFIX
          ? "ga6-drill-summary.json"
          : "lane-fixture-check-summary.json";
    const summaryPath = path.join(runsDir, run.name, summaryName);
    try {
      const raw = await fs.readFile(summaryPath, "utf8");
      if (prefix === PREFLIGHT_RUN_PREFIX) {
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          overall_status?: string;
          failed_gate?: string | null;
          checks?: Array<{ gate?: string; status?: string; command?: string }>;
        };
        const preview = parsePreflightPreview(parsed, run.name, runsDir);
        const timestampMs = parseRunTimestampMs(preview.runId, PREFLIGHT_RUN_PREFIX);
        const pinned = await hasRunPinMarker(preview.runDir);
        const annotations = await loadRunAnnotations(preview.runDir);
        runs.push({
          runId: preview.runId,
          runDir: preview.runDir,
          timestampMs,
          pinned,
          stale: isStale(timestampMs, staleAfterHours, nowMs),
          notePresent: annotations.noteSummary !== null,
          tagged: annotations.tags.length > 0
        });
      } else if (prefix === GA6_RUN_PREFIX) {
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          validation?: {
            invalid_event_count?: { node_a?: number; node_b?: number; node_c?: number };
            applied_event_count?: { node_a?: number; node_b?: number; node_c?: number };
            applied_event_count_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
            replay_state_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
            discovery_equal?: { node_a_vs_node_b?: boolean; node_a_vs_node_c?: boolean };
          };
        };
        const preview = parseGa6Preview(parsed, run.name, runsDir);
        if (!preview) {
          continue;
        }
        const timestampMs = parseRunTimestampMs(preview.runId, GA6_RUN_PREFIX);
        const pinned = await hasRunPinMarker(preview.runDir);
        const annotations = await loadRunAnnotations(preview.runDir);
        runs.push({
          runId: preview.runId,
          runDir: preview.runDir,
          timestampMs,
          pinned,
          stale: isStale(timestampMs, staleAfterHours, nowMs),
          notePresent: annotations.noteSummary !== null,
          tagged: annotations.tags.length > 0
        });
      } else {
        const parsed = JSON.parse(raw) as {
          run_id?: string;
          run_dir?: string;
          overall_status?: string;
          failed_check?: string | null;
          checks?: Array<{ name?: string; status?: string; command?: string }>;
        };
        const preview = parseLaneFixturePreview(parsed, run.name, runsDir);
        const timestampMs = parseRunTimestampMs(preview.runId, LANE_FIXTURE_RUN_PREFIX);
        const pinned = await hasRunPinMarker(preview.runDir);
        const annotations = await loadRunAnnotations(preview.runDir);
        runs.push({
          runId: preview.runId,
          runDir: preview.runDir,
          timestampMs,
          pinned,
          stale: isStale(timestampMs, staleAfterHours, nowMs),
          notePresent: annotations.noteSummary !== null,
          tagged: annotations.tags.length > 0
        });
      }
    } catch {
      // skip invalid summaries
    }
  }

  return runs;
}

function buildLaneLifecycleSummary(
  runs: Array<{
    runId: string;
    runDir: string;
    timestampMs: number | null;
    pinned: boolean;
    stale: boolean;
    notePresent: boolean;
    tagged: boolean;
  }>
): LifecycleLaneSummary {
  const nowMs = Date.now();
  const latest = runs.length > 0 ? runs[0] : null;
  return {
    totalRuns: runs.length,
    pinnedRuns: runs.filter(run => run.pinned).length,
    notedRuns: runs.filter(run => run.notePresent).length,
    taggedRuns: runs.filter(run => run.tagged).length,
    pruneCandidates: pruneCandidates(
      runs.map(run => ({ runDir: run.runDir, timestampMs: run.timestampMs, pinned: run.pinned })),
      nowMs
    ),
    latestRunId: latest?.runId ?? null,
    latestRunDir: latest?.runDir ?? null,
    latestAgeSummary: latest ? formatAgeSummary(latest.timestampMs, nowMs) : "n/a",
    latestStale: latest?.stale ?? false
  };
}

async function loadOperationsLifecycleSummary(): Promise<OperationsLifecycleResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const preflightRuns = await loadLaneRunMetadata(runsDir, PREFLIGHT_RUN_PREFIX, PREFLIGHT_STALE_HOURS);
    const ga6Runs = await loadLaneRunMetadata(runsDir, GA6_RUN_PREFIX, GA6_STALE_HOURS);
    const laneFixtureRuns = await loadLaneRunMetadata(
      runsDir,
      LANE_FIXTURE_RUN_PREFIX,
      LANE_FIXTURE_STALE_HOURS
    );
    return {
      ok: true,
      summary: {
        preflight: buildLaneLifecycleSummary(preflightRuns),
        ga6: buildLaneLifecycleSummary(ga6Runs),
        laneFixtures: buildLaneLifecycleSummary(laneFixtureRuns)
      }
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading lifecycle summary";
    return { ok: false, message };
  }
}

async function loadEvidenceManifestPreview(): Promise<EvidenceManifestPreviewResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const latest = await findLatestArtifactJson(runsDir, EVIDENCE_MANIFEST_PREFIX);
    if (!latest) {
      return { ok: false, message: "no operations evidence manifest found under target/tmp" };
    }
    const raw = await fs.readFile(latest.filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const root = readObject(parsed);
    if (!root) {
      return { ok: false, message: "invalid evidence manifest root" };
    }

    const analysisAsOf = readString(root.analysis_as_of);
    const summary = readObject(root.summary);
    const commands = readObject(root.commands);
    const preflight = readObject(root.preflight);
    const ga6 = readObject(root.ga6);
    const laneFixtures = readObject(root.lane_fixtures);
    const preflightCounts = readObject(preflight?.counts);
    const ga6Counts = readObject(ga6?.counts);
    const laneFixtureCounts = readObject(laneFixtures?.counts);

    const overallStatus = readString(summary?.overall_status);
    const latestPreflightStatus = readString(summary?.latest_preflight_status);
    const latestGa6Status = readString(summary?.latest_ga6_status);
    const latestLaneFixtureStatus = readString(summary?.latest_lane_fixture_status);
    const preflightPruneCandidates = readNumber(preflightCounts?.prune_candidate_count);
    const ga6PruneCandidates = readNumber(ga6Counts?.prune_candidate_count);
    const laneFixturePruneCandidates = readNumber(laneFixtureCounts?.prune_candidate_count);

    if (
      !analysisAsOf ||
      !overallStatus ||
      !latestPreflightStatus ||
      !latestGa6Status ||
      !latestLaneFixtureStatus ||
      preflightPruneCandidates === null ||
      ga6PruneCandidates === null ||
      laneFixturePruneCandidates === null
    ) {
      return { ok: false, message: "incomplete evidence manifest contract" };
    }
    const analysisAsOfMs = parseIsoTimestampMs(analysisAsOf);
    if (analysisAsOfMs === null) {
      return { ok: false, message: "invalid evidence manifest analysis_as_of timestamp" };
    }

    return {
      ok: true,
      preview: {
        filePath: latest.filePath,
        analysisAsOf,
        analysisAsOfMs,
        overallStatus,
        latestPreflightStatus,
        latestGa6Status,
        latestLaneFixtureStatus,
        preflightPruneCandidates,
        ga6PruneCandidates,
        laneFixturePruneCandidates,
        commands: {
          generateManifest: readString(commands?.generate_manifest),
          generateLaneFixtures: readString(commands?.generate_lane_fixtures),
          preflightPrunePreview: readString(commands?.preflight_prune_preview),
          preflightPruneDryRun: readString(commands?.preflight_prune_dry_run),
          ga6PrunePreview: readString(commands?.ga6_prune_preview),
          ga6PruneDryRun: readString(commands?.ga6_prune_dry_run),
          laneFixturePrunePreview: readString(commands?.lane_fixture_prune_preview),
          laneFixturePruneDryRun: readString(commands?.lane_fixture_prune_dry_run)
        }
      }
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading evidence manifest";
    return { ok: false, message };
  }
}

async function loadArtifactPrunePlanPreview(): Promise<ArtifactPrunePlanPreviewResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const latest = await findLatestArtifactJson(runsDir, ARTIFACT_PRUNE_PLAN_PREFIX);
    if (!latest) {
      return { ok: false, message: "no operations artifact prune plan found under target/tmp" };
    }
    const raw = await fs.readFile(latest.filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const root = readObject(parsed);
    if (!root) {
      return { ok: false, message: "invalid artifact prune plan root" };
    }

    const analysisAsOf = readString(root.analysis_as_of);
    const summary = readObject(root.summary);
    const preflight = readObject(root.preflight);
    const ga6 = readObject(root.ga6);
    const laneFixtures = readObject(root.lane_fixtures);
    const preflightCommands = readObject(preflight?.commands);
    const ga6Commands = readObject(ga6?.commands);
    const laneFixtureCommands = readObject(laneFixtures?.commands);

    const totalCandidates = readNumber(summary?.total_candidates);
    const preflightCandidates = readNumber(summary?.preflight_candidates);
    const ga6Candidates = readNumber(summary?.ga6_candidates);
    const laneFixtureCandidates = readNumber(summary?.lane_fixture_candidates);

    if (
      !analysisAsOf ||
      totalCandidates === null ||
      preflightCandidates === null ||
      ga6Candidates === null ||
      laneFixtureCandidates === null
    ) {
      return { ok: false, message: "incomplete artifact prune plan contract" };
    }
    const analysisAsOfMs = parseIsoTimestampMs(analysisAsOf);
    if (analysisAsOfMs === null) {
      return { ok: false, message: "invalid artifact prune plan analysis_as_of timestamp" };
    }

    return {
      ok: true,
      preview: {
        filePath: latest.filePath,
        analysisAsOf,
        analysisAsOfMs,
        totalCandidates,
        preflightCandidates,
        ga6Candidates,
        laneFixtureCandidates,
        preflightCommands: {
          preview: readString(preflightCommands?.preview),
          dryRun: readString(preflightCommands?.dry_run),
          apply: readString(preflightCommands?.apply)
        },
        ga6Commands: {
          preview: readString(ga6Commands?.preview),
          dryRun: readString(ga6Commands?.dry_run),
          apply: readString(ga6Commands?.apply)
        },
        laneFixtureCommands: {
          preview: readString(laneFixtureCommands?.preview),
          dryRun: readString(laneFixtureCommands?.dry_run),
          apply: readString(laneFixtureCommands?.apply)
        }
      }
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading artifact prune plan";
    return { ok: false, message };
  }
}

async function loadExportAuditLogPlanPreview(): Promise<ExportAuditLogPlanPreviewResult> {
  const runsDir = path.join(process.cwd(), "target", "tmp");
  try {
    const latest = await findLatestArtifactJson(runsDir, EXPORT_AUDIT_LOG_PLAN_PREFIX);
    if (!latest) {
      return { ok: false, message: "no export audit log plan found under target/tmp" };
    }

    const raw = await fs.readFile(latest.filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const root = readObject(parsed);
    if (!root) {
      return { ok: false, message: "invalid export audit log plan root" };
    }

    const analysisAsOf = readString(root.analysis_as_of);
    const summary = readObject(root.summary);
    const commands = readObject(root.commands);
    const applyResult = readObject(root.apply_result);
    const logPath = readString(root.log_path);

    const lineCount = readNumber(summary?.line_count);
    const keepCount = readNumber(summary?.keep_count);
    const pruneCandidateCount = readNumber(summary?.prune_candidate_count);
    const currentBytes = readNumber(summary?.current_bytes);
    const projectedBytesAfterApply = readNumber(summary?.projected_bytes_after_apply);
    const maxBytes = readNumber(summary?.max_bytes);
    const overMaxBytes = readBoolean(summary?.over_max_bytes);
    const projectedOverMaxBytes = readBoolean(summary?.projected_over_max_bytes);

    const applied = readBoolean(applyResult?.applied);
    const changed = readBoolean(applyResult?.changed);
    const archivePath = readString(applyResult?.archive_path);
    const warning = readString(applyResult?.warning);

    if (
      !analysisAsOf ||
      !logPath ||
      lineCount === null ||
      keepCount === null ||
      pruneCandidateCount === null ||
      currentBytes === null ||
      projectedBytesAfterApply === null ||
      maxBytes === null ||
      overMaxBytes === null ||
      projectedOverMaxBytes === null ||
      applied === null ||
      changed === null
    ) {
      return { ok: false, message: "incomplete export audit log plan contract" };
    }

    const analysisAsOfMs = parseIsoTimestampMs(analysisAsOf);
    if (analysisAsOfMs === null) {
      return { ok: false, message: "invalid export audit log plan analysis_as_of timestamp" };
    }

    return {
      ok: true,
      preview: {
        filePath: latest.filePath,
        analysisAsOf,
        analysisAsOfMs,
        logPath,
        lineCount,
        keepCount,
        pruneCandidateCount,
        currentBytes,
        projectedBytesAfterApply,
        maxBytes,
        overMaxBytes,
        projectedOverMaxBytes,
        commands: {
          generatePlan: readString(commands?.generate_plan),
          reproducibleSnapshot: readString(commands?.reproducible_snapshot),
          applyCleanup: readString(commands?.apply_cleanup)
        },
        applyResult: {
          applied,
          changed,
          archivePath,
          warning
        }
      }
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error while reading export audit log plan";
    return { ok: false, message };
  }
}

async function loadRecentExportExecutionAudit(limit: number): Promise<ExportExecutionAuditResult> {
  const logPath = path.join(process.cwd(), "target", "tmp", EXPORT_EXECUTION_AUDIT_LOG_NAME);
  try {
    const nowMs = Date.now();
    const raw = await fs.readFile(logPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const allItems: ExportExecutionAuditItem[] = [];
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        const parsed = JSON.parse(lines[i]) as unknown;
        const root = readObject(parsed);
        if (!root) {
          continue;
        }
        const recordedAt = readString(root.recorded_at);
        const action = readString(root.action);
        const actionLabel = readString(root.action_label);
        const status = readString(root.status);
        const durationMs = readNumber(root.duration_ms);
        const exitCodeRaw = root.exit_code;
        const artifactPathHintsRaw = root.artifact_path_hints;
        if (
          !recordedAt ||
          !action ||
          !actionLabel ||
          (status !== "passed" && status !== "failed") ||
          durationMs === null
        ) {
          continue;
        }
        const recordedAtMs = parseIsoTimestampMs(recordedAt);
        if (recordedAtMs === null) {
          continue;
        }
        const exitCode =
          typeof exitCodeRaw === "number" && Number.isFinite(exitCodeRaw) ? exitCodeRaw : null;
        const artifactPathHints = Array.isArray(artifactPathHintsRaw)
          ? artifactPathHintsRaw.filter((value): value is string => typeof value === "string" && value.length > 0)
          : [];
        allItems.push({
          recordedAt,
          action,
          actionLabel,
          status,
          durationMs,
          exitCode,
          artifactPathHints,
          ageSummary: formatAgeSummary(recordedAtMs, nowMs)
        });
      } catch {
        // ignore malformed rows
      }
    }

    const items = allItems.slice(0, limit);
    if (items.length === 0) {
      return { ok: false, logPath, message: "no valid export execution audit entries found" };
    }

    const summaryByAction = new Map<string, ExportExecutionAuditActionSummary>();
    for (const item of allItems) {
      const existing = summaryByAction.get(item.action);
      if (!existing) {
        summaryByAction.set(item.action, {
          action: item.action,
          actionLabel: item.actionLabel,
          latestStatus: item.status,
          latestRecordedAt: item.recordedAt,
          latestAgeSummary: item.ageSummary,
          latestArtifactPathHints: item.artifactPathHints,
          failureStreak: item.status === "failed" ? 1 : 0,
          lastSuccessAt: item.status === "passed" ? item.recordedAt : null,
          lastSuccessAgeSummary: item.status === "passed" ? item.ageSummary : null
        });
        continue;
      }
      if (existing.lastSuccessAt === null) {
        if (item.status === "failed") {
          existing.failureStreak += 1;
        } else {
          existing.lastSuccessAt = item.recordedAt;
          existing.lastSuccessAgeSummary = item.ageSummary;
        }
      }
    }

    const byAction = Array.from(summaryByAction.values()).sort((left, right) =>
      left.actionLabel.localeCompare(right.actionLabel)
    );
    const failingLatestActions = byAction
      .filter(action => action.latestStatus === "failed")
      .map(action => action.actionLabel);

    return {
      ok: true,
      logPath,
      items,
      summary: {
        byAction,
        failingLatestActions,
        totalEntries: allItems.length
      }
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { ok: false, logPath, message: "no export execution audit log found under target/tmp" };
    }
    const message = error instanceof Error ? error.message : "unknown export execution audit read error";
    return { ok: false, logPath, message };
  }
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const params = await searchParams;
  const replay = await loadReplayPreview();
  const ga6 = await loadGa6DrillPreview();
  const preflight = await loadPreflightPreview();
  const laneFixtures = await loadLaneFixturePreview();
  const recentPreflight = await loadRecentPreflightHistory(5);
  const recentGa6 = await loadRecentGa6History(5);
  const recentLaneFixtures = await loadRecentLaneFixtureHistory(5);
  const lifecycle = await loadOperationsLifecycleSummary();
  const evidenceManifest = await loadEvidenceManifestPreview();
  const artifactPrunePlan = await loadArtifactPrunePlanPreview();
  const exportAuditLogPlan = await loadExportAuditLogPlanPreview();
  const exportExecutionAudit = await loadRecentExportExecutionAudit(8);
  const preflightPassedChecks =
    preflight.ok ? preflight.preview.checks.filter(check => check.status === "passed").length : 0;
  const ga6Failures = ga6.ok ? ga6FailureReasons(ga6.preview) : [];
  const laneFixturePassedChecks =
    laneFixtures.ok
      ? laneFixtures.preview.checks.filter(check => check.status === "passed").length
      : 0;
  const triageCommands: TriageCommand[] = [];
  const lifecycleCommands: TriageCommand[] = [];
  const exportCommands: TriageCommand[] = [];
  const exportWorkflowCommands: TriageCommand[] = [
    {
      label: "Refresh evidence manifest",
      command: "npm run v1:evidence-manifest",
      runnableAction: "refresh_evidence_manifest"
    },
    {
      label: "Refresh artifact prune plan",
      command: "npm run v1:artifact-prune-plan",
      runnableAction: "refresh_artifact_prune_plan"
    },
    {
      label: "Refresh export audit log plan",
      command: "npm run v1:export-audit-log-plan",
      runnableAction: "refresh_export_audit_log_plan"
    },
    {
      label: "Run lane fixture checks",
      command: "npm run v1:lane-fixtures",
      runnableAction: "run_lane_fixture_checks"
    }
  ];
  const nowMs = Date.now();
  const focusChecklistFilter = parseFocusChecklistFilter(getSearchParamSingle(params, "focus_filter"));
  const historyFocus = parseHistoryFocus(getSearchParamSingle(params, "history_focus"));
  const criticalCopyGroupMode = parseCriticalCopyGroupMode(
    getSearchParamSingle(params, "critical_copy")
  );
  const latestPreflightRunMs =
    preflight.ok ? parseRunTimestampMs(preflight.preview.runId, PREFLIGHT_RUN_PREFIX) : null;
  const latestGa6RunMs =
    ga6.ok ? parseRunTimestampMs(ga6.preview.runId, GA6_RUN_PREFIX) : null;
  const latestLaneFixtureRunMs =
    laneFixtures.ok
      ? parseRunTimestampMs(laneFixtures.preview.runId, LANE_FIXTURE_RUN_PREFIX)
      : null;
  const latestPreflightAgeSummary = formatAgeSummary(latestPreflightRunMs, nowMs);
  const latestGa6AgeSummary = formatAgeSummary(latestGa6RunMs, nowMs);
  const latestLaneFixtureAgeSummary = formatAgeSummary(latestLaneFixtureRunMs, nowMs);
  const latestPreflightAgeBadge = buildAgeBadge("preflight run", latestPreflightRunMs, nowMs);
  const latestGa6AgeBadge = buildAgeBadge("GA6 run", latestGa6RunMs, nowMs);
  const latestLaneFixtureAgeBadge = buildAgeBadge(
    "lane fixture run",
    latestLaneFixtureRunMs,
    nowMs
  );
  const laneFixtureStaleSeverity = staleSeverityFromBadges([latestLaneFixtureAgeBadge]);
  const laneFixtureIsStale =
    latestLaneFixtureAgeBadge.tone === "warn" || latestLaneFixtureAgeBadge.tone === "critical";
  const latestOperationalRunMs =
    Math.max(latestPreflightRunMs ?? 0, latestGa6RunMs ?? 0, latestLaneFixtureRunMs ?? 0) || null;
  const runbookCommands: TriageCommand[] = [
    {
      label: "Open runbook incident triage section",
      command: "rg -n \"incident triage\" docs/runbooks/alpha-operations-runbook.md"
    },
    {
      label: "Open cadence checklist",
      command: "Get-Content -Path docs/runbooks/phase1-operations-cadence.md"
    },
    {
      label: "Open gate mapping checklist",
      command: "Get-Content -Path docs/runbooks/phase1-preflight-checklist.md"
    },
    {
      label: "Open export execution audit log tail",
      command: `Get-Content -Path "${path.join(process.cwd(), "target", "tmp", EXPORT_EXECUTION_AUDIT_LOG_NAME)}" -Tail 20`
    },
    {
      label: "Regenerate export audit log plan",
      command: "npm run v1:export-audit-log-plan"
    },
    {
      label: "Run export-audit planner smoke harness",
      command: "npm run v1:export-audit-log-plan:smoke"
    }
  ];
  const criticalStaleBaseViewHref = `${buildFocusFilterHref(params, "critical-stale")}#phase1-operations`;
  const criticalStaleShownCopyViewHref = withCriticalCopyInHomeHref(
    criticalStaleBaseViewHref,
    "show"
  );
  const criticalStaleCurrentModeViewHref = withCriticalCopyInHomeHref(
    criticalStaleBaseViewHref,
    criticalCopyGroupMode
  );
  const criticalStaleAlternateModeViewHref = withCriticalCopyInHomeHref(
    criticalStaleBaseViewHref,
    criticalCopyGroupMode === "hide" ? "show" : "hide"
  );
  const criticalStaleHiddenCopyViewHref = withCriticalCopyInHomeHref(
    criticalStaleBaseViewHref,
    "hide"
  );
  const focusFilterEntryLinks = [
    {
      label: "Open non-pass triage view",
      href: `${buildFocusFilterHref(params, "non-pass")}#phase1-operations`
    },
    {
      label: "Open stale triage view",
      href: `${buildFocusFilterHref(params, "stale")}#phase1-operations`
    },
    {
      label: "Open stale + non-pass triage view",
      href: `${buildFocusFilterHref(params, "stale-non-pass")}#phase1-operations`
    },
    {
      label: "Open critical stale triage view",
      href: criticalStaleCurrentModeViewHref
    },
    {
      label: "Open critical stale triage view (copy-only hidden)",
      href: criticalStaleHiddenCopyViewHref
    }
  ];

  addCommandUnique(
    exportCommands,
    "Refresh evidence manifest",
    "npm run v1:evidence-manifest",
    "refresh_evidence_manifest"
  );
  addCommandUnique(
    exportCommands,
    "Refresh artifact prune plan",
    "npm run v1:artifact-prune-plan",
    "refresh_artifact_prune_plan"
  );
  addCommandUnique(
    exportCommands,
    "Refresh export audit log plan",
    "npm run v1:export-audit-log-plan",
    "refresh_export_audit_log_plan"
  );

  if (evidenceManifest.ok) {
    addCommandUnique(
      exportCommands,
      "Regenerate evidence manifest",
      evidenceManifest.preview.commands.generateManifest
    );
    addCommandUnique(
      exportCommands,
      "Run lane fixture checks",
      evidenceManifest.preview.commands.generateLaneFixtures,
      "run_lane_fixture_checks"
    );
    addCommandUnique(
      exportCommands,
      "Manifest preflight prune preview",
      evidenceManifest.preview.commands.preflightPrunePreview
    );
    addCommandUnique(
      exportCommands,
      "Manifest preflight prune dry-run",
      evidenceManifest.preview.commands.preflightPruneDryRun
    );
    addCommandUnique(
      exportCommands,
      "Manifest GA6 prune preview",
      evidenceManifest.preview.commands.ga6PrunePreview
    );
    addCommandUnique(
      exportCommands,
      "Manifest GA6 prune dry-run",
      evidenceManifest.preview.commands.ga6PruneDryRun
    );
    addCommandUnique(
      exportCommands,
      "Manifest lane-fixture prune preview",
      evidenceManifest.preview.commands.laneFixturePrunePreview
    );
    addCommandUnique(
      exportCommands,
      "Manifest lane-fixture prune dry-run",
      evidenceManifest.preview.commands.laneFixturePruneDryRun
    );
  }

  if (artifactPrunePlan.ok) {
    addCommandUnique(exportCommands, "Regenerate artifact prune plan", "npm run v1:artifact-prune-plan");
    addCommandUnique(
      exportCommands,
      "Plan preflight prune preview",
      artifactPrunePlan.preview.preflightCommands.preview
    );
    addCommandUnique(
      exportCommands,
      "Plan preflight prune dry-run",
      artifactPrunePlan.preview.preflightCommands.dryRun
    );
    addCommandUnique(
      exportCommands,
      "Plan preflight prune apply",
      artifactPrunePlan.preview.preflightCommands.apply
    );
    addCommandUnique(
      exportCommands,
      "Plan GA6 prune preview",
      artifactPrunePlan.preview.ga6Commands.preview
    );
    addCommandUnique(
      exportCommands,
      "Plan GA6 prune dry-run",
      artifactPrunePlan.preview.ga6Commands.dryRun
    );
    addCommandUnique(
      exportCommands,
      "Plan GA6 prune apply",
      artifactPrunePlan.preview.ga6Commands.apply
    );
    addCommandUnique(
      exportCommands,
      "Plan lane-fixture prune preview",
      artifactPrunePlan.preview.laneFixtureCommands.preview
    );
    addCommandUnique(
      exportCommands,
      "Plan lane-fixture prune dry-run",
      artifactPrunePlan.preview.laneFixtureCommands.dryRun
    );
    addCommandUnique(
      exportCommands,
      "Plan lane-fixture prune apply",
      artifactPrunePlan.preview.laneFixtureCommands.apply
    );
  }

  if (exportAuditLogPlan.ok) {
    addCommandUnique(
      exportCommands,
      "Regenerate export audit log plan",
      exportAuditLogPlan.preview.commands.generatePlan
    );
    addCommandUnique(
      exportCommands,
      "Export audit log reproducibility snapshot",
      exportAuditLogPlan.preview.commands.reproducibleSnapshot
    );
    addCommandUnique(
      exportCommands,
      "Apply export audit log cleanup",
      exportAuditLogPlan.preview.commands.applyCleanup
    );
  }

  const evidenceManifestStaleReasons = evidenceManifest.ok
    ? staleExportReasons(evidenceManifest.preview.analysisAsOfMs, latestOperationalRunMs, nowMs)
    : [];
  const artifactPrunePlanStaleReasons = artifactPrunePlan.ok
    ? staleExportReasons(artifactPrunePlan.preview.analysisAsOfMs, latestOperationalRunMs, nowMs)
    : [];
  const exportAuditLogPlanStaleReasons = exportAuditLogPlan.ok
    ? staleExportReasons(exportAuditLogPlan.preview.analysisAsOfMs, latestOperationalRunMs, nowMs)
    : [];
  const preflightGateStatus = preflight.ok
    ? new Map(preflight.preview.checks.map(check => [check.gate, check.status]))
    : new Map<string, string>();
  const preflightGateCommand = preflight.ok
    ? new Map(
        preflight.preview.checks
          .filter(check => check.command !== null)
          .map(check => [check.gate, check.command!])
      )
    : new Map<string, string>();
  const onboardingGateStatus = preflight.ok ? preflightGateStatus.get("GA1") ?? "unknown" : "missing";
  const discoveryGateStatus = preflight.ok ? preflightGateStatus.get("GA5") ?? "unknown" : "missing";

  const onboardingFocusCommands: TriageCommand[] = [];
  addCommandUnique(
    onboardingFocusCommands,
    "Rerun GA1 guardrail test",
    preflightGateCommand.get("GA1") ??
      "cargo test -p node --test api api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch"
  );
  addCommandUnique(onboardingFocusCommands, "Run readiness bundle", "npm run v1:readiness");

  const discoveryFocusCommands: TriageCommand[] = [];
  addCommandUnique(
    discoveryFocusCommands,
    "Rerun GA5 discovery determinism test",
    preflightGateCommand.get("GA5") ??
      "cargo test -p node --test api api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic"
  );
  addCommandUnique(discoveryFocusCommands, "Run readiness bundle", "npm run v1:readiness");

  const ga6FocusCommands: TriageCommand[] = [];
  addCommandUnique(ga6FocusCommands, "Rerun GA6 drill", "npm run v1:ga6-drill");
  if (ga6.ok) {
    addCommandUnique(
      ga6FocusCommands,
      "Inspect latest GA6 summary",
      `Get-Content -Path "${path.join(ga6.preview.runDir, "ga6-drill-summary.json")}"`
    );
  }

  const laneFixtureFocusCommands: TriageCommand[] = [];
  addCommandUnique(
    laneFixtureFocusCommands,
    "Run lane fixture checks",
    "npm run v1:lane-fixtures",
    "run_lane_fixture_checks"
  );
  addCommandUnique(
    laneFixtureFocusCommands,
    "Run lane fixture readiness checks",
    "npm run v1:lane-fixtures:readiness"
  );
  if (laneFixtures.ok) {
    addCommandUnique(
      laneFixtureFocusCommands,
      "Inspect latest lane fixture summary",
      `Get-Content -Path "${path.join(laneFixtures.preview.runDir, "lane-fixture-check-summary.json")}"`
    );
  }
  const laneFixtureStaleCommands: TriageCommand[] = [];
  addCommandUnique(
    laneFixtureStaleCommands,
    "Run lane fixture checks",
    "npm run v1:lane-fixtures",
    "run_lane_fixture_checks"
  );
  addCommandUnique(
    laneFixtureStaleCommands,
    "Run lane fixture readiness checks",
    "npm run v1:lane-fixtures:readiness"
  );
  if (laneFixtures.ok) {
    addCommandUnique(
      laneFixtureStaleCommands,
      "Inspect latest lane fixture summary",
      `Get-Content -Path "${path.join(laneFixtures.preview.runDir, "lane-fixture-check-summary.json")}"`
    );
  }

  const exportFocusCommands: TriageCommand[] = [];
  addCommandUnique(
    exportFocusCommands,
    "Refresh evidence manifest",
    "npm run v1:evidence-manifest",
    "refresh_evidence_manifest"
  );
  addCommandUnique(
    exportFocusCommands,
    "Refresh artifact prune plan",
    "npm run v1:artifact-prune-plan",
    "refresh_artifact_prune_plan"
  );
  addCommandUnique(
    exportFocusCommands,
    "Refresh export audit log plan",
    "npm run v1:export-audit-log-plan",
    "refresh_export_audit_log_plan"
  );
  const evidenceFocusAgeBadges: FocusChecklistAgeBadge[] = [
    evidenceManifest.ok
      ? buildAgeBadge("manifest", evidenceManifest.preview.analysisAsOfMs, nowMs)
      : buildAgeBadge("manifest", null, nowMs),
    artifactPrunePlan.ok
      ? buildAgeBadge("prune-plan", artifactPrunePlan.preview.analysisAsOfMs, nowMs)
      : buildAgeBadge("prune-plan", null, nowMs),
    exportAuditLogPlan.ok
      ? buildAgeBadge("audit-plan", exportAuditLogPlan.preview.analysisAsOfMs, nowMs)
      : buildAgeBadge("audit-plan", null, nowMs)
  ];
  const evidenceFocusStaleSeverity = staleSeverityFromBadges(evidenceFocusAgeBadges);

  const focusChecklist: FocusChecklistItem[] = [
    {
      key: "onboarding-ga1",
      label: "Onboarding guardrails (GA1)",
      status:
        onboardingGateStatus === "passed"
          ? "pass"
          : onboardingGateStatus === "missing"
            ? "attention"
            : "fail",
      summary: preflight.ok
        ? `latest preflight GA1 status: ${onboardingGateStatus} (run age: ${latestPreflightAgeSummary})`
        : "preflight summary missing",
      triageCommands: onboardingFocusCommands,
      quickLinks: [
        { label: "Open onboarding wizard", href: "#onboarding-wizard" },
        { label: "Jump to failure triage", href: "#ops-failure-triage" }
      ],
      ageBadges: [latestPreflightAgeBadge],
      staleSource: "run age"
    },
    {
      key: "discovery-ga5",
      label: "Discovery determinism (GA5)",
      status:
        discoveryGateStatus === "passed"
          ? "pass"
          : discoveryGateStatus === "missing"
            ? "attention"
            : "fail",
      summary: preflight.ok
        ? `latest preflight GA5 status: ${discoveryGateStatus} (run age: ${latestPreflightAgeSummary})`
        : "preflight summary missing",
      triageCommands: discoveryFocusCommands,
      quickLinks: [
        { label: "Open discovery explorer", href: "/explorer/discovery" },
        { label: "Jump to failure triage", href: "#ops-failure-triage" }
      ],
      ageBadges: [latestPreflightAgeBadge],
      staleSource: "run age"
    },
    {
      key: "ga6",
      label: "Runbook drill parity (GA6)",
      status: ga6.ok ? (ga6Failures.length === 0 ? "pass" : "fail") : "attention",
      summary: ga6.ok
        ? ga6Failures.length === 0
          ? `latest GA6 parity checks passed (run age: ${latestGa6AgeSummary})`
          : `${ga6Failures.join("; ")} (run age: ${latestGa6AgeSummary})`
        : ga6.message,
      triageCommands: ga6FocusCommands,
      quickLinks: [
        { label: "Jump to recent run history", href: "#ops-recent-history" },
        { label: "Jump to runbook shortcuts", href: "#ops-runbook-shortcuts" }
      ],
      ageBadges: [latestGa6AgeBadge],
      staleSource: "run age"
    },
    {
      key: "lane-fixtures",
      label: "Non-software lane fixture coverage",
      status: laneFixtures.ok
        ? laneFixtureStatus(laneFixtures.preview) === "passed"
          ? laneFixtureStaleSeverity === "ok"
            ? "pass"
            : "attention"
          : "fail"
        : "attention",
      summary: laneFixtures.ok
        ? laneFixtureStatus(laneFixtures.preview) === "passed"
          ? `latest lane fixture checks passed (${laneFixturePassedChecks}/${laneFixtures.preview.checks.length}; run age: ${latestLaneFixtureAgeSummary}; stale severity: ${laneFixtureStaleSeverity})`
          : `failed check: ${laneFixtures.preview.failedCheck ?? "unknown"} (run age: ${latestLaneFixtureAgeSummary})`
        : laneFixtures.message,
      triageCommands: laneFixtureFocusCommands,
      quickLinks: [
        { label: "Jump to fixture bundles", href: "#fixture-quickstart" },
        { label: "Jump to lane-fixture history", href: "/?history_focus=lane-fixtures#ops-recent-history" },
        { label: "Jump to failure triage", href: "#ops-failure-triage" }
      ],
      ageBadges: [latestLaneFixtureAgeBadge],
      staleSource: "run age"
    },
    {
      key: "evidence-exports",
      label: "Evidence export freshness",
      status:
        evidenceManifest.ok &&
        artifactPrunePlan.ok &&
        exportAuditLogPlan.ok &&
        evidenceManifestStaleReasons.length === 0 &&
        artifactPrunePlanStaleReasons.length === 0 &&
        exportAuditLogPlanStaleReasons.length === 0
          ? "pass"
          : "attention",
      summary:
        evidenceManifest.ok && artifactPrunePlan.ok && exportAuditLogPlan.ok
          ? `severity: ${evidenceFocusStaleSeverity}; ages -> manifest: ${formatAgeSummary(evidenceManifest.preview.analysisAsOfMs, nowMs)}; prune-plan: ${formatAgeSummary(artifactPrunePlan.preview.analysisAsOfMs, nowMs)}; audit-plan: ${formatAgeSummary(exportAuditLogPlan.preview.analysisAsOfMs, nowMs)}; stale reasons -> manifest: ${evidenceManifestStaleReasons.join(", ") || "none"}; prune-plan: ${artifactPrunePlanStaleReasons.join(", ") || "none"}; audit-plan: ${exportAuditLogPlanStaleReasons.join(", ") || "none"}`
          : "one or more export artifacts unavailable",
      triageCommands: exportFocusCommands,
      quickLinks: [
        { label: "Jump to evidence exports", href: "#ops-evidence-exports" },
        { label: "Jump to export execution audit", href: "#ops-export-execution-audit" }
      ],
      ageBadges: evidenceFocusAgeBadges,
      staleSource: "export artifact age"
    }
  ];
  const focusChecklistCounts = focusChecklist.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { pass: 0, attention: 0, fail: 0 }
  );
  const isFocusChecklistItemStale = (item: FocusChecklistItem): boolean =>
    item.ageBadges.some(badge => badge.tone === "warn" || badge.tone === "critical");
  const isFocusChecklistItemCriticalStale = (item: FocusChecklistItem): boolean =>
    item.ageBadges.some(badge => badge.tone === "critical");
  const focusFilterCounts: Record<FocusChecklistFilter, number> = {
    all: focusChecklist.length,
    "non-pass": focusChecklist.filter(item => item.status !== "pass").length,
    stale: focusChecklist.filter(isFocusChecklistItemStale).length,
    "stale-non-pass": focusChecklist.filter(
      item => item.status !== "pass" && isFocusChecklistItemStale(item)
    ).length,
    "critical-stale": focusChecklist.filter(isFocusChecklistItemCriticalStale).length
  };
  const criticalStalePassCount = focusChecklist.filter(
    item => item.status === "pass" && isFocusChecklistItemCriticalStale(item)
  ).length;
  const criticalStaleNonPassCount = focusChecklist.filter(
    item => item.status !== "pass" && isFocusChecklistItemCriticalStale(item)
  ).length;
  const staleStatusCounts = focusChecklist
    .filter(isFocusChecklistItemStale)
    .reduce(
      (counts, item) => {
        counts[item.status] += 1;
        return counts;
      },
      { pass: 0, attention: 0, fail: 0 }
    );
  const focusFilterViewLabel: Record<FocusChecklistFilter, string> = {
    all: "all",
    "non-pass": "non-pass only",
    stale: "stale only",
    "stale-non-pass": "stale + non-pass",
    "critical-stale": "critical stale only (>7d)"
  };
  const filteredFocusChecklist = focusChecklist.filter(item => {
    const isStale = isFocusChecklistItemStale(item);
    const isCriticalStale = isFocusChecklistItemCriticalStale(item);
    if (focusChecklistFilter === "non-pass") {
      return item.status !== "pass";
    }
    if (focusChecklistFilter === "stale") {
      return isStale;
    }
    if (focusChecklistFilter === "stale-non-pass") {
      return item.status !== "pass" && isStale;
    }
    if (focusChecklistFilter === "critical-stale") {
      return isCriticalStale;
    }
    return true;
  });
  const criticalStaleRollupByCommand = new Map<
    string,
    {
      baseLabel: string;
      origins: Set<string>;
      runnableAction?: OperationsCommandRunnableAction;
    }
  >();
  if (focusChecklistFilter === "critical-stale") {
    for (const item of filteredFocusChecklist) {
      if (item.status === "pass") {
        continue;
      }
      for (const command of item.triageCommands) {
        const existing = criticalStaleRollupByCommand.get(command.command);
        if (existing) {
          existing.origins.add(item.label);
          if (!existing.runnableAction && command.runnableAction) {
            existing.runnableAction = command.runnableAction;
          }
          continue;
        }
        criticalStaleRollupByCommand.set(command.command, {
          baseLabel: command.label,
          origins: new Set([item.label]),
          runnableAction: command.runnableAction
        });
      }
    }
  }
  const criticalStaleRollupCommands: TriageCommand[] = Array.from(
    criticalStaleRollupByCommand.entries()
  ).map(([command, detail]) => {
    const origins = Array.from(detail.origins).sort((left, right) => left.localeCompare(right));
    return {
      label: `${detail.baseLabel} [from: ${origins.join(", ")}]`,
      command,
      runnableAction: detail.runnableAction
    };
  });
  const criticalStaleSortedRollupCommands = [...criticalStaleRollupCommands].sort((left, right) => {
    const leftRunnable = typeof left.runnableAction === "string";
    const rightRunnable = typeof right.runnableAction === "string";
    if (leftRunnable !== rightRunnable) {
      return leftRunnable ? -1 : 1;
    }
    const byLabel = left.label.localeCompare(right.label);
    if (byLabel !== 0) {
      return byLabel;
    }
    return left.command.localeCompare(right.command);
  });
  const criticalStaleRunnableCommandCount = criticalStaleSortedRollupCommands.filter(
    item => typeof item.runnableAction === "string"
  ).length;
  const criticalStaleRunnableCommands = criticalStaleSortedRollupCommands.filter(
    item => typeof item.runnableAction === "string"
  );
  const criticalStaleCopyOnlyCommands = criticalStaleSortedRollupCommands.filter(
    item => typeof item.runnableAction !== "string"
  );
  const currentFocusViewHref = `${buildFocusFilterHref(params, focusChecklistFilter)}#phase1-operations`;
  const focusViewLinkCommands: TriageCommand[] = [
    { label: "Copy current view URL", command: currentFocusViewHref },
    {
      label: "Copy non-pass view URL",
      command: `${buildFocusFilterHref(params, "non-pass")}#phase1-operations`
    },
    { label: "Copy stale view URL", command: `${buildFocusFilterHref(params, "stale")}#phase1-operations` },
    {
      label: "Copy stale + non-pass view URL",
      command: `${buildFocusFilterHref(params, "stale-non-pass")}#phase1-operations`
    },
    {
      label: "Copy critical stale view URL",
      command: criticalStaleCurrentModeViewHref
    },
    {
      label: "Copy critical stale view URL (copy-only shown)",
      command: criticalStaleShownCopyViewHref
    },
    {
      label: "Copy critical stale view URL (copy-only hidden)",
      command: criticalStaleHiddenCopyViewHref
    }
  ];
  const criticalStaleSequenceCommands: TriageCommand[] = [
    {
      label: "1. Refresh exports",
      command: "npm run v1:evidence-manifest",
      runnableAction: "refresh_evidence_manifest"
    },
    {
      label: "2. Rerun readiness",
      command: "npm run v1:readiness"
    },
    {
      label: "3. Verify GA6 parity",
      command: "npm run v1:ga6-drill"
    }
  ];
  const criticalStaleIncidentModeSummary = `${focusFilterViewLabel["critical-stale"]}; copy-only ${
    criticalCopyGroupMode === "hide" ? "hidden" : "shown"
  }`;
  const criticalStaleIncidentShareCommands: TriageCommand[] = [
    {
      label:
        criticalCopyGroupMode === "hide"
          ? `Copy current incident view URL (${criticalStaleIncidentModeSummary}; active)`
          : `Copy current incident view URL (${criticalStaleIncidentModeSummary}; active)`,
      command: criticalStaleCurrentModeViewHref
    },
    {
      label:
        criticalCopyGroupMode === "hide"
          ? `Copy shown-copy incident view URL (${criticalStaleIncidentModeSummary}; fallback alternate)`
          : `Copy hidden-copy incident view URL (${criticalStaleIncidentModeSummary}; fallback alternate)`,
      command: criticalStaleAlternateModeViewHref
    }
  ];
  const criticalStaleRecommendedShareCommands: TriageCommand[] = [
    {
      label: `Copy recommended handoff URL (${criticalStaleIncidentModeSummary}; active recommended)`,
      command: criticalStaleCurrentModeViewHref
    }
  ];

  if (preflight.ok && preflightStatus(preflight.preview) === "failed") {
    const failedCheck = preflight.preview.checks.find(check => check.status !== "passed");
    if (failedCheck?.command) {
      triageCommands.push({
        label: `Rerun ${failedCheck.gate}`,
        command: failedCheck.command
      });
    }
    triageCommands.push({ label: "Run full preflight", command: "npm run v1:preflight" });
    triageCommands.push({ label: "Run full readiness", command: "npm run v1:readiness" });
  }

  if (ga6.ok && ga6Failures.length > 0) {
    triageCommands.push({ label: "Rerun GA6 drill", command: "npm run v1:ga6-drill" });
    triageCommands.push({
      label: "Validate sync convergence regression",
      command:
        "cargo test -p node --test sync sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views"
    });
    if (ga6Failures.some(reason => reason.includes("discovery parity"))) {
      triageCommands.push({
        label: "Validate discovery determinism regression",
        command:
          "cargo test -p node --test api api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic"
      });
    }
    if (ga6Failures.some(reason => reason.includes("invalid events"))) {
      triageCommands.push({
        label: "Inspect node-a DB",
        command: `cargo run --bin cli -- node db inspect --data-dir "${path.join(ga6.preview.runDir, "node-a")}"`
      });
      triageCommands.push({
        label: "Inspect node-b DB",
        command: `cargo run --bin cli -- node db inspect --data-dir "${path.join(ga6.preview.runDir, "node-b")}"`
      });
      triageCommands.push({
        label: "Inspect node-c DB",
        command: `cargo run --bin cli -- node db inspect --data-dir "${path.join(ga6.preview.runDir, "node-c")}"`
      });
    }
  }

  if (laneFixtures.ok && laneFixtureStatus(laneFixtures.preview) === "failed") {
    const failedCheck = laneFixtures.preview.checks.find(check => check.status !== "passed");
    if (failedCheck?.command) {
      triageCommands.push({
        label: `Rerun ${failedCheck.name}`,
        command: failedCheck.command
      });
    }
    triageCommands.push({
      label: "Run lane fixture checks",
      command: "npm run v1:lane-fixtures",
      runnableAction: "run_lane_fixture_checks"
    });
    triageCommands.push({
      label: "Run lane fixture readiness checks",
      command: "npm run v1:lane-fixtures:readiness"
    });
  }

  if (lifecycle.ok) {
    const archiveRoot = path.join(process.cwd(), "target", "tmp", "archive");
    lifecycleCommands.push({
      label: "Ensure archive directory exists",
      command: `New-Item -ItemType Directory -Path "${archiveRoot}" -Force`
    });
    if (lifecycle.summary.preflight.latestRunDir) {
      const markerPath = path.join(lifecycle.summary.preflight.latestRunDir, ".pinned");
      const notePath = path.join(lifecycle.summary.preflight.latestRunDir, RUN_NOTE_FILE);
      const tagsPath = path.join(lifecycle.summary.preflight.latestRunDir, RUN_TAGS_FILE);
      const archivePath = path.join(archiveRoot, `${lifecycle.summary.preflight.latestRunId ?? "preflight-latest"}.zip`);
      lifecycleCommands.push({
        label: "Pin latest preflight run",
        command: `Set-Content -Path "${markerPath}" -Value "pinned $(Get-Date -Format o)"`
      });
      lifecycleCommands.push({
        label: "Unpin latest preflight run",
        command: `Remove-Item -LiteralPath "${markerPath}"`
      });
      lifecycleCommands.push({
        label: "Set latest preflight note",
        command: `Set-Content -Path "${notePath}" -Value "note: <fill incident details>"`
      });
      lifecycleCommands.push({
        label: "Set latest preflight tags",
        command: `Set-Content -Path "${tagsPath}" -Value "tag1,tag2"`
      });
      lifecycleCommands.push({
        label: "Archive latest preflight run",
        command: `Compress-Archive -Path "${lifecycle.summary.preflight.latestRunDir}\\*" -DestinationPath "${archivePath}" -Force`
      });
    }
    if (lifecycle.summary.ga6.latestRunDir) {
      const markerPath = path.join(lifecycle.summary.ga6.latestRunDir, ".pinned");
      const notePath = path.join(lifecycle.summary.ga6.latestRunDir, RUN_NOTE_FILE);
      const tagsPath = path.join(lifecycle.summary.ga6.latestRunDir, RUN_TAGS_FILE);
      const archivePath = path.join(archiveRoot, `${lifecycle.summary.ga6.latestRunId ?? "ga6-latest"}.zip`);
      lifecycleCommands.push({
        label: "Pin latest GA6 run",
        command: `Set-Content -Path "${markerPath}" -Value "pinned $(Get-Date -Format o)"`
      });
      lifecycleCommands.push({
        label: "Unpin latest GA6 run",
        command: `Remove-Item -LiteralPath "${markerPath}"`
      });
      lifecycleCommands.push({
        label: "Set latest GA6 note",
        command: `Set-Content -Path "${notePath}" -Value "note: <fill incident details>"`
      });
      lifecycleCommands.push({
        label: "Set latest GA6 tags",
        command: `Set-Content -Path "${tagsPath}" -Value "tag1,tag2"`
      });
      lifecycleCommands.push({
        label: "Archive latest GA6 run",
        command: `Compress-Archive -Path "${lifecycle.summary.ga6.latestRunDir}\\*" -DestinationPath "${archivePath}" -Force`
      });
    }
    if (lifecycle.summary.laneFixtures.latestRunDir) {
      const markerPath = path.join(lifecycle.summary.laneFixtures.latestRunDir, ".pinned");
      const notePath = path.join(lifecycle.summary.laneFixtures.latestRunDir, RUN_NOTE_FILE);
      const tagsPath = path.join(lifecycle.summary.laneFixtures.latestRunDir, RUN_TAGS_FILE);
      const archivePath = path.join(
        archiveRoot,
        `${lifecycle.summary.laneFixtures.latestRunId ?? "lane-fixture-latest"}.zip`
      );
      lifecycleCommands.push({
        label: "Pin latest lane fixture run",
        command: `Set-Content -Path "${markerPath}" -Value "pinned $(Get-Date -Format o)"`
      });
      lifecycleCommands.push({
        label: "Unpin latest lane fixture run",
        command: `Remove-Item -LiteralPath "${markerPath}"`
      });
      lifecycleCommands.push({
        label: "Set latest lane fixture note",
        command: `Set-Content -Path "${notePath}" -Value "note: <fill lane fixture details>"`
      });
      lifecycleCommands.push({
        label: "Set latest lane fixture tags",
        command: `Set-Content -Path "${tagsPath}" -Value "lane-fixture,tag2"`
      });
      lifecycleCommands.push({
        label: "Archive latest lane fixture run",
        command: `Compress-Archive -Path "${lifecycle.summary.laneFixtures.latestRunDir}\\*" -DestinationPath "${archivePath}" -Force`
      });
    }
    if (lifecycle.summary.preflight.pruneCandidates.length > 0) {
      const prunePaths = lifecycle.summary.preflight.pruneCandidates
        .map(runDir => `"${runDir}"`)
        .join(",");
      lifecycleCommands.push({
        label: "Preview prune preflight candidates",
        command: `Get-Item -LiteralPath ${prunePaths}`
      });
      lifecycleCommands.push({
        label: "Prune preflight candidates (review before removing -WhatIf)",
        command: `Remove-Item -LiteralPath ${prunePaths} -Recurse -Force -WhatIf`
      });
    }
    if (lifecycle.summary.ga6.pruneCandidates.length > 0) {
      const prunePaths = lifecycle.summary.ga6.pruneCandidates
        .map(runDir => `"${runDir}"`)
        .join(",");
      lifecycleCommands.push({
        label: "Preview prune GA6 candidates",
        command: `Get-Item -LiteralPath ${prunePaths}`
      });
      lifecycleCommands.push({
        label: "Prune GA6 candidates (review before removing -WhatIf)",
        command: `Remove-Item -LiteralPath ${prunePaths} -Recurse -Force -WhatIf`
      });
    }
    if (lifecycle.summary.laneFixtures.pruneCandidates.length > 0) {
      const prunePaths = lifecycle.summary.laneFixtures.pruneCandidates
        .map(runDir => `"${runDir}"`)
        .join(",");
      lifecycleCommands.push({
        label: "Preview prune lane fixture candidates",
        command: `Get-Item -LiteralPath ${prunePaths}`
      });
      lifecycleCommands.push({
        label: "Prune lane fixture candidates (review before removing -WhatIf)",
        command: `Remove-Item -LiteralPath ${prunePaths} -Recurse -Force -WhatIf`
      });
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "3rem 1rem" }}>
      <h1 style={{ marginTop: 0 }}>New Start Web Shell</h1>
      <p style={{ opacity: 0.85 }}>
        Track 3 now includes local event creation/signing in TypeScript over the Rust node.
      </p>

      <section
        style={{
          marginTop: "1.5rem",
          border: "1px solid #2a3458",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          background: "#111936"
        }}
      >
        <h2 style={{ marginTop: 0 }}>Replay Preview</h2>
        {replay.ok ? (
          <>
            <p>as_of: {replay.preview.asOf}</p>
            <p>source: {replay.preview.source}</p>
            <p>applied events: {replay.preview.appliedEventCount}</p>
            <p>invalid events: {replay.preview.invalidEventCount}</p>
          </>
        ) : (
          <>
            <p style={{ opacity: 0.85 }}>Could not load replay data from the node.</p>
            <pre
              style={{
                marginTop: "0.5rem",
                border: "1px solid #523041",
                borderRadius: 12,
                padding: "0.9rem",
                background: "#291724",
                whiteSpace: "pre-wrap"
              }}
            >
              {replay.message}
            </pre>
          </>
        )}
      </section>

      <IdentityCreateForm />
      <section
        id="alpha-workflows"
        style={{
          marginTop: "1.5rem",
          border: "1px solid #2a3458",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          background: "#111936"
        }}
      >
        <h2 style={{ marginTop: 0 }}>Closed-Alpha Workflow Launchers</h2>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Start real alpha workflows from a single place instead of hopping between docs, presets,
          and manual builder setup.
        </p>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {ALPHA_WORKFLOW_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                color: "#dbe7ff",
                textDecoration: "none",
                border: "1px solid #2a3458",
                borderRadius: 10,
                padding: "0.9rem",
                background: "#0d1633"
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.35rem", color: "#9fc2ff" }}>
                {link.label}
              </strong>
              <span style={{ opacity: 0.85 }}>{link.description}</span>
            </Link>
          ))}
        </div>
        <h3 style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>Lane Starters</h3>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Jump straight into a real alpha service lane with the marketplace builder already aligned
          to that lane.
        </p>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {ALPHA_LANE_STARTERS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                color: "#dbe7ff",
                textDecoration: "none",
                border: "1px solid #2a3458",
                borderRadius: 10,
                padding: "0.8rem",
                background: "#0d1633"
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.35rem", color: "#9fc2ff" }}>
                {link.label}
              </strong>
              <span style={{ opacity: 0.85 }}>{link.description}</span>
            </Link>
          ))}
        </div>
        <h3 style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>Dispute Path Starters</h3>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Jump directly into timeout and deadlock testing flows for the alpha lanes that need
          dispute-path rehearsal.
        </p>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {ALPHA_DISPUTE_LANE_STARTERS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                color: "#dbe7ff",
                textDecoration: "none",
                border: "1px solid #523041",
                borderRadius: 10,
                padding: "0.8rem",
                background: "#291724"
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.35rem", color: "#ffcf85" }}>
                {link.label}
              </strong>
              <span style={{ opacity: 0.85 }}>{link.description}</span>
            </Link>
          ))}
        </div>
        <h3 style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>Checked-In Lane Fixture Bundles</h3>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Use the checked-in non-software lane fixtures for reproducible local flows. Start from the
          matching launcher here, then use the fixture bundle commands below when you need the exact
          ingest path.
        </p>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {NON_SOFTWARE_FIXTURE_LANES.map(link => {
            const acceptOrderId = `${link.lane}-accept-order`;
            const disputeOrderId = `${link.lane}-dispute-order`;
            return (
              <div
                key={link.lane}
                style={{
                  border: "1px solid #30526b",
                  borderRadius: 10,
                  padding: "0.9rem",
                  background: "#0d1a2f"
                }}
              >
                <strong style={{ display: "block", marginBottom: "0.35rem", color: "#95e4ff" }}>
                  {link.label}
                </strong>
                <p style={{ marginTop: 0, marginBottom: "0.75rem", opacity: 0.85 }}>
                  {link.description}
                </p>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  <Link
                    href={`/?builder_lane=${link.lane}&builder_flow=accept#marketplace-event-builder`}
                    style={{
                      display: "inline-block",
                      color: "#dbe7ff",
                      textDecoration: "none",
                      border: "1px solid #2c5470",
                      borderRadius: 999,
                      padding: "0.45rem 0.75rem",
                      background: "#12304b"
                    }}
                  >
                    Accept starter
                  </Link>
                  <Link
                    href={`/?builder_lane=${link.lane}&builder_flow=dispute#marketplace-event-builder`}
                    style={{
                      display: "inline-block",
                      color: "#ffe4c0",
                      textDecoration: "none",
                      border: "1px solid #72513a",
                      borderRadius: 999,
                      padding: "0.45rem 0.75rem",
                      background: "#3a2418"
                    }}
                  >
                    Dispute starter
                  </Link>
                  <Link
                    href="#fixture-quickstart"
                    style={{
                      display: "inline-block",
                      color: "#dbe7ff",
                      textDecoration: "none",
                      border: "1px solid #2a3458",
                      borderRadius: 999,
                      padding: "0.45rem 0.75rem",
                      background: "#121c3a"
                    }}
                  >
                    Bundle commands
                  </Link>
                </div>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                  <Link
                    href={`/explorer/orders?id=${acceptOrderId}`}
                    style={{ color: "#9fc2ff", textDecoration: "none" }}
                  >
                    Accept order
                  </Link>
                  <Link
                    href={`/explorer/milestones?order_id=${acceptOrderId}&milestone_id=m1`}
                    style={{ color: "#9fc2ff", textDecoration: "none" }}
                  >
                    Accept milestone
                  </Link>
                  <Link
                    href={`/explorer/milestones?order_id=${disputeOrderId}&milestone_id=m1`}
                    style={{ color: "#ffcf85", textDecoration: "none" }}
                  >
                    Dispute milestone
                  </Link>
                  <Link
                    href={`/explorer/discovery?service_type=${link.lane}&alpha_defaults=0`}
                    style={{ color: "#9fe0b3", textDecoration: "none" }}
                  >
                    Discovery
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section
        id="phase2-compute-preview"
        style={{
          marginTop: "1.5rem",
          border: "1px solid #31513f",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          background: "#10231d"
        }}
      >
        <h2 style={{ marginTop: 0 }}>Phase 2 Compute Preview</h2>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          This section is the dedicated entry point for the new Phase 2 `compute-job` lane. It is
          intentionally separate from the completed Phase 1 closed-alpha launcher set.
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.75rem", opacity: 0.85 }}>
          Current compute-job template contract: <code>deliveryMode=receipt</code>,{" "}
          <code>allowedEvidenceFormats=[job-receipt-v1]</code>, and delivery receipts must include
          artifact hashes plus a non-empty <code>notesHash</code>.
        </p>
        <div
          style={{
            marginTop: 0,
            marginBottom: "0.9rem",
            border: "1px solid #365e4b",
            borderRadius: 10,
            padding: "0.8rem 0.9rem",
            background: "#132a22"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "0.45rem", color: "#9fe0b1" }}>
            Provider Receipt Tooling
          </h3>
          <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.85 }}>
            Generate a canonical `job-receipt-v1` artifact and delivery hints before submitting
            `ServiceDelivery`.
          </p>
          <pre
            style={{
              marginTop: 0,
              marginBottom: "0.45rem",
              border: "1px solid #2a3458",
              borderRadius: 8,
              padding: "0.5rem 0.65rem",
              background: "#0b122b",
              whiteSpace: "pre-wrap"
            }}
          >
            {`npm run v2:compute-receipt -- --job-id compute-demo --provider <provider-pubkey> --out-dir target/tmp/compute-demo --output-hash output-hash-1 --notes "deterministic compute receipt"`}
          </pre>
          <pre
            style={{
              marginTop: 0,
              marginBottom: "0.45rem",
              border: "1px solid #2a3458",
              borderRadius: 8,
              padding: "0.5rem 0.65rem",
              background: "#0b122b",
              whiteSpace: "pre-wrap"
            }}
          >
            {`Get-Content -Path target/tmp/compute-demo/job-receipt-v1-delivery-hints.json`}
          </pre>
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            <Link
              href="/?builder_lane=compute-job&builder_flow=accept#marketplace-event-builder"
              style={{ color: "#9fe0b1" }}
            >
              Back to compute accept starter
            </Link>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
          }}
        >
          {PHASE2_COMPUTE_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                color: "#e2fff2",
                textDecoration: "none",
                border: "1px solid #365e4b",
                borderRadius: 10,
                padding: "0.9rem",
                background: "#132a22"
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.35rem", color: "#9fe0b1" }}>
                {link.label}
              </strong>
              <span style={{ opacity: 0.85 }}>{link.description}</span>
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <Link href="/explorer/orders?id=compute-job-accept-order" style={{ color: "#9fe0b1" }}>
            Compute accept order
          </Link>
          <Link
            href="/explorer/milestones?order_id=compute-job-accept-order&milestone_id=m1"
            style={{ color: "#9fe0b1" }}
          >
            Compute accept milestone
          </Link>
          <Link
            href="/explorer/milestones?order_id=compute-job-dispute-order&milestone_id=m1"
            style={{ color: "#ffcf85" }}
          >
            Compute dispute milestone
          </Link>
        </div>
      </section>
      <div id="onboarding-wizard">
        <OnboardingWizard />
      </div>
      <div id="marketplace-event-builder">
        <MarketplaceEventBuilder />
      </div>
      <div id="contribution-credit-builder">
        <ContributionCreditBuilder />
      </div>
      <FixtureQuickstart />

      <section
        id="phase1-operations"
        style={{
          marginTop: "1.5rem",
          border: "1px solid #2a3458",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          background: "#111936"
        }}
      >
        <h2 style={{ marginTop: 0 }}>Phase 1 Operations</h2>
        <p style={{ opacity: 0.85 }}>
          Carry-forward closed-alpha operator checks, evidence refreshes, and runbook drills after
          the original Phase 1 scope completion.
        </p>
        <ul style={{ marginTop: "0.5rem" }}>
          <li>
            <code>npm run v1:preflight</code>
          </li>
          <li>
            <code>npm run v1:readiness</code>
          </li>
          <li>
            <code>npm run v1:ga6-drill</code>
          </li>
        </ul>
        {preflight.ok ? (
          <>
            <p style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              latest preflight run: <code>{preflight.preview.runId}</code>
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              preflight dir: <code title={preflight.preview.runDir}>{compactDisplayPath(preflight.preview.runDir)}</code>
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              preflight status: {preflight.preview.overallStatus} ({preflightPassedChecks}/
              {preflight.preview.checks.length} checks passed)
            </p>
            {preflight.preview.failedGate ? (
              <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
                failed gate: <code>{preflight.preview.failedGate}</code>
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ marginTop: "0.75rem", marginBottom: 0, opacity: 0.85 }}>
            preflight summary unavailable: <code>{preflight.message}</code>
          </p>
        )}
        {ga6.ok ? (
          <>
            <p style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              latest GA6 run: <code>{ga6.preview.runId}</code>
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              run dir: <code title={ga6.preview.runDir}>{compactDisplayPath(ga6.preview.runDir)}</code>
            </p>
            <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              invalid events (A/B/C): {ga6.preview.invalidEventCount.nodeA}/
              {ga6.preview.invalidEventCount.nodeB}/{ga6.preview.invalidEventCount.nodeC}
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              applied events (A/B/C): {ga6.preview.appliedEventCount.nodeA}/
              {ga6.preview.appliedEventCount.nodeB}/{ga6.preview.appliedEventCount.nodeC}
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              applied-event parity (A vs B / A vs C):{" "}
              {ga6.preview.appliedEventCountEqual.nodeAvsNodeB ? "true" : "false"} /{" "}
              {ga6.preview.appliedEventCountEqual.nodeAvsNodeC ? "true" : "false"}
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              replay parity (A vs B / A vs C):{" "}
              {ga6.preview.replayParity.nodeAvsNodeB ? "true" : "false"} /{" "}
              {ga6.preview.replayParity.nodeAvsNodeC ? "true" : "false"}
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              discovery parity (A vs B / A vs C):{" "}
              {ga6.preview.discoveryParity.nodeAvsNodeB ? "true" : "false"} /{" "}
              {ga6.preview.discoveryParity.nodeAvsNodeC ? "true" : "false"}
            </p>
          </>
        ) : (
          <p style={{ marginTop: "0.75rem", marginBottom: 0, opacity: 0.85 }}>
            GA6 summary unavailable: <code>{ga6.message}</code>
          </p>
        )}
        {laneFixtures.ok ? (
          <>
            <p style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              latest lane fixture run: <code>{laneFixtures.preview.runId}</code>
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              run dir: <code title={laneFixtures.preview.runDir}>{compactDisplayPath(laneFixtures.preview.runDir)}</code>
            </p>
            <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              lane fixture status: {laneFixtures.preview.overallStatus} ({laneFixturePassedChecks}/
              {laneFixtures.preview.checks.length} checks passed)
            </p>
            {laneFixtures.preview.failedCheck ? (
              <p style={{ marginTop: "0.25rem", marginBottom: 0 }}>
                failed check: <code>{laneFixtures.preview.failedCheck}</code>
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ marginTop: "0.75rem", marginBottom: 0, opacity: 0.85 }}>
            lane fixture summary unavailable: <code>{laneFixtures.message}</code>
          </p>
        )}

        <h3 id="ops-recent-history" style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>
          Recent Run History
        </h3>
        <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
          history focus:{" "}
          <Link
            href={`${buildHistoryFocusHref(params, "all")}#ops-recent-history`}
            style={{ color: historyFocus === "all" ? "#9fe0b1" : "#9fc2ff" }}
          >
            all
          </Link>{" "}
          |{" "}
          <Link
            href={`${buildHistoryFocusHref(params, "preflight")}#ops-recent-history`}
            style={{ color: historyFocus === "preflight" ? "#9fe0b1" : "#9fc2ff" }}
          >
            preflight
          </Link>{" "}
          |{" "}
          <Link
            href={`${buildHistoryFocusHref(params, "ga6")}#ops-recent-history`}
            style={{ color: historyFocus === "ga6" ? "#9fe0b1" : "#9fc2ff" }}
          >
            GA6
          </Link>{" "}
          |{" "}
          <Link
            href={`${buildHistoryFocusHref(params, "lane-fixtures")}#ops-recent-history`}
            style={{ color: historyFocus === "lane-fixtures" ? "#9fe0b1" : "#9fc2ff" }}
          >
            lane fixtures
          </Link>
        </p>
        {(historyFocus === "all" || historyFocus === "preflight") && recentPreflight.ok ? (
          <>
            <p
              id="ops-recent-history-preflight"
              style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.85 }}
            >
              Latest preflight runs:
            </p>
            <ul style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              {recentPreflight.items.map(item => (
                <li key={`preflight-${item.runId}`}>
                  <code>{item.runId}</code> [{item.status}] - {item.summary} ({item.ageSummary}
                  {item.isStale ? ", stale" : ""}{item.isPinned ? ", pinned" : ""})
                  {item.noteSummary ? ` note: ${item.noteSummary}` : ""}
                  {item.tags.length > 0 ? ` tags: ${item.tags.join(",")}` : ""}
                  <details style={{ marginTop: "0.35rem", marginBottom: "0.35rem" }}>
                    <summary style={{ cursor: "pointer", color: "#9fc2ff" }}>Actions</summary>
                    <OperationsCommandTools
                      title={`Preflight Actions (${item.runId})`}
                      commands={toCommandToolItems([
                        {
                          label: "Inspect this summary",
                          command: `Get-Content -Path "${path.join(item.runDir, "preflight-summary.json")}"`
                        },
                        {
                          label: "Run full preflight",
                          command: "npm run v1:preflight"
                        },
                        {
                          label: "Run full readiness",
                          command: "npm run v1:readiness"
                        }
                      ])}
                    />
                  </details>
                </li>
              ))}
            </ul>
          </>
        ) : (historyFocus === "all" || historyFocus === "preflight") && !recentPreflight.ok ? (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            preflight history unavailable: <code>{recentPreflight.message}</code>
          </p>
        ) : null}
        {(historyFocus === "all" || historyFocus === "ga6") && recentGa6.ok ? (
          <>
            <p id="ops-recent-history-ga6" style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.85 }}>
              Latest GA6 drill runs:
            </p>
            <ul style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              {recentGa6.items.map(item => (
                <li key={`ga6-${item.runId}`}>
                  <code>{item.runId}</code> [{item.status}] - {item.summary} ({item.ageSummary}
                  {item.isStale ? ", stale" : ""}{item.isPinned ? ", pinned" : ""})
                  {item.noteSummary ? ` note: ${item.noteSummary}` : ""}
                  {item.tags.length > 0 ? ` tags: ${item.tags.join(",")}` : ""}
                  <details style={{ marginTop: "0.35rem", marginBottom: "0.35rem" }}>
                    <summary style={{ cursor: "pointer", color: "#9fc2ff" }}>Actions</summary>
                    <OperationsCommandTools
                      title={`GA6 Actions (${item.runId})`}
                      commands={toCommandToolItems([
                        {
                          label: "Inspect this summary",
                          command: `Get-Content -Path "${path.join(item.runDir, "ga6-drill-summary.json")}"`
                        },
                        {
                          label: "Rerun GA6 drill",
                          command: "npm run v1:ga6-drill"
                        }
                      ])}
                    />
                  </details>
                </li>
              ))}
            </ul>
          </>
        ) : (historyFocus === "all" || historyFocus === "ga6") && !recentGa6.ok ? (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            GA6 history unavailable: <code>{recentGa6.message}</code>
          </p>
        ) : null}
        {(historyFocus === "all" || historyFocus === "lane-fixtures") && recentLaneFixtures.ok ? (
          <details
            id="ops-recent-history-lane-fixtures"
            open={historyFocus === "lane-fixtures"}
            style={{
              marginTop: 0,
              marginBottom: "0.6rem",
              border: "1px solid #30526b",
              borderRadius: 10,
              padding: "0.65rem 0.8rem",
              background: "#0d1a2f"
            }}
          >
            <summary style={{ cursor: "pointer", color: "#95e4ff", marginBottom: "0.45rem" }}>
              Latest lane fixture runs ({recentLaneFixtures.items.length})
            </summary>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.85 }}>
              focused review links:{" "}
              <Link
                href={`${buildHistoryFocusHref(params, "lane-fixtures")}#ops-recent-history`}
                style={{ color: "#9fc2ff" }}
              >
                lane-fixtures only
              </Link>{" "}
              |{" "}
              <Link href="#fixture-quickstart" style={{ color: "#9fc2ff" }}>
                fixture bundles
              </Link>
            </p>
            <ul style={{ marginTop: 0, marginBottom: 0 }}>
              {recentLaneFixtures.items.map(item => (
                <li key={`lane-fixture-${item.runId}`}>
                  <code>{item.runId}</code> [{item.status}] - {item.summary} ({item.ageSummary}
                  {item.isStale ? ", stale" : ""}{item.isPinned ? ", pinned" : ""})
                  {item.noteSummary ? ` note: ${item.noteSummary}` : ""}
                  {item.tags.length > 0 ? ` tags: ${item.tags.join(",")}` : ""}
                  <details style={{ marginTop: "0.35rem", marginBottom: "0.35rem" }}>
                    <summary style={{ cursor: "pointer", color: "#9fc2ff" }}>Actions</summary>
                    <OperationsCommandTools
                      title={`Lane Fixture Actions (${item.runId})`}
                      commands={toCommandToolItems([
                        {
                          label: "Inspect this summary",
                          command: `Get-Content -Path "${path.join(item.runDir, "lane-fixture-check-summary.json")}"`
                        },
                        {
                          label: "Rerun lane fixture checks",
                          command: "npm run v1:lane-fixtures",
                          runnableAction: "run_lane_fixture_checks"
                        },
                        {
                          label: "Run lane fixture readiness checks",
                          command: "npm run v1:lane-fixtures:readiness"
                        }
                      ])}
                    />
                  </details>
                </li>
              ))}
            </ul>
          </details>
        ) : (historyFocus === "all" || historyFocus === "lane-fixtures") && !recentLaneFixtures.ok ? (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            lane fixture history unavailable: <code>{recentLaneFixtures.message}</code>
          </p>
        ) : null}

        <h3 style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>Artifact Lifecycle</h3>
        {lifecycle.ok ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              preflight latest age: {lifecycle.summary.preflight.latestAgeSummary}
              {lifecycle.summary.preflight.latestStale ? " (stale)" : ""}
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              preflight runs: {lifecycle.summary.preflight.totalRuns}, pinned:{" "}
              {lifecycle.summary.preflight.pinnedRuns}, noted: {lifecycle.summary.preflight.notedRuns},
              tagged: {lifecycle.summary.preflight.taggedRuns}, prune candidates:{" "}
              {lifecycle.summary.preflight.pruneCandidates.length}
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              GA6 latest age: {lifecycle.summary.ga6.latestAgeSummary}
              {lifecycle.summary.ga6.latestStale ? " (stale)" : ""}
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              GA6 runs: {lifecycle.summary.ga6.totalRuns}, pinned: {lifecycle.summary.ga6.pinnedRuns},
              noted: {lifecycle.summary.ga6.notedRuns}, tagged: {lifecycle.summary.ga6.taggedRuns},
              prune candidates: {lifecycle.summary.ga6.pruneCandidates.length}
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              lane fixture latest age: {lifecycle.summary.laneFixtures.latestAgeSummary}
              {lifecycle.summary.laneFixtures.latestStale ? " (stale)" : ""}
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              lane fixture runs: {lifecycle.summary.laneFixtures.totalRuns}, pinned:{" "}
              {lifecycle.summary.laneFixtures.pinnedRuns}, noted:{" "}
              {lifecycle.summary.laneFixtures.notedRuns}, tagged:{" "}
              {lifecycle.summary.laneFixtures.taggedRuns}, prune candidates:{" "}
              {lifecycle.summary.laneFixtures.pruneCandidates.length}
            </p>
            {lifecycleCommands.length > 0 ? (
              <ul style={{ marginTop: 0, marginBottom: "0.6rem" }}>
                {lifecycleCommands.map(item => (
                  <li key={`lifecycle-${item.label}-${item.command}`}>
                    {item.label}: <code>{item.command}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
                No lifecycle actions suggested for current artifacts.
              </p>
            )}
          </>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            lifecycle summary unavailable: <code>{lifecycle.message}</code>
          </p>
        )}

        <h3 id="ops-evidence-exports" style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>
          Evidence Exports
        </h3>
        {evidenceManifest.ok ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              evidence manifest: <code title={evidenceManifest.preview.filePath}>{compactDisplayPath(evidenceManifest.preview.filePath)}</code>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              analysis as_of: <code>{evidenceManifest.preview.analysisAsOf}</code> (
              {formatAgeSummary(evidenceManifest.preview.analysisAsOfMs, nowMs)} old)
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              manifest status: {evidenceManifest.preview.overallStatus} (preflight{" "}
              {evidenceManifest.preview.latestPreflightStatus}, GA6{" "}
              {evidenceManifest.preview.latestGa6Status}, lane fixtures{" "}
              {evidenceManifest.preview.latestLaneFixtureStatus})
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              manifest prune candidates (preflight/GA6/lane fixtures):{" "}
              {evidenceManifest.preview.preflightPruneCandidates}/
              {evidenceManifest.preview.ga6PruneCandidates}/
              {evidenceManifest.preview.laneFixturePruneCandidates}
            </p>
            {evidenceManifestStaleReasons.length > 0 ? (
              <p style={{ marginTop: 0, marginBottom: "0.6rem", color: "#ffb17a" }}>
                manifest refresh recommended: {evidenceManifestStaleReasons.join("; ")}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            evidence manifest unavailable: <code>{evidenceManifest.message}</code>
          </p>
        )}
        {artifactPrunePlan.ok ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              artifact prune plan: <code title={artifactPrunePlan.preview.filePath}>{compactDisplayPath(artifactPrunePlan.preview.filePath)}</code>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              analysis as_of: <code>{artifactPrunePlan.preview.analysisAsOf}</code> (
              {formatAgeSummary(artifactPrunePlan.preview.analysisAsOfMs, nowMs)} old)
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              planner candidates total: {artifactPrunePlan.preview.totalCandidates} (preflight{" "}
              {artifactPrunePlan.preview.preflightCandidates}, GA6{" "}
              {artifactPrunePlan.preview.ga6Candidates}, lane fixtures{" "}
              {artifactPrunePlan.preview.laneFixtureCandidates})
            </p>
            {artifactPrunePlanStaleReasons.length > 0 ? (
              <p style={{ marginTop: 0, marginBottom: "0.6rem", color: "#ffb17a" }}>
                prune-plan refresh recommended: {artifactPrunePlanStaleReasons.join("; ")}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            artifact prune plan unavailable: <code>{artifactPrunePlan.message}</code>
          </p>
        )}
        {exportCommands.length > 0 ? (
          <OperationsCommandTools
            title="Export Commands"
            commands={toCommandToolItems(exportCommands)}
            collapsedByDefault
          />
        ) : (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            No export commands available from current manifest/prune-plan artifacts.
          </p>
        )}
        <OperationsCommandTools
          title="Refresh Workflow"
          commands={toCommandToolItems(exportWorkflowCommands)}
          refreshAfterRun
          showReloadButton
        />

        <h4 style={{ marginTop: "0.9rem", marginBottom: "0.45rem" }}>Export Audit Log Cleanup Plan</h4>
        {exportAuditLogPlan.ok ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              plan artifact: <code title={exportAuditLogPlan.preview.filePath}>{compactDisplayPath(exportAuditLogPlan.preview.filePath)}</code>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              analysis as_of: <code>{exportAuditLogPlan.preview.analysisAsOf}</code> (
              {formatAgeSummary(exportAuditLogPlan.preview.analysisAsOfMs, nowMs)} old)
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              audit log path: <code title={exportAuditLogPlan.preview.logPath}>{compactDisplayPath(exportAuditLogPlan.preview.logPath)}</code>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              lines keep/prune: {exportAuditLogPlan.preview.keepCount}/
              {exportAuditLogPlan.preview.pruneCandidateCount} (total {exportAuditLogPlan.preview.lineCount})
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              bytes current/projected/max: {exportAuditLogPlan.preview.currentBytes}/
              {exportAuditLogPlan.preview.projectedBytesAfterApply}/{exportAuditLogPlan.preview.maxBytes}
            </p>
            {exportAuditLogPlan.preview.overMaxBytes ? (
              <p style={{ marginTop: 0, marginBottom: "0.35rem", color: "#ffb17a" }}>
                audit log currently exceeds size policy; apply cleanup plan after review.
              </p>
            ) : null}
            {exportAuditLogPlan.preview.projectedOverMaxBytes ? (
              <p style={{ marginTop: 0, marginBottom: "0.35rem", color: "#ffb17a" }}>
                projected size remains above policy after planned prune; adjust retention policy.
              </p>
            ) : null}
            {exportAuditLogPlanStaleReasons.length > 0 ? (
              <p style={{ marginTop: 0, marginBottom: "0.35rem", color: "#ffb17a" }}>
                cleanup-plan refresh recommended: {exportAuditLogPlanStaleReasons.join("; ")}
              </p>
            ) : null}
            {exportAuditLogPlan.preview.applyResult.applied ? (
              <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
                last cleanup apply:{" "}
                {exportAuditLogPlan.preview.applyResult.changed ? "changed log" : "no changes"}{" "}
                {exportAuditLogPlan.preview.applyResult.archivePath
                  ? `(archive: ${compactDisplayPath(exportAuditLogPlan.preview.applyResult.archivePath)})`
                  : ""}
                {exportAuditLogPlan.preview.applyResult.warning
                  ? ` warning: ${exportAuditLogPlan.preview.applyResult.warning}`
                  : ""}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            export audit log plan unavailable: <code>{exportAuditLogPlan.message}</code>
          </p>
        )}

        <h4
          id="ops-export-execution-audit"
          style={{ marginTop: "0.9rem", marginBottom: "0.45rem" }}
        >
          Allowlisted Execution Audit
        </h4>
        {exportExecutionAudit.ok ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.85 }}>
              log path: <code title={exportExecutionAudit.logPath}>{compactDisplayPath(exportExecutionAudit.logPath)}</code>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.85 }}>
              total audit rows: {exportExecutionAudit.summary.totalEntries}
            </p>
            <ul style={{ marginTop: 0, marginBottom: "0.45rem" }}>
              {exportExecutionAudit.summary.byAction.map(action => (
                <li key={`audit-summary-${action.action}`}>
                  {action.actionLabel}: latest {action.latestStatus} ({action.latestAgeSummary}), failure
                  streak {action.failureStreak}
                  {action.lastSuccessAt
                    ? `, last success ${action.lastSuccessAt} (${action.lastSuccessAgeSummary})`
                    : ", no successful run recorded"}
                  {summarizeArtifactHints(action.latestArtifactPathHints)
                    ? `, latest artifacts: ${summarizeArtifactHints(action.latestArtifactPathHints)}`
                    : ""}
                </li>
              ))}
            </ul>
            {exportExecutionAudit.summary.failingLatestActions.length > 0 ? (
              <p style={{ marginTop: 0, marginBottom: "0.45rem", color: "#ffb17a" }}>
                allowlisted run alert: latest run failed for{" "}
                {exportExecutionAudit.summary.failingLatestActions.join(", ")}
              </p>
            ) : (
              <p style={{ marginTop: 0, marginBottom: "0.45rem", color: "#9fe0b1" }}>
                allowlisted run alert: none (latest runs are passing)
              </p>
            )}
            {exportExecutionAudit.summary.byAction.some(
              action => action.action === "run_lane_fixture_checks"
            ) ? (
              <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
                lane fixture audit:{" "}
                {
                  exportExecutionAudit.summary.byAction.find(
                    action => action.action === "run_lane_fixture_checks"
                  )?.latestStatus
                }{" "}
                (
                {
                  exportExecutionAudit.summary.byAction.find(
                    action => action.action === "run_lane_fixture_checks"
                  )?.latestAgeSummary
                }
                )
              </p>
            ) : null}
            <ul style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              {exportExecutionAudit.items.map(item => (
                <li key={`${item.recordedAt}-${item.action}-${item.durationMs}`}>
                  <code>{item.recordedAt}</code> [{item.status}] {item.actionLabel} (
                  {(item.durationMs / 1000).toFixed(1)}s, exit{" "}
                  {item.exitCode === null ? "n/a" : item.exitCode}, {item.ageSummary})
                  {summarizeArtifactHints(item.artifactPathHints)
                    ? ` artifacts: ${summarizeArtifactHints(item.artifactPathHints)}`
                    : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            export execution audit unavailable: <code>{exportExecutionAudit.message}</code> (
            <code>{exportExecutionAudit.logPath}</code>)
          </p>
        )}

        <h3 style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>
          Closed-Alpha UX Readiness Focus
        </h3>
        <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
          summary: pass {focusChecklistCounts.pass}, attention {focusChecklistCounts.attention},
          fail {focusChecklistCounts.fail}
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
          stale impact: pass {staleStatusCounts.pass}, attention {staleStatusCounts.attention}, fail{" "}
          {staleStatusCounts.fail}
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.45rem" }}>
          view: <code>{focusFilterViewLabel[focusChecklistFilter]}</code> (
          {filteredFocusChecklist.length} rows)
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
          filter:{" "}
          <Link
            href={buildFocusFilterHref(params, "all")}
            style={{ color: focusChecklistFilter === "all" ? "#9fe0b1" : "#9fc2ff" }}
          >
            all ({focusFilterCounts.all})
          </Link>{" "}
          |{" "}
          <Link
            href={buildFocusFilterHref(params, "non-pass")}
            style={{ color: focusChecklistFilter === "non-pass" ? "#9fe0b1" : "#9fc2ff" }}
          >
            non-pass only ({focusFilterCounts["non-pass"]})
          </Link>{" "}
          |{" "}
          <Link
            href={buildFocusFilterHref(params, "stale")}
            style={{ color: focusChecklistFilter === "stale" ? "#9fe0b1" : "#9fc2ff" }}
          >
            stale only ({focusFilterCounts.stale})
          </Link>{" "}
          |{" "}
          <Link
            href={buildFocusFilterHref(params, "stale-non-pass")}
            style={{ color: focusChecklistFilter === "stale-non-pass" ? "#9fe0b1" : "#9fc2ff" }}
          >
            stale + non-pass ({focusFilterCounts["stale-non-pass"]})
          </Link>{" "}
          |{" "}
          <Link
            href={buildFocusFilterHref(params, "critical-stale")}
            style={{ color: focusChecklistFilter === "critical-stale" ? "#9fe0b1" : "#9fc2ff" }}
          >
            critical stale only ({focusFilterCounts["critical-stale"]})
          </Link>
        </p>
        <OperationsCommandTools
          title="Checklist View Links"
          commands={toCommandToolItems(focusViewLinkCommands)}
          collapsedByDefault
        />
        {laneFixtureIsStale ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", color: "#ffcf85" }}>
              lane fixture stale rollup: latest lane coverage is {laneFixtureStaleSeverity} ({latestLaneFixtureAgeSummary} old).
            </p>
            <OperationsCommandTools
              title="Lane Fixture Stale Rollup"
              commands={toCommandToolItems(laneFixtureStaleCommands)}
            />
          </>
        ) : null}
        {focusChecklistFilter === "critical-stale" &&
        criticalStaleNonPassCount === 0 &&
        criticalStalePassCount > 0 ? (
          <p style={{ marginTop: 0, marginBottom: "0.45rem", color: "#ffcf85" }}>
            critical-stale warning: no non-pass rows, but {criticalStalePassCount} critical-stale
            pass row(s) remain; refresh evidence before declaring all clear.
          </p>
        ) : null}
        {focusChecklistFilter === "critical-stale" ? (
          <OperationsCommandTools
            title="Critical Stale Urgent Sequence"
            commands={toCommandToolItems(criticalStaleSequenceCommands)}
          />
        ) : null}
        {focusChecklistFilter === "critical-stale" ? (
          <>
            <p style={{ marginTop: 0, marginBottom: "0.45rem" }}>
              incident mode: <code>{focusFilterViewLabel[focusChecklistFilter]}</code>, copy-only{" "}
              <code>{criticalCopyGroupMode === "hide" ? "hidden" : "shown"}</code>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
              handoff hierarchy: <code>active recommended</code> = preferred current-share URL;{" "}
              <code>fallback alternate presets</code> = secondary incident-share options
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              legend: <code>[recommended]</code> = preferred current-share; <code>[fallback]</code>{" "}
              = alternate preset
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              copied-link note: these legend tokens are preserved in copy labels, so pasted handoff
              artifacts stay self-describing outside this page.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              alignment note: the visible URL lines and copy actions intentionally use the same
              legend tokens, so scan and copy paths stay aligned.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              context note: the recommended and fallback URLs point to the same current incident
              context; only the handoff role and preset framing differ.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              fallback preference note: prefer the fallback preset when you intentionally need the
              alternate share framing, such as copy-only-hidden incident handoff.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              recommended preference note: stay on the recommended current-share path when you want
              the default visible incident framing and do not need an alternate preset.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", color: "#9fe0b1" }}>
              recommended handoff link [recommended] (active):{" "}
              <code>{criticalStaleCurrentModeViewHref}</code>
            </p>
            <OperationsCommandTools
              title={`Recommended Handoff Link [recommended] (${criticalStaleIncidentModeSummary}; handoff hierarchy: active recommended current-share control)`}
              commands={toCommandToolItems(criticalStaleRecommendedShareCommands)}
              collapsedByDefault
            />
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
              use the fallback share block only when you intentionally need an alternate preset.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem" }}>
              share this incident view [fallback] (fallback block):{" "}
              <Link href={criticalStaleCurrentModeViewHref} style={{ color: "#9fc2ff" }}>
                <code>{criticalStaleCurrentModeViewHref}</code>
              </Link>
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.9 }}>
              fallback share links are alternate presets, not the default current-share handoff path.
            </p>
            <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
              shared note: both helper cues agree on the same handoff rule, so either side remains trustworthy when the other is out of view.
            </p>
            <OperationsCommandTools
              title={`Critical Stale Incident Share Links [fallback] (${criticalStaleIncidentModeSummary}; handoff hierarchy: active recommended -> fallback alternate presets)`}
              commands={toCommandToolItems(criticalStaleIncidentShareCommands)}
              collapsedByDefault
            />
          </>
        ) : null}
        {focusChecklistFilter === "critical-stale" ? (
          criticalStaleRollupCommands.length > 0 ? (
            <>
              <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.9 }}>
                critical-stale command impact: {criticalStaleSortedRollupCommands.length} unique commands,{" "}
                {criticalStaleRunnableCommandCount} runnable actions
              </p>
              <p style={{ marginTop: 0, marginBottom: "0.35rem", opacity: 0.9 }}>
                copy-only group:{" "}
                <Link
                  href={`${buildCriticalCopyGroupHref(params, "show")}#phase1-operations`}
                  style={{ color: criticalCopyGroupMode === "show" ? "#9fe0b1" : "#9fc2ff" }}
                >
                  show
                </Link>{" "}
                |{" "}
                <Link
                  href={`${buildCriticalCopyGroupHref(params, "hide")}#phase1-operations`}
                  style={{ color: criticalCopyGroupMode === "hide" ? "#9fe0b1" : "#9fc2ff" }}
                >
                  hide
                </Link>
              </p>
              <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
                copy-only visibility:{" "}
                <code>{criticalCopyGroupMode === "hide" ? "hidden" : "shown"}</code>
              </p>
              {criticalStaleRunnableCommands.length > 0 ? (
                <OperationsCommandTools
                  title="Critical Stale Urgent Triage Commands (Runnable)"
                  commands={toCommandToolItems(criticalStaleRunnableCommands)}
                  collapsedByDefault
                />
              ) : null}
              {criticalCopyGroupMode === "show" && criticalStaleCopyOnlyCommands.length > 0 ? (
                <OperationsCommandTools
                  title="Critical Stale Urgent Triage Commands (Copy-Only)"
                  commands={toCommandToolItems(criticalStaleCopyOnlyCommands)}
                  collapsedByDefault
                />
              ) : null}
            </>
          ) : (
            <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
              No non-pass command rollups for current critical-stale rows.
            </p>
          )
        ) : null}
        <ul style={{ marginTop: 0, marginBottom: "0.6rem" }}>
          {filteredFocusChecklist.map(item => {
            const staleHints = item.ageBadges
              .filter(badge => badge.tone === "warn" || badge.tone === "critical")
              .map(badge => badge.staleHint)
              .filter((hint): hint is string => typeof hint === "string" && hint.length > 0);
            return (
              <li key={item.key}>
                {item.label}: [{renderFocusStatus(item.status)}] {item.summary}
                {item.status !== "pass" && item.triageCommands.length > 0 ? (
                  <OperationsCommandTools
                    title={`${item.label} Commands`}
                    commands={toCommandToolItems(item.triageCommands)}
                  />
                ) : null}
                {item.status !== "pass" && item.quickLinks.length > 0 ? (
                  <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
                    shortcuts:{" "}
                    {item.quickLinks.map((shortcut, index) => (
                      <span key={`focus-link-${item.key}-${shortcut.href}`}>
                        {index > 0 ? " | " : ""}
                        <Link
                          href={resolveFocusShortcutHref(shortcut.href, params, focusChecklistFilter)}
                          style={{ color: "#9fc2ff" }}
                        >
                          {shortcut.label}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
                {item.ageBadges.length > 0 ? (
                  <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
                    age context:{" "}
                    {item.ageBadges.map((badge, index) => (
                      <span
                        key={`focus-age-${item.key}-${badge.label}`}
                        style={{
                          color:
                            badge.tone === "critical"
                              ? "#ff9d9d"
                              : badge.tone === "warn"
                                ? "#ffcf85"
                                : badge.tone === "ok"
                                  ? "#9fe0b1"
                                  : "#9fc2ff"
                        }}
                      >
                        {index > 0 ? " | " : ""}
                        {badge.label}
                      </span>
                    ))}
                  </p>
                ) : null}
                {staleHints.length > 0 ? (
                  <p style={{ marginTop: 0, marginBottom: "0.35rem", color: "#ffcf85" }}>
                    why stale ({item.staleSource}): {staleHints.join("; ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {filteredFocusChecklist.length === 0 ? (
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
            No checklist rows match the active filter.
          </p>
        ) : null}

        <h3 id="ops-runbook-shortcuts" style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>
          Runbook Shortcuts
        </h3>
        <ul style={{ marginTop: 0, marginBottom: "0.45rem" }}>
          {focusFilterEntryLinks.map(item => (
            <li key={`runbook-focus-${item.label}-${item.href}`}>
              <Link href={item.href} style={{ color: "#9fc2ff" }}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul style={{ marginTop: 0, marginBottom: "0.6rem" }}>
          {runbookCommands.map(item => (
            <li key={`runbook-${item.label}-${item.command}`}>
              {item.label}: <code>{item.command}</code>
            </li>
          ))}
        </ul>

        <h3 id="ops-failure-triage" style={{ marginTop: "1rem", marginBottom: "0.45rem" }}>
          Failure Triage Shortcuts
        </h3>
        {triageCommands.length > 0 ? (
          <ul style={{ marginTop: 0, marginBottom: 0 }}>
            {triageCommands.map(item => (
              <li key={`${item.label}-${item.command}`}>
                {item.label}: <code>{item.command}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.85 }}>
            No immediate triage actions. Latest preflight and GA6 checks are passing.
          </p>
        )}
      </section>

      <section
        id="explorer-routes"
        style={{
          marginTop: "1.5rem",
          border: "1px solid #2a3458",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          background: "#111936"
        }}
      >
        <h2 style={{ marginTop: 0 }}>Explorer Routes</h2>
        <p style={{ opacity: 0.85 }}>
          Open dedicated pages with URL query params for shareable state inspection.
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>
            <Link href="/explorer/offers" style={{ color: "#9fc2ff" }}>
              `/explorer/offers`
            </Link>
          </li>
          <li>
            <Link href="/explorer/orders" style={{ color: "#9fc2ff" }}>
              `/explorer/orders`
            </Link>
          </li>
          <li>
            <Link href="/explorer/milestones" style={{ color: "#9fc2ff" }}>
              `/explorer/milestones`
            </Link>
          </li>
          <li>
            <Link href="/explorer/reputation" style={{ color: "#9fc2ff" }}>
              `/explorer/reputation`
            </Link>
          </li>
          <li>
            <Link href="/explorer/discovery" style={{ color: "#9fc2ff" }}>
              `/explorer/discovery`
            </Link>
          </li>
          <li>
            <Link href="/explorer/identity" style={{ color: "#9fc2ff" }}>
              `/explorer/identity`
            </Link>
          </li>
          <li>
            <Link href="/explorer/balance" style={{ color: "#9fc2ff" }}>
              `/explorer/balance`
            </Link>
          </li>
          <li>
            <Link href="/explorer/policy" style={{ color: "#9fc2ff" }}>
              `/explorer/policy`
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}

