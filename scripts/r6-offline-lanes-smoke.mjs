#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    name: "offline-template-mismatch-api",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_marketplace_offline_lane_template_mismatch_rejections_are_deterministic",
    ],
  },
  {
    name: "offline-telemetry-api",
    command: "cargo",
    args: [
      "test",
      "-p",
      "node",
      "--test",
      "api",
      "api_economics_metrics_offline_lane_telemetry_reports_rates",
    ],
  },
  {
    name: "physical-handoff-fixture-scn18",
    command: "cargo",
    args: ["run", "--bin", "cli", "--", "fixtures", "run"],
  },
];

function runCheck(check) {
  console.log(`\n[offline-smoke] ${check.name}`);
  console.log(`$ ${check.command} ${check.args.join(" ")}`);
  const result = spawnSync(check.command, check.args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`check failed: ${check.name}`);
  }
}

async function ensurePhysicalFixturePresent() {
  const fixture = path.join(
    WORKSPACE_ROOT,
    "fixtures",
    "valid",
    "marketplace-physical-handoff-accept.jsonl",
  );
  await fs.access(fixture);
}

async function main() {
  await ensurePhysicalFixturePresent();
  for (const check of checks) {
    runCheck(check);
  }
  console.log("\nR6-L3 offline lane smoke passed.");
}

main().catch((error) => {
  console.error("R6-L3 offline lane smoke failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
