#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage:
  node ./scripts/v3-aperio-live-drill-determinism.mjs [--live] [--runs 2] [--no-build]

Runs the Aperio live drill twice (no ingest) and asserts the exported
target/tmp/v3-aperio-live-*/vectis-signals.jsonl is byte-identical.
`);
}

function parseArgs(argv) {
  const result = {
    live: false,
    runs: 2,
    skipBuild: argv.includes("--no-build"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--live") {
      result.live = true;
    } else if (arg === "--runs") {
      const value = Number.parseInt(argv[++i] ?? "", 10);
      if (!Number.isFinite(value) || value < 2) {
        throw new Error("--runs must be an integer >= 2");
      }
      result.runs = value;
    }
  }
  return result;
}

async function listSignalFiles() {
  const base = path.join(WORKSPACE_ROOT, "target", "tmp");
  let entries = [];
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return [];
  }
  const rows = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith("v3-aperio-live-")) continue;
    const filePath = path.join(base, entry.name, "vectis-signals.jsonl");
    try {
      const stat = await fs.stat(filePath);
      rows.push({ dir: entry.name, filePath, mtimeMs: stat.mtimeMs });
    } catch {
      // ignore
    }
  }
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return rows;
}

function sha256File(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runOnce({ live, skipBuild }) {
  const args = ["./scripts/v3-aperio-live-drill.mjs"];
  if (live) {
    args.push("--live");
  }
  if (skipBuild) {
    args.push("--no-build");
  }
  args.push("--no-ingest");

  const result = spawnSync(process.execPath, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("aperio live drill failed");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const before = await listSignalFiles();
  const baseline = before[0]?.mtimeMs ?? 0;

  /** @type {{dir: string; filePath: string; hash: string}[]} */
  const runs = [];

  for (let i = 0; i < args.runs; i += 1) {
    runOnce({ live: args.live, skipBuild: args.skipBuild });
    const after = await listSignalFiles();
    const newest = after.find((row) => row.mtimeMs > baseline);
    if (!newest) {
      throw new Error("expected new vectis-signals.jsonl output after drill run");
    }
    const bytes = await fs.readFile(newest.filePath);
    runs.push({ dir: newest.dir, filePath: newest.filePath, hash: sha256File(bytes) });
  }

  const first = runs[0]?.hash;
  const mismatch = runs.find((run) => run.hash !== first);
  if (mismatch) {
    console.error("DB-1 determinism failed: vectis-signals.jsonl differs across runs.");
    for (const run of runs) {
      console.error(`  - ${run.dir}: ${run.hash}`);
    }
    process.exit(1);
  }

  console.log("DB-1 determinism passed.");
  console.log(JSON.stringify({ live: args.live, runs }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

