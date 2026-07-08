#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

const WORKSPACE_ROOT = process.cwd();
const PLANNER_SCRIPT = path.join(
  WORKSPACE_ROOT,
  "scripts",
  "v1-export-audit-log-plan.mjs"
);
const SMOKE_ROOT = path.join(
  WORKSPACE_ROOT,
  "target",
  "tmp",
  "export-audit-log-plan-smoke"
);
const AS_OF = "2026-04-08T00:00:00Z";
const POLICY_ARGS = [
  "--as-of",
  AS_OF,
  "--retain-recent-days",
  "7",
  "--retain-failed-days",
  "30",
  "--min-keep-lines",
  "1",
  "--max-bytes",
  "256"
];

function makeAuditRow(input) {
  return JSON.stringify({
    recorded_at: input.recorded_at,
    action: input.action,
    action_label: input.action_label,
    command: input.command,
    status: input.status,
    started_at: input.started_at,
    completed_at: input.completed_at,
    duration_ms: input.duration_ms,
    exit_code: input.exit_code,
    artifact_path_hints: input.artifact_path_hints
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runPlanner(args) {
  const { stdout, stderr } = await execFileAsync("node", [PLANNER_SCRIPT, ...args], {
    cwd: SMOKE_ROOT
  });
  return { stdout, stderr };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  await fs.rm(SMOKE_ROOT, { recursive: true, force: true });
  const smokeTmpDir = path.join(SMOKE_ROOT, "target", "tmp");
  await fs.mkdir(smokeTmpDir, { recursive: true });

  const logPath = path.join(smokeTmpDir, "operations-export-execution-log.jsonl");
  const initialRows = [
    makeAuditRow({
      recorded_at: "2025-11-01T00:00:00Z",
      action: "refresh_evidence_manifest",
      action_label: "Refresh evidence manifest",
      command: "npm run v1:evidence-manifest",
      status: "passed",
      started_at: "2025-11-01T00:00:00Z",
      completed_at: "2025-11-01T00:00:01Z",
      duration_ms: 1000,
      exit_code: 0,
      artifact_path_hints: ["target/tmp/operations-evidence-manifest.json"]
    }),
    makeAuditRow({
      recorded_at: "2025-12-01T00:00:00Z",
      action: "refresh_artifact_prune_plan",
      action_label: "Refresh artifact prune plan",
      command: "npm run v1:artifact-prune-plan",
      status: "failed",
      started_at: "2025-12-01T00:00:00Z",
      completed_at: "2025-12-01T00:00:02Z",
      duration_ms: 2000,
      exit_code: 1,
      artifact_path_hints: ["target/tmp/operations-artifact-prune-plan.json"]
    }),
    makeAuditRow({
      recorded_at: "2026-03-31T00:00:00Z",
      action: "refresh_export_audit_log_plan",
      action_label: "Refresh export audit log plan",
      command: "npm run v1:export-audit-log-plan",
      status: "failed",
      started_at: "2026-03-31T00:00:00Z",
      completed_at: "2026-03-31T00:00:03Z",
      duration_ms: 3000,
      exit_code: 1,
      artifact_path_hints: ["target/tmp/operations-export-audit-log-plan.json"]
    }),
    makeAuditRow({
      recorded_at: "2026-04-07T00:00:00Z",
      action: "refresh_evidence_manifest",
      action_label: "Refresh evidence manifest",
      command: "npm run v1:evidence-manifest",
      status: "passed",
      started_at: "2026-04-07T00:00:00Z",
      completed_at: "2026-04-07T00:00:01Z",
      duration_ms: 1000,
      exit_code: 0,
      artifact_path_hints: ["target/tmp/operations-evidence-manifest.json"]
    })
  ];
  await fs.writeFile(logPath, `${initialRows.join("\n")}\n`, "utf8");

  const beforePlanPath = path.join(smokeTmpDir, "plan-before.json");
  await runPlanner([...POLICY_ARGS, "--out", "target/tmp/plan-before.json"]);
  const beforePlan = await readJson(beforePlanPath);

  assert(beforePlan.summary.log_exists === true, "expected log_exists=true before apply");
  assert(
    beforePlan.summary.prune_candidate_count === 2,
    `expected 2 prune candidates before apply, got ${beforePlan.summary.prune_candidate_count}`
  );
  const candidateLineNumbers = beforePlan.candidates
    .map(candidate => candidate.line_number)
    .sort((left, right) => left - right);
  assert(
    candidateLineNumbers.length === 2 &&
      candidateLineNumbers[0] === 1 &&
      candidateLineNumbers[1] === 2,
    `expected candidate line numbers [1,2], got [${candidateLineNumbers.join(",")}]`
  );

  const applyPlanPath = path.join(smokeTmpDir, "plan-after-apply.json");
  await runPlanner([...POLICY_ARGS, "--out", "target/tmp/plan-after-apply.json", "--apply"]);
  const applyPlan = await readJson(applyPlanPath);

  assert(applyPlan.apply_result.applied === true, "expected applied=true in apply plan");
  assert(applyPlan.apply_result.changed === true, "expected changed=true in apply plan");
  assert(
    typeof applyPlan.apply_result.archive_path === "string" &&
      applyPlan.apply_result.archive_path.length > 0,
    "expected archive_path string in apply plan"
  );

  const archivePath = applyPlan.apply_result.archive_path;
  const archivedRaw = await fs.readFile(archivePath, "utf8");
  const archivedLines = archivedRaw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  assert(archivedLines.length === 2, `expected archive to contain 2 lines, got ${archivedLines.length}`);
  assert(
    archivedLines[0] === initialRows[0] && archivedLines[1] === initialRows[1],
    "archive content does not match expected pruned rows"
  );

  const rewrittenRaw = await fs.readFile(logPath, "utf8");
  const rewrittenLines = rewrittenRaw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  assert(
    rewrittenLines.length === 2,
    `expected rewritten log to contain 2 lines, got ${rewrittenLines.length}`
  );
  assert(
    rewrittenLines[0] === initialRows[2] && rewrittenLines[1] === initialRows[3],
    "rewritten log content does not match expected kept rows"
  );

  console.log("v1-export-audit-log-plan apply smoke passed.");
  console.log(`Smoke root: ${SMOKE_ROOT}`);
  console.log(`Before plan: ${beforePlanPath}`);
  console.log(`Apply plan: ${applyPlanPath}`);
  console.log(`Archive: ${archivePath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
