#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runStep({ name, command, args, shell = process.platform === "win32" }) {
  console.log(`\n[ci-readiness] ${name}`);
  console.log(`$ ${command} ${args.join(" ")}`.trim());

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
      name: "Workspace typecheck",
      command: "pnpm",
      args: ["typecheck"],
    },
    {
      name: "R4 client/kernel audit",
      command: process.execPath,
      args: ["./scripts/r4-client-audit.mjs"],
    },
    {
      name: "R8 transport smoke",
      command: process.execPath,
      args: ["./scripts/r8-transport-smoke.mjs"],
    },
    {
      name: "R6 offline lanes smoke",
      command: process.execPath,
      args: ["./scripts/r6-offline-lanes-smoke.mjs"],
    },
    {
      name: "Stage Tauri sidecar binary",
      command: process.execPath,
      args: ["./scripts/stage-tauri-sidecar.mjs"],
    },
    {
      name: "Desktop Tauri cargo check",
      command: "cargo",
      args: ["check", "--manifest-path", "apps/desktop/src-tauri/Cargo.toml"],
      shell: false,
    },
    {
      name: "R7 mobile scaffold smoke",
      command: process.execPath,
      args: ["./scripts/r7-mobile-scaffold-smoke.mjs"],
    },
  ];

  for (const step of steps) {
    runStep(step);
  }

  console.log("\nCI readiness bundle passed.");
}

main().catch((error) => {
  console.error("CI readiness bundle failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
