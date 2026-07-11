#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WORKSPACE_ROOT, "apps", "web", "out");
const DIST_DIR = path.join(WORKSPACE_ROOT, "dist", "web-static");
const OPERATOR_PAGE = path.join(WORKSPACE_ROOT, "apps", "web", "app", "operator", "page.tsx");
const OPERATOR_PAGE_DESKTOP = path.join(
  WORKSPACE_ROOT,
  "apps",
  "web",
  "app",
  "operator",
  "page.desktop.tsx"
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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
  console.log("Building static web shell for self-hosted deployment…");
  run("pnpm", ["--filter", "@new-start/sdk-ts", "build"]);

  const operatorPageOriginal = await swapOperatorPageForDesktop();
  try {
    run("pnpm", ["--filter", "@new-start/web", "build:desktop"], {
      env: { ...process.env, TAURI_BUILD: "1" },
    });
  } finally {
    await restoreOperatorPage(operatorPageOriginal);
  }

  try {
    await fs.access(OUT_DIR);
  } catch {
    console.error(`Missing static export directory: ${OUT_DIR}`);
    process.exit(1);
  }

  await fs.mkdir(DIST_DIR, { recursive: true });
  const manifest = {
    builtAt: new Date().toISOString(),
    outputDir: path.relative(WORKSPACE_ROOT, OUT_DIR),
    notes: [
      "Serve apps/web/out from nginx/Caddy and point NEXT_PUBLIC_NODE_API_BASE_URL at your vectis-node.",
      "For full operator console with server rewrites, use `pnpm --filter @new-start/web build` + `next start` instead.",
    ],
  };
  await fs.writeFile(
    path.join(DIST_DIR, "web-static-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  console.log(`Static web shell written to ${OUT_DIR}`);
  console.log(`Manifest: ${path.relative(WORKSPACE_ROOT, path.join(DIST_DIR, "web-static-manifest.json"))}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
