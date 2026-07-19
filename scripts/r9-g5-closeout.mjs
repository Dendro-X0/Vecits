#!/usr/bin/env node
/**
 * R9-G5 — regression closeout (maintainer).
 *
 * Runs standing R9 verification: R8 transport + R6 offline lanes regressions,
 * plus R9 unit/smokes that prove no kernel API break from NFC/halo client work.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipHalo = process.argv.includes("--skip-halo");
const noBuild = process.argv.includes("--no-build");

const steps = [
  { label: "web typecheck", cmd: "pnpm", args: ["--filter", "@new-start/web", "typecheck"] },
  { label: "r9:halo:join-unit", cmd: "pnpm", args: ["r9:halo:join-unit"] },
  { label: "r9:nfc:read-unit", cmd: "pnpm", args: ["r9:nfc:read-unit"] },
  { label: "r9:nfc:write-unit", cmd: "pnpm", args: ["r9:nfc:write-unit"] },
  { label: "r8:transport:smoke", cmd: "npm", args: ["run", "r8:transport:smoke"] },
  { label: "r6:offline-lanes:smoke", cmd: "npm", args: ["run", "r6:offline-lanes:smoke"] }
];

if (!skipHalo) {
  steps.push({
    label: "r9:halo:smoke",
    cmd: "pnpm",
    args: noBuild ? ["r9:halo:smoke", "--", "--no-build"] : ["r9:halo:smoke"]
  });
}

function run(step) {
  console.log(`\n[r9-g5] ${step.label}`);
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
  console.log("\nR9-G5 closeout passed (maintainer smoke).");
  console.log("Gates: R9-G0..G5 — R8 transport + R6 offline lanes regressions green; no kernel API break.");
} catch (error) {
  console.error("\nR9-G5 closeout failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
