#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signalsToOfferDrafts } from "./lib/discovery-bridge/offer-draft.mjs";
import { validateOfferDraft } from "./lib/discovery-bridge/validate-draft.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readUtf8(relativePath) {
  return fs.readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8");
}

async function main() {
  const failures = [];

  const importLib = await readUtf8("apps/web/lib/marketplace/discovery-draft-import.ts");
  const importPanel = await readUtf8("apps/web/components/marketplace/discovery-draft-import-panel.tsx");
  const builder = await readUtf8("apps/web/app/components/marketplace-event-builder.tsx");
  const builderPage = await readUtf8("apps/web/app/dashboard/builder/page.tsx");

  if (!/parseDiscoveryDraftJsonl/.test(importLib)) {
    failures.push("discovery-draft-import.ts missing JSONL parser");
  }
  if (!/suggestedLane/.test(importLib)) {
    failures.push("discovery-draft-import.ts missing suggestedLane mapping");
  }
  if (!/DiscoveryDraftImportPanel/.test(importPanel)) {
    failures.push("discovery-draft-import-panel.tsx missing import panel");
  }
  if (!/DiscoveryDraftImportPanel/.test(builder) || !/applyDiscoveryDraft/.test(builder)) {
    failures.push("marketplace-event-builder missing discovery draft import wiring");
  }
  if (!/non-authoritative|Draft ≠ ingested/i.test(builder)) {
    failures.push("marketplace-event-builder missing non-authoritative draft label");
  }
  if (!/MarketplaceEventBuilder/.test(builderPage)) {
    failures.push("dashboard/builder page missing MarketplaceEventBuilder");
  }

  const goldenPath = path.join(
    WORKSPACE_ROOT,
    "scripts",
    "fixtures",
    "discovery-signals-golden.json"
  );
  const golden = JSON.parse(await fs.readFile(goldenPath, "utf8"));
  const drafts = signalsToOfferDrafts(golden.slice(0, 3).map(entry => entry.input));
  for (const draft of drafts) {
    try {
      validateOfferDraft(draft);
    } catch (error) {
      failures.push(
        `validateOfferDraft failed for ${draft.provenance?.signalId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    if (!draft.provenance?.suggestedLane) {
      failures.push("offer draft missing provenance.suggestedLane");
    }
    if (!draft.payload?.title) {
      failures.push("offer draft missing payload.title");
    }
  }

  const jsonl = `${drafts.map(draft => JSON.stringify(draft)).join("\n")}\n`;
  const lines = jsonl
    .trim()
    .split("\n")
    .map(line => JSON.parse(line));
  if (lines.length !== drafts.length) {
    failures.push("JSONL round-trip line count mismatch");
  }

  if (failures.length > 0) {
    console.error("R7 discovery draft import smoke failed:");
    for (const item of failures) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  console.log("R7 discovery draft import smoke passed.");
  console.log(`  validated ${drafts.length} offer drafts from golden signals`);
  console.log("  builder import panel + dashboard/builder route present");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
