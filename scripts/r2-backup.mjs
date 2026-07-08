#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    dataDir: path.join(WORKSPACE_ROOT, "vectis-data-r2"),
    destDir: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (argv[i] === "--dest") result.destDir = path.resolve(argv[++i]);
  }
  if (!result.destDir) {
    const stamp = new Date().toISOString().slice(0, 10);
    result.destDir = path.join(WORKSPACE_ROOT, "target", "backups", `r2-${stamp}`);
  }
  return result;
}

async function sha256File(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function copyIfExists(src, dest) {
  try {
    await fs.copyFile(src, dest);
    const hash = await sha256File(dest);
    return { copied: true, path: dest, sha256: hash };
  } catch {
    return { copied: false, path: dest };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(args.destDir, { recursive: true });

  const files = ["events.log", "manifest.json", "peers.json", "node.db"];
  const copied = [];
  for (const name of files) {
    const src = path.join(args.dataDir, name);
    const dest = path.join(args.destDir, name);
    const result = await copyIfExists(src, dest);
    if (result.copied) {
      copied.push({ name, sha256: result.sha256 });
    }
  }

  if (!copied.some(entry => entry.name === "events.log")) {
    throw new Error(`events.log not found in ${args.dataDir}`);
  }

  const summary = {
    backedUpAt: new Date().toISOString(),
    dataDir: args.dataDir,
    destDir: args.destDir,
    files: copied,
  };
  await fs.writeFile(
    path.join(args.destDir, "backup-manifest.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log(`R2 backup completed: ${args.destDir}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
