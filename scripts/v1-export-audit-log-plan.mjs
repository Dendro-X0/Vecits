#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const TMP_DIR = path.join(WORKSPACE_ROOT, "target", "tmp");
const LOG_PATH = path.join(TMP_DIR, "operations-export-execution-log.jsonl");
const DEFAULT_OUT = path.join(TMP_DIR, "operations-export-audit-log-plan.json");
const ARCHIVE_DIR = path.join(TMP_DIR, "archive");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_RETAIN_RECENT_DAYS = 21;
const DEFAULT_RETAIN_FAILED_DAYS = 90;
const DEFAULT_MIN_KEEP_LINES = 400;

function usage() {
  console.log(
    "Usage: node ./scripts/v1-export-audit-log-plan.mjs [--out <path>] [--as-of <rfc3339>] [--max-bytes <n>] [--retain-recent-days <n>] [--retain-failed-days <n>] [--min-keep-lines <n>] [--apply]"
  );
}

function parsePositiveInteger(value, argName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid ${argName} value: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  let outPath = DEFAULT_OUT;
  let asOfMs = Date.now();
  let asOfSource = "now";
  let maxBytes = DEFAULT_MAX_BYTES;
  let retainRecentDays = DEFAULT_RETAIN_RECENT_DAYS;
  let retainFailedDays = DEFAULT_RETAIN_FAILED_DAYS;
  let minKeepLines = DEFAULT_MIN_KEEP_LINES;
  let apply = false;

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
    if (arg === "--max-bytes") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --max-bytes");
      }
      maxBytes = parsePositiveInteger(value, "--max-bytes");
      index += 1;
      continue;
    }
    if (arg === "--retain-recent-days") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --retain-recent-days");
      }
      retainRecentDays = parsePositiveInteger(value, "--retain-recent-days");
      index += 1;
      continue;
    }
    if (arg === "--retain-failed-days") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --retain-failed-days");
      }
      retainFailedDays = parsePositiveInteger(value, "--retain-failed-days");
      index += 1;
      continue;
    }
    if (arg === "--min-keep-lines") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --min-keep-lines");
      }
      minKeepLines = parsePositiveInteger(value, "--min-keep-lines");
      index += 1;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return {
    outPath,
    asOfMs,
    asOfSource,
    maxBytes,
    retainRecentDays,
    retainFailedDays,
    minKeepLines,
    apply
  };
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

function ageDays(timestampMs, asOfMs) {
  return Number.parseFloat(((asOfMs - timestampMs) / DAY_MS).toFixed(3));
}

function normalizeStatus(value) {
  return value === "passed" || value === "failed" ? value : null;
}

function classifyEntry(entry, policy) {
  const { minKeepLines, retainRecentDays, retainFailedDays } = policy;
  if (entry.newestRank < minKeepLines) {
    return { keep: true, reason: "min_keep_window" };
  }
  if (!entry.recordedAtMs || !entry.status) {
    return { keep: true, reason: "invalid_contract" };
  }
  if (entry.ageDays <= retainRecentDays) {
    return { keep: true, reason: "recent_window" };
  }
  if (entry.status === "failed" && entry.ageDays <= retainFailedDays) {
    return { keep: true, reason: "failed_retention_window" };
  }
  return {
    keep: false,
    reason:
      entry.status === "failed"
        ? "old_failed_outside_retention"
        : "old_passed_outside_retention"
  };
}

function relativeWorkspacePath(absolutePath) {
  return path.relative(WORKSPACE_ROOT, absolutePath).split(path.sep).join("/");
}

