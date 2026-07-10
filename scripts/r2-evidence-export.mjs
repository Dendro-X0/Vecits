#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findLatestExchangeSummary,
  inferAsOfFromEventsLog,
  writeEvidenceManifest,
  writeOperatorNotes,
} from "./lib/r2-evidence-core.mjs";
import {
  choosePort,
  fetchJson,
  stopProcess,
  waitForNode,
} from "./lib/ga6-drill-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { DATA_DIRS } from "./lib/data-dirs.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseEvidenceExportArgs(argv) {
  const result = {
    dataDir: DATA_DIRS.r2,
    outDir: "",
    baseUrl: "",
    asOf: "",
    skipBuild: argv.includes("--no-build"),
    archive: !argv.includes("--no-archive"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (arg === "--out") result.outDir = path.resolve(argv[++i]);
    else if (arg === "--base-url") result.baseUrl = argv[++i];
    else if (arg === "--as-of") result.asOf = argv[++i];
  }
  if (!result.outDir) {
    result.outDir = path.join(
      WORKSPACE_ROOT,
      "target",
      "tmp",
      `r2-evidence-${Date.now()}`,
    );
  }
  return result;
}

function runBinary(binary, args) {
  const result = spawnSync(binary, args, {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(`command failed: ${binary} ${args.join(" ")}\n${detail}`);
  }
  return result.stdout;
}

async function copyIfExists(src, dest) {
  try {
    await fs.copyFile(src, dest);
    return true;
  } catch {
    return false;
  }
}

async function ensureHealthCapture(args, binary) {
  if (args.baseUrl) {
    try {
      return await fetchJson(`${args.baseUrl}/health`);
    } catch {
      // fall through to spawn
    }
  }

  const binaryPath = binary;
  const { spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);
  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serve = spawnNodeServe(args.dataDir, port, []);
  try {
    await waitForNode(baseUrl, 45_000);
    args.baseUrl = baseUrl;
    return await fetchJson(`${baseUrl}/health`);
  } finally {
    await stopProcess(serve);
  }
}

export async function exportEvidence(args) {
  const binary = await resolveReleaseBinary(WORKSPACE_ROOT, {
    buildIfMissing: !args.skipBuild,
  });
  await fs.mkdir(args.outDir, { recursive: true });

  const eventsLog = path.join(args.dataDir, "events.log");
  if (!args.asOf) {
    args.asOf = await inferAsOfFromEventsLog(eventsLog);
  }

  const snapshotOut = path.join(args.outDir, "snapshot.json");
  const replayOut = path.join(args.outDir, "replay-state.json");
  const dbInspectOut = path.join(args.outDir, "db-inspect.json");

  const copiedFiles = [];
  for (const name of ["events.log", "manifest.json", "peers.json"]) {
    if (await copyIfExists(path.join(args.dataDir, name), path.join(args.outDir, name))) {
      copiedFiles.push(name);
    }
  }

  runBinary(binary, [
    "node",
    "snapshot",
    "create",
    "--data-dir",
    args.dataDir,
    "--as-of",
    args.asOf,
    "--out",
    snapshotOut,
  ]);
  copiedFiles.push("snapshot.json");

  const dbInspect = runBinary(binary, ["node", "db", "inspect", "--data-dir", args.dataDir]);
  await fs.writeFile(dbInspectOut, dbInspect);
  copiedFiles.push("db-inspect.json");

  runBinary(binary, [
    "log",
    "replay",
    "--in",
    eventsLog,
    "--out",
    replayOut,
    "--as-of",
    args.asOf,
  ]);
  copiedFiles.push("replay-state.json");

  let health = null;
  try {
    health = await ensureHealthCapture(args, binary);
    await fs.writeFile(
      path.join(args.outDir, "health.json"),
      `${JSON.stringify(health, null, 2)}\n`,
    );
    copiedFiles.push("health.json");
  } catch {
    // health optional if node cannot start
  }

  const replayJson = JSON.parse(await fs.readFile(replayOut, "utf8"));
  const stateHash = createHash("sha256")
    .update(JSON.stringify(replayJson))
    .digest("hex");
  await fs.writeFile(path.join(args.outDir, "replay-state-hash.txt"), `${stateHash}\n`);
  copiedFiles.push("replay-state-hash.txt");

  const exchange = await findLatestExchangeSummary(WORKSPACE_ROOT);
  const exportedAt = new Date().toISOString();
  await writeOperatorNotes(args.outDir, {
    exportedAt,
    dataDir: args.dataDir,
    deploymentHost: args.baseUrl ?? "local",
    exchangeSummary: exchange?.summary,
    replayStateHash: stateHash,
    asOf: args.asOf,
    healthStatus: health?.status ?? null,
  });
  copiedFiles.push("operator-notes.md");

  const summary = {
    exportedAt,
    dataDir: args.dataDir,
    asOf: args.asOf,
    binary,
    replayStateHash: stateHash,
    healthStatus: health?.status ?? null,
    outDir: args.outDir,
    exchangeRunId: exchange?.summary?.runId ?? null,
  };
  await fs.writeFile(
    path.join(args.outDir, "evidence-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  copiedFiles.push("evidence-summary.json");

  await writeEvidenceManifest(
    args.outDir,
    copiedFiles.map(name => ({ name, path: name })),
  );

  return summary;
}

async function main() {
  const args = parseEvidenceExportArgs(process.argv.slice(2));
  const summary = await exportEvidence(args);
  console.log(`R2 evidence exported to ${args.outDir}`);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
