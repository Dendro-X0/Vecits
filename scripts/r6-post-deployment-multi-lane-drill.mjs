#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMUNITY_ARTIFACT_LANES } from "./lib/r6-lane-template-registry.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage:
  node ./scripts/r6-post-deployment-multi-lane-drill.mjs [options]

Options:
  --no-build          Skip release binary rebuild
  --lane <id>         Run one lane only (repeatable)
  --help              Show help

Runs HTTP exchange drills for all R6 community artifact lanes (R6-PD-B).
`);
}

function parseArgs(argv) {
  const result = {
    skipBuild: false,
    lanes: [...COMMUNITY_ARTIFACT_LANES],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--no-build") {
      result.skipBuild = true;
      continue;
    }
    if (arg === "--lane") {
      const lane = argv[index + 1];
      if (!lane) {
        throw new Error("missing value for --lane");
      }
      if (!COMMUNITY_ARTIFACT_LANES.includes(lane)) {
        throw new Error(`unknown lane: ${lane}`);
      }
      result.lanes = [lane];
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return result;
}

function runLaneDrill(lane, skipBuild) {
  const dataDir = path.join(WORKSPACE_ROOT, `vectis-data-r6-pd-${lane}`);
  const drillArgs = [
    "./scripts/r6-post-deployment-drill.mjs",
    "--lane",
    lane,
    "--data-dir",
    dataDir,
  ];
  if (skipBuild) {
    drillArgs.push("--no-build");
  }

  console.log(`\n[r6-post-deployment-multi-lane] lane=${lane}`);
  const result = spawnSync(process.execPath, drillArgs, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`lane drill failed: ${lane}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const passed = [];

  for (const lane of args.lanes) {
    runLaneDrill(lane, args.skipBuild);
    passed.push(lane);
  }

  console.log("\nR6 post-deployment multi-lane drill passed.");
  console.log(`  lanes: ${passed.join(", ")}`);
}

try {
  main();
} catch (error) {
  console.error("R6 post-deployment multi-lane drill failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
