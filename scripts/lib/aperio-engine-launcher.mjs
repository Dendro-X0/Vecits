import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_APERIO_ROOT = "E:/Web Projects/aperio";

export function resolveAperioEngineBinary(options = {}) {
  const explicit = options.binaryPath?.trim();
  if (explicit) {
    return path.resolve(explicit);
  }

  const envRoot = process.env.APERIO_ROOT?.trim();
  const aperioRoot = envRoot || options.aperioRoot || DEFAULT_APERIO_ROOT;
  const binaryName = process.platform === "win32" ? "aperio-engine.exe" : "aperio-engine";
  return path.join(aperioRoot, "crates", "target", "debug", binaryName);
}

export function runAperioDiscover(config, options = {}) {
  const binaryPath = resolveAperioEngineBinary(options);
  const payload = typeof config === "string" ? config : JSON.stringify(config);
  const result = spawnSync(binaryPath, ["discover"], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`failed to spawn aperio-engine: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`aperio-engine discover failed: ${detail}`);
  }

  const lines = result.stdout
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(
      "aperio-engine discover returned no JSONL events (rebuild aperio-cli after dispatch fix)",
    );
  }

  return { binaryPath, lines };
}

export async function loadDiscoverConfig(configPath) {
  const content = await fs.readFile(path.resolve(configPath), "utf8");
  return JSON.parse(content);
}

export function summarizeDiscoverRun(lines) {
  let manifest = null;
  let summary = null;
  let signalCount = 0;
  let filteredCount = 0;

  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.type === "manifest") {
      manifest = event.data ?? null;
    } else if (event.type === "summary") {
      summary = event.data ?? null;
    } else if (event.type === "signal") {
      signalCount += 1;
      if (event.data?.filtered === true) {
        filteredCount += 1;
      }
    }
  }

  const keptSignals =
    summary?.kept ??
    lines.filter(line => {
      try {
        const event = JSON.parse(line);
        return event.type === "signal" && event.data?.filtered !== true;
      } catch {
        return false;
      }
    }).length;

  return {
    manifest,
    summary,
    signalCount,
    filteredCount,
    keptSignals,
  };
}
