#!/usr/bin/env node

import path from "node:path";
import { runGa6Drill } from "./lib/ga6-drill-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";

const WORKSPACE_ROOT = process.cwd();
const skipBuild = process.argv.includes("--no-build");

async function main() {
  const binaryPath = await resolveReleaseBinary(WORKSPACE_ROOT, {
    buildIfMissing: !skipBuild,
  });
  const { runCli, spawnNodeServe } = createReleaseRunners(
    WORKSPACE_ROOT,
    binaryPath,
  );

  const { runDir, summaryPath, summary } = await runGa6Drill({
    workspaceRoot: WORKSPACE_ROOT,
    runIdPrefix: "runbook-release-dryrun",
    runnerMode: "release-binary",
    binaryPath,
    runCli,
    spawnNodeServe,
  });

  console.log(`GA6 release drill completed: ${runDir}`);
  console.log(`binary: ${binaryPath}`);
  console.log(`runner_mode: ${summary.runner_mode}`);
  console.log(summaryPath);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
