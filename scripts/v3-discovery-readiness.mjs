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

function runStep({ name, command, args }) {
  console.log(`\n[v3-discovery-readiness] ${name}`);
  console.log(`$ ${formatCommand(command, args)}`);

  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
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
  };
  const outPath = path.join(outDir, "discovery-readiness-summary.json");
  await fs.writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function main() {
  const runId = `v3-discovery-readiness-${Date.now()}`;
  const outDir = path.join(WORKSPACE_ROOT, "target", "tmp", runId);

  const steps = [
    {
      name: "aperio-import smoke",
      command: process.execPath,
      args: ["./scripts/v3-aperio-import.mjs", "--smoke"],
    },
    {
      name: "discovery bridge smoke",
      command: process.execPath,
      args: ["./scripts/v3-discovery-bridge.mjs", "--smoke"],
    },
    {
      name: "discovery bridge e2e",
      command: process.execPath,
      args: ["./scripts/v3-discovery-bridge-e2e.mjs"],
    },
    {
      name: "DB-1 determinism (fixture) guard",
      command: process.execPath,
      args: ["./scripts/v3-aperio-live-drill-determinism.mjs"],
    },
  ];

  const executedSteps = [];
  for (const step of steps) {
    runStep(step);
    executedSteps.push(step.name);
  }

  await writeSummary({ outDir, steps: executedSteps });
  console.log(`\nR3 discovery readiness bundle passed: ${outDir}`);
}

main().catch((error) => {
  console.error("R3 discovery readiness bundle failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

