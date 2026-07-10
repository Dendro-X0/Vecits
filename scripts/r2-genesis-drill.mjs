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
  buildR2GenesisBootstrap,
  submitEventsViaHttp,
  verifyGenesisOfferLive,
  verifyPreVouchOfferBlocked,
} from "./lib/r2-genesis-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { DATA_DIRS } from "./lib/data-dirs.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    dataDir: DATA_DIRS.r2Genesis,
    baseUrl: "",
    baseDate: "2026-07-02",
    skipBuild: argv.includes("--no-build"),
    exportEvidence: argv.includes("--export-evidence"),
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

async function writeOperatorNotes(outDir, summary) {
  const notes = `# R2 genesis operator notes

- deployment host: local operator node (${summary.baseUrl})
- network phase: founding (SCN-17 bootstrap)
- provider eligibility threshold: 2
- founding sponsor A: ${summary.sponsorPubKeys[0]}
- founding sponsor B: ${summary.sponsorPubKeys[1]}
- genesis provider: ${summary.providerPubKey}
- offer id: ${summary.offerId}
- pre-vouch offer rejection: replay invalid (trust threshold), offer absent from state
- post-vouch offer status: active (discovery-visible)
- submission path: HTTP POST /events (not fixture ingest)
- run id: ${summary.runId}
- notes: R2 genesis drill completed via npm run r2:genesis-drill
`;
  await fs.writeFile(path.join(outDir, "operator-notes.md"), notes);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `genesis-${Date.now()}`;
  const runDir = path.join(WORKSPACE_ROOT, "target", "tmp", `r2-genesis-${runId}`);
  await fs.mkdir(runDir, { recursive: true });

  const bootstrap = await buildR2GenesisBootstrap(runId, args.baseDate);
  const fixturePath = path.join(runDir, "r2-genesis-events.jsonl");
  const allEvents = [
    ...bootstrap.identities,
    bootstrap.preVouchOffer,
    ...bootstrap.foundingVouches,
    bootstrap.offer,
  ];
  await fs.writeFile(fixturePath, `${allEvents.map(event => JSON.stringify(event)).join("\n")}\n`);
  await fs.writeFile(
    path.join(runDir, "founding-sponsors.json"),
    `${JSON.stringify(bootstrap.foundingSponsors, null, 2)}\n`,
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

  await submitEventsViaHttp(baseUrl, bootstrap.identities);
  await submitEventsViaHttp(baseUrl, [bootstrap.preVouchOffer]);
  const preVouchProof = await verifyPreVouchOfferBlocked(
    baseUrl,
    bootstrap.preVouchOfferId,
    bootstrap.preVouchAsOf,
  );
  await submitEventsViaHttp(baseUrl, bootstrap.foundingVouches);
  await submitEventsViaHttp(baseUrl, [bootstrap.offer]);
  await verifyGenesisOfferLive(baseUrl, bootstrap.offerId, bootstrap.providerPubKey, bootstrap.asOf);

  const health = await fetchJson(`${baseUrl}/health`);
  const summary = {
    passed: true,
    runId,
    lane: bootstrap.lane,
    offerId: bootstrap.offerId,
    providerPubKey: bootstrap.providerPubKey,
    sponsorPubKeys: bootstrap.sponsorPubKeys,
    asOf: bootstrap.asOf,
    dataDir: args.dataDir,
    baseUrl,
    preVouchInvalidEventId: preVouchProof.invalidEvent?.event_id ?? null,
    preVouchInvalidMessage: preVouchProof.invalidEvent?.message ?? null,
    healthStatus: health?.status ?? null,
    fixturePath,
    foundingSponsorsPath: path.join(runDir, "founding-sponsors.json"),
    runDir,
  };

  await fs.writeFile(path.join(runDir, "genesis-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
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
        bootstrap.asOf,
      ],
      { cwd: WORKSPACE_ROOT, encoding: "utf8" },
    );
    if (evidence.status !== 0) {
      throw new Error(evidence.stderr || "r2:evidence-export failed after genesis drill");
    }
    const outMatch = evidence.stdout.match(/r2-evidence-\d+/);
    if (outMatch) {
      summary.evidenceOutDir = path.join(WORKSPACE_ROOT, "target", "tmp", outMatch[0]);
    }
  }

  console.log("R2 genesis drill passed.");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Founding sponsors: ${summary.foundingSponsorsPath}`);
  console.log(`Operator notes: ${path.join(runDir, "operator-notes.md")}`);

  if (serve) {
    await stopProcess(serve);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
