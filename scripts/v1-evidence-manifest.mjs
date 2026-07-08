#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const RUNS_DIR = path.join(WORKSPACE_ROOT, "target", "tmp");
const DEFAULT_OUT = path.join(RUNS_DIR, "operations-evidence-manifest.json");

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

function usage() {
  console.log("Usage: node ./scripts/v1-evidence-manifest.mjs [--out <path>] [--as-of <rfc3339>]");
}

function parseArgs(argv) {
  let outPath = DEFAULT_OUT;
  let asOfMs = Date.now();
  let asOfSource = "now";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --out");
      }
      outPath = path.resolve(WORKSPACE_ROOT, value);
      index += 1;
      continue;
    }
    if (arg === "--as-of") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --as-of");
      }
      const parsed = Date.parse(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`invalid --as-of value: ${value}`);
      }
      asOfMs = parsed;
      asOfSource = "arg";
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { outPath, asOfMs, asOfSource };
}

function parseRunTimestampMs(runId, prefix) {
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

function ageHours(timestampMs, asOfMs) {
  if (timestampMs === null) {
    return null;
  }
  const hours = (asOfMs - timestampMs) / (1000 * 60 * 60);
  return Number.parseFloat(hours.toFixed(3));
}

function isStale(timestampMs, asOfMs, staleAfterHours) {
  if (timestampMs === null) {
    return false;
  }
  return (asOfMs - timestampMs) / (1000 * 60 * 60) > staleAfterHours;
}

function splitTags(raw) {
  if (!raw) {
    return [];
  }
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map(part => part.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

async function readOptionalTrimmed(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function collectPinMarkers(runDir) {
  const markers = [];
  for (const marker of RUN_PIN_SENTINELS) {
    try {
      await fs.access(path.join(runDir, marker));
      markers.push(marker);
    } catch {
      // marker not present
    }
  }
  return markers;
}

function noteSummary(note) {
  if (!note) {
    return null;
  }
  if (note.length <= 120) {
    return note;
  }
  return `${note.slice(0, 120)}...`;
}

async function loadRunAnnotations(runDir) {
  const note = await readOptionalTrimmed(path.join(runDir, RUN_NOTE_FILE));
  const tagsRaw = await readOptionalTrimmed(path.join(runDir, RUN_TAGS_FILE));
  const tags = splitTags(tagsRaw);
  const pinMarkers = await collectPinMarkers(runDir);
  return {
    note,
    note_summary: noteSummary(note),
    tags,
    pin_markers: pinMarkers,
    pinned: pinMarkers.length > 0
  };
}

function preflightStatus(parsed) {
  return parsed?.overall_status === "passed" ? "passed" : "failed";
}

function parsePreflightSummary(parsed, fallbackRunName, runsDir) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const runId =
    typeof parsed.run_id === "string" && parsed.run_id.trim().length > 0
      ? parsed.run_id
      : fallbackRunName;
  const runDir =
    typeof parsed.run_dir === "string" && parsed.run_dir.trim().length > 0
      ? parsed.run_dir
      : path.join(runsDir, fallbackRunName);
  const overallStatus =
    typeof parsed.overall_status === "string" ? parsed.overall_status : "unknown";
  const failedGate =
    typeof parsed.failed_gate === "string" && parsed.failed_gate.trim().length > 0
      ? parsed.failed_gate
      : null;
  const checks = Array.isArray(parsed.checks)
    ? parsed.checks.map(check => ({
        gate: typeof check?.gate === "string" ? check.gate : "unknown",
        status: typeof check?.status === "string" ? check.status : "unknown",
        command: typeof check?.command === "string" ? check.command : null
      }))
    : [];
  const passedChecks = checks.filter(check => check.status === "passed").length;
  const status = preflightStatus(parsed);
  const failureReasons = status === "passed" ? [] : [`failed gate: ${failedGate ?? "unknown"}`];

  return {
    run_id: runId,
    run_dir: runDir,
    status,
    summary:
      status === "passed"
        ? `${passedChecks}/${checks.length} checks passed`
        : `failed gate: ${failedGate ?? "unknown"}`,
    failure_reasons: failureReasons,
    details: {
      overall_status: overallStatus,
      failed_gate: failedGate,
      checks
    }
  };
}

function ga6FailureReasons(validation) {
  const reasons = [];
  if (validation.invalid_event_count.node_a !== 0) {
    reasons.push("invalid events on node A");
  }
  if (validation.invalid_event_count.node_b !== 0) {
    reasons.push("invalid events on node B");
  }
  if (validation.invalid_event_count.node_c !== 0) {
    reasons.push("invalid events on node C");
  }
  if (!validation.applied_event_count_equal.node_a_vs_node_b) {
    reasons.push("applied-event parity mismatch A/B");
  }
  if (!validation.applied_event_count_equal.node_a_vs_node_c) {
    reasons.push("applied-event parity mismatch A/C");
  }
  if (!validation.replay_state_equal.node_a_vs_node_b) {
    reasons.push("replay parity mismatch A/B");
  }
  if (!validation.replay_state_equal.node_a_vs_node_c) {
    reasons.push("replay parity mismatch A/C");
  }
  if (!validation.discovery_equal.node_a_vs_node_b) {
    reasons.push("discovery parity mismatch A/B");
  }
  if (!validation.discovery_equal.node_a_vs_node_c) {
    reasons.push("discovery parity mismatch A/C");
  }
  return reasons;
}

function laneFixtureStatus(parsed) {
  return parsed?.overall_status === "passed" ? "passed" : "failed";
}

function parseLaneFixtureSummary(parsed, fallbackRunName, runsDir) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const runId =
    typeof parsed.run_id === "string" && parsed.run_id.trim().length > 0
      ? parsed.run_id
      : fallbackRunName;
  const runDir =
    typeof parsed.run_dir === "string" && parsed.run_dir.trim().length > 0
      ? parsed.run_dir
      : path.join(runsDir, fallbackRunName);
  const overallStatus =
    typeof parsed.overall_status === "string" ? parsed.overall_status : "unknown";
  const failedCheck =
    typeof parsed.failed_check === "string" && parsed.failed_check.trim().length > 0
      ? parsed.failed_check
      : null;
  const checks = Array.isArray(parsed.checks)
    ? parsed.checks.map(check => ({
        name: typeof check?.name === "string" ? check.name : "unknown",
        status: typeof check?.status === "string" ? check.status : "unknown",
        command: typeof check?.command === "string" ? check.command : null
      }))
    : [];
  const passedChecks = checks.filter(check => check.status === "passed").length;
  const status = laneFixtureStatus(parsed);
  const failureReasons = status === "passed" ? [] : [`failed check: ${failedCheck ?? "unknown"}`];

  return {
    run_id: runId,
    run_dir: runDir,
    status,
    summary:
      status === "passed"
        ? `${passedChecks}/${checks.length} checks passed`
        : `failed check: ${failedCheck ?? "unknown"}`,
    failure_reasons: failureReasons,
    details: {
      overall_status: overallStatus,
      failed_check: failedCheck,
      checks
    }
  };
}

function parseGa6Summary(parsed, fallbackRunName, runsDir) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const runId =
    typeof parsed.run_id === "string" && parsed.run_id.trim().length > 0
      ? parsed.run_id
      : fallbackRunName;
  const runDir =
    typeof parsed.run_dir === "string" && parsed.run_dir.trim().length > 0
      ? parsed.run_dir
      : path.join(runsDir, fallbackRunName);

  const validation = parsed.validation;
  const valid =
    validation &&
    typeof validation === "object" &&
    typeof validation.invalid_event_count?.node_a === "number" &&
    typeof validation.invalid_event_count?.node_b === "number" &&
    typeof validation.invalid_event_count?.node_c === "number" &&
    typeof validation.applied_event_count?.node_a === "number" &&
    typeof validation.applied_event_count?.node_b === "number" &&
    typeof validation.applied_event_count?.node_c === "number" &&
    typeof validation.applied_event_count_equal?.node_a_vs_node_b === "boolean" &&
    typeof validation.applied_event_count_equal?.node_a_vs_node_c === "boolean" &&
    typeof validation.replay_state_equal?.node_a_vs_node_b === "boolean" &&
    typeof validation.replay_state_equal?.node_a_vs_node_c === "boolean" &&
    typeof validation.discovery_equal?.node_a_vs_node_b === "boolean" &&
    typeof validation.discovery_equal?.node_a_vs_node_c === "boolean";

  if (!valid) {
    return null;
  }

  const failureReasons = ga6FailureReasons(validation);
  const status = failureReasons.length === 0 ? "passed" : "failed";

  return {
    run_id: runId,
    run_dir: runDir,
    status,
    summary: failureReasons.length === 0 ? "all parity checks passed" : failureReasons.join("; "),
    failure_reasons: failureReasons,
    details: {
      validation
    }
  };
}

function literalPathList(paths) {
  return paths.map(item => `"${item}"`).join(",");
}

function computePruneCandidates(runs, asOfMs) {
  const keepSet = new Set(runs.slice(0, KEEP_RECENT_RUNS).map(run => run.run_dir));
  return runs
    .filter(run => {
      if (keepSet.has(run.run_dir)) {
        return false;
      }
      if (run.pinned) {
        return false;
      }
      if (run.timestamp_ms === null) {
        return false;
      }
      return (asOfMs - run.timestamp_ms) / (1000 * 60 * 60) > PRUNE_RETENTION_HOURS;
    })
    .map(run => run.run_dir);
}

function laneCounts(runs, pruneCandidates) {
  return {
    total_runs: runs.length,
    passed_runs: runs.filter(run => run.status === "passed").length,
    failed_runs: runs.filter(run => run.status === "failed").length,
    stale_runs: runs.filter(run => run.stale).length,
    pinned_runs: runs.filter(run => run.pinned).length,
    noted_runs: runs.filter(run => run.note_summary !== null).length,
    tagged_runs: runs.filter(run => run.tags.length > 0).length,
    prune_candidate_count: pruneCandidates.length
  };
}

async function loadLaneEvidence(input) {
  const { prefix, summaryName, staleAfterHours, asOfMs, parser } = input;
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });
  const candidateRuns = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .sort((left, right) => right.name.localeCompare(left.name));

  const runs = [];
  const skipped = [];
  for (const run of candidateRuns) {
    const summaryPath = path.join(RUNS_DIR, run.name, summaryName);
    try {
      const raw = await fs.readFile(summaryPath, "utf8");
      const parsed = JSON.parse(raw);
      const parsedRun = parser(parsed, run.name, RUNS_DIR);
      if (!parsedRun) {
        skipped.push({
          run_dir: path.join(RUNS_DIR, run.name),
          reason: `invalid summary contract: ${summaryName}`
        });
        continue;
      }
      const annotations = await loadRunAnnotations(parsedRun.run_dir);
      const timestampMs = parseRunTimestampMs(parsedRun.run_id, prefix);
      runs.push({
        run_id: parsedRun.run_id,
        run_dir: parsedRun.run_dir,
        timestamp_ms: timestampMs,
        age_hours: ageHours(timestampMs, asOfMs),
        stale: isStale(timestampMs, asOfMs, staleAfterHours),
        pinned: annotations.pinned,
        pin_markers: annotations.pin_markers,
        note_summary: annotations.note_summary,
        tags: annotations.tags,
        status: parsedRun.status,
        summary: parsedRun.summary,
        failure_reasons: parsedRun.failure_reasons,
        details: parsedRun.details
      });
    } catch {
      skipped.push({
        run_dir: path.join(RUNS_DIR, run.name),
        reason: `missing or unreadable ${summaryName}`
      });
    }
  }

  const pruneCandidates = computePruneCandidates(runs, asOfMs);
  const previewPruneCommand =
    pruneCandidates.length > 0
      ? `Get-Item -LiteralPath ${literalPathList(pruneCandidates)}`
      : null;
  const dryRunPruneCommand =
    pruneCandidates.length > 0
      ? `Remove-Item -LiteralPath ${literalPathList(pruneCandidates)} -Recurse -Force -WhatIf`
      : null;

  return {
    latest_run_id: runs[0]?.run_id ?? null,
    latest_run_dir: runs[0]?.run_dir ?? null,
    prune_candidates: pruneCandidates,
    prune_preview_command: previewPruneCommand,
    prune_dry_run_command: dryRunPruneCommand,
    counts: laneCounts(runs, pruneCandidates),
    runs,
    skipped
  };
}

