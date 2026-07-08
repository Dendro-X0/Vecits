#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exportEvidence, parseEvidenceExportArgs } from "./r2-evidence-export.mjs";
import { runRestoreDrill } from "./r2-restore-drill.mjs";
import { verifyExchangeClosed } from "./lib/r2-exchange-core.mjs";
import {
  choosePort,
  fetchJson,
  stopProcess,
  waitForNode,
} from "./lib/ga6-drill-core.mjs";
import { createReleaseRunners, resolveReleaseBinary } from "./lib/release-binary.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage:
  node ./scripts/r6-post-deployment-phase-c-packet.mjs [options]

Required (field proof):
  --data-dir <path>         Persistent node data directory
  --lane <id>               Community artifact lane id
  --order-id <id>           Closed order id from human exchange
  --buyer-pubkey <hex>      Buyer Ed25519 public key
  --provider-pubkey <hex>   Provider Ed25519 public key

Optional:
  --base-url <url>          Running node base URL (spawns ephemeral node if omitted)
  --as-of <RFC3339>         Replay as-of (inferred from events.log if omitted)
  --offer-id <id>           Offer id for operator notes
  --no-build                Skip release binary rebuild
  --no-archive              Skip archive copy under target/r2-evidence-archive
  --smoke                   Maintainer smoke: resolve context from latest solo drill
  --help                    Show help

Examples:
  pnpm r6:post-deployment:phase-c:packet -- --data-dir ./vectis-data-r6-docs --lane documentation --order-id <id> --buyer-pubkey <hex> --provider-pubkey <hex> --base-url http://127.0.0.1:7878
  pnpm r6:post-deployment:phase-c:smoke
`);
}

export function parsePhaseCPacketArgs(argv) {
  const exportArgs = parseEvidenceExportArgs(argv);
  const result = {
    ...exportArgs,
    lane: "",
    orderId: "",
    buyerPubKey: "",
    providerPubKey: "",
    offerId: "",
    smoke: argv.includes("--smoke"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--lane") {
      result.lane = argv[++index] ?? "";
      continue;
    }
    if (arg === "--order-id") {
      result.orderId = argv[++index] ?? "";
      continue;
    }
    if (arg === "--buyer-pubkey") {
      result.buyerPubKey = argv[++index] ?? "";
      continue;
    }
    if (arg === "--provider-pubkey") {
      result.providerPubKey = argv[++index] ?? "";
      continue;
    }
    if (arg === "--offer-id") {
      result.offerId = argv[++index] ?? "";
    }
  }

  return result;
}

async function assertManifest(dataDir) {
  try {
    await fs.access(path.join(dataDir, "manifest.json"));
  } catch {
    throw new Error(`missing manifest.json in data dir: ${dataDir}`);
  }
}

async function findLatestDrillSummary(lane = "") {
  const tmpRoot = path.join(WORKSPACE_ROOT, "target", "tmp");
  let entries;
  try {
    entries = await fs.readdir(tmpRoot);
  } catch {
    return null;
  }

  const candidates = entries
    .filter(name => name.startsWith("r2-exchange-"))
    .sort()
    .reverse();

  for (const name of candidates) {
    const summaryPath = path.join(tmpRoot, name, "exchange-summary.json");
    try {
      const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
      if (!summary.passed) {
        continue;
      }
      if (lane && summary.lane !== lane) {
        continue;
      }
      if (!summary.dataDir || !summary.orderId) {
        continue;
      }
      return summary;
    } catch {
      // try next
    }
  }

  return null;
}

async function resolveSmokeContext(args) {
  const summary = await findLatestDrillSummary("documentation");
  if (!summary) {
    throw new Error(
      "no drill exchange summary found; run pnpm r6:post-deployment:drill -- --lane documentation --no-build first",
    );
  }

  args.dataDir = path.join(WORKSPACE_ROOT, "vectis-data-r6-pd-documentation");
  args.lane = summary.lane;
  args.orderId = summary.orderId;
  args.offerId = summary.offerId ?? "";
  args.buyerPubKey = summary.buyerPubKey ?? "";
  args.providerPubKey = summary.providerPubKey ?? "";
  args.asOf = args.asOf || summary.asOf;
  args.baseUrl = "";
  args.smoke = true;
}

function assertRequiredFields(args) {
  const missing = [];
  if (!args.lane) missing.push("--lane");
  if (!args.orderId) missing.push("--order-id");
  if (!args.buyerPubKey) missing.push("--buyer-pubkey");
  if (!args.providerPubKey) missing.push("--provider-pubkey");
  if (missing.length > 0) {
    throw new Error(`missing required arguments: ${missing.join(", ")}`);
  }
}

async function withNodeBaseUrl(args, fn) {
  if (args.baseUrl) {
    return fn(args.baseUrl);
  }

  const binary = await resolveReleaseBinary(WORKSPACE_ROOT, {
    buildIfMissing: !args.skipBuild,
  });
  const { spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binary);
  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serve = spawnNodeServe(args.dataDir, port, []);
  try {
    await waitForNode(baseUrl, 45_000);
    return await fn(baseUrl);
  } finally {
    await stopProcess(serve);
  }
}

async function writeR6PdOperatorNotes(outDir, context) {
  const notes = `# R6-PD Phase C operator notes

