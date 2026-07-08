#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "docs/specs/r7-m2-remote-pinned-node-wiring-spec.md",
  "docs/runbooks/r7-m2-remote-node-smoke-runbook.md",
  "docs/runbooks/mobile-remote-pinned-node-operator-runbook.md",
  "docs/runbooks/r7-m1-ios-mac-host-handoff-runbook.md",
  "apps/web/lib/node-client-base-url.ts",
  "apps/web/components/auth/register-form.tsx",
  "apps/web/components/marketplace/start-exchange-panel.tsx",
  "apps/web/components/marketplace/order-exchange-panel.tsx",
  "apps/web/components/mobile/mobile-pinned-node-notice.tsx",
];

async function readRequiredFiles() {
  const contents = {};
  const missing = [];

  for (const rel of REQUIRED_FILES) {
    const abs = path.join(WORKSPACE_ROOT, rel);
    try {
      contents[rel] = await fs.readFile(abs, "utf8");
    } catch {
      missing.push(rel);
    }
  }

  if (missing.length > 0) {
    console.error("R7-M2 remote node smoke failed:");
    for (const file of missing) {
      console.error(`  - missing ${file}`);
    }
    process.exit(1);
  }

  return contents;
}

function expectIncludes(label, text, snippet) {
  if (!text.includes(snippet)) {
    console.error(`R7-M2 remote node smoke failed: ${label}`);
    console.error(`  expected snippet: ${JSON.stringify(snippet)}`);
    process.exit(1);
  }
}

async function main() {
  const files = await readRequiredFiles();

  const nodeUrlLib = files["apps/web/lib/node-client-base-url.ts"];
  expectIncludes("node URL lib defines mobile override key", nodeUrlLib, "vectis.mobile.pinnedNodeUrlOverride");
  expectIncludes("node URL lib validates absolute mobile URL", nodeUrlLib, "Mobile pinned node must be an absolute URL");
  expectIncludes("node URL lib enforces HTTPS in release", nodeUrlLib, "Mobile release requires an HTTPS pinned node URL.");
  expectIncludes("node URL lib labels env pinned node source", nodeUrlLib, 'source: "mobile-env"');
  expectIncludes("node URL lib fails fast if mobile runtime lacks pinned URL", nodeUrlLib, "if (isMobileRuntime()) {\n      return {\n        baseUrl: \"\",\n        source: \"mobile-runtime\"");
  expectIncludes("node URL lib exposes mobile pinned node error helper", nodeUrlLib, "export function resolveMobilePinnedNodeError()");

  const registerForm = files["apps/web/components/auth/register-form.tsx"];
  expectIncludes("register form resolves node connection info", registerForm, "resolveNodeConnectionInfo");
  expectIncludes("register form validates pinned mobile node", registerForm, "resolveMobilePinnedNodeError");
  expectIncludes("register form uses pinned base URL on mobile", registerForm, "nodeInfo.isMobileRuntime\n        ? resolveNodeClientBaseUrl()");
  expectIncludes("register form hides baseUrl input on mobile", registerForm, "!compact && !nodeInfo.isMobileRuntime");

  const startPanel = files["apps/web/components/marketplace/start-exchange-panel.tsx"];
  expectIncludes("start exchange panel uses mobile pinned node helper", startPanel, "resolveMobilePinnedNodeError");
  expectIncludes("start exchange panel shows mobile notice", startPanel, "MobilePinnedNodeNotice");
  expectIncludes("start exchange panel blocks start on mobile error", startPanel, "disabled={!canSubmit || Boolean(mobilePinnedNodeError) || isSubmitting}");

  const orderPanel = files["apps/web/components/marketplace/order-exchange-panel.tsx"];
  expectIncludes("order exchange panel uses mobile pinned node helper", orderPanel, "resolveMobilePinnedNodeError");
  expectIncludes("order exchange panel shows mobile notice", orderPanel, "MobilePinnedNodeNotice");
  expectIncludes("order exchange panel fails fast on mobile error", orderPanel, "if (mobilePinnedNodeError) {\n      setErrorMessage(mobilePinnedNodeError);\n      return;");

  const mobileNotice = files["apps/web/components/mobile/mobile-pinned-node-notice.tsx"];
  expectIncludes("mobile notice uses pinned node error helper", mobileNotice, "resolveMobilePinnedNodeError");
  expectIncludes("mobile notice links to settings", mobileNotice, "/dashboard/settings");

  console.log("R7-M2 remote node smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

