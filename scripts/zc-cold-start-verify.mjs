#!/usr/bin/env node
/**
 * ZC cold-start verify — post-reboot operator smoke.
 *
 * Requires an existing data dir (default `.data/zc1`) unless `--allow-init`.
 * Proves: serve + health + backup + join honesty + halo pull shape.
 *
 * Claim: maintainer operable after reboot. Not a human counterparty field proof.
 *
 * Invokes child scripts via `node` + argv arrays (no shell) so paths with
 * spaces are not split.
 */

import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  choosePort,
  fetchJson,
  stopProcess,
  waitForNode,
} from "./lib/ga6-drill-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { DATA_DIRS, WORKSPACE_ROOT } from "./lib/data-dirs.mjs";

const root = WORKSPACE_ROOT;
const node = process.execPath;

function parseArgs(argv) {
  const result = {
    dataDir: DATA_DIRS.zc1,
    skipBuild: argv.includes("--no-build"),
    allowInit: argv.includes("--allow-init"),
    skipJoinHalo: argv.includes("--skip-join-halo"),
    bind: "127.0.0.1",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (argv[i] === "--bind") result.bind = argv[++i];
  }
  return result;
}

function runNodeScript(label, scriptArgs, nodeOptions = []) {
  console.log(`\n[zc-cold-start] ${label}`);
  const result = spawnSync(node, [...nodeOptions, ...scriptArgs], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status ?? "unknown"}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(args.dataDir, "manifest.json");

  try {
    await fs.access(manifestPath);
  } catch {
    if (!args.allowInit) {
      console.error(
        `[zc-cold-start] Missing ${manifestPath}. Restore from backup or pass --allow-init for first-time setup.`,
      );
      console.error("Refusing to silent-init (would wipe the cold-start claim).");
      process.exit(1);
    }
  }

  const binaryPath = await resolveReleaseBinary(root, {
    buildIfMissing: !args.skipBuild,
  });
  const { runCli, spawnNodeServe } = createReleaseRunners(root, binaryPath);
  const commandLog = [];

  try {
    await fs.access(manifestPath);
  } catch {
    console.log("[zc-cold-start] --allow-init: initializing data dir");
    runCli(["node", "init", "--data-dir", args.dataDir], commandLog);
  }

  const port = await choosePort();
  const baseUrl = `http://${args.bind}:${port}`;
  const serve = spawnNodeServe(args.dataDir, port, commandLog);
  let backupDest = null;

  try {
    await waitForNode(baseUrl, 45_000);
    const health = await fetchJson(`${baseUrl}/health`);
    if (health.status !== "ok") {
      throw new Error(`health check failed: ${JSON.stringify(health)}`);
    }
    console.log(`[zc-cold-start] health ok at ${baseUrl}`);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destDir = path.join(root, "target", "backups", `zc-cold-start-${stamp}`);
    runNodeScript("backup verify", [
      path.join(root, "scripts/r2-backup.mjs"),
      "--data-dir",
      args.dataDir,
      "--dest",
      destDir,
    ]);
    backupDest = destDir;

    if (!args.skipJoinHalo) {
      runNodeScript(
        "ZC-2 join honesty (R9-H1)",
        [path.join(root, "scripts/r9-h1-halo-join-unit.mjs")],
        ["--experimental-strip-types"],
      );
      runNodeScript("ZC-2/ZC-3 pull shape (R9 halo smoke)", [
        path.join(root, "scripts/r9-halo-smoke.mjs"),
        ...(args.skipBuild ? ["--no-build"] : []),
      ]);
    }

    const summary = {
      passed: true,
      checkedAt: new Date().toISOString(),
      dataDir: args.dataDir,
      baseUrl,
      health,
      backupDest,
      claim: "maintainer operable after reboot — not field proof",
    };
    const outDir = path.join(root, "target", "tmp", `zc-cold-start-${Date.now()}`);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, "cold-start-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );

    console.log("\nZC cold-start verify passed.");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await stopProcess(serve);
  }
}

main().catch((error) => {
  console.error(
    `\nZC cold-start verify failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
});
