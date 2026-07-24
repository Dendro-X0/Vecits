#!/usr/bin/env node
/**
 * Stability regression pack — day-to-day operable closeout.
 *
 * Chains standing maintainer proofs:
 *   1) protocol fixtures (kernel)
 *   2) ZC cold-start (require existing .data/zc1)
 *   3) SX-S5 multi-milestone staged exchange
 *   4) R4 client/kernel audit
 *
 * Claim: maintainer regression green. Not a human counterparty field proof.
 *
 * Invokes children via `node`/`cargo` + argv arrays (no shell) so paths with
 * spaces are not split.
 */

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIRS, WORKSPACE_ROOT } from "./lib/data-dirs.mjs";

const root = WORKSPACE_ROOT;
const node = process.execPath;
const noBuild = process.argv.includes("--no-build");
const skipFixtures = process.argv.includes("--skip-fixtures");
const skipColdStart = process.argv.includes("--skip-cold-start");
const skipSx = process.argv.includes("--skip-sx");
const skipAudit = process.argv.includes("--skip-audit");

function run(label, command, args, options = {}) {
  console.log(`\n[stability-pack] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status ?? "unknown"}`);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const steps = [];

  if (!skipFixtures) {
    steps.push({
      label: "protocol fixtures (cli fixtures run)",
      run: () => run("protocol fixtures", "cargo", ["run", "--bin", "cli", "--", "fixtures", "run"]),
    });
  }

  if (!skipColdStart) {
    steps.push({
      label: "ZC cold-start verify",
      run: async () => {
        const manifest = path.join(DATA_DIRS.zc1, "manifest.json");
        try {
          await fs.access(manifest);
        } catch {
          throw new Error(
            `Missing ${manifest}. Seed once with \`pnpm zc:s4\` or \`pnpm zc:cold-start -- --allow-init\`, then re-run this pack.`,
          );
        }
        run("ZC cold-start", node, [
          path.join(root, "scripts/zc-cold-start-verify.mjs"),
          ...(noBuild ? ["--no-build"] : []),
        ]);
      },
    });
  }

  if (!skipSx) {
    steps.push({
      label: "SX-S5 multi-milestone drill",
      run: () =>
        run("SX-S5", node, [
          path.join(root, "scripts/sx-s5-drill.mjs"),
          ...(noBuild ? ["--no-build"] : []),
        ]),
    });
  }

  if (!skipAudit) {
    steps.push({
      label: "R4 client/kernel audit",
      run: () => run("R4 client audit", node, [path.join(root, "scripts/r4-client-audit.mjs")]),
    });
    steps.push({
      label: "SX guidance unit",
      run: () =>
        run("SX guidance", node, [
          "--experimental-strip-types",
          path.join(root, "scripts/sx-guidance-unit.mjs"),
        ]),
    });
  }

  if (steps.length === 0) {
    throw new Error("All steps skipped — nothing to run.");
  }

  for (const step of steps) {
    await step.run();
  }

  const summary = {
    passed: true,
    checkedAt: startedAt,
    finishedAt: new Date().toISOString(),
    noBuild,
    steps: steps.map((s) => s.label),
    claim: "maintainer regression pack green — not field proof",
  };
  const outDir = path.join(root, "target", "tmp", `stability-pack-${Date.now()}`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "stability-pack-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("\nStability regression pack passed.");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Summary: ${path.join(outDir, "stability-pack-summary.json")}`);
}

main().catch((error) => {
  console.error(
    `\nStability regression pack failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
});
