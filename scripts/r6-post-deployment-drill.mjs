#!/usr/bin/env node

/**
 * R6-PD-B: solo HTTP exchange drill on a community artifact lane.
 * Thin wrapper around r2:exchange-drill (ALLOWED_LANES = COMMUNITY_ARTIFACT_LANES).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage:
  node ./scripts/r6-post-deployment-drill.mjs [r2:exchange-drill options]

Examples:
  pnpm r6:post-deployment:drill -- --lane documentation --data-dir ./.data/r6-pd-documentation
  pnpm r6:post-deployment:drill -- --lane feature-work --no-build
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const drillArgs = ["./scripts/r2-exchange-drill.mjs", ...args];
  console.log("[r6-post-deployment-drill] community lane HTTP exchange proof");
  console.log(`$ node ${drillArgs.join(" ")}`);

  const result = spawnSync(process.execPath, drillArgs, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log("\nR6 post-deployment drill passed (HTTP exchange on community lane).");
}

main();
