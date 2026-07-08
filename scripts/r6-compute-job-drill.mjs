#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  choosePort,
  fetchJson,
  stopProcess,
  waitForNode,
} from "./lib/ga6-drill-core.mjs";
import { submitEventsViaHttp, verifyExchangeClosed } from "./lib/r2-exchange-core.mjs";
import { buildR6ComputeJobExchangeEvents } from "./lib/r6-compute-job-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    dataDir: path.join(WORKSPACE_ROOT, "vectis-data-r6"),
    baseUrl: "",
    baseDate: "2026-07-02",
    skipBuild: argv.includes("--no-build"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (arg === "--base-url") result.baseUrl = argv[++i];
    else if (arg === "--base-date") result.baseDate = argv[++i];
  }
  return result;
}

async function resolveNodeBinary(skipBuild) {
  try {
    return await resolveReleaseBinary(WORKSPACE_ROOT, { buildIfMissing: !skipBuild });
  } catch {
    const fallback =
      process.platform === "win32"
        ? path.join(WORKSPACE_ROOT, "target", "release", "vectis-node.exe")
        : path.join(WORKSPACE_ROOT, "target", "release", "vectis-node");
    await fs.access(fallback);
    return fallback;
  }
}

async function writeReceiptArtifacts(runDir, receiptBundle) {
  const receiptDir = path.join(runDir, "receipt");
  await fs.mkdir(receiptDir, { recursive: true });
  await fs.writeFile(
    path.join(receiptDir, "job-receipt-v1.json"),
    `${receiptBundle.canonicalReceipt}\n`,
  );
  await fs.writeFile(
    path.join(receiptDir, "job-receipt-v1.sha256"),
    `${receiptBundle.receiptHash}\n`,
  );
  await fs.writeFile(
    path.join(receiptDir, "job-receipt-v1-notes.sha256"),
    `${receiptBundle.notesHash}\n`,
  );
  await fs.writeFile(
    path.join(receiptDir, "job-receipt-v1-delivery-hints.json"),
    `${JSON.stringify(receiptBundle.deliveryHints, null, 2)}\n`,
  );
  return receiptDir;
}

async function writeOperatorNotes(outDir, summary) {
  const notes = `# R6 compute-job operator notes

- deployment host: local operator node (${summary.baseUrl})
- exchange lane: ${summary.lane}
- buyer: ${summary.buyerPubKey}
- provider: ${summary.providerPubKey}
- offer id: ${summary.offerId}
- order id: ${summary.orderId}
- job id: ${summary.jobId}
- evidence format: job-receipt-v1
- milestone outcome: accepted (order closed)
- submission path: HTTP POST /events (not fixture ingest)
- run id: ${summary.runId}
- receipt artifacts: ${summary.receiptDir}
- notes: R6-L1 compute-job lane drill completed via npm run r6:compute-job:drill
`;
  await fs.writeFile(path.join(outDir, "operator-notes.md"), notes);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `cj-${Date.now()}`;
  const runDir = path.join(WORKSPACE_ROOT, "target", "tmp", `r6-compute-job-${runId}`);
  await fs.mkdir(runDir, { recursive: true });

  const exchange = await buildR6ComputeJobExchangeEvents(runId, args.baseDate);
  const receiptDir = await writeReceiptArtifacts(runDir, exchange.receiptBundle);

  const fixturePath = path.join(runDir, "r6-compute-job-events.jsonl");
  await fs.writeFile(
    fixturePath,
    `${exchange.events.map((event) => JSON.stringify(event)).join("\n")}\n`,
  );

  const binaryPath = await resolveNodeBinary(args.skipBuild);
  const { runCli, spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);
  const commandLog = [];

  try {
    await fs.access(path.join(args.dataDir, "manifest.json"));
  } catch {
    runCli(["node", "init", "--data-dir", args.dataDir], commandLog);
  }

  let baseUrl = args.baseUrl;
  let serve = null;
  if (!baseUrl) {
    const port = await choosePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serve = spawnNodeServe(args.dataDir, port, commandLog);
    await waitForNode(baseUrl, 45_000);
  }

  const ingestResults = await submitEventsViaHttp(baseUrl, exchange.events);
  await verifyExchangeClosed(baseUrl, exchange.orderId, exchange.asOf);

  const health = await fetchJson(`${baseUrl}/health`);
  const summary = {
    passed: true,
    runId,
    lane: exchange.lane,
    offerId: exchange.offerId,
    orderId: exchange.orderId,
    jobId: exchange.jobId,
    buyerPubKey: exchange.buyerPubKey,
    providerPubKey: exchange.providerPubKey,
    asOf: exchange.asOf,
    dataDir: args.dataDir,
    baseUrl,
    eventCount: exchange.events.length,
    acceptedCount: ingestResults.length,
    healthStatus: health?.status ?? null,
    fixturePath,
    receiptDir,
    runDir,
    deliveryHints: exchange.receiptBundle.deliveryHints,
  };

  await fs.writeFile(
    path.join(runDir, "exchange-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await writeOperatorNotes(runDir, summary);

  console.log("R6-L1 compute-job drill passed.");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Operator notes: ${path.join(runDir, "operator-notes.md")}`);

  if (serve) {
    await stopProcess(serve);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
