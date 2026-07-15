#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTALLER_PATTERN = /\.(exe|msi|dmg|deb|AppImage|apk|aab)$/i;

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

function platformLabel(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/desktop-windows/") || normalized.includes("/nsis/")) {
    return "windows";
  }
  if (normalized.includes("/desktop-macos/") || normalized.includes("/dmg/")) {
    return "macos";
  }
  if (normalized.includes("/desktop-linux/") || normalized.includes("/deb/")) {
    return "linux";
  }
  if (normalized.includes("/android-apk/") || normalized.endsWith(".apk") || normalized.endsWith(".aab")) {
    return "android";
  }
  if (normalized.includes("aarch64-apple-darwin")) {
    return "macos-arm64";
  }
  if (normalized.includes("x86_64-apple-darwin")) {
    return "macos-x64";
  }
  if (normalized.includes("x86_64-pc-windows-msvc")) {
    return "windows-x64";
  }
  if (normalized.includes("x86_64-unknown-linux-gnu")) {
    return "linux-x64";
  }
  return null;
}

function installerDestination(label, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".apk") {
    return `vectis-android.apk`;
  }
  if (ext === ".aab") {
    return `vectis-android.aab`;
  }
  if (ext === ".dmg") {
    return `vectis-desktop-macos.dmg`;
  }
  if (ext === ".deb") {
    return `vectis-desktop-linux-amd64.deb`;
  }
  if (ext === ".exe" || ext === ".msi") {
    return `vectis-desktop-windows-x64-setup${ext}`;
  }
  if (ext === ".appimage") {
    return `vectis-desktop-linux-x86_64.AppImage`;
  }
  return `vectis-installer-${label}${ext}`;
}

async function copyIfExists(source, destination) {
  try {
    await fs.access(source);
  } catch {
    return false;
  }
  await fs.copyFile(source, destination);
  return true;
}

async function main() {
  const sourceRoot = path.resolve(WORKSPACE_ROOT, process.argv[2] ?? "release-files");
  const uploadDir = path.resolve(WORKSPACE_ROOT, process.argv[3] ?? "release-upload");
  await fs.rm(uploadDir, { recursive: true, force: true });
  await fs.mkdir(uploadDir, { recursive: true });

  const copied = [];

  const dockerSource = path.join(sourceRoot, "vectis-node-docker.tar");
  if (await copyIfExists(dockerSource, path.join(uploadDir, "vectis-node-docker.tar"))) {
    copied.push("vectis-node-docker.tar");
  }

  const webTarSource = path.join(sourceRoot, "vectis-web-static.tar.gz");
  if (await copyIfExists(webTarSource, path.join(uploadDir, "vectis-web-static.tar.gz"))) {
    copied.push("vectis-web-static.tar.gz");
  }

  const manifestSource = path.join(sourceRoot, "release-manifest.json");
  if (await copyIfExists(manifestSource, path.join(uploadDir, "release-manifest.json"))) {
    copied.push("release-manifest.json");
  }

  const allFiles = await walkFiles(sourceRoot);
  const kernelFiles = allFiles.filter((filePath) => {
    const base = path.basename(filePath);
    return /^vectis-node(?:-[\w.-]+)?(?:\.exe)?$/i.test(base) || /^cli(?:-[\w.-]+)?(?:\.exe)?$/i.test(base);
  });

  for (const filePath of kernelFiles) {
    const label = platformLabel(filePath);
    if (!label) {
      continue;
    }
    const destination = path.join(uploadDir, path.basename(filePath));
    if (!(await copyIfExists(filePath, destination))) {
      continue;
    }
    copied.push(path.basename(destination));
  }

  const installers = allFiles.filter((filePath) => INSTALLER_PATTERN.test(path.basename(filePath)));
  for (const filePath of installers) {
    const label = platformLabel(filePath) ?? "desktop";
    const destination = path.join(uploadDir, installerDestination(label, filePath));
    if (await copyIfExists(filePath, destination)) {
      copied.push(path.basename(destination));
    }
  }

  const unique = [...new Set(copied)];
  if (unique.length === 0) {
    throw new Error(`no release files matched in ${sourceRoot}`);
  }

  console.log("Release upload bundle:");
  for (const name of unique.sort()) {
    console.log(`  - ${name}`);
  }
  console.log(`Ready (${unique.length} files): ${uploadDir}`);
}

main().catch((error) => {
  console.error("assemble-release-upload failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
