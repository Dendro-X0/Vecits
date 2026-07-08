#!/usr/bin/env node

import { promises as fs } from "node:fs";
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

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    dataDir: path.join(WORKSPACE_ROOT, "vectis-data-r2"),
    baseUrl: "",
    bind: "127.0.0.1",
    skipBuild: argv.includes("--no-build"),
    withBackup: argv.includes("--with-backup"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (argv[i] === "--base-url") result.baseUrl = argv[++i];
    else if (argv[i] === "--bind") result.bind = argv[++i];
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const binaryPath = await resolveReleaseBinary(WORKSPACE_ROOT, {
    buildIfMissing: !args.skipBuild,
  });
  const { runCli, spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);

  let baseUrl = args.baseUrl;
  let serve = null;
  const commandLog = [];

  try {
    await fs.access(path.join(args.dataDir, "manifest.json"));
  } catch {
    runCli(["node", "init", "--data-dir", args.dataDir], commandLog);
  }

  if (!baseUrl) {
    const port = await choosePort();
    baseUrl = `http://${args.bind}:${port}`;
    serve = spawnNodeServe(args.dataDir, port, commandLog);
    await waitForNode(baseUrl, 45_000);
  }

  const health = await fetchJson(`${baseUrl}/health`);
  if (health.status !== "ok") {
    throw new Error(`health check failed: ${JSON.stringify(health)}`);
  }

  let backupDest = null;
  if (args.withBackup) {
    const { spawnSync } = await import("node:child_process");
    const backup = spawnSync(
      process.execPath,
      [path.join(WORKSPACE_ROOT, "scripts/r2-backup.mjs"), "--data-dir", args.dataDir],
      { cwd: WORKSPACE_ROOT, encoding: "utf8" },
    );
    if (backup.status !== 0) {
      throw new Error(backup.stderr || "r2-backup failed");
    }
    const match = backup.stdout.match(/R2 backup completed: (.+)/);
    backupDest = match?.[1] ?? null;
  }

  const summary = {
    passed: true,
    checkedAt: new Date().toISOString(),
    dataDir: args.dataDir,
    baseUrl,
    health,
    backupDest,
  };

  const outDir = path.join(WORKSPACE_ROOT, "target", "tmp", `r2-deploy-smoke-${Date.now()}`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "deploy-smoke-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("R2-P1 deploy smoke passed.");
  console.log(JSON.stringify(summary, null, 2));

  if (serve) {
    await stopProcess(serve);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