- exported at: ${context.exportedAt}
- proof band: R6-PD-C (human counterparty field proof)
- smoke mode: ${context.smoke ? "yes (maintainer drill replay — not a field proof)" : "no"}
- deployment host: ${context.baseUrl ?? "local operator node"}
- data directory: ${context.dataDir}
- community lane: ${context.lane}
- buyer pubkey: ${context.buyerPubKey}
- provider pubkey: ${context.providerPubKey}
- offer id: ${context.offerId || "see events.log"}
- order id: ${context.orderId}
- milestone outcome: accepted (order closed)
- replay state hash: ${context.replayStateHash}
- as-of: ${context.asOf}
- health status: ${context.healthStatus ?? "not captured"}
- notes: exportable evidence packet for post-deployment community lane proof
`;
  await fs.writeFile(path.join(outDir, "r6-pd-operator-notes.md"), notes);
}

async function copyDirFlat(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const name of await fs.readdir(src)) {
    await fs.copyFile(path.join(src, name), path.join(dest, name));
  }
}

export async function runPhaseCPacket(rawArgv = process.argv.slice(2)) {
  const argv = rawArgv.filter(arg => arg !== "--help" && arg !== "-h");
  if (rawArgv.includes("--help") || rawArgv.includes("-h")) {
    usage();
    return { passed: true, help: true };
  }

  const args = parsePhaseCPacketArgs(argv);
  if (args.smoke) {
    await resolveSmokeContext(args);
  }

  assertRequiredFields(args);
  await assertManifest(args.dataDir);

  await withNodeBaseUrl(args, async baseUrl => {
    args.baseUrl = baseUrl;
    await verifyExchangeClosed(baseUrl, args.orderId, args.asOf);
    await fetchJson(`${baseUrl.replace(/\/+$/, "")}/health`);
  });

  const exportSummary = await exportEvidence(args);
  const evidenceDir = exportSummary.outDir;
  const restoreSummary = await runRestoreDrill(evidenceDir, exportSummary.asOf);

  await writeR6PdOperatorNotes(evidenceDir, {
    exportedAt: exportSummary.exportedAt,
    smoke: args.smoke,
    baseUrl: args.baseUrl,
    dataDir: args.dataDir,
    lane: args.lane,
    buyerPubKey: args.buyerPubKey,
    providerPubKey: args.providerPubKey,
    offerId: args.offerId,
    orderId: args.orderId,
    replayStateHash: exportSummary.replayStateHash,
    asOf: exportSummary.asOf,
    healthStatus: exportSummary.healthStatus,
  });

  let archiveDir = null;
  if (args.archive) {
    archiveDir = path.join(
      WORKSPACE_ROOT,
      "target",
      "r6-pd-evidence-archive",
      path.basename(evidenceDir),
    );
    await copyDirFlat(evidenceDir, archiveDir);
    await fs.copyFile(
      path.join(evidenceDir, "r6-pd-operator-notes.md"),
      path.join(archiveDir, "r6-pd-operator-notes.md"),
    );
  }

  const phaseSummary = {
    passed: true,
    completedAt: new Date().toISOString(),
    band: "R6-PD-C",
    smoke: args.smoke,
    lane: args.lane,
    orderId: args.orderId,
    offerId: args.offerId || null,
    buyerPubKey: args.buyerPubKey,
    providerPubKey: args.providerPubKey,
    dataDir: args.dataDir,
    baseUrl: args.baseUrl,
    asOf: exportSummary.asOf,
    evidenceDir,
    archiveDir,
    export: exportSummary,
    restore: restoreSummary,
  };

  await fs.writeFile(
    path.join(evidenceDir, "r6-pd-phase-c-summary.json"),
    `${JSON.stringify(phaseSummary, null, 2)}\n`,
  );
  if (archiveDir) {
    await fs.writeFile(
      path.join(archiveDir, "r6-pd-phase-c-summary.json"),
      `${JSON.stringify(phaseSummary, null, 2)}\n`,
    );
  }

  return phaseSummary;
}

async function main() {
  const summary = await runPhaseCPacket(process.argv.slice(2));
  if (summary.help) {
    return;
  }

  console.log("R6-PD Phase C evidence packet complete.");
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error("R6-PD Phase C packet failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
