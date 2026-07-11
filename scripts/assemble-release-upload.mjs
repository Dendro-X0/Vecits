#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTALLER_PATTERN = /\.(exe|dmg|deb|AppImage|msi)$/i;
const ALLOWED_FILENAMES = new Set([
  "vectis-node-docker.tar",
  "vectis-web-static.tar.gz",
  "release-manifest.json",
]);

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

function shouldInclude(filePath) {
  const base = path.basename(filePath);
  if (ALLOWED_FILENAMES.has(base)) {
    return true;
  }
  if (/^vectis-node(?:-[\w.-]+)?(?:\.exe)?$/i.test(base)) {
    return true;
  }
  if (/^cli(?:-[\w.-]+)?(?:\.exe)?$/i.test(base)) {
    return true;
  }
  if (INSTALLER_PATTERN.test(base)) {
    return true;
  }
  return false;
}

async function uniqueDestination(uploadDir, filePath) {
  const base = path.basename(filePath);
  let destination = path.join(uploadDir, base);
  if (!(await exists(destination))) {
    return destination;
  }

  const ext = path.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let index = 2;
  while (await exists(destination)) {
    destination = path.join(uploadDir, `${stem}-${index}${ext}`);
    index += 1;
  }
  return destination;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sourceRoot = path.resolve(WORKSPACE_ROOT, process.argv[2] ?? "release-files");
  const uploadDir = path.resolve(WORKSPACE_ROOT, process.argv[3] ?? "release-upload");
  await fs.rm(uploadDir, { recursive: true, force: true });
  await fs.mkdir(uploadDir, { recursive: true });

  const files = await walkFiles(sourceRoot);
  const selected = files.filter(shouldInclude);
  if (selected.length === 0) {
    throw new Error(`no release files matched in ${sourceRoot}`);
  }

  for (const filePath of selected) {
    const destination = await uniqueDestination(uploadDir, filePath);
    await fs.copyFile(filePath, destination);
    console.log(`  ${path.relative(WORKSPACE_ROOT, filePath)} -> ${path.relative(WORKSPACE_ROOT, destination)}`);
  }

  console.log(`Release upload bundle ready (${selected.length} files): ${uploadDir}`);
}

main().catch((error) => {
  console.error("assemble-release-upload failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
