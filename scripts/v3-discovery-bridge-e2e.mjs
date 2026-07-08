#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOfferEventsFromDraft } from "./lib/discovery-bridge/bootstrap-offer-events.mjs";
import { signalToOfferDraft } from "./lib/discovery-bridge/offer-draft.mjs";
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

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AS_OF = "2026-07-01T00:15:00Z";
const skipBuild = process.argv.includes("--no-build");

async function loadDemoSignal() {
  const goldenPath = path.join(
    WORKSPACE_ROOT,
    "scripts",
    "fixtures",
    "discovery-signals-golden.json",
  );
  const golden = JSON.parse(await fs.readFile(goldenPath, "utf8"));
  const entry =
    golden.find(item => item.expectedLane === "project-maintenance") ?? golden[0];
  if (!entry?.input) {
    throw new Error("golden signal fixture missing demo entry");
  }
  return entry.input;
}

async function resolveNodeBinary() {
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

async function runE2e() {
  const signal = await loadDemoSignal();
  const draft = signalToOfferDraft(signal);
  validateOfferDraft(draft);

  const { events, offerId, serviceType } = await buildOfferEventsFromDraft(draft, {
    baseTime: "2026-07-01T00:00:00Z",
  });

  const runDir = path.join(
    WORKSPACE_ROOT,
    "target",
    "tmp",
    `discovery-bridge-e2e-${Date.now()}`,
  );
  const dataDir = path.join(runDir, "node-data");
  const fixturePath = path.join(runDir, "discovery-offer-ingest.jsonl");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    fixturePath,
    `${events.map(event => JSON.stringify(event)).join("\n")}\n`,
  );

  const binaryPath = await resolveNodeBinary();
  const { runCli, spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);
  const commandLog = [];

  runCli(["node", "init", "--data-dir", dataDir], commandLog);
  runCli(["node", "ingest", "--data-dir", dataDir, "--in", fixturePath], commandLog);

  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serve = spawnNodeServe(dataDir, port, commandLog);

  try {
    await waitForNode(baseUrl, 45_000);

    const discoveryUrl =
      `${baseUrl}/state/discovery?service_type=${encodeURIComponent(serviceType)}` +
      `&alpha_defaults=0&limit=50&as_of=${encodeURIComponent(AS_OF)}`;
    const discovery = await fetchJson(discoveryUrl);
    const offers = discovery?.data?.offers;
    if (!Array.isArray(offers)) {
      throw new Error("discovery response missing offers array");
    }

    const match = offers.find(entry => entry.offer_id === offerId);
    if (!match) {
      throw new Error(`DB-4 failed: offer ${offerId} not visible in discovery view`);
    }

    const eventsPage = await fetchJson(`${baseUrl}/events?kind=ServiceOffer&limit=20`);
    const listed = eventsPage?.events ?? [];
    const listedOffer = listed.find(
      event =>
        event.payload_json?.offerId === offerId ||
        event.raw_json?.payload?.offerId === offerId,
    );
    if (!listedOffer) {
      throw new Error(`DB-4 failed: offer ${offerId} not listed in /events`);
    }

    const summary = {
      passed: true,
      offerId,
      serviceType,
      signalId: draft.provenance.signalId,
      discoveryScore: match.discovery_score,
      providerPubKey: match.provider_pub_key,
      runDir,
      fixturePath,
    };
    await fs.writeFile(
      path.join(runDir, "e2e-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );

    console.log("Discovery bridge e2e passed (DB-4).");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await stopProcess(serve);
  }
}

runE2e().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
