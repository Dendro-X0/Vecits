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
import {
  ALLOWED_LANES,
  buildR2ExchangeEvents,
  R2_KEYS,
  submitEventsViaHttp,
  verifyExchangeClosed,
} from "./lib/r2-exchange-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { DATA_DIRS } from "./lib/data-dirs.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    lane: "project-maintenance",
    dataDir: DATA_DIRS.r2,
    baseUrl: "",
    baseDate: "2026-07-02",
    skipBuild: argv.includes("--no-build"),
    exportEvidence: argv.includes("--export-evidence"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--lane") result.lane = argv[++i];
    else if (arg === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (arg === "--base-url") result.baseUrl = argv[++i];
    else if (arg === "--base-date") result.baseDate = argv[++i];
  }
  if (!ALLOWED_LANES.includes(result.lane)) {
    throw new Error(`--lane must be one of: ${ALLOWED_LANES.join(", ")}`);
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

async function writeOperatorNotes(outDir, summary) {
  const notes = `# R2 operator notes

- deployment host: local operator node (${summary.baseUrl})
- exchange lane: ${summary.lane}
- buyer (operator): ${summary.buyerPubKey}
- provider (counterparty): ${summary.providerPubKey}
- offer id: ${summary.offerId}
- order id: ${summary.orderId}
- milestone outcome: accepted (order closed)
- submission path: HTTP POST /events (not fixture ingest)
- run id: ${summary.runId}
- notes: R2-P2 exchange drill completed via npm run r2:exchange-drill
`;
  await fs.writeFile(path.join(outDir, "operator-notes.md"), notes);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `p2-${Date.now()}`;
  const runDir = path.join(WORKSPACE_ROOT, "target", "tmp", `r2-exchange-${runId}`);
  await fs.mkdir(runDir, { recursive: true });

  const exchange = await buildR2ExchangeEvents(args.lane, runId, args.baseDate);
  const fixturePath = path.join(runDir, "r2-exchange-events.jsonl");
  await fs.writeFile(
    fixturePath,
    `${exchange.events.map(event => JSON.stringify(event)).join("\n")}\n`,
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
    buyerPubKey: exchange.buyerPubKey,
    providerPubKey: exchange.providerPubKey,
    asOf: exchange.asOf,
    dataDir: args.dataDir,
    baseUrl,
    eventCount: exchange.events.length,
    acceptedCount: ingestResults.length,
    healthStatus: health?.status ?? null,
    fixturePath,
    runDir,
    counterpartyKeys: {
      providerSecretEnv: "R2_PROVIDER_SECRET",
      note: "Default drill keys are in scripts/lib/r2-exchange-core.mjs for reproducibility.",
    },
  };

  await fs.writeFile(
    path.join(runDir, "exchange-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await writeOperatorNotes(runDir, summary);

  if (args.exportEvidence) {
    const { spawnSync } = await import("node:child_process");
    const evidence = spawnSync(
      process.execPath,
      [
        path.join(WORKSPACE_ROOT, "scripts/r2-evidence-export.mjs"),
        "--data-dir",
        args.dataDir,
        "--base-url",
        baseUrl,
        "--as-of",
        exchange.asOf,
      ],
      { cwd: WORKSPACE_ROOT, encoding: "utf8" },
    );
    if (evidence.status !== 0) {
      throw new Error(evidence.stderr || "r2:evidence-export failed after exchange drill");
    }
    const outMatch = evidence.stdout.match(/r2-evidence-\d+/);
    if (outMatch) {
      summary.evidenceOutDir = path.join(WORKSPACE_ROOT, "target", "tmp", outMatch[0]);
    }
  }

  console.log("R2-P2 exchange drill passed.");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Operator notes: ${path.join(runDir, "operator-notes.md")}`);

  if (serve) {
    await stopProcess(serve);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
