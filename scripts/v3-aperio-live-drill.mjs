#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDiscoverConfig,
  runAperioDiscover,
  summarizeDiscoverRun,
} from "./lib/aperio-engine-launcher.mjs";
import { parseAperioDiscoverJsonl } from "./lib/discovery-bridge/aperio-import.mjs";
import { buildOfferEventsFromDraft } from "./lib/discovery-bridge/bootstrap-offer-events.mjs";
import { signalsToOfferDrafts } from "./lib/discovery-bridge/offer-draft.mjs";
import { validateOfferDraft } from "./lib/discovery-bridge/validate-draft.mjs";
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
import { submitEventsViaHttp } from "./lib/r2-genesis-core.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FIXTURE_CONFIG = path.join(
  WORKSPACE_ROOT,
  "scripts",
  "fixtures",
  "aperio-discover-vectis.fixture.json",
);
const LIVE_CONFIG = path.join(
  WORKSPACE_ROOT,
  "scripts",
  "fixtures",
  "aperio-discover-vectis.example.json",
);

function parseArgs(argv) {
  const result = {
    mode: "fixture",
    configPath: DEFAULT_FIXTURE_CONFIG,
    ingest: true,
    skipBuild: argv.includes("--no-build"),
    aperioBinary: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--live") {
      result.mode = "live";
      result.configPath = LIVE_CONFIG;
    } else if (arg === "--fixture") {
      result.mode = "fixture";
      result.configPath = DEFAULT_FIXTURE_CONFIG;
    } else if (arg === "--no-ingest") {
      result.ingest = false;
    } else if (arg === "--config") {
      result.configPath = path.resolve(argv[++i]);
    } else if (arg === "--aperio-bin") {
      result.aperioBinary = argv[++i];
    }
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

function pickReviewDraft(drafts) {
  const maintenance = drafts.find(draft => draft.payload.serviceType === "project-maintenance");
  return maintenance ?? drafts[0] ?? null;
}

async function writeReviewQueue(runDir, drafts) {
  const reviewPath = path.join(runDir, "review-queue.jsonl");
  const rows = drafts.map(draft => ({
    draftKind: draft.draftKind,
    serviceType: draft.payload.serviceType,
    title: draft.payload.title,
    signalId: draft.provenance.signalId,
    dedupeKey: draft.provenance.dedupeKey,
    sourceUrl: draft.provenance.sourceUrl,
    reviewStatus: "pending",
  }));
  await fs.writeFile(reviewPath, `${rows.map(row => JSON.stringify(row)).join("\n")}\n`);
  return reviewPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `aperio-${Date.now()}`;
  const runDir = path.join(WORKSPACE_ROOT, "target", "tmp", `v3-aperio-live-${runId}`);
  await fs.mkdir(runDir, { recursive: true });

  const config = await loadDiscoverConfig(args.configPath);
  const discover = runAperioDiscover(config, { binaryPath: args.aperioBinary || undefined });
  const discoverPath = path.join(runDir, "aperio-discover.jsonl");
  await fs.writeFile(discoverPath, `${discover.lines.join("\n")}\n`);

  const runSummary = summarizeDiscoverRun(discover.lines);
  if (runSummary.keptSignals < 1) {
    throw new Error(`expected at least one kept discovery signal, got ${runSummary.keptSignals}`);
  }

  const imported = parseAperioDiscoverJsonl(discover.lines);
  const drafts = signalsToOfferDrafts(imported);
  for (const draft of drafts) {
    validateOfferDraft(draft);
  }
  if (drafts.length < 1) {
    throw new Error("expected at least one offer draft after import");
  }

  const signalsPath = path.join(runDir, "vectis-signals.jsonl");
  const draftsPath = path.join(runDir, "offer-drafts.jsonl");
  await fs.writeFile(
    signalsPath,
    `${imported.map(signal => JSON.stringify(signal)).join("\n")}\n`,
  );
  await fs.writeFile(draftsPath, `${drafts.map(draft => JSON.stringify(draft)).join("\n")}\n`);
  const reviewQueuePath = await writeReviewQueue(runDir, drafts);

  const reviewDraft = pickReviewDraft(drafts);
  const baseTime = "2026-07-08T00:00:00Z";
  const { events, offerId, serviceType, providerPubKey } = await buildOfferEventsFromDraft(
    reviewDraft,
    { baseTime, offerIdPrefix: "aperio" },
  );

  const summary = {
    passed: true,
    runId,
    mode: args.mode,
    configPath: args.configPath,
    aperioBinary: discover.binaryPath,
    discoverPath,
    signalsPath,
    draftsPath,
    reviewQueuePath,
    keptSignals: runSummary.keptSignals,
    draftCount: drafts.length,
    selectedDraft: {
      offerId,
      serviceType,
      signalId: reviewDraft.provenance.signalId,
      title: reviewDraft.payload.title,
    },
    ingest: args.ingest,
    runDir,
  };

  if (!args.ingest) {
    await fs.writeFile(path.join(runDir, "live-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log("Aperio live drill passed (discover → import → review drafts).");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const dataDir = path.join(runDir, "node-data");
  const binaryPath = await resolveNodeBinary(args.skipBuild);
  const { runCli, spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);
  const commandLog = [];
  runCli(["node", "init", "--data-dir", dataDir], commandLog);

  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serve = spawnNodeServe(dataDir, port, commandLog);

  try {
    await waitForNode(baseUrl, 45_000);
    await submitEventsViaHttp(baseUrl, events);

    const replay = await fetchJson(`${baseUrl}/state/replay`);
    const asOf = replay?.as_of;
    if (!asOf) {
      throw new Error("replay view missing as_of after ingest");
    }

    const offerBody = await fetchJson(
      `${baseUrl}/state/offer/${encodeURIComponent(offerId)}?as_of=${encodeURIComponent(asOf)}`,
    );
    if (offerBody?.data?.status !== "active") {
      throw new Error(`expected ingested offer to be active, got ${offerBody?.data?.status ?? "unknown"}`);
    }

    const discovery = await fetchJson(
      `${baseUrl}/state/discovery?service_type=${encodeURIComponent(serviceType)}` +
        `&alpha_defaults=0&limit=50&as_of=${encodeURIComponent(asOf)}`,
    );
    const offers = discovery?.data?.offers ?? [];
    if (!offers.some(row => row.offer_id === offerId)) {
      throw new Error(`offer ${offerId} not visible in discovery after ingest`);
    }

    summary.baseUrl = baseUrl;
    summary.providerPubKey = providerPubKey;
    summary.ingestedOfferStatus = offerBody.data.status;
    await fs.writeFile(path.join(runDir, "live-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

    console.log("Aperio live drill passed (discover → import → review → ingest).");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await stopProcess(serve);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
