#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const RUNS_DIR = path.join(WORKSPACE_ROOT, "target", "tmp");
const DEFAULT_OUT = path.join(RUNS_DIR, "operations-artifact-prune-plan.json");

const PREFLIGHT_RUN_PREFIX = "preflight-";
const GA6_RUN_PREFIX = "runbook-dryrun-";
const LANE_FIXTURE_RUN_PREFIX = "lane-fixture-check-";
const PRUNE_RETENTION_HOURS = 14 * 24;
const KEEP_RECENT_RUNS = 5;
const RUN_PIN_SENTINELS = [".pinned", ".keep", "PINNED.md"];
const RUN_NOTE_FILE = "OPERATIONS_NOTE.txt";
const RUN_TAGS_FILE = "INCIDENT_TAGS.txt";
const DEFAULT_ELIGIBLE_STATUSES = ["passed"];

function usage() {
  console.log(
    "Usage: node ./scripts/v1-artifact-prune-plan.mjs [--out <path>] [--as-of <rfc3339>] [--eligible-status <status> ...]"
  );
}

function parseArgs(argv) {
  let outPath = DEFAULT_OUT;
  let asOfMs = Date.now();
  let asOfSource = "now";
  const eligibleStatuses = new Set(DEFAULT_ELIGIBLE_STATUSES);

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
    if (arg === "--eligible-status") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --eligible-status");
      }
      eligibleStatuses.add(value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return {
    outPath,
    asOfMs,
    asOfSource,
    eligibleStatuses: Array.from(eligibleStatuses).sort((left, right) =>
      left.localeCompare(right)
    )
  };
}

