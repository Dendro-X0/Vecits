#!/usr/bin/env node
/**
 * ZC-S4 — zero-capital maintainer closeout.
 *
 * Proves ZC-1 persistent local host (init + health + backup on `.data/zc1`)
 * and standing ZC-2/ZC-3 sync / join honesty helpers.
 *
 * Claim: maintainer smoke. Not a human counterparty field proof.
 *
 * Invokes child scripts via `node` + argv arrays (no shell) so paths with
 * spaces (e.g. `Experimental projects`) are not split.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIRS } from "./lib/data-dirs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const noBuild = process.argv.includes("--no-build");
const node = process.execPath;

const steps = [
  {
    label: "ZC-1 persistent host (deploy smoke + backup)",
    args: [
      path.join(root, "scripts/r2-deploy-smoke.mjs"),
      "--data-dir",
      DATA_DIRS.zc1,
      "--with-backup",
      ...(noBuild ? ["--no-build"] : []),
    ],
  },
  {
    label: "ZC-2 join honesty (R9-H1)",
    args: [path.join(root, "scripts/r9-h1-halo-join-unit.mjs")],
    nodeOptions: ["--experimental-strip-types"],
  },
  {
    label: "ZC-2/ZC-3 pull shape (R9 halo smoke)",
    args: [
      path.join(root, "scripts/r9-halo-smoke.mjs"),
      ...(noBuild ? ["--no-build"] : []),
    ],
  },
];

function run(step) {
  console.log(`\n[zc-s4] ${step.label}`);
  const result = spawnSync(node, [...(step.nodeOptions ?? []), ...step.args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${step.label} failed with exit ${result.status ?? "unknown"}`);
  }
}

try {
  for (const step of steps) run(step);
  console.log("\nZC-S4 closeout passed (maintainer smoke).");
  console.log("Claim: zero-capital ZC-1 host + ZC-2/3 sync helpers. Not field proof.");
  console.log(`ZC-1 data dir: ${DATA_DIRS.zc1}`);
  process.exit(0);
} catch (error) {
  console.error(`\nZC-S4 closeout failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
