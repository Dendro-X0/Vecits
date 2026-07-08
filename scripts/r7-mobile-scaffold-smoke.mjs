#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "apps/desktop/src-tauri/gen/android/build.gradle.kts",
  "apps/desktop/src-tauri/gen/android/settings.gradle",
  "apps/desktop/src-tauri/gen/android/app/build.gradle.kts",
  "apps/desktop/src-tauri/gen/android/app/src/main/AndroidManifest.xml",
  "apps/desktop/src-tauri/gen/android/app/src/main/java/com/vectis/desktop/MainActivity.kt",
];

async function main() {
  const missing = [];
  for (const rel of REQUIRED_FILES) {
    const abs = path.join(WORKSPACE_ROOT, rel);
    try {
      await fs.access(abs);
    } catch {
      missing.push(rel);
    }
  }

  if (missing.length > 0) {
    console.error("R7-M1 mobile scaffold smoke failed:");
    for (const file of missing) {
      console.error(`  - missing ${file}`);
    }
    process.exit(1);
  }

  console.log("R7-M1 mobile scaffold smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
