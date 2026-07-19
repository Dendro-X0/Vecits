#!/usr/bin/env node
/**
 * R6-PD — maintainer closeout (not human field proof).
 *
 * Passes R6-PD-A readiness, R6-PD-B documentation drill, and R6-PD-C tooling smoke.
 * Optional --full also runs R6-PD-B2 multi-lane drill.
 *
 * Human counterparty field proof remains deferred until a second operator is available.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
const noBuild = process.argv.includes("--no-build") || !process.argv.includes("--build");

const steps = [
  { label: "R6-PD-A readiness", cmd: "pnpm", args: ["r6:post-deployment:readiness"] },
  {
    label: "R6-PD-B documentation drill",
    cmd: "pnpm",
    args: ["r6:post-deployment:drill", "--", "--lane", "documentation", ...(noBuild ? ["--no-build"] : [])]
  },
  { label: "R6-PD-C phase-c smoke", cmd: "pnpm", args: ["r6:post-deployment:phase-c:smoke"] }
];

if (full) {
  steps.splice(2, 0, {
    label: "R6-PD-B2 multi-lane drill",
    cmd: "pnpm",
    args: ["r6:post-deployment:multi-lane-drill", "--", ...(noBuild ? ["--no-build"] : [])]
  });
}

function run(step) {
  console.log(`\n[r6-pd] ${step.label}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${step.label} failed with exit ${result.status ?? "unknown"}`);
  }
}

try {
  for (const step of steps) {
    run(step);
  }
  console.log("\nR6-PD maintainer closeout passed.");
  console.log(
    "Claim: R6-PD-A/B/C tooling green (maintainer smoke). Human field proof (R6-PD-C field) still deferred."
  );
} catch (error) {
  console.error("\nR6-PD closeout failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
