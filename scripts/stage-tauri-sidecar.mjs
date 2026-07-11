#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BINARIES_DIR = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "binaries");

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

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const release = process.argv.includes("--release");
  const profile = release ? "release" : "debug";
  const triple = targetTriple();
  const ext = process.platform === "win32" ? ".exe" : "";
  const source = path.join(WORKSPACE_ROOT, "target", profile, `vectis-node${ext}`);
  const stagedName = `vectis-node-${triple}${ext}`;
  const destination = path.join(BINARIES_DIR, stagedName);

  try {
    await fs.access(source);
  } catch {
    console.log(`Building vectis-node (${profile}) for Tauri sidecar staging…`);
    const buildArgs = ["build", "--bin", "vectis-node"];
    if (release) {
      buildArgs.push("--release");
    }
    run("cargo", buildArgs);
  }

  await fs.mkdir(BINARIES_DIR, { recursive: true });
  await fs.copyFile(source, destination);
  console.log(`Staged Tauri sidecar: ${path.relative(WORKSPACE_ROOT, destination)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
