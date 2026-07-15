import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ICON_SOURCE = path.join(WORKSPACE_ROOT, "apps", "desktop", "assets", "icon.svg");
const ICONS_DIR = path.join(WORKSPACE_ROOT, "apps", "desktop", "src-tauri", "icons");
const ICON_STAMP = path.join(ICONS_DIR, ".icon-source");

const REQUIRED = ["icon.ico", "32x32.png", "128x128.png", "128x128@2x.png"];

async function newestRequiredIconMtime() {
  let newest = 0;
  for (const name of REQUIRED) {
    try {
      const stat = await fs.stat(path.join(ICONS_DIR, name));
      newest = Math.max(newest, stat.mtimeMs);
    } catch {
      return 0;
    }
  }
  return newest;
}

export async function ensureTauriIcons({ force = false } = {}) {
  let sourceMtime = 0;
  try {
    sourceMtime = (await fs.stat(ICON_SOURCE)).mtimeMs;
  } catch {
    console.warn(`Missing desktop icon source: ${path.relative(WORKSPACE_ROOT, ICON_SOURCE)}`);
    return false;
  }

  const missing = [];
  for (const name of REQUIRED) {
    try {
      await fs.access(path.join(ICONS_DIR, name));
    } catch {
      missing.push(name);
    }
  }

  const stamp = await fs.readFile(ICON_STAMP, "utf8").catch(() => "");
  const stampMatches = stamp.trim() === String(sourceMtime);
  const iconsFresh = missing.length === 0 && stampMatches && !force;
  if (iconsFresh) {
    return false;
  }

  const generatedMtime = await newestRequiredIconMtime();
  if (!force && missing.length === 0 && generatedMtime >= sourceMtime && stampMatches) {
    return false;
  }

  console.log(
    missing.length > 0
      ? `Generating desktop icons (missing: ${missing.join(", ")})`
      : "Regenerating desktop icons from apps/desktop/assets/icon.svg"
  );

  const result = spawnSync("pnpm", ["brand:icons"], {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  await fs.mkdir(ICONS_DIR, { recursive: true });
  await fs.writeFile(ICON_STAMP, `${sourceMtime}\n`, "utf8");
  return true;
}
