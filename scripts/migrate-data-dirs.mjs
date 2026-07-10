#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

import { DATA_ROOT, WORKSPACE_ROOT, dataDir } from "./lib/data-dirs.mjs";

/** Legacy root directory name → `.data/` subdirectory. */
const LEGACY_MAP = new Map([
  ["vectis-data", "default"],
  ["vectis-data-dev", "dev"],
  ["vectis-data-r2", "r2"],
  ["vectis-data-r2-genesis", "r2-genesis"],
  ["vectis-data-r6", "r6"],
  ["vectis-data-r6-l2", "r6-l2"],
  ["vectis-data-r6-test", "r6-test"],
  ["vectis-data-r6-docs-test", "r6-docs-test"],
  ["vectis-data-r6-pd-documentation", "r6-pd-documentation"],
  ["vectis-data-source", "source"],
  ["vectis-data-sink", "sink"],
]);

const LEGACY_PD_PREFIX = "vectis-data-r6-pd-";

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function dirHasNodeData(dir) {
  for (const name of ["events.log", "node.db", "manifest.json"]) {
    if (await pathExists(path.join(dir, name))) {
      return true;
    }
  }
  return false;
}

async function listLegacyRootDirs() {
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vectis-data"))
    .map((entry) => entry.name)
    .sort();
}

function targetNameForLegacy(legacyName) {
  if (LEGACY_MAP.has(legacyName)) {
    return LEGACY_MAP.get(legacyName);
  }
  if (legacyName.startsWith(LEGACY_PD_PREFIX)) {
    return `r6-pd-${legacyName.slice(LEGACY_PD_PREFIX.length)}`;
  }
  return null;
}

async function migrateOne(legacyName, { dryRun = false, force = false } = {}) {
  const targetName = targetNameForLegacy(legacyName);
  if (!targetName) {
    return { legacyName, status: "skipped", reason: "no mapping" };
  }

  const source = path.join(WORKSPACE_ROOT, legacyName);
  const target = dataDir(targetName);

  if (!(await pathExists(source))) {
    return { legacyName, status: "skipped", reason: "source missing" };
  }

  const sourceHasData = await dirHasNodeData(source);
  const targetExists = await pathExists(target);
  const targetHasData = targetExists ? await dirHasNodeData(target) : false;

  if (targetExists && targetHasData && !force) {
    return {
      legacyName,
      status: "skipped",
      reason: `target already has data (${target})`,
    };
  }

  if (targetExists && !targetHasData) {
    if (!dryRun) {
      await fs.rm(target, { recursive: true, force: true });
    }
  } else if (targetExists && force) {
    if (!dryRun) {
      await fs.rm(target, { recursive: true, force: true });
    }
  }

  if (!dryRun) {
    await fs.mkdir(DATA_ROOT, { recursive: true });
    await fs.rename(source, target);
  }

  return {
    legacyName,
    status: dryRun ? "would-move" : "moved",
    target: path.relative(WORKSPACE_ROOT, target),
    hadData: sourceHasData,
  };
}

function usage() {
  console.log(`Usage:
  node ./scripts/migrate-data-dirs.mjs [--dry-run] [--force] [--list]

Moves legacy root-level vectis-data* directories into .data/<name>/.
Safe by default: skips when the target already contains node data.
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const listOnly = args.includes("--list");

  const legacyDirs = await listLegacyRootDirs();

  if (listOnly) {
    for (const legacyName of legacyDirs) {
      const targetName = targetNameForLegacy(legacyName);
      console.log(`${legacyName} → .data/${targetName ?? "?"}`);
    }
    if (legacyDirs.length === 0) {
      console.log("No legacy vectis-data* directories at repo root.");
    }
    return;
  }

  if (legacyDirs.length === 0) {
    console.log("No legacy vectis-data* directories at repo root.");
    return;
  }

  await fs.mkdir(DATA_ROOT, { recursive: true });

  const results = [];
  for (const legacyName of legacyDirs) {
    results.push(await migrateOne(legacyName, { dryRun, force }));
  }

  const moved = results.filter((item) => item.status === "moved" || item.status === "would-move");
  const skipped = results.filter((item) => item.status === "skipped");

  for (const item of moved) {
    console.log(
      `${dryRun ? "[dry-run] " : ""}${item.legacyName} → ${item.target}${item.hadData ? "" : " (empty)"}`,
    );
  }
  for (const item of skipped) {
    console.log(`skip ${item.legacyName}: ${item.reason}`);
  }

  console.log(
    `\n${dryRun ? "Would move" : "Moved"} ${moved.length}, skipped ${skipped.length}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
