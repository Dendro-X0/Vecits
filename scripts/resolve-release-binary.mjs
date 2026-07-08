#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const DIST_DIR = path.join(WORKSPACE_ROOT, "dist", "release");

async function main() {
  let entries;
  try {
    entries = await fs.readdir(DIST_DIR);
  } catch {
    console.error("No release directory found. Run: npm run v1:build-release");
    process.exit(1);
  }

  const folder = entries.find(name => name.startsWith("vectis-node-"));
  if (!folder) {
    console.error("No release folder found. Run: npm run v1:build-release");
    process.exit(1);
  }

  const dir = path.join(DIST_DIR, folder);
  const exe = process.platform === "win32" ? "vectis-node.exe" : "vectis-node";
  const binary = path.join(dir, exe);

  try {
    await fs.access(binary);
  } catch {
    console.error(`Binary missing: ${binary}`);
    process.exit(1);
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ folder, dir, binary }, null, 2));
    return;
  }

  console.log(binary);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
