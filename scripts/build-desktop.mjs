#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BINARIES_DIR = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "binaries");
const ICONS_DIR = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "icons");
const OPERATOR_PAGE = path.join(WORKSPACE_ROOT, "apps", "web", "app", "operator", "page.tsx");
const OPERATOR_PAGE_DESKTOP = path.join(
  WORKSPACE_ROOT,
  "apps",
  "web",
  "app",
  "operator",
  "page.desktop.tsx"
);

function targetTriple() {
  const arch = process.arch === "x64" ? "x86_64" : process.arch;
  if (process.platform === "win32") {
    return `${arch}-pc-windows-msvc`;
  }
  if (process.platform === "darwin") {
    return `${arch}-apple-darwin`;
  }
  return `${arch}-unknown-linux-gnu`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function bundleTarget() {
  if (process.env.TAURI_BUNDLE_TARGET?.trim()) {
    return process.env.TAURI_BUNDLE_TARGET.trim();
  }
  if (process.platform === "win32") {
    return "nsis";
  }
  if (process.platform === "darwin") {
    return "dmg";
  }
  return "deb";
}

async function ensureIcons() {
  const required = ["icon.ico", "32x32.png", "128x128.png", "128x128@2x.png"];
  const missing = [];
  for (const name of required) {
    try {
      await fs.access(path.join(ICONS_DIR, name));
    } catch {
      missing.push(name);
    }
  }
  if (missing.length === 0) {
    return;
  }
  console.log(`Generating desktop icons (missing: ${missing.join(", ")})`);
  run("pnpm", ["brand:icons"]);
}

async function stageNodeBinary() {
  const triple = targetTriple();
  const ext = process.platform === "win32" ? ".exe" : "";
  const source = path.join(WORKSPACE_ROOT, "target", "release", `vectis-node${ext}`);
  const stagedName = `vectis-node-${triple}${ext}`;
  const destination = path.join(BINARIES_DIR, stagedName);

  try {
    await fs.access(source);
  } catch {
    console.error(`Missing release binary: ${source}`);
    console.error("Run `npm run v1:build-release` first.");
    process.exit(1);
  }

  await fs.mkdir(BINARIES_DIR, { recursive: true });
  await fs.copyFile(source, destination);
  console.log(`Staged sidecar binary: ${path.relative(WORKSPACE_ROOT, destination)}`);
  return { stagedName, destination };
}

async function writeBundleManifest({ stagedName, bundleTargetName }) {
  const manifestDir = path.join(WORKSPACE_ROOT, "dist", "desktop");
  await fs.mkdir(manifestDir, { recursive: true });
  const manifest = {
    builtAt: new Date().toISOString(),
    targetTriple: targetTriple(),
    bundleTarget: bundleTargetName,
    sidecarBinary: stagedName,
    notes:
      "Installer artifacts are written under target/release/bundle/ (workspace root) after `tauri build`."
  };
  await fs.writeFile(
    path.join(manifestDir, "desktop-build-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function swapOperatorPageForDesktop() {
  const original = await fs.readFile(OPERATOR_PAGE, "utf8");
  const desktop = await fs.readFile(OPERATOR_PAGE_DESKTOP, "utf8");
  await fs.writeFile(OPERATOR_PAGE, desktop);
  return original;
}

async function restoreOperatorPage(original) {
  await fs.writeFile(OPERATOR_PAGE, original);
}

async function main() {
  const skipRelease = process.argv.includes("--skip-release");
  const skipWeb = process.argv.includes("--skip-web");
  const tauriOnly = process.argv.includes("--tauri-only");

  console.log("R7-D5 desktop release build");
  if (!skipRelease && !tauriOnly) {
    run("npm", ["run", "v1:build-release"]);
  }
  const staged = await stageNodeBinary();
  await ensureIcons();

  if (!skipWeb && !tauriOnly) {
    const operatorPageOriginal = await swapOperatorPageForDesktop();
    try {
      console.log("Building static web assets for Tauri…");
      run("pnpm", ["--filter", "@new-start/sdk-ts", "build"]);
      run("pnpm", ["--filter", "@new-start/web", "build:desktop"], {
        env: { ...process.env, TAURI_BUILD: "1" }
      });
    } finally {
      await restoreOperatorPage(operatorPageOriginal);
    }
  }

  const bundle = bundleTarget();
  console.log(`Running tauri build (bundle: ${bundle})…`);
  run("pnpm", ["--filter", "@vectis/desktop", "exec", "tauri", "build", "--bundles", bundle]);

  await writeBundleManifest({ stagedName: staged.stagedName, bundleTargetName: bundle });
  console.log("Desktop release build complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
