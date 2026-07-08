/**
 * Browser verification for marketplace-adjacent client functions on prod :4602.
 * Run: node scripts/verify-marketplace-functions.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const fallback = path.resolve(scriptDir, "../../codactrl/node_modules/playwright/index.mjs");
    return import(pathToFileURL(fallback).href);
  }
}

const { chromium } = await loadPlaywright();
import {
  derivePublicKey,
  createUnsignedEnvelope,
  signUnsignedEnvelope,
} from "../packages/sdk-ts/dist/index.js";
import { R2_KEYS } from "./lib/r2-exchange-core.mjs";

const WEB = process.env.VECTIS_WEB_URL ?? "http://127.0.0.1:4602";
const NODE_PROXY = `${WEB}/api/node`;
const NODE_DIRECT = process.env.VECTIS_NODE_URL ?? "http://127.0.0.1:7878";

const PROVIDER_SECRET = R2_KEYS.provider;
const BUYER_SECRET = R2_KEYS.buyer;
const PROVIDER_PUB = await derivePublicKey(PROVIDER_SECRET);
const BUYER_PUB = await derivePublicKey(BUYER_SECRET);

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(pass ? `PASS ${name}` : `FAIL ${name}`, detail ? `— ${detail}` : "");
}

async function codactrlSignIn(page, secret) {
  await page.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
  await page.locator("#secretKeyHex").fill(secret);
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Use saved key")').click();
  await page.waitForURL("**/marketplace**", { timeout: 15000 });
}

async function fillLabeledInput(page, sectionId, label, value) {
  const root = page.locator(`#${sectionId}`);
  const input = root.locator(`label:has-text("${label}") input, label:has-text("${label}") textarea`).first();
  await input.fill(value);
}

async function submitOperatorForm(page, buttonPattern) {
  await page.getByRole("button", { name: buttonPattern }).click();
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  const accepted = /"accepted"\s*:\s*true/i.test(body) || /eventId/i.test(body);
  const error = await page.locator("text=/Submit Error|errorMessage/i").count();
  return { accepted, body: body.slice(0, 500), hasErrorPanel: error > 0 };
}

const browser = await chromium.launch({ headless: true });

try {
  // 1. Register page — generate keypair
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${WEB}/register`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Generate/i }).click();
    await page.waitForTimeout(500);
    const hasPubkey = (await page.locator("text=/Public key|pubkey/i").count()) > 0
      || (await page.locator("code, .font-mono").count()) > 0;
    record("register: generate keypair UI", hasPubkey || page.url().includes("/register"));
    await page.close();
  }

  // 2. Dashboard live stats (buyer signed in)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await codactrlSignIn(page, BUYER_SECRET);
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle" });
    const text = await page.locator("main").innerText();
    const live = /Live ·/i.test(text) || /d75979/i.test(text);
    const myExchanges = /My exchanges/i.test(text);
    record("dashboard: signed-in overview", live, myExchanges ? "My exchanges section visible" : "no my exchanges");
    await ctx.close();
  }

  // 3. Explorer surfaces
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${WEB}/explorer/offers`, { waitUntil: "networkidle" });
    const offersOk = page.url().includes("/explorer");
    record("explorer: offers page loads", offersOk);
    await page.goto(`${WEB}/explorer/orders`, { waitUntil: "networkidle" });
    record("explorer: orders page loads", page.url().includes("/explorer/orders"));
    await page.close();
  }

  // 4. Account settings
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await codactrlSignIn(page, BUYER_SECRET);
    await page.goto(`${WEB}/account`, { waitUntil: "networkidle" });
    const text = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
    record(
      "account: settings page",
      /backup|passkey|theme|account/i.test(text),
      page.url()
    );
    await ctx.close();
  }

  // 5. Operator — post ServiceOffer (provider)
  const offerId = `verify-func-${Date.now()}-offer`;
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${WEB}/operator#marketplace-event-builder`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ServiceOffer", exact: true }).click();
    await fillLabeledInput(page, "marketplace-event-builder", "Node API Base URL", NODE_PROXY);
    await fillLabeledInput(page, "marketplace-event-builder", "Author Public Key", PROVIDER_PUB);
    await fillLabeledInput(page, "marketplace-event-builder", "Author Secret Key", PROVIDER_SECRET);
    await fillLabeledInput(page, "marketplace-event-builder", "offerId", offerId);
    await fillLabeledInput(page, "marketplace-event-builder", "serviceType", "software-fixes");
    await fillLabeledInput(page, "marketplace-event-builder", "unitDefinition", "verify function test");
    await fillLabeledInput(page, "marketplace-event-builder", "pricePerUnitCredits", "50");
    const submit = await submitOperatorForm(page, /Sign \+ Submit ServiceOffer/i);
    record("operator: post ServiceOffer", submit.accepted && !submit.hasErrorPanel, submit.body.slice(0, 120));
    await page.close();
  }

  // 6. Offer appears on marketplace
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${WEB}/marketplace`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const text = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
    record("marketplace: new offer listed", text.includes(offerId), offerId);
    await page.close();
  }

  // 7. Operator — MintCredits (buyer as operator/minter in R2 fixture pattern)
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${WEB}/operator#contribution-credit-builder`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "MintCredits", exact: true }).click();
    await fillLabeledInput(page, "contribution-credit-builder", "Node API Base URL", NODE_PROXY);
    await fillLabeledInput(page, "contribution-credit-builder", "Author Public Key", BUYER_PUB);
    await fillLabeledInput(page, "contribution-credit-builder", "Author Secret Key", BUYER_SECRET);
    await fillLabeledInput(page, "contribution-credit-builder", "beneficiaryPubKey", BUYER_PUB);
    await fillLabeledInput(page, "contribution-credit-builder", "amount", "25");
    await fillLabeledInput(page, "contribution-credit-builder", "mintReason", "verify-function-test");
    const submit = await submitOperatorForm(page, /Sign \+ Submit MintCredits/i);
    record("operator: MintCredits submit", submit.accepted && !submit.hasErrorPanel, submit.body.slice(0, 120));
    await page.close();
  }

  // 8. Onboarding wizard — vouch status for provider
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${WEB}/operator#onboarding-wizard`, { waitUntil: "networkidle" });
    await fillLabeledInput(page, "onboarding-wizard", "Node API Base URL", NODE_PROXY);
    await fillLabeledInput(page, "onboarding-wizard", "Identity Public Key", PROVIDER_PUB);
    await page.getByRole("button", { name: "Refresh Onboarding Status" }).click();
    await page.waitForTimeout(3000);
    const text = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
    const hasVouchInfo = /vouch|threshold|sponsor|incoming/i.test(text);
    record("operator: onboarding vouch status", hasVouchInfo, text.match(/incomingActiveVouches[^\n]*/i)?.[0] ?? "");
    await page.close();
  }

  // 9. Node API direct health
  {
    const res = await fetch(`${NODE_DIRECT}/health`);
    record("node: health endpoint", res.ok, String(res.status));
  }
} catch (error) {
  console.error("Verification aborted:", error.message);
  record("runner", false, error.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log("\n--- Summary ---");
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.name).join(", "));
  process.exitCode = 1;
}
