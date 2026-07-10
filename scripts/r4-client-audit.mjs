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
  if (
    !/variant="offProtocol"|variant='offProtocol'/.test(marketplace) &&
    !/KernelTruthBanner/.test(marketplace)
  ) {
    failures.push("marketplace entry missing SOC-01 off-protocol payment warning");
  }

  const helpArticles = await readUtf8("apps/web/lib/help/articles.ts");
  const requiredHelpSlugs = [
    "deal-flow",
    "disputes",
    "identity",
    "node-connection",
    "trust-bootstrap",
    "credits-path"
  ];
  for (const slug of requiredHelpSlugs) {
    if (!new RegExp(`slug:\\s*"${slug}"`).test(helpArticles)) {
      failures.push(`help articles missing slug: ${slug}`);
    }
  }

  const phase2Surfaces = [
    "apps/web/components/marketplace/order-action-hub.tsx",
    "apps/web/lib/dashboard/workspace-role.ts",
    "apps/web/components/workspace/order-workspace-notes-panel.tsx",
    "apps/web/lib/marketplace/milestone-draft.ts",
    "apps/web/components/dashboard/trust-bootstrap-panel.tsx",
    "apps/web/lib/dashboard/trust-bootstrap.ts",
    "apps/web/lib/marketplace/trust-signals.ts",
    "apps/web/components/marketplace/provider-trust-signals.tsx"
  ];
  for (const relative of phase2Surfaces) {
    try {
      await fs.access(path.join(WORKSPACE_ROOT, relative));
    } catch {
      failures.push(`missing Phase 2 surface: ${relative}`);
    }
  }

  const phase3LaneSurfaces = [
    "apps/web/lib/marketplace/lane-templates.ts",
    "apps/web/components/marketplace/marketplace-lane-catalog.tsx",
    "apps/web/components/marketplace/lane-publish-fit-panel.tsx",
    "apps/web/components/marketplace/discovery-draft-import-cta.tsx",
    "apps/web/app/marketplace/lanes/page.tsx"
  ];
  for (const relative of phase3LaneSurfaces) {
    try {
      await fs.access(path.join(WORKSPACE_ROOT, relative));
    } catch {
      failures.push(`missing Phase 3 lane surface: ${relative}`);
    }
  }

  const marketplaceHero = await readUtf8("apps/web/components/marketplace/marketplace-hero.tsx");
  if (!/Lane catalog/.test(marketplaceHero) || !/DiscoveryDraftImportCta/.test(marketplaceHero)) {
    failures.push("marketplace hero missing lane catalog or discovery import CTA");
  }

  const marketplaceToolbar = await readUtf8("apps/web/components/marketplace/marketplace-toolbar.tsx");
  if (!/DiscoveryDraftImportCta/.test(marketplaceToolbar)) {
    failures.push("marketplace toolbar missing discovery import CTA");
  }

  const discoveryImportPanel = await readUtf8(
    "apps/web/components/marketplace/discovery-draft-import-panel.tsx"
  );
  if (!/Draft ≠ live offer/.test(discoveryImportPanel)) {
    failures.push("discovery draft import panel missing draft disclaimer badge");
  }

  const transactionBuilder = await readUtf8(
    "apps/web/components/dashboard/transaction-builder-panel.tsx"
  );
  if (!/importParam/.test(transactionBuilder)) {
    failures.push("transaction builder missing discovery import deep link handling");
  }

  const eventBuilder = await readUtf8("apps/web/app/components/marketplace-event-builder.tsx");
  if (!/LanePublishFitPanel/.test(eventBuilder)) {
    failures.push("marketplace event builder missing lane publish fit panel");
  }
  if (!/discovery-draft-import/.test(eventBuilder)) {
    failures.push("marketplace event builder missing discovery import anchor");
  }

  const overviewPage = await readUtf8("apps/web/components/dashboard/overview-page.tsx");
  if (!/flushDueOrderReminders/.test(overviewPage)) {
    failures.push("overview page missing workspace reminder flush");
  }

  const orderActionHub = await readUtf8("apps/web/components/marketplace/order-action-hub.tsx");
  if (!/Local note/.test(orderActionHub) || !/loadOrderWorkspaceSummary/.test(orderActionHub)) {
    failures.push("order action hub missing local note workspace chip");
  }

  const phase3WorkspaceSurfaces = [
    "apps/web/lib/workspace/workspace-backup.ts",
    "apps/web/components/workspace/workspace-backup-panel.tsx"
  ];
  for (const relative of phase3WorkspaceSurfaces) {
    try {
      await fs.access(path.join(WORKSPACE_ROOT, relative));
    } catch {
      failures.push(`missing Phase 3 workspace surface: ${relative}`);
    }
  }

  const advancedPanel = await readUtf8("apps/web/components/dashboard/dashboard-advanced-panel.tsx");
  if (!/WorkspaceBackupPanel/.test(advancedPanel)) {
    failures.push("advanced settings missing workspace backup export");
  }
  if (!/OperationsCommandTools/.test(advancedPanel) || !/v1:preflight/.test(advancedPanel)) {
    failures.push("settings advanced panel missing operator preflight/evidence tools");
  }

  const transactionsPage = await readUtf8("apps/web/components/dashboard/transactions-page.tsx");
  if (!/parseRoleFilter/.test(transactionsPage)) {
    failures.push("transactions page missing role-aware queue filter");
  }

  const orderDetailWorkspace = await readUtf8(
    "apps/web/components/marketplace/order-detail-workspace.tsx"
  );
  if (!/OrderActionHub/.test(orderDetailWorkspace)) {
    failures.push("order detail workspace missing action hub");
  }
  if (!/OrderWorkspaceNotesPanel/.test(orderDetailWorkspace)) {
    failures.push("order detail workspace missing off-protocol notes panel");
  }

  const siteHeader = await readUtf8("apps/web/components/shell/site-header.tsx");
  if (!/\/help/.test(siteHeader)) {
    failures.push("site header missing Help nav link");
  }
  if (!/label: "Identity"/.test(siteHeader)) {
    failures.push("site header missing Identity primary nav label");
  }
  if (/\/operator/.test(siteHeader)) {
    failures.push("site header still links to operator console in primary nav");
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

  console.log("R4 client audit passed (C1–C4 + Phase 2 surface checks).");
  console.log(`  scanned ${webFiles.length} web app source files`);
  console.log("  AB-15: session state gated on kernel ingest");
  console.log("  SOC-01-doc: onboarding + operator-security-guide + marketplace entry");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
