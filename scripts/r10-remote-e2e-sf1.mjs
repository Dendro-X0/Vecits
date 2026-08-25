#!/usr/bin/env node
/**
 * R10-E2 — remote software-fixes happy path (R10-E2E-SF1) against an existing host.
 *
 * Requires VECTIS_REMOTE_BASE_URL or --base-url pointing at a live release node
 * (Tailscale/LAN per FR lock). Does not spawn a local node.
 *
 * Claim when pass: Remote E2E (maintainer). Not human field proof.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "./lib/ga6-drill-core.mjs";
import {
  buildR2ExchangeEvents,
  submitEventsViaHttp,
  verifyExchangeClosed,
} from "./lib/r2-exchange-core.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANE = "software-fixes";

function parseArgs(argv) {
  const result = {
    baseUrl: process.env.VECTIS_REMOTE_BASE_URL ?? "",
    baseDate: "2026-08-25",
    exportEvidence: !argv.includes("--no-export"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--base-url") result.baseUrl = argv[++i];
    else if (arg === "--base-date") result.baseDate = argv[++i];
  }
  return result;
}

function normalizeBaseUrl(url) {
  return String(url ?? "").trim().replace(/\/+$/, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  if (!baseUrl) {
    throw new Error(
      "Set VECTIS_REMOTE_BASE_URL or pass --base-url http://<host>:7878 (LAN or Tailscale)",
    );
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(baseUrl)) {
    console.warn(
      "WARNING: base-url is loopback — remote E2E claim prefers LAN/Tailscale host URL.",
    );
  }

  const health = await fetchJson(`${baseUrl}/health`);
  if (health?.status !== "ok") {
    throw new Error(`remote host not healthy: ${health?.status ?? "missing"}`);
  }

  const runId = `r10-sf1-${Date.now()}`;
  const exchange = await buildR2ExchangeEvents(LANE, runId, args.baseDate);
  const ingestResults = await submitEventsViaHttp(baseUrl, exchange.events);
  await verifyExchangeClosed(baseUrl, exchange.orderId, exchange.asOf);

  const orderUrl =
    `${baseUrl}/state/order/${encodeURIComponent(exchange.orderId)}` +
    `?as_of=${encodeURIComponent(exchange.asOf)}`;
  const order = await fetchJson(orderUrl);
  const orderStatus = order?.data?.status ?? null;
  if (orderStatus !== "closed" && orderStatus !== "Closed") {
    throw new Error(`expected order closed, got ${orderStatus ?? "unknown"}`);
  }

  const healthAfter = await fetchJson(`${baseUrl}/health`);
  const summary = {
    pass: true,
    step: "R10-E2",
    gate: "PRG-2",
    scenario: "R10-E2E-SF1",
    runId,
    lane: LANE,
    baseUrl,
    offerId: exchange.offerId,
    orderId: exchange.orderId,
    orderStatus,
    asOf: exchange.asOf,
    eventCount: exchange.events.length,
    acceptedCount: ingestResults.length,
    healthStatus: healthAfter?.status ?? null,
    latestSeq: healthAfter?.data_dir?.latest_seq ?? null,
    claim: "Remote E2E (maintainer) — software-fixes via remote HTTP ingest",
    recordedAt: new Date().toISOString(),
  };

  console.log("R10 remote E2E SF1 passed.");
  console.log(JSON.stringify(summary, null, 2));

  if (args.exportEvidence) {
    const outDir = path.join(WORKSPACE_ROOT, "target", "r10-evidence", runId);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, "events.jsonl"),
      `${exchange.events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    );
    await fs.writeFile(path.join(outDir, "health-host.json"), `${JSON.stringify(healthAfter, null, 2)}\n`);
    await fs.writeFile(path.join(outDir, "order-state.json"), `${JSON.stringify(order, null, 2)}\n`);
    await fs.writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(
      path.join(outDir, "operator-notes.md"),
      `# R10-E2E-SF1\n\nPASS — ${baseUrl}\n\nOrder ${exchange.orderId} status=${orderStatus}.\n\nClaim: Remote E2E (maintainer) only.\n`,
    );
    console.log(`Evidence: ${outDir}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
