#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPhaseCPacket } from "./r6-post-deployment-phase-c-packet.mjs";
import { DATA_DIRS } from "./lib/data-dirs.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runDocumentationDrill() {
  console.log("[r6-post-deployment-phase-c-smoke] documentation drill");
  const drill = spawnSync(
    process.execPath,
    [
      "./scripts/r6-post-deployment-drill.mjs",
      "--lane",
      "documentation",
      "--data-dir",
      DATA_DIRS.r6PdDocumentation,
      "--no-build",
    ],
    { cwd: WORKSPACE_ROOT, stdio: "inherit", shell: false },
  );
  if (drill.status !== 0) {
    throw new Error("documentation drill failed before phase-c smoke");
  }
}

async function main() {
  runDocumentationDrill();
  const summary = await runPhaseCPacket(["--smoke", "--no-build"]);
  console.log("R6-PD Phase C smoke passed.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error("R6-PD Phase C smoke failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
