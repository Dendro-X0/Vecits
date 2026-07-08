#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const withTypecheck = process.argv.includes("--with-typecheck");

/** @type {{ gate: string; command: string; args: string[]; note: string }[]} */
const checks = [
  {
    gate: "GA1",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch",
    ],
    note: "Invite onboarding guardrail determinism",
  },
  {
    gate: "GA2",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_marketplace_accept_flow_covers_initial_digital_lanes",
    ],
    note: "Accepted exchange coverage across initial lanes",
  },
  {
    gate: "GA3",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_marketplace_dispute_timeout_covers_initial_digital_lanes",
    ],
    note: "Dispute/timeout deterministic coverage across initial lanes",
  },
  {
    gate: "GA4",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "sync",
      "sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views",
    ],
    note: "Two-node convergence across alpha fixture bundles",
  },
  {
    gate: "GA5",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic",
    ],
    note: "Deterministic discovery output under repeated queries",
  },
];

if (withTypecheck) {
  checks.push(
    {
      gate: "GA6-support",
      command: "pnpm",
      args: ["--filter", "@new-start/sdk-ts", "typecheck"],
      note: "SDK typecheck (operator/client usability support)",
    },
    {
      gate: "GA6-support",
      command: "pnpm",
      args: ["--filter", "@new-start/web", "typecheck"],
      note: "Web typecheck (operator/client usability support)",
    },
  );
}

function formatCommand(command, args) {
  return `${command} ${args.join(" ")}`.trim();
}

function nowIso() {
  return new Date().toISOString();
}

function runCheck(index, total, check) {
  const label = `${index + 1}/${total}`;
  console.log(`\n[${label}] ${check.gate} - ${check.note}`);
  console.log(`$ ${formatCommand(check.command, check.args)}`);

  const startedAt = nowIso();
  const startedMs = Date.now();

  const useWindowsNpmShim =
    process.platform === "win32" && check.command === "npm";
  const command = useWindowsNpmShim ? "cmd.exe" : check.command;
  const args = useWindowsNpmShim ? ["/c", "npm.cmd", ...check.args] : check.args;
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && check.command === "pnpm",
  });
  const durationMs = Date.now() - startedMs;

  if (result.error) {
    return {
      gate: check.gate,
      note: check.note,
      command: formatCommand(check.command, check.args),
      started_at: startedAt,
      duration_ms: durationMs,
      status: "failed",
      exit_code: 1,
      error: `failed to start command: ${result.error.message}`,
    };
  }

  if (typeof result.status === "number" && result.status !== 0) {
    return {
      gate: check.gate,
      note: check.note,
      command: formatCommand(check.command, check.args),
      started_at: startedAt,
      duration_ms: durationMs,
      status: "failed",
      exit_code: result.status,
      error: `check failed: ${check.gate}`,
    };
  }

  return {
    gate: check.gate,
    note: check.note,
    command: formatCommand(check.command, check.args),
    started_at: startedAt,
    duration_ms: durationMs,
    status: "passed",
    exit_code: 0,
    error: null,
  };
}

async function main() {
  const runId = `preflight-${Date.now()}`;
  const runDir = path.join(process.cwd(), "target", "tmp", runId);
  const summaryPath = path.join(runDir, "preflight-summary.json");
  const summary = {
    run_id: runId,
    run_dir: runDir,
    with_typecheck: withTypecheck,
    started_at: nowIso(),
    finished_at: null,
    overall_status: "passed",
    failed_gate: null,
    checks: [],
  };

  console.log("Running V1 preflight checks (GA1..GA5 automated + GA6 checklist handoff).");
  let exitCode = 0;
  for (let i = 0; i < checks.length; i += 1) {
    const result = runCheck(i, checks.length, checks[i]);
    summary.checks.push(result);
    if (result.status !== "passed") {
      summary.overall_status = "failed";
      summary.failed_gate = result.gate;
      exitCode = result.exit_code && result.exit_code > 0 ? result.exit_code : 1;
      break;
    }
  }

  summary.finished_at = nowIso();
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`\nPreflight summary: ${summaryPath}`);
  if (summary.overall_status !== "passed") {
    console.error(`Preflight failed at ${summary.failed_gate}.`);
    process.exit(exitCode);
  }

  console.log("\nAutomated preflight checks passed.");
  console.log(
    "GA6 operator-runbook drill is available via npm run v1:ga6-drill. See docs/runbooks/phase1-preflight-checklist.md.",
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
