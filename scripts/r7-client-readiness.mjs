#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function formatCommand(command, args) {
  return `${command} ${args.join(" ")}`.trim();
}

function nowIso() {
  return new Date().toISOString();
}

function runStep({ name, command, args, shell = process.platform === "win32" }) {
  console.log(`\n[r7-client-readiness] ${name}`);
  console.log(`$ ${formatCommand(command, args)}`);

  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell,
  });

  if (result.status !== 0) {
    throw new Error(`step failed: ${name}`);
  }
}

async function writeSummary({ outDir, steps }) {
  await fs.mkdir(outDir, { recursive: true });
  const summary = {
    passed: true,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    steps,
    workspaceRoot: WORKSPACE_ROOT,
    notes: [
      "Desktop release installer smoke (r7:desktop:release-smoke) is not included — run after build:desktop.",
      "iOS scaffold smoke runs inside r7:mobile:readiness only when gen/ios exists.",
    ],
  };
  const outPath = path.join(outDir, "client-readiness-summary.json");
  await fs.writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function main() {
  const runId = `r7-client-readiness-${Date.now()}`;
  const outDir = path.join(WORKSPACE_ROOT, "target", "tmp", runId);

  const steps = [
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
      name: "R4 client/kernel audit",
      command: process.execPath,
      args: ["./scripts/r4-client-audit.mjs"],
    },
    {
      name: "Web typecheck",
      command: "pnpm",
      args: ["--filter", "@new-start/web", "typecheck"],
    },
    {
      name: "R7 mobile readiness bundle",
      command: process.execPath,
      args: ["./scripts/r7-mobile-readiness.mjs"],
    },
  ];

  const executedSteps = [];
  for (const step of steps) {
    runStep(step);
    executedSteps.push(step.name);
  }

  await writeSummary({ outDir, steps: executedSteps });
  console.log(`\nR7 client readiness bundle passed: ${outDir}`);
}

main().catch((error) => {
  console.error("R7 client readiness bundle failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
