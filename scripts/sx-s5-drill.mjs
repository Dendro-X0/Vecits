#!/usr/bin/env node
/**
 * SX-S5 — multi-milestone staged exchange maintainer drill (Profile A).
 *
 * software-fixes order with m1 (spec) + m2 (implementation): each phase
 * escrow → delivery → accept. Order closes only when both milestones accept.
 *
 * Claim: maintainer protocol proof of SX-D1 staging. Not a human field proof.
 */

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
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { WORKSPACE_ROOT } from "./lib/data-dirs.mjs";
import {
  buildSxS5StagedExchangeEvents,
} from "./lib/sx-s5-staged-exchange-core.mjs";
import {
  submitEventsViaHttp,
  verifyExchangeClosed,
} from "./lib/r2-exchange-core.mjs";

const root = WORKSPACE_ROOT;

function parseArgs(argv) {
  const result = {
    skipBuild: argv.includes("--no-build"),
    baseDate: "2026-07-24",
    baseUrl: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base-date") result.baseDate = argv[++i];
    else if (argv[i] === "--base-url") result.baseUrl = argv[++i];
  }
  return result;
}

async function verifyMilestonesAccepted(baseUrl, orderId, milestoneIds, asOf) {
  const results = [];
  for (const milestoneId of milestoneIds) {
    const url =
      `${baseUrl.replace(/\/+$/, "")}/state/milestone/${encodeURIComponent(orderId)}/${encodeURIComponent(milestoneId)}` +
      `?as_of=${encodeURIComponent(asOf)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`milestone lookup failed for ${milestoneId}: ${response.status}`);
    }
    const body = await response.json();
    const status = body?.data?.status;
    if (status !== "Accepted") {
      throw new Error(
        `expected milestone ${milestoneId} Accepted, got ${status ?? "unknown"}`,
      );
    }
    results.push({ milestoneId, status });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `${Date.now()}`;
  const runDir = path.join(root, "target", "tmp", `sx-s5-${runId}`);
  const dataDir = path.join(runDir, "node");
  await fs.mkdir(dataDir, { recursive: true });

  const exchange = await buildSxS5StagedExchangeEvents(runId, args.baseDate);
  const fixturePath = path.join(runDir, "sx-s5-events.jsonl");
  await fs.writeFile(
    fixturePath,
    `${exchange.events.map((event) => JSON.stringify(event)).join("\n")}\n`,
  );

  const binaryPath = await resolveReleaseBinary(root, {
    buildIfMissing: !args.skipBuild,
  });
  const { runCli, spawnNodeServe } = createReleaseRunners(root, binaryPath);
  const commandLog = [];
  runCli(["node", "init", "--data-dir", dataDir], commandLog);

  let baseUrl = args.baseUrl;
  let serve = null;
  try {
    if (!baseUrl) {
      const port = await choosePort();
      baseUrl = `http://127.0.0.1:${port}`;
      serve = spawnNodeServe(dataDir, port, commandLog);
      await waitForNode(baseUrl, 45_000);
    }

    const ingestResults = await submitEventsViaHttp(baseUrl, exchange.events);
    const milestoneStatuses = await verifyMilestonesAccepted(
      baseUrl,
      exchange.orderId,
      exchange.milestones.map((m) => m.milestoneId),
      exchange.asOf,
    );
    await verifyExchangeClosed(baseUrl, exchange.orderId, exchange.asOf);

    const health = await fetchJson(`${baseUrl}/health`);
    const summary = {
      passed: true,
      claim: "SX-S5 Profile A multi-milestone software-fixes — maintainer proof, not field proof",
      runId,
      lane: exchange.lane,
      offerId: exchange.offerId,
      orderId: exchange.orderId,
      milestones: exchange.milestones,
      milestoneStatuses,
      totalCredits: exchange.totalCredits,
      buyerPubKey: exchange.buyerPubKey,
      providerPubKey: exchange.providerPubKey,
      asOf: exchange.asOf,
      dataDir,
      baseUrl,
      eventCount: exchange.events.length,
      acceptedCount: ingestResults.length,
      healthStatus: health?.status ?? null,
      fixturePath,
      runDir,
    };

    await fs.writeFile(
      path.join(runDir, "sx-s5-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(runDir, "operator-notes.md"),
      `# SX-S5 staged exchange notes

- Profile A (staged digital) on lane \`${exchange.lane}\`
- Order \`${exchange.orderId}\` with milestones: ${exchange.milestones
        .map((m) => `${m.milestoneId}=${m.amountCredits} (${m.phaseLabel})`)
        .join("; ")}
- Each phase: escrow → delivery → accept; order closed only after both accepts
- Credits are L1 fuel at phase accept — not passive yield
- Events: ${fixturePath}
`,
    );

    console.log("SX-S5 multi-milestone drill passed.");
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Operator notes: ${path.join(runDir, "operator-notes.md")}`);
  } finally {
    if (serve) await stopProcess(serve);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