async function writePlan(outPath, plan) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(plan, null, 2)}\n`);
}

async function main() {
  const {
    outPath,
    asOfMs,
    asOfSource,
    maxBytes,
    retainRecentDays,
    retainFailedDays,
    minKeepLines,
    apply
  } = parseArgs(process.argv.slice(2));

  const analysisAsOf = toIso(asOfMs);
  const policy = {
    max_bytes: maxBytes,
    retain_recent_days: retainRecentDays,
    retain_failed_days: retainFailedDays,
    min_keep_lines: minKeepLines
  };

  const commands = {
    generate_plan: "npm run v1:export-audit-log-plan",
    reproducible_snapshot: `node ./scripts/v1-export-audit-log-plan.mjs --as-of ${analysisAsOf} --out target/tmp/operations-export-audit-log-plan-asof.json`,
    apply_cleanup: "node ./scripts/v1-export-audit-log-plan.mjs --apply"
  };

  let rawLog = null;
  let logBytes = 0;
  try {
    rawLog = await fs.readFile(LOG_PATH, "utf8");
    const stat = await fs.stat(LOG_PATH);
    logBytes = stat.size;
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  if (rawLog === null) {
    const plan = {
      schema_version: 1,
      analysis_as_of: analysisAsOf,
      analysis_as_of_source: asOfSource,
      workspace_root: WORKSPACE_ROOT,
      log_path: LOG_PATH,
      policy,
      summary: {
        log_exists: false,
        current_bytes: 0,
        max_bytes: maxBytes,
        over_max_bytes: false,
        line_count: 0,
        keep_count: 0,
        prune_candidate_count: 0,
        projected_bytes_after_apply: 0,
        projected_over_max_bytes: false,
        oldest_entry_at: null,
        newest_entry_at: null
      },
      candidates: [],
      exclusion_reason_counts: {},
      commands,
      apply_result: {
        applied: false,
        changed: false,
        archive_path: null,
        warning: "log file not found"
      }
    };
    await writePlan(outPath, plan);
    console.log(`Export audit log plan written: ${outPath}`);
    console.log("No audit log found; nothing to prune.");
    return;
  }

  const sourceLines = rawLog
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.length > 0);

  const entries = sourceLines.map((line, index) => {
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = null;
    }
    const recordedAtRaw =
      parsed && typeof parsed === "object" ? parsed.recorded_at : null;
    const recordedAtMs =
      typeof recordedAtRaw === "string" ? Date.parse(recordedAtRaw) : Number.NaN;
    const statusRaw = parsed && typeof parsed === "object" ? parsed.status : null;
    const status = normalizeStatus(statusRaw);
    return {
      line,
      lineNumber: index + 1,
      newestRank: 0,
      bytes: Buffer.byteLength(`${line}\n`, "utf8"),
      recordedAt:
        typeof recordedAtRaw === "string" && Number.isFinite(recordedAtMs)
          ? recordedAtRaw
          : null,
      recordedAtMs: Number.isFinite(recordedAtMs) ? recordedAtMs : null,
      status,
      action:
        parsed && typeof parsed === "object" && typeof parsed.action === "string"
          ? parsed.action
          : null,
      actionLabel:
        parsed && typeof parsed === "object" && typeof parsed.action_label === "string"
          ? parsed.action_label
          : null
    };
  });

  for (let newestRank = 0; newestRank < entries.length; newestRank += 1) {
    const indexFromStart = entries.length - 1 - newestRank;
    entries[indexFromStart].newestRank = newestRank;
  }

  const exclusionReasonCounts = {};
  const candidates = [];
  const keptEntries = [];
  for (const entry of entries) {
    const entryAgeDays =
      typeof entry.recordedAtMs === "number" ? ageDays(entry.recordedAtMs, asOfMs) : null;
    entry.ageDays = entryAgeDays;
    const decision = classifyEntry(entry, {
      minKeepLines,
      retainRecentDays,
      retainFailedDays
    });
    if (decision.keep) {
      keptEntries.push(entry);
    } else {
      candidates.push({
        line_number: entry.lineNumber,
        recorded_at: entry.recordedAt,
        status: entry.status,
        action: entry.action,
        action_label: entry.actionLabel,
        age_days: entry.ageDays,
        reason: decision.reason
      });
    }
    exclusionReasonCounts[decision.reason] = (exclusionReasonCounts[decision.reason] ?? 0) + 1;
  }

  const projectedBytesAfterApply = keptEntries.reduce((total, entry) => total + entry.bytes, 0);
  const timestamps = entries
    .map(entry => entry.recordedAtMs)
    .filter(value => typeof value === "number");

  let applyResult = {
    applied: false,
    changed: false,
    archive_path: null,
    warning: null
  };

  if (apply) {
    if (candidates.length === 0) {
      applyResult = {
        applied: true,
        changed: false,
        archive_path: null,
        warning: "no prune candidates under current policy"
      };
    } else {
      await fs.mkdir(ARCHIVE_DIR, { recursive: true });
      const archivePath = path.join(
        ARCHIVE_DIR,
        `operations-export-execution-pruned-${Date.now()}.jsonl`
      );
      const candidateLineNumbers = new Set(candidates.map(candidate => candidate.line_number));
      const prunedLines = entries
        .filter(entry => candidateLineNumbers.has(entry.lineNumber))
        .map(entry => entry.line);
      await fs.writeFile(archivePath, `${prunedLines.join("\n")}\n`);
      await fs.writeFile(
        LOG_PATH,
        `${keptEntries.map(entry => entry.line).join("\n")}${keptEntries.length > 0 ? "\n" : ""}`
      );
      applyResult = {
        applied: true,
        changed: true,
        archive_path: archivePath,
        warning: null
      };
    }
  }

  const plan = {
    schema_version: 1,
    analysis_as_of: analysisAsOf,
    analysis_as_of_source: asOfSource,
    workspace_root: WORKSPACE_ROOT,
    log_path: LOG_PATH,
    policy,
    summary: {
      log_exists: true,
      current_bytes: logBytes,
      max_bytes: maxBytes,
      over_max_bytes: logBytes > maxBytes,
      line_count: entries.length,
      keep_count: keptEntries.length,
      prune_candidate_count: candidates.length,
      projected_bytes_after_apply: projectedBytesAfterApply,
      projected_over_max_bytes: projectedBytesAfterApply > maxBytes,
      oldest_entry_at:
        timestamps.length > 0 ? toIso(Math.min(...timestamps)) : null,
      newest_entry_at:
        timestamps.length > 0 ? toIso(Math.max(...timestamps)) : null
    },
    candidates,
    exclusion_reason_counts: exclusionReasonCounts,
    commands,
    apply_result: applyResult
  };

  await writePlan(outPath, plan);

  console.log(`Export audit log plan written: ${outPath}`);
  console.log(
    `Log size: ${logBytes} bytes (${relativeWorkspacePath(LOG_PATH)}), candidates=${candidates.length}, projected_bytes=${projectedBytesAfterApply}`
  );
  if (applyResult.applied && applyResult.changed) {
    console.log(`Applied cleanup with archive: ${applyResult.archive_path}`);
  } else if (applyResult.warning) {
    console.log(`Apply result: ${applyResult.warning}`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
