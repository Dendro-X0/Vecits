#!/usr/bin/env node
/**
 * Guided deal-loop runner used when CodaCtrl MCP client_* cannot sustain
 * multi-step builder fills (details visibility / daemon timeouts).
 * Writes proof under .codectx/verify/operations/vectis-mcp-deal-loop/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEAL_LOOP_LANE,
  DEAL_LOOP_PRESET,
  deriveDealLoopKeys,
  ensureDealLoopPrerequisitesStrict,
  verifyExchangeClosed,
} from "./lib/desktop-deal-loop-core.mjs";
import { R2_KEYS } from "./lib/r2-exchange-core.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = process.env.VECTIS_WEB_URL ?? "http://127.0.0.1:4251";
const NODE = process.env.VECTIS_NODE_URL ?? "http://127.0.0.1:7878";
const NODE_PROXY = `${WEB.replace(/\/+$/, "")}/api/node`;
const RUN_FILE = path.join(WORKSPACE_ROOT, "target/tmp/mcp-deal-loop-run.json");

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return import(pathToFileURL(path.resolve(WORKSPACE_ROOT, "../codactrl/node_modules/playwright/index.mjs")).href);
  }
}

function log(steps, step, ok, detail = "") {
  steps.push({ step, ok, detail, at: new Date().toISOString() });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(page, secret) {
  await page.goto(`${WEB}/sign-in?devKey=${secret}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
}

async function openBuilder(page, step) {
  await page.goto(`${WEB}/dashboard/builder?step=${step}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#marketplace-event-builder").waitFor({ timeout: 20000 });
}

async function openAdvanced(page) {
  const summary = page.locator('summary:has-text("Advanced details")');
  if (await summary.count()) {
    await summary.click();
  }
}

async function fillLabeled(page, label, value) {
  const root = page.locator("#marketplace-event-builder");
  const input = root
    .locator(`label:has-text("${label}") input, label:has-text("${label}") textarea`)
    .first();
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.fill(String(value));
}

async function configureKeys(page, pub, secret, created) {
  await openAdvanced(page);
  await fillLabeled(page, "Node URL", NODE_PROXY);
  await fillLabeled(page, "Public signing key", pub);
  await fillLabeled(page, "Secret signing key", secret);
  if (created) {
    await fillLabeled(page, "Created at (optional RFC3339)", created);
  }
}

async function fillRef(page, label, value) {
  const details = page.locator('summary:has-text("Reference details")');
  if (await details.count()) {
    await details.first().click();
  }
  await fillLabeled(page, label, value);
}

async function submit(page, buttonRe) {
  await page.getByRole("button", { name: buttonRe }).click();
  await Promise.race([
    page.getByText("Step completed").waitFor({ timeout: 45000 }),
    page.getByText("Accepted by node").waitFor({ timeout: 45000 }),
  ]);
}

async function findEventId(kind, predicate) {
  const response = await fetch(`${NODE}/events?kind=${encodeURIComponent(kind)}&limit=50`, {
    cache: "no-store",
  });
  const body = await response.json();
  const events = Array.isArray(body?.events) ? [...body.events].reverse() : [];
  for (const row of events) {
    if (predicate(row?.payload_json ?? {})) {
      return row.event_id;
    }
  }
  throw new Error(`missing ${kind}`);
}

async function main() {
  const run = JSON.parse(await fs.readFile(RUN_FILE, "utf8"));
  const { offerId, orderId, runId, price, artifactHash, createdAt, providerPub, buyerPub } = run;
  const milestoneId = "m1";
  const offerExpiresAt = "2026-12-01T00:00:00Z";
  const orderExpiresAt = "2026-12-15T00:00:00Z";
  const deliveredAt = "2026-07-09T12:00:00Z";
  const acceptedAt = "2026-07-09T12:05:00Z";
  const steps = [];

  await ensureDealLoopPrerequisitesStrict(NODE, { lane: DEAL_LOOP_LANE, runId });
  const keys = await deriveDealLoopKeys();
  const { chromium: pwChromium } = await loadPlaywright();
  const browser = await pwChromium.launch({ headless: true });
  let offerEventId = "";
  let orderEventId = "";
  let deliveryEventId = "";

  try {
    {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => localStorage.removeItem("new-start.marketplace-builder"));
      const page = await ctx.newPage();
      await signIn(page, R2_KEYS.provider);
      await openBuilder(page, "offer");
      await configureKeys(page, keys.providerPubKey, R2_KEYS.provider, createdAt.offer);
      await fillLabeled(page, "Offer ID", offerId);
      await fillLabeled(page, "Service category", DEAL_LOOP_LANE);
      await fillLabeled(page, "What is being sold", DEAL_LOOP_PRESET.unitDefinition);
      await fillLabeled(page, "Price per unit", price);
      await fillLabeled(page, "Delivery style", "artifact");
      await fillLabeled(page, "Offer expires at", offerExpiresAt);
      await fillLabeled(page, "Accepted proof formats (comma-separated)", "artifactHash");
      await submit(page, /Sign and submit your offer/i);
      offerEventId = await findEventId("ServiceOffer", (p) => p.offerId === offerId);
      log(steps, "guided.offer", true, offerEventId);
      await ctx.close();
    }

    {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => localStorage.removeItem("new-start.marketplace-builder"));
      const page = await ctx.newPage();
      await signIn(page, R2_KEYS.buyer);
      await openBuilder(page, "order");
      await configureKeys(page, keys.buyerPubKey, R2_KEYS.buyer, createdAt.order);
      await fillLabeled(page, "Order ID", orderId);
      await fillLabeled(page, "Offer ID", offerId);
      await fillLabeled(page, "Provider public key", keys.providerPubKey);
      await fillLabeled(page, "Buyer public key", keys.buyerPubKey);
      await fillLabeled(page, "Order expires at", orderExpiresAt);
      await fillLabeled(page, "Amount (credits)", price);
      await fillLabeled(page, "Deliverable", "MCP deal-loop deliverable");
      await fillLabeled(page, "Due window", "7 days after escrow funding");
      await fillLabeled(page, "Acceptance criteria", "Buyer verifies artifact hash on delivery");
      await fillRef(page, "Offer reference event ID", offerEventId);
      await submit(page, /Sign and submit your order/i);
      orderEventId = await findEventId("ServiceOrder", (p) => p.orderId === orderId);
      log(steps, "guided.order", true, orderEventId);
      await ctx.close();
    }

    {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => localStorage.removeItem("new-start.marketplace-builder"));
      const page = await ctx.newPage();
      await signIn(page, R2_KEYS.buyer);
      await openBuilder(page, "escrowSpend");
      await configureKeys(page, keys.buyerPubKey, R2_KEYS.buyer, createdAt.escrowSpend);
      await fillLabeled(page, "Payer public key", keys.buyerPubKey);
      await fillLabeled(page, "Order ID", orderId);
      await fillLabeled(page, "Amount to fund", price);
      await fillLabeled(page, "Payment nonce", `${runId}-escrow`);
      await submit(page, /Sign and submit escrow funding/i);
      log(steps, "guided.escrow", true, `${price} credits`);
      await ctx.close();
    }

    {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => localStorage.removeItem("new-start.marketplace-builder"));
      const page = await ctx.newPage();
      await signIn(page, R2_KEYS.provider);
      await openBuilder(page, "delivery");
      await configureKeys(page, keys.providerPubKey, R2_KEYS.provider, createdAt.delivery);
      await fillLabeled(page, "Order ID", orderId);
      await fillLabeled(page, "Proof format", "artifactHash");
      await fillLabeled(page, "Delivered at", deliveredAt);
      await fillLabeled(page, "Proof hashes (optional)", artifactHash);
      await fillRef(page, "Order reference event ID", orderEventId);
      await submit(page, /Sign and submit your delivery/i);
      deliveryEventId = await findEventId(
        "ServiceDelivery",
        (p) => p.orderId === orderId && p.milestoneId === milestoneId,
      );
      log(steps, "guided.delivery", true, deliveryEventId);
      await ctx.close();
    }

    {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => localStorage.removeItem("new-start.marketplace-builder"));
      const page = await ctx.newPage();
      await signIn(page, R2_KEYS.buyer);
      await openBuilder(page, "accept");
      await configureKeys(page, keys.buyerPubKey, R2_KEYS.buyer, createdAt.accept);
      await fillLabeled(page, "Order ID", orderId);
      await fillLabeled(page, "Accepted at", acceptedAt);
      await fillRef(page, "Delivery reference event ID", deliveryEventId);
      await submit(page, /Sign and submit completion acceptance/i);
      log(steps, "guided.accept", true, orderId);
      await ctx.close();
    }

    await verifyExchangeClosed(NODE, orderId, "2026-07-09T12:10:00Z");
    log(steps, "node.orderClosed", true, orderId);
  } catch (error) {
    log(steps, "runner", false, error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await browser.close();
  }

  const proofDir = path.join(WORKSPACE_ROOT, ".codectx/verify/operations/vectis-mcp-deal-loop");
  await fs.mkdir(proofDir, { recursive: true });
  const proof = {
    schema: "vectis.mcp-deal-loop.proof@0.1.0",
    mode: "guided-builder-playwright-fallback",
    reason:
      "MCP client_* opened dual sessions and Operator builder, but daemon timed out on heavy builder pages and guided Advanced-details signing fields are not fillable via MCP visibility. Completed authoritative guided loop with Playwright on the same UI path.",
    runId,
    offerId,
    orderId,
    offerEventId,
    orderEventId,
    deliveryEventId,
    providerPub,
    buyerPub,
    steps,
    pass: steps.every((s) => s.ok),
  };
  await fs.writeFile(path.join(proofDir, "latest-proof.json"), JSON.stringify(proof, null, 2));
  await fs.writeFile(
    RUN_FILE,
    JSON.stringify({ ...run, offerEventId, orderEventId, deliveryEventId, steps, pass: proof.pass }, null, 2),
  );
  console.log(JSON.stringify({ pass: proof.pass, orderId, proofPath: `${proofDir}/latest-proof.json` }, null, 2));
  if (!proof.pass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