function parseRunTimestampMs(runId, prefix) {
  if (!runId.startsWith(prefix)) {
    return null;
  }
  const raw = runId.slice(prefix.length);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ageHours(timestampMs, asOfMs) {
  if (timestampMs === null) {
    return null;
  }
  return Number.parseFloat((((asOfMs - timestampMs) / (1000 * 60 * 60))).toFixed(3));
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

async function loadRunAnnotations(runDir) {
  const note = await readOptionalTrimmed(path.join(runDir, RUN_NOTE_FILE));
  const tagsRaw = await readOptionalTrimmed(path.join(runDir, RUN_TAGS_FILE));
  const tags = splitTags(tagsRaw);
  const pinMarkers = await collectPinMarkers(runDir);
  return {
    note_present: note !== null,
    tags,
    pinned: pinMarkers.length > 0,
    pin_markers: pinMarkers
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
  const status = preflightStatus(parsed);
  return { run_id: runId, run_dir: runDir, status };
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

  const status = ga6FailureReasons(validation).length === 0 ? "passed" : "failed";
  return { run_id: runId, run_dir: runDir, status };
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
  const status = laneFixtureStatus(parsed);
  return { run_id: runId, run_dir: runDir, status };
}

function exclusionReason(run, context) {
  if (context.keepSet.has(run.run_dir)) {
    return "keep_recent_window";
  }
  if (run.timestamp_ms === null) {
    return "missing_timestamp";
  }
  if (run.age_hours === null || run.age_hours <= PRUNE_RETENTION_HOURS) {
    return "within_retention_window";
  }
  if (run.pinned) {
    return "pinned";
  }
  if (run.note_present) {
    return "has_note";
  }
  if (run.tags.length > 0) {
    return "has_tags";
  }
  if (!context.eligibleStatuses.has(run.status)) {
    return "status_not_eligible";
  }
  return null;
}

function literalPathList(paths) {
  return paths.map(item => `"${item}"`).join(",");
}

function makeCommands(candidates) {
  if (candidates.length === 0) {
    return {
      preview: null,
      dry_run: null,
      apply: null
    };
  }
  const paths = literalPathList(candidates.map(candidate => candidate.run_dir));
  return {
    preview: `Get-Item -LiteralPath ${paths}`,
    dry_run: `Remove-Item -LiteralPath ${paths} -Recurse -Force -WhatIf`,
    apply: `Remove-Item -LiteralPath ${paths} -Recurse -Force`
  };
}

async function loadLaneRuns(input) {
  const { prefix, summaryName, parser, asOfMs } = input;
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
      const timestampMs = parseRunTimestampMs(parsedRun.run_id, prefix);
      const annotations = await loadRunAnnotations(parsedRun.run_dir);
      runs.push({
        run_id: parsedRun.run_id,
        run_dir: parsedRun.run_dir,
        status: parsedRun.status,
        timestamp_ms: timestampMs,
        age_hours: ageHours(timestampMs, asOfMs),
        note_present: annotations.note_present,
        tags: annotations.tags,
        pinned: annotations.pinned,
        pin_markers: annotations.pin_markers
      });
    } catch {
      skipped.push({
        run_dir: path.join(RUNS_DIR, run.name),
        reason: `missing or unreadable ${summaryName}`
      });
    }
  }

  return { runs, skipped };
}

function buildLanePlan(input) {
  const { runs, skipped, eligibleStatuses } = input;
  const keepSet = new Set(runs.slice(0, KEEP_RECENT_RUNS).map(run => run.run_dir));
  const context = { keepSet, eligibleStatuses };

  const candidates = [];
  const excluded = [];
  for (const run of runs) {
    const reason = exclusionReason(run, context);
    if (!reason) {
      candidates.push(run);
    } else {
      excluded.push({
        run_id: run.run_id,
        run_dir: run.run_dir,
        reason
      });
    }
  }

  return {
    latest_run_id: runs[0]?.run_id ?? null,
    latest_run_dir: runs[0]?.run_dir ?? null,
    counts: {
      total_runs: runs.length,
      candidates: candidates.length,
      excluded: excluded.length,
      skipped: skipped.length
    },
    candidates,
    excluded,
    skipped,
    commands: makeCommands(candidates)
  };
}

async function main() {
  const { outPath, asOfMs, asOfSource, eligibleStatuses } = parseArgs(process.argv.slice(2));
  const eligibleStatusSet = new Set(eligibleStatuses);

  const preflightInput = await loadLaneRuns({
    prefix: PREFLIGHT_RUN_PREFIX,
    summaryName: "preflight-summary.json",
    parser: parsePreflightSummary,
    asOfMs
  });
  const ga6Input = await loadLaneRuns({
    prefix: GA6_RUN_PREFIX,
    summaryName: "ga6-drill-summary.json",
    parser: parseGa6Summary,
    asOfMs
  });
  const laneFixtureInput = await loadLaneRuns({
    prefix: LANE_FIXTURE_RUN_PREFIX,
    summaryName: "lane-fixture-check-summary.json",
    parser: parseLaneFixtureSummary,
    asOfMs
  });

  const preflight = buildLanePlan({
    runs: preflightInput.runs,
    skipped: preflightInput.skipped,
    eligibleStatuses: eligibleStatusSet
  });
  const ga6 = buildLanePlan({
    runs: ga6Input.runs,
    skipped: ga6Input.skipped,
    eligibleStatuses: eligibleStatusSet
  });
  const lane_fixtures = buildLanePlan({
    runs: laneFixtureInput.runs,
    skipped: laneFixtureInput.skipped,
    eligibleStatuses: eligibleStatusSet
  });

  const plan = {
    schema_version: 1,
    analysis_as_of: new Date(asOfMs).toISOString(),
    analysis_as_of_source: asOfSource,
    workspace_root: WORKSPACE_ROOT,
    runs_dir: RUNS_DIR,
    policy: {
      prune_retention_hours: PRUNE_RETENTION_HOURS,
      keep_recent_runs: KEEP_RECENT_RUNS,
      eligible_statuses: eligibleStatuses,
      pin_markers: RUN_PIN_SENTINELS,
      note_file: RUN_NOTE_FILE,
      tags_file: RUN_TAGS_FILE
    },
    summary: {
      total_candidates:
        preflight.counts.candidates + ga6.counts.candidates + lane_fixtures.counts.candidates,
      preflight_candidates: preflight.counts.candidates,
      ga6_candidates: ga6.counts.candidates,
      lane_fixture_candidates: lane_fixtures.counts.candidates
    },
    preflight,
    ga6,
    lane_fixtures
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log(`Artifact prune plan written: ${outPath}`);
  console.log(
    `Candidates: preflight=${preflight.counts.candidates}, ga6=${ga6.counts.candidates}, lane_fixtures=${lane_fixtures.counts.candidates}, total=${plan.summary.total_candidates}`
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
