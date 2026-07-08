#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function formatCommand(command, args) {
  return `${command} ${args.join(" ")}`.trim();
}

function runStep({ name, command, args, shell = process.platform === "win32" }) {
  console.log(`\n[r6-post-deployment-readiness] ${name}`);
  console.log(`$ ${formatCommand(command, args)}`);

  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell,
  });

  if (result.status !== 0) {
    throw new Error(`step failed: ${name}`);
  }
}

async function main() {
  const steps = [
    {
      name: "R6-L2 lane template registry + fixtures",
      command: process.execPath,
      args: ["./scripts/r6-lane-templates-smoke.mjs", "--fixtures-only"],
    },
    {
      name: "R6-L3 offline lane experimental guards",
      command: process.execPath,
      args: ["./scripts/r6-offline-lanes-smoke.mjs"],
    },
    {
      name: "R6-L1 compute receipt smoke",
      command: process.execPath,
      args: ["./scripts/v2-compute-receipt.mjs", "--smoke"],
    },
  ];

  for (const step of steps) {
    runStep(step);
  }

  const specPath = path.join(WORKSPACE_ROOT, "docs/specs/r6-post-deployment-proof-spec.md");
  const runbookPath = path.join(
    WORKSPACE_ROOT,
    "docs/runbooks/r6-post-deployment-proof-runbook.md",
  );
  for (const file of [specPath, runbookPath]) {
    try {
      await fs.access(file);
    } catch {
      throw new Error(`missing required doc: ${path.relative(WORKSPACE_ROOT, file)}`);
    }
  }

  console.log("\nR6 post-deployment readiness passed.");
  console.log("Next: pnpm r6:post-deployment:drill -- --lane documentation");
  console.log("      pnpm r6:post-deployment:multi-lane-drill -- --no-build");
  console.log("      pnpm r6:post-deployment:phase-c:smoke");
}

main().catch((error) => {
  console.error("R6 post-deployment readiness failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
