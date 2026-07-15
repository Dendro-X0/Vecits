#!/usr/bin/env node

import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEAL_LOOP_LANE,
  DEAL_LOOP_PRESET,
  R2_KEYS,
  deriveDealLoopKeys,
  ensureDealLoopPrerequisitesStrict,
  verifyExchangeClosed,
} from "./lib/desktop-deal-loop-core.mjs";

const require = createRequire(import.meta.url);
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESKTOP_PORT_FILE = path.join(WORKSPACE_ROOT, ".dev", "desktop-web-port");
const WEB_PORT_FILE = path.join(WORKSPACE_ROOT, ".dev", "web-port");
const NODE_DIRECT = process.env.VECTIS_NODE_URL ?? "http://127.0.0.1:7878";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const fallback = path.resolve(WORKSPACE_ROOT, "../codactrl/node_modules/playwright/index.mjs");
    return import(pathToFileURL(fallback).href);
  }
}

async function readPortFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const port = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

async function resolveDevWebUrl() {
  if (process.env.VECTIS_WEB_URL) {
    return process.env.VECTIS_WEB_URL;
  }
  const desktopPort = await readPortFile(DESKTOP_PORT_FILE);
  const webPort = await readPortFile(WEB_PORT_FILE);
  for (const port of [desktopPort, webPort]) {
    if (!port) {
      continue;
    }
    const candidate = `http://127.0.0.1:${port}`;
    const health = await fetchJson(`${candidate}/api/node/health`);
    if (health.ok && health.body?.status === "ok") {
      return candidate;
    }
  }
  if (desktopPort) {
    return `http://127.0.0.1:${desktopPort}`;
  }
  if (webPort) {
    return `http://127.0.0.1:${webPort}`;
  }
  return null;
}

