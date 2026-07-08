#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportEvidence, parseEvidenceExportArgs } from "./r2-evidence-export.mjs";
import { runRestoreDrill } from "./r2-restore-drill.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function copyDirFlat(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const name of await fs.readdir(src)) {
    await fs.copyFile(path.join(src, name), path.join(dest, name));
  }
}

async function main() {
  const args = parseEvidenceExportArgs(process.argv.slice(2));
  const exportSummary = await exportEvidence(args);
  const evidenceDir = exportSummary.outDir;

  const restoreSummary = await runRestoreDrill(evidenceDir, exportSummary.asOf);

  let archiveDir = null;
  if (!process.argv.includes("--no-archive")) {
    archiveDir = path.join(
      WORKSPACE_ROOT,
      "target",
      "r2-evidence-archive",
      path.basename(evidenceDir),
    );
    await copyDirFlat(evidenceDir, archiveDir);
  }

  const packSummary = {
    passed: true,
    completedAt: new Date().toISOString(),
    evidenceDir,
    archiveDir,
    export: exportSummary,
    restore: restoreSummary,
    r2Slices: ["R2-P3", "R2-P4"],
    gate: "RDG-3",
  };

  await fs.writeFile(
    path.join(evidenceDir, "evidence-pack-summary.json"),
    `${JSON.stringify(packSummary, null, 2)}\n`,
  );
  if (archiveDir) {
    await fs.writeFile(
      path.join(archiveDir, "evidence-pack-summary.json"),
      `${JSON.stringify(packSummary, null, 2)}\n`,
    );
  }

  console.log("R2-P3/P4 evidence pack complete.");
  console.log(JSON.stringify(packSummary, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
