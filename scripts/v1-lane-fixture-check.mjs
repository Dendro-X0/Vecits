#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const withTypecheck = process.argv.includes("--with-typecheck");

/** @type {{ name: string; command: string; args: string[]; note: string }[]} */
const checks = [
  {
    name: "lane-fixture-api",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_checked_in_non_software_lane_fixture_bundles_replay_cleanly"
    ],
    note: "Checked-in lane fixtures replay cleanly"
  },
  {
    name: "lane-fixture-sync",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "sync",
      "sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views"
    ],
    note: "Checked-in lane fixtures converge across pull sync"
  },
  {
    name: "lane-fixture-compute-template-guards",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_marketplace_compute_job_lane_template_mismatch_rejections_are_deterministic"
    ],
    note: "Compute-job lane template mismatches reject deterministically"
  }
];

if (withTypecheck) {
  checks.push({
    name: "lane-fixture-web-typecheck",
    command: "pnpm",
    args: ["--filter", "@new-start/web", "typecheck"],
    note: "Web shell typecheck for fixture launcher/discovery surfaces"
  });
}

function formatCommand(command, args) {
  return `${command} ${args.join(" ")}`.trim();
}

function nowIso() {
  return new Date().toISOString();
}

function runCheck(index, total, check) {
  const label = `${index + 1}/${total}`;
  console.log(`\n[${label}] ${check.name} - ${check.note}`);
  console.log(`$ ${formatCommand(check.command, check.args)}`);

  const startedAt = nowIso();
  const startedMs = Date.now();

  const useWindowsNpmShim = process.platform === "win32" && check.command === "npm";
  const command = useWindowsNpmShim ? "cmd.exe" : check.command;
  const args = useWindowsNpmShim ? ["/c", "npm.cmd", ...check.args] : check.args;
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && check.command === "pnpm",
  });
  const durationMs = Date.now() - startedMs;

  if (result.error) {
    return {
      name: check.name,
      note: check.note,
      command: formatCommand(check.command, check.args),
      started_at: startedAt,
      duration_ms: durationMs,
      status: "failed",
      exit_code: 1,
      error: `failed to start command: ${result.error.message}`
    };
  }

  if (typeof result.status === "number" && result.status !== 0) {
    return {
      name: check.name,
      note: check.note,
      command: formatCommand(check.command, check.args),
      started_at: startedAt,
      duration_ms: durationMs,
      status: "failed",
      exit_code: result.status,
      error: `check failed: ${check.name}`
    };
  }

  return {
    name: check.name,
    note: check.note,
    command: formatCommand(check.command, check.args),
    started_at: startedAt,
    duration_ms: durationMs,
    status: "passed",
    exit_code: 0,
    error: null
  };
}

async function main() {
  const runId = `lane-fixture-check-${Date.now()}`;
  const runDir = path.join(process.cwd(), "target", "tmp", runId);
  const summaryPath = path.join(runDir, "lane-fixture-check-summary.json");
  const summary = {
    run_id: runId,
    run_dir: runDir,
    with_typecheck: withTypecheck,
    started_at: nowIso(),
    finished_at: null,
    overall_status: "passed",
    failed_check: null,
    checks: []
  };

  console.log(
    "Running lane fixture checks (fixture replay + sync convergence + compute template guards, optional web typecheck)."
  );

  let exitCode = 0;
  for (let i = 0; i < checks.length; i += 1) {
    const result = runCheck(i, checks.length, checks[i]);
    summary.checks.push(result);
    if (result.status !== "passed") {
      summary.overall_status = "failed";
      summary.failed_check = result.name;
      exitCode = result.exit_code && result.exit_code > 0 ? result.exit_code : 1;
      break;
    }
  }

  summary.finished_at = nowIso();
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`\nLane fixture summary: ${summaryPath}`);
  if (summary.overall_status !== "passed") {
    console.error(`Lane fixture check failed at ${summary.failed_check}.`);
    process.exit(exitCode);
  }

  console.log("\nLane fixture checks passed.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
