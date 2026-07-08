#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_ROOTS = [
  path.join(WORKSPACE_ROOT, "target", "release", "bundle"),
  path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "target", "release", "bundle")
];

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const failures = [];
  const manifestPath = path.join(WORKSPACE_ROOT, "dist", "desktop", "desktop-build-manifest.json");
  try {
    await fs.access(manifestPath);
  } catch {
    failures.push("missing dist/desktop/desktop-build-manifest.json — run `npm run build:desktop` first");
  }

  const binariesDir = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "binaries");
  const binaries = await walkFiles(binariesDir);
  const sidecar = binaries.find((file) => path.basename(file).startsWith("vectis-node-"));
  if (!sidecar) {
    failures.push("missing staged vectis-node sidecar under apps/desktop/src-tauri/binaries/");
  }

  const installers = [];
  for (const bundleRoot of BUNDLE_ROOTS) {
    const found = await walkFiles(bundleRoot);
    installers.push(
      ...found.filter((file) => /\.(exe|msi|dmg|deb|AppImage)$/i.test(file))
    );
  }
  const releaseArtifacts = [...new Set(installers)];

  if (releaseArtifacts.length === 0) {
    failures.push(
      "no installer found under target/release/bundle — run `npm run build:desktop`"
    );
  }

  if (failures.length > 0) {
    console.error("R7 desktop release smoke failed:");
    for (const item of failures) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  console.log("R7 desktop release smoke passed.");
  if (sidecar) {
    const stat = await fs.stat(sidecar);
    console.log(`  sidecar: ${path.relative(WORKSPACE_ROOT, sidecar)} (${formatBytes(stat.size)})`);
  }
  for (const artifact of releaseArtifacts) {
    const stat = await fs.stat(artifact);
    console.log(`  installer: ${path.relative(WORKSPACE_ROOT, artifact)} (${formatBytes(stat.size)})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
