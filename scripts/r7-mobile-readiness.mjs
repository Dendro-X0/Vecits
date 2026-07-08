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
  console.log(`\n[r7-mobile-readiness] ${name}`);
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
    notes: [
      "Android scaffold smoke is required on all hosts.",
      "iOS scaffold smoke is optional and skipped when gen/ios is absent (macOS host only).",
    ],
  };
  const outPath = path.join(outDir, "mobile-readiness-summary.json");
  await fs.writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function iosScaffoldPresent() {
  const iosDir = path.join(WORKSPACE_ROOT, "apps/desktop/src-tauri/gen/ios");
  try {
    await fs.access(iosDir);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const runId = `r7-mobile-readiness-${Date.now()}`;
  const outDir = path.join(WORKSPACE_ROOT, "target", "tmp", runId);

  const steps = [
    {
      name: "R7-M1 Android scaffold smoke",
      command: process.execPath,
      args: ["./scripts/r7-mobile-scaffold-smoke.mjs"],
    },
    {
      name: "R7-M2 remote pinned node wiring smoke",
      command: process.execPath,
      args: ["./scripts/r7-m2-remote-node-smoke.mjs"],
    },
    {
      name: "R7-M2 iOS command wrapper dry-run (env injection)",
      command: process.execPath,
      args: [
        "./scripts/r7-mobile-ios-command.mjs",
        "dev",
        "--dry-run",
        "--pinned-node-url",
        "https://node.example.com",
      ],
    },
    {
      name: "R7-M2 Android command wrapper dry-run (env injection)",
      command: process.execPath,
      args: [
        "./scripts/r7-mobile-android-command.mjs",
        "dev",
        "--dry-run",
        "--pinned-node-url",
        "http://10.0.2.2:7878",
      ],
    },
  ];

  if (await iosScaffoldPresent()) {
    steps.push({
      name: "R7-M1 iOS scaffold smoke",
      command: process.execPath,
      args: ["./scripts/r7-ios-scaffold-smoke.mjs"],
    });
  } else {
    console.log("\n[r7-mobile-readiness] skipping iOS scaffold smoke (gen/ios not present on this host)");
  }

  const executedSteps = [];
  for (const step of steps) {
    runStep(step);
    executedSteps.push(step.name);
  }

  await writeSummary({ outDir, steps: executedSteps });
  console.log(`\nR7 mobile readiness bundle passed: ${outDir}`);
}

main().catch((error) => {
  console.error("R7 mobile readiness bundle failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
