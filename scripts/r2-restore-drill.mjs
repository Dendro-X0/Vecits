#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { resolveReleaseBinary } from "./lib/release-binary.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function findLatestEvidenceDir() {
  const roots = [
    path.join(WORKSPACE_ROOT, "target", "r2-evidence-archive"),
    path.join(WORKSPACE_ROOT, "target", "tmp"),
  ];
  const candidates = [];
  for (const root of roots) {
    let entries;
    try {
      entries = await fs.readdir(root);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.startsWith("r2-evidence-")) {
        candidates.push(path.join(root, name));
      }
    }
  }
  candidates.sort().reverse();
  for (const dir of candidates) {
    try {
      await fs.access(path.join(dir, "replay-state-hash.txt"));
      return dir;
    } catch {
      // skip
    }
  }
  return "";
}

async function readEvidenceAsOf(evidenceDir, fallbackAsOf) {
  try {
    const summary = JSON.parse(
      await fs.readFile(path.join(evidenceDir, "evidence-summary.json"), "utf8"),
    );
    if (summary.asOf) {
      return summary.asOf;
    }
  } catch {
    // fall back
  }
  return fallbackAsOf;
}

function parseArgs(argv) {
  const result = { evidenceDir: "", asOf: "2026-07-02T00:15:00Z" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--evidence") result.evidenceDir = path.resolve(argv[++i]);
    else if (argv[i] === "--as-of") result.asOf = argv[++i];
  }
  return result;
}

export async function runRestoreDrill(evidenceDir, asOfOverride) {
  const asOf = await readEvidenceAsOf(evidenceDir, asOfOverride);
  const binary = await resolveReleaseBinary(WORKSPACE_ROOT, { buildIfMissing: true });
  const restoreRoot = path.join(
    WORKSPACE_ROOT,
    "target",
    "tmp",
    `r2-restore-drill-${Date.now()}`,
  );
  const restoredDir = path.join(restoreRoot, "restored-data");
  await fs.mkdir(restoredDir, { recursive: true });

  const sourceEvents = path.join(evidenceDir, "events.log");
  const expectedHashPath = path.join(evidenceDir, "replay-state-hash.txt");
  const expectedHash = (await fs.readFile(expectedHashPath, "utf8")).trim();

  runBinary(binary, ["node", "init", "--data-dir", restoredDir]);
  await fs.copyFile(sourceEvents, path.join(restoredDir, "events.log"));

  const replayOut = path.join(restoreRoot, "replay-state.json");
  runBinary(binary, ["log", "replay", "--in", sourceEvents, "--out", replayOut, "--as-of", asOf]);
  const replayJson = JSON.parse(await fs.readFile(replayOut, "utf8"));
  const actualHash = createHash("sha256")
    .update(JSON.stringify(replayJson))
    .digest("hex");

  if (actualHash !== expectedHash) {
    throw new Error(
      `RDG-3 failed: replay hash mismatch\nexpected ${expectedHash}\nactual   ${actualHash}`,
    );
  }

  runBinary(binary, ["node", "db", "inspect", "--data-dir", restoredDir]);

  const summary = {
    passed: true,
    evidenceDir,
    restoredDir,
    replayStateHash: actualHash,
    asOf,
  };
  await fs.writeFile(
    path.join(restoreRoot, "restore-drill-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(evidenceDir, "restore-drill-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  return summary;
}

function runBinary(binary, args) {
  const result = spawnSync(binary, args, {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`command failed: ${binary} ${args.join(" ")}`);
  }
  return result.stdout;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let evidenceDir = args.evidenceDir;
  if (!evidenceDir) {
    evidenceDir = await findLatestEvidenceDir();
  }
  if (!evidenceDir) {
    throw new Error(
      "usage: node scripts/r2-restore-drill.mjs [--evidence <r2-evidence-dir>]\n" +
        "Run npm run r2:evidence-export first, or pass --evidence explicitly.",
    );
  }

  const summary = await runRestoreDrill(evidenceDir, args.asOf);
  console.log("R2 restore drill passed (RDG-3).");
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
