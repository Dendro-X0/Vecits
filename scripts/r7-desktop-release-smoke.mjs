#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_ROOTS = [
  path.join(WORKSPACE_ROOT, "target", "release", "bundle"),
  path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "target", "release", "bundle"),
];
const MANIFEST_PATH = path.join(WORKSPACE_ROOT, "dist", "desktop", "desktop-build-manifest.json");
const BINARIES_DIR = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "binaries");
const WEB_OUT_INDEX = path.join(WORKSPACE_ROOT, "apps", "web", "out", "index.html");
const ICONS_DIR = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "icons");
const REQUIRED_ICONS = ["icon.ico", "32x32.png", "128x128.png", "128x128@2x.png"];

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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function record(results, name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(pass ? `PASS ${name}` : `FAIL ${name}`, detail ? `— ${detail}` : "");
}

async function main() {
  const results = [];

  try {
    await fs.access(MANIFEST_PATH);
    record(results, "desktop build manifest", true, path.relative(WORKSPACE_ROOT, MANIFEST_PATH));
  } catch {
    record(
      results,
      "desktop build manifest",
      false,
      "missing dist/desktop/desktop-build-manifest.json — run `pnpm build:desktop` first",
    );
  }

  let manifest = null;
  if (results.at(-1)?.pass) {
    try {
      manifest = await readJson(MANIFEST_PATH);
      const hasFields =
        typeof manifest?.builtAt === "string" &&
        typeof manifest?.targetTriple === "string" &&
        typeof manifest?.bundleTarget === "string" &&
        typeof manifest?.sidecarBinary === "string";
      record(
        results,
        "manifest fields",
        hasFields,
        hasFields
          ? `${manifest.bundleTarget} · ${manifest.targetTriple}`
          : "expected builtAt, targetTriple, bundleTarget, sidecarBinary",
      );
    } catch (error) {
      record(
        results,
        "manifest fields",
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const binaries = await walkFiles(BINARIES_DIR);
  const sidecar = binaries.find((file) => path.basename(file).startsWith("vectis-node-"));
  if (!sidecar) {
    record(
      results,
      "staged vectis-node sidecar",
      false,
      "missing under apps/desktop/src-tauri/binaries/",
    );
  } else {
    const stat = await fs.stat(sidecar);
    record(
      results,
      "staged vectis-node sidecar",
      stat.size > 1024 * 1024,
      `${path.basename(sidecar)} (${formatBytes(stat.size)})`,
    );
    if (manifest?.sidecarBinary) {
      record(
        results,
        "manifest sidecar name",
        path.basename(sidecar) === manifest.sidecarBinary,
        manifest.sidecarBinary,
      );
    }
  }

  for (const iconName of REQUIRED_ICONS) {
    try {
      await fs.access(path.join(ICONS_DIR, iconName));
      record(results, `desktop icon ${iconName}`, true);
    } catch {
      record(results, `desktop icon ${iconName}`, false, "run pnpm brand:icons");
    }
  }

  try {
    await fs.access(WEB_OUT_INDEX);
    record(results, "static web export", true, path.relative(WORKSPACE_ROOT, WEB_OUT_INDEX));
  } catch {
    record(
      results,
      "static web export",
      false,
      "missing apps/web/out/index.html — rebuild with TAURI_BUILD=1",
    );
  }

  const installers = [];
  for (const bundleRoot of BUNDLE_ROOTS) {
    const found = await walkFiles(bundleRoot);
    installers.push(...found.filter((file) => /\.(exe|msi|dmg|deb|AppImage)$/i.test(file)));
  }
  const releaseArtifacts = [...new Set(installers)];

  if (releaseArtifacts.length === 0) {
    record(
      results,
      "platform installer artifact",
      false,
      "none under target/release/bundle — run `pnpm build:desktop`",
    );
  } else {
    for (const artifact of releaseArtifacts) {
      const stat = await fs.stat(artifact);
      record(
        results,
        `installer ${path.basename(artifact)}`,
        stat.size > 5 * 1024 * 1024,
        `${path.relative(WORKSPACE_ROOT, artifact)} (${formatBytes(stat.size)})`,
      );
    }
  }

  const failed = results.filter((entry) => !entry.pass);
  if (failed.length > 0) {
    console.error(`\nR7 desktop release smoke failed (${failed.length}/${results.length}).`);
    process.exit(1);
  }

  console.log(`\nR7 desktop release smoke passed (${results.length} checks).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
