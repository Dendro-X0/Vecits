#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage:
  node ./scripts/r7-mobile-ios-command.mjs <dev|build> [options] [-- <extra tauri args>]

Options:
  --pinned-node-url <url>   Set mobile pinned node URL (defaults per mode)
  --release                 Enable mobile release policy guards
  --dry-run                 Print resolved env/command without executing`);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  if (command !== "dev" && command !== "build") {
    usage();
    throw new Error("first argument must be dev or build");
  }

  const result = {
    command,
    release: false,
    dryRun: false,
    pinnedNodeUrl: "",
    passthrough: []
  };

  let passthroughMode = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (passthroughMode) {
      result.passthrough.push(arg);
      continue;
    }

    if (arg === "--") {
      passthroughMode = true;
      continue;
    }
    if (arg === "--release") {
      result.release = true;
      continue;
    }
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (arg === "--pinned-node-url") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("missing value for --pinned-node-url");
      }
      result.pinnedNodeUrl = value.trim();
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return result;
}

function defaultPinnedNodeUrl(command) {
  if (command === "dev") {
    // Best-effort dev default; if it doesn't reach your host, pass --pinned-node-url.
    return "http://127.0.0.1:7878";
  }
  return "https://example.invalid";
}

function validatePinnedNodeUrl(url, release) {
  if (!url) {
    throw new Error("pinned node URL is required");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("pinned node URL must be an absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("pinned node URL must use http:// or https://");
  }
  if (release && parsed.protocol !== "https:") {
    throw new Error("release mode requires an HTTPS pinned node URL");
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const pinnedNodeUrl = parsed.pinnedNodeUrl || defaultPinnedNodeUrl(parsed.command);
  validatePinnedNodeUrl(pinnedNodeUrl, parsed.release);

  const releaseFlag = parsed.release ? "1" : "0";
  const tauriArgs = ["--filter", "@vectis/desktop", "exec", "tauri", "ios", parsed.command];
  if (parsed.passthrough.length > 0) {
    tauriArgs.push("--", ...parsed.passthrough);
  }

  const env = {
    ...process.env,
    VECTIS_MOBILE_PINNED_NODE_URL: pinnedNodeUrl,
    NEXT_PUBLIC_MOBILE_PINNED_NODE_URL: pinnedNodeUrl,
    VECTIS_MOBILE_RELEASE: releaseFlag,
    NEXT_PUBLIC_VECTIS_MOBILE_RELEASE: releaseFlag
  };

  if (parsed.dryRun) {
    console.log("R7-M2 mobile iOS command dry-run");
    console.log(`  command: pnpm ${tauriArgs.join(" ")}`);
    console.log(`  VECTIS_MOBILE_PINNED_NODE_URL=${env.VECTIS_MOBILE_PINNED_NODE_URL}`);
    console.log(`  VECTIS_MOBILE_RELEASE=${env.VECTIS_MOBILE_RELEASE}`);
    return;
  }

  const result = spawnSync("pnpm", tauriArgs, {
    cwd: WORKSPACE_ROOT,
    stdio: "inherit",
    env,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