function record(results, name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(pass ? `PASS ${name}` : `FAIL ${name}`, detail ? `— ${detail}` : "");
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

async function signIn(page, webUrl, secretKeyHex) {
  await page.goto(`${webUrl}/sign-in`, { waitUntil: "networkidle" });
  await page.locator("#secretKeyHex").fill(secretKeyHex);
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Use saved key" }).click();
  await page.waitForURL("**/marketplace**", { timeout: 20000 });
}

async function openBuilderStep(page, webUrl, step) {
  await page.goto(`${webUrl}/dashboard/builder?step=${step}`, { waitUntil: "networkidle" });
  await page.locator("#marketplace-event-builder").waitFor({ timeout: 20000 });
}

async function openAdvancedDetails(page) {
  const summary = page.locator('summary:has-text("Advanced details")');
  if (await summary.count()) {
    await summary.click();
  }
}

async function fillLabeledInput(page, label, value) {
  const root = page.locator("#marketplace-event-builder");
  const input = root
    .locator(`label:has-text("${label}") input, label:has-text("${label}") textarea`)
    .first();
  await input.fill(value);
}

async function configureSigningKeys(page, { nodeProxy, publicKeyHex, secretKeyHex, createdAt }) {
  await openAdvancedDetails(page);
  await fillLabeledInput(page, "Node URL", nodeProxy);
  await fillLabeledInput(page, "Public signing key", publicKeyHex);
  await fillLabeledInput(page, "Secret signing key", secretKeyHex);
  if (createdAt) {
    await fillLabeledInput(page, "Created at (optional RFC3339)", createdAt);
  }
}

async function fillMilestoneTerms(page) {
  await fillLabeledInput(page, "Deliverable", "Desktop deal-loop smoke deliverable");
  await fillLabeledInput(page, "Due window", "7 days after escrow funding");
  await fillLabeledInput(page, "Acceptance criteria", "Buyer verifies artifact hash on delivery");
}

async function fillReferenceEventId(page, label, value) {
  const details = page.locator('summary:has-text("Reference details")');
  if (await details.count()) {
    await details.first().click();
  }
  await fillLabeledInput(page, label, value);
}

async function findLatestEventId(baseUrl, kind, predicate) {
  const root = baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${root}/events?kind=${encodeURIComponent(kind)}&limit=50`, {
    cache: "no-store",
  });
  const body = await response.json();
  const events = Array.isArray(body?.events) ? [...body.events].reverse() : [];
  for (const row of events) {
    if (predicate(row?.payload_json ?? {})) {
      return row.event_id;
    }
  }
  throw new Error(`could not find ${kind} event for verification`);
}

async function submitBuilderStep(page, buttonPattern) {
  await page.getByRole("button", { name: buttonPattern }).click();
  const success = page.getByText("Step completed");
  const accepted = page.getByText("Accepted by node");
  const failed = page.getByText("Submit failed");
  try {
    await Promise.race([
      success.waitFor({ timeout: 45000 }),
      accepted.waitFor({ timeout: 45000 }),
    ]);
  } catch {
    if (await failed.count()) {
      const detail = await page.locator("body").innerText();
      const message = detail.match(/Message:\s*(.+)/)?.[1]?.trim();
      throw new Error(message ? `submit failed: ${message}` : "submit failed without Step completed");
    }
    throw new Error("submit timed out without Step completed");
  }
}

async function createBrowserContext(browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.removeItem("new-start.marketplace-builder");
  });
  return context;
}

async function main() {
  const results = [];
  const webUrl = await resolveDevWebUrl();
  const nodeProxy = webUrl ? `${webUrl}/api/node` : null;
  const runId = `desktop-deal-${Date.now()}`;
  const offerId = `${runId}-offer`;
  const orderId = `${runId}-order`;
  const milestoneId = "m1";
  const price = String(DEAL_LOOP_PRESET.pricePerUnitCredits);
  const offerExpiresAt = "2026-12-01T00:00:00Z";
  const orderExpiresAt = "2026-12-15T00:00:00Z";
  const deliveredAt = "2026-07-09T12:00:00Z";
  const acceptedAt = "2026-07-09T12:05:00Z";
  const createdAt = {
    offer: "2026-07-09T11:50:00Z",
    order: "2026-07-09T11:51:00Z",
    escrowSpend: "2026-07-09T11:52:00Z",
    delivery: deliveredAt,
    accept: acceptedAt,
  };
  const artifactHash = DEAL_LOOP_PRESET.artifactHash;

  const health = await fetchJson(`${NODE_DIRECT}/health`);
  record(
    results,
    "sidecar /health (direct)",
    health.ok && health.body?.status === "ok",
    health.ok ? NODE_DIRECT : `status ${health.status}`,
  );
  if (!health.ok || health.body?.status !== "ok") {
    throw new Error("sidecar is not healthy — start pnpm dev:desktop first");
  }

  if (!webUrl || !nodeProxy) {
    record(
      results,
      "dev web URL",
      false,
      "missing — run pnpm dev:desktop or pnpm dev:web, or set VECTIS_WEB_URL",
    );
    throw new Error("dev web URL unavailable");
  }

  const proxyHealth = await fetchJson(`${nodeProxy}/health`);
  record(
    results,
    "Next /api/node/health (dev proxy)",
    proxyHealth.ok && proxyHealth.body?.status === "ok",
    proxyHealth.ok ? nodeProxy : `status ${proxyHealth.status}`,
  );

  const prerequisites = await ensureDealLoopPrerequisitesStrict(NODE_DIRECT, {
    lane: DEAL_LOOP_LANE,
    runId,
  });
  record(
    results,
    "deal-loop prerequisites (identities, vouches, buyer credits)",
    prerequisites.providerReady && prerequisites.creditsReady,
    `vouches ${prerequisites.eligibility.incomingActiveVouchWeight}/${prerequisites.eligibility.threshold}, buyer credits ${prerequisites.buyerCredits}`,
  );

  const keys = await deriveDealLoopKeys();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  let offerEventId = "";
  let orderEventId = "";
  let deliveryEventId = "";

  try {
    {
      const ctx = await createBrowserContext(browser);
      const page = await ctx.newPage();
      await signIn(page, webUrl, R2_KEYS.provider);
      await openBuilderStep(page, webUrl, "offer");
      await configureSigningKeys(page, {
        nodeProxy,
        publicKeyHex: keys.providerPubKey,
        secretKeyHex: R2_KEYS.provider,
        createdAt: createdAt.offer,
      });
      await fillLabeledInput(page, "Offer ID", offerId);
      await fillLabeledInput(page, "Service category", DEAL_LOOP_LANE);
      await fillLabeledInput(page, "What is being sold", DEAL_LOOP_PRESET.unitDefinition);
      await fillLabeledInput(page, "Price per unit", price);
      await fillLabeledInput(page, "Delivery style", "artifact");
      await fillLabeledInput(page, "Offer expires at", offerExpiresAt);
      await fillLabeledInput(page, "Accepted proof formats (comma-separated)", "artifactHash");
      await submitBuilderStep(page, /Sign and submit your offer/i);
      offerEventId = await findLatestEventId(
        NODE_DIRECT,
        "ServiceOffer",
        (payload) => payload.offerId === offerId,
      );
      record(results, "guided builder: publish offer (provider)", true, offerEventId);
      await ctx.close();
    }

    {
      const ctx = await createBrowserContext(browser);
      const page = await ctx.newPage();
      await signIn(page, webUrl, R2_KEYS.buyer);
      await openBuilderStep(page, webUrl, "order");
      await configureSigningKeys(page, {
        nodeProxy,
        publicKeyHex: keys.buyerPubKey,
        secretKeyHex: R2_KEYS.buyer,
        createdAt: createdAt.order,
      });
      await fillLabeledInput(page, "Order ID", orderId);
      await fillLabeledInput(page, "Offer ID", offerId);
      await fillLabeledInput(page, "Provider public key", keys.providerPubKey);
      await fillLabeledInput(page, "Buyer public key", keys.buyerPubKey);
      await fillLabeledInput(page, "Order expires at", orderExpiresAt);
      await fillLabeledInput(page, "Amount (credits)", price);
      await fillMilestoneTerms(page);
      await fillReferenceEventId(page, "Offer reference event ID", offerEventId);
      await submitBuilderStep(page, /Sign and submit your order/i);
      orderEventId = await findLatestEventId(
        NODE_DIRECT,
        "ServiceOrder",
        (payload) => payload.orderId === orderId,
      );
      record(results, "guided builder: place order (buyer)", true, orderEventId);
      await ctx.close();
    }

    {
      const ctx = await createBrowserContext(browser);
      const page = await ctx.newPage();
      await signIn(page, webUrl, R2_KEYS.buyer);
      await openBuilderStep(page, webUrl, "escrowSpend");
      await configureSigningKeys(page, {
        nodeProxy,
        publicKeyHex: keys.buyerPubKey,
        secretKeyHex: R2_KEYS.buyer,
        createdAt: createdAt.escrowSpend,
      });
      await fillLabeledInput(page, "Payer public key", keys.buyerPubKey);
      await fillLabeledInput(page, "Order ID", orderId);
      await fillLabeledInput(page, "Amount to fund", price);
      await fillLabeledInput(page, "Payment nonce", `${runId}-escrow`);
      await submitBuilderStep(page, /Sign and submit escrow funding/i);
      record(results, "guided builder: fund escrow (buyer)", true, `${price} credits`);
      await ctx.close();
    }

    {
      const ctx = await createBrowserContext(browser);
      const page = await ctx.newPage();
      await signIn(page, webUrl, R2_KEYS.provider);
      await openBuilderStep(page, webUrl, "delivery");
      await configureSigningKeys(page, {
        nodeProxy,
        publicKeyHex: keys.providerPubKey,
        secretKeyHex: R2_KEYS.provider,
        createdAt: createdAt.delivery,
      });
      await fillLabeledInput(page, "Order ID", orderId);
      await fillLabeledInput(page, "Proof format", "artifactHash");
      await fillLabeledInput(page, "Delivered at", deliveredAt);
      await fillLabeledInput(page, "Proof hashes (optional)", artifactHash);
      await fillReferenceEventId(page, "Order reference event ID", orderEventId);
      await submitBuilderStep(page, /Sign and submit your delivery/i);
      deliveryEventId = await findLatestEventId(
        NODE_DIRECT,
        "ServiceDelivery",
        (payload) => payload.orderId === orderId && payload.milestoneId === milestoneId,
      );
      record(results, "guided builder: deliver work (provider)", true, deliveryEventId);
      await ctx.close();
    }

    {
      const ctx = await createBrowserContext(browser);
      const page = await ctx.newPage();
      await signIn(page, webUrl, R2_KEYS.buyer);
      await openBuilderStep(page, webUrl, "accept");
      await configureSigningKeys(page, {
        nodeProxy,
        publicKeyHex: keys.buyerPubKey,
        secretKeyHex: R2_KEYS.buyer,
        createdAt: createdAt.accept,
      });
      await fillLabeledInput(page, "Order ID", orderId);
      await fillLabeledInput(page, "Accepted at", acceptedAt);
      await fillReferenceEventId(page, "Delivery reference event ID", deliveryEventId);
      await submitBuilderStep(page, /Sign and submit completion acceptance/i);
      record(results, "guided builder: accept completion (buyer)", true, orderId);
      await ctx.close();
    }

    await verifyExchangeClosed(NODE_DIRECT, orderId, "2026-07-09T12:10:00Z");
    record(results, "node: order closed after accept", true, orderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(results, "deal-loop runner", false, message);
    throw error;
  } finally {
    await browser.close();
  }

  const failed = results.filter((entry) => !entry.pass);
  if (failed.length > 0) {
    console.error(`\nDesktop deal-loop smoke failed (${failed.length}/${results.length}).`);
    process.exit(1);
  }

  console.log(`\nDesktop deal-loop smoke passed (${results.length} checks).`);
  console.log(`Offer: ${offerId}`);
  console.log(`Order: ${orderId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
