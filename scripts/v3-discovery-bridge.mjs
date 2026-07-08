#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { signalsToOfferDrafts } from "./lib/discovery-bridge/offer-draft.mjs";
import { normalizeSignal } from "./lib/discovery-bridge/signal-schema.mjs";
import { validateOfferDraft } from "./lib/discovery-bridge/validate-draft.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = { inPath: "", outPath: "", smoke: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--smoke") {
      result.smoke = true;
    } else if (arg === "--in") {
      result.inPath = argv[++i];
    } else if (arg === "--out") {
      result.outPath = argv[++i];
    }
  }
  return result;
}

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function runSmoke() {
  const goldenPath = path.join(
    WORKSPACE_ROOT,
    "scripts",
    "fixtures",
    "discovery-signals-golden.json",
  );
  const golden = JSON.parse(await fs.readFile(goldenPath, "utf8"));
  if (golden.length < 20) {
    throw new Error("golden signal set must contain at least 20 entries");
  }

  const normalized = golden.map(entry => normalizeSignal(entry.input));
  for (const [index, entry] of golden.entries()) {
    const got = normalized[index];
    if (got.suggestedLane !== entry.expectedLane) {
      throw new Error(
        `lane mismatch at ${index}: expected ${entry.expectedLane}, got ${got.suggestedLane}`,
      );
    }
    if (got.signalId !== entry.expectedSignalId) {
      throw new Error(`signalId mismatch at ${index}`);
    }
  }

  const drafts = signalsToOfferDrafts(golden.map(entry => entry.input));
  for (const draft of drafts) {
    validateOfferDraft(draft);
    if (draft.draftKind !== "ServiceOffer") {
      throw new Error("draftKind must be ServiceOffer");
    }
    if (!draft.payload.serviceType || !draft.payload.deliveryMode) {
      throw new Error("offer draft missing lane template fields");
    }
  }

  const outDir = path.join(WORKSPACE_ROOT, "target", "tmp", `discovery-bridge-smoke-${Date.now()}`);
  await fs.mkdir(outDir, { recursive: true });
  const draftsPath = path.join(outDir, "offer-drafts.jsonl");
  await fs.writeFile(
    draftsPath,
    `${drafts.map(draft => JSON.stringify(draft)).join("\n")}\n`,
  );

  console.log(`Discovery bridge smoke passed (${golden.length} golden signals).`);
  console.log(draftsPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.smoke) {
    await runSmoke();
    return;
  }

  if (!args.inPath || !args.outPath) {
    throw new Error("usage: node scripts/v3-discovery-bridge.mjs --in <signals.jsonl> --out <offer-drafts.jsonl>");
  }

  const signals = await readJsonl(path.resolve(args.inPath));
  const drafts = signalsToOfferDrafts(signals);
  await fs.writeFile(
    path.resolve(args.outPath),
    `${drafts.map(draft => JSON.stringify(draft)).join("\n")}\n`,
  );
  console.log(`Wrote ${drafts.length} offer drafts to ${args.outPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
