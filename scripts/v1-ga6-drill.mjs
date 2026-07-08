#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { runGa6Drill } from "./lib/ga6-drill-core.mjs";

const WORKSPACE_ROOT = process.cwd();

function runCommand(command, args, commandLog) {
  commandLog.push(`${command} ${args.join(" ")}`.trim());
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`failed to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`command failed: ${command} ${args.join(" ")}`);
  }
}

function runCli(args, commandLog) {
  runCommand("cargo", ["run", "--quiet", "--bin", "cli", "--", ...args], commandLog);
}

function spawnNodeServe(dataDir, port, commandLog) {
  const args = [
    "run",
    "--quiet",
    "--bin",
    "cli",
    "--",
    "node",
    "serve",
    "--data-dir",
    dataDir,
    "--bind",
    `127.0.0.1:${port}`,
  ];
  commandLog.push(`cargo ${args.join(" ")}`);
  return spawn("cargo", args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
  });
}

async function main() {
  const { runDir, summaryPath } = await runGa6Drill({
    workspaceRoot: WORKSPACE_ROOT,
    runIdPrefix: "runbook-dryrun",
    runnerMode: "cargo-cli",
    runCli,
    spawnNodeServe,
  });

  console.log(`GA6 drill completed: ${runDir}`);
  console.log(summaryPath);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