async function main() {
  const { outPath, asOfMs, asOfSource } = parseArgs(process.argv.slice(2));
  const asOfIso = new Date(asOfMs).toISOString();

  const preflight = await loadLaneEvidence({
    prefix: PREFLIGHT_RUN_PREFIX,
    summaryName: "preflight-summary.json",
    staleAfterHours: PREFLIGHT_STALE_HOURS,
    asOfMs,
    parser: parsePreflightSummary
  });

  const ga6 = await loadLaneEvidence({
    prefix: GA6_RUN_PREFIX,
    summaryName: "ga6-drill-summary.json",
    staleAfterHours: GA6_STALE_HOURS,
    asOfMs,
    parser: parseGa6Summary
  });

  const laneFixtures = await loadLaneEvidence({
    prefix: LANE_FIXTURE_RUN_PREFIX,
    summaryName: "lane-fixture-check-summary.json",
    staleAfterHours: LANE_FIXTURE_STALE_HOURS,
    asOfMs,
    parser: parseLaneFixtureSummary
  });

  const overallStatus =
    (preflight.runs[0]?.status ?? "missing") === "passed" &&
    (ga6.runs[0]?.status ?? "missing") === "passed" &&
    (laneFixtures.runs[0]?.status ?? "passed") === "passed"
      ? "healthy"
      : "attention";

  const manifest = {
    schema_version: 1,
    analysis_as_of: asOfIso,
    analysis_as_of_source: asOfSource,
    workspace_root: WORKSPACE_ROOT,
    runs_dir: RUNS_DIR,
    policy: {
      preflight_stale_hours: PREFLIGHT_STALE_HOURS,
      ga6_stale_hours: GA6_STALE_HOURS,
      lane_fixture_stale_hours: LANE_FIXTURE_STALE_HOURS,
      prune_retention_hours: PRUNE_RETENTION_HOURS,
      keep_recent_runs: KEEP_RECENT_RUNS,
      pin_markers: RUN_PIN_SENTINELS,
      note_file: RUN_NOTE_FILE,
      tags_file: RUN_TAGS_FILE
    },
    summary: {
      overall_status: overallStatus,
      latest_preflight_status: preflight.runs[0]?.status ?? "missing",
      latest_ga6_status: ga6.runs[0]?.status ?? "missing",
      latest_lane_fixture_status: laneFixtures.runs[0]?.status ?? "missing"
    },
    commands: {
      generate_manifest: "npm run v1:evidence-manifest",
      generate_lane_fixtures: "npm run v1:lane-fixtures",
      preflight_prune_preview: preflight.prune_preview_command,
      preflight_prune_dry_run: preflight.prune_dry_run_command,
      ga6_prune_preview: ga6.prune_preview_command,
      ga6_prune_dry_run: ga6.prune_dry_run_command,
      lane_fixture_prune_preview: laneFixtures.prune_preview_command,
      lane_fixture_prune_dry_run: laneFixtures.prune_dry_run_command
    },
    preflight,
    ga6,
    lane_fixtures: laneFixtures
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Evidence manifest written: ${outPath}`);
  console.log(
    `Latest statuses: preflight=${manifest.summary.latest_preflight_status}, ga6=${manifest.summary.latest_ga6_status}, lane_fixtures=${manifest.summary.latest_lane_fixture_status}, overall=${manifest.summary.overall_status}`
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
