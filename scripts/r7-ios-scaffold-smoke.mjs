#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_DIRS = ["apps/desktop/src-tauri/gen/ios/Runner.xcodeproj", "apps/desktop/src-tauri/gen/ios/Runner"];

const OPTIONAL_INFO_PLISTS = [
  "apps/desktop/src-tauri/gen/ios/Runner/Info.plist",
  "apps/desktop/src-tauri/gen/ios/Runner/Info.xcconfig",
  "apps/desktop/src-tauri/gen/ios/Runner/Runner/Info.plist"
];

async function main() {
  const missing = [];
  for (const rel of REQUIRED_DIRS) {
    const abs = path.join(WORKSPACE_ROOT, rel);
    try {
      await fs.access(abs);
    } catch {
      missing.push(rel);
    }
  }

  if (missing.length > 0) {
    console.error("R7-M1 iOS scaffold smoke failed:");
    for (const file of missing) {
      console.error(`  - missing ${file}`);
    }
    process.exit(1);
  }

  // Tauri/Xcode scaffold layout can vary slightly by version/template.
  let hasInfoPlist = false;
  for (const rel of OPTIONAL_INFO_PLISTS) {
    const abs = path.join(WORKSPACE_ROOT, rel);
    try {
      await fs.access(abs);
      hasInfoPlist = true;
      break;
    } catch {
      // ignore
    }
  }

  if (!hasInfoPlist) {
    console.error("R7-M1 iOS scaffold smoke failed:");
    console.error("  - could not find an Info.plist in expected scaffold locations");
    process.exit(1);
  }

  console.log("R7-M1 iOS scaffold smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

