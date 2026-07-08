#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_APP = path.join(WORKSPACE_ROOT, "apps", "web", "app");

const FORBIDDEN_PATTERNS = [
  { id: "local-balance", pattern: /effective_balance|remaining_amount|provider_reward_credits/ },
  { id: "local-mint", pattern: /function\s+mintCredits|applyMint|computeBalance/ },
];

const REQUIRED_FILES = [
  "packages/sdk-ts/STABILITY.md",
  "docs/v0/r4-client-kernel-audit.md",
  "docs/runbooks/operator-security-guide.md",
  "apps/web/app/components/kernel-truth-notice.tsx",
];

async function readUtf8(relativePath) {
  return fs.readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8");
}

async function walkTsFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkTsFiles(full, out);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const failures = [];

  for (const relative of REQUIRED_FILES) {
    try {
      await fs.access(path.join(WORKSPACE_ROOT, relative));
    } catch {
      failures.push(`missing required file: ${relative}`);
    }
  }

  const webFiles = await walkTsFiles(WEB_APP);
  for (const file of webFiles) {
    const content = await fs.readFile(file, "utf8");
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(content)) {
        failures.push(`${rule.id} matched in ${path.relative(WORKSPACE_ROOT, file)}`);
      }
    }
  }

  const builder = await readUtf8("apps/web/app/components/marketplace-event-builder.tsx");
  if (!/if \(result\.accepted\)/.test(builder)) {
    failures.push("marketplace builder missing kernel ingest gate for session events");
  }
  if (!/Session checklist|browser session/i.test(builder)) {
    failures.push("marketplace builder missing session-only disclaimer");
  }
  if (!/DiscoveryDraftImportPanel/.test(builder)) {
    failures.push("marketplace builder missing discovery draft import panel");
  }

  const discoveryImport = await readUtf8("apps/web/lib/marketplace/discovery-draft-import.ts");
  if (!/parseDiscoveryDraftJsonl/.test(discoveryImport)) {
    failures.push("discovery draft import library missing JSONL parser");
  }

  const onboarding = await readUtf8("apps/web/app/components/onboarding-wizard.tsx");
  if (!/OffProtocolPaymentWarning|off-platform payment|PayPal/i.test(onboarding)) {
    failures.push("onboarding missing SOC-01 off-protocol payment warning");
  }

  const explorer = await readUtf8("apps/web/app/explorer/components/explorer-shell.tsx");
  if (!/KernelTruthNotice/.test(explorer)) {
    failures.push("explorer shell missing KernelTruthNotice");
  }

  const marketplace = await readUtf8("apps/web/app/marketplace/page.tsx");
  if (!/variant="offProtocol"|variant='offProtocol'/.test(marketplace)) {
    failures.push("marketplace entry missing SOC-01 off-protocol payment warning");
  }

  const siteHeader = await readUtf8("apps/web/components/shell/site-header.tsx");
  if (!/label: "Identity"/.test(siteHeader)) {
    failures.push("site header missing Identity primary nav label");
  }
  if (/\/operator/.test(siteHeader)) {
    failures.push("site header still links to operator console in primary nav");
  }

  const advancedPanel = await readUtf8("apps/web/components/dashboard/dashboard-advanced-panel.tsx");
  if (!/OperationsCommandTools/.test(advancedPanel) || !/v1:preflight/.test(advancedPanel)) {
    failures.push("settings advanced panel missing operator preflight/evidence tools");
  }


  const security = await readUtf8("docs/runbooks/operator-security-guide.md");
  if (!/SOC-01|Off-platform payment/i.test(security)) {
    failures.push("operator-security-guide missing SOC-01 section");
  }

  const stability = await readUtf8("packages/sdk-ts/STABILITY.md");
  if (!/Semantic Versioning|NodeClient/.test(stability)) {
    failures.push("STABILITY.md incomplete");
  }

  if (failures.length > 0) {
    console.error("R4 client audit failed:");
    for (const item of failures) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  console.log("R4 client audit passed (C1–C4 checks).");
  console.log(`  scanned ${webFiles.length} web app source files`);
  console.log("  AB-15: session state gated on kernel ingest");
  console.log("  SOC-01-doc: onboarding + operator-security-guide + marketplace entry");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
