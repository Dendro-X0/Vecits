#!/usr/bin/env node
/**
 * R10-E1 — remote /health smoke against VECTIS_REMOTE_BASE_URL (or --base-url).
 * Writes evidence under target/r10-evidence/<runId>/ when --export is set.
 *
 * Claim: reachability only (PRG-1 class 1). Not a full exchange.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "./lib/ga6-drill-core.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    baseUrl: process.env.VECTIS_REMOTE_BASE_URL ?? "",
    exportEvidence: argv.includes("--export"),
    runId: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--base-url") result.baseUrl = argv[++i];
    else if (arg === "--run-id") result.runId = argv[++i];
  }
  return result;
}

function normalizeBaseUrl(url) {
  return String(url ?? "").trim().replace(/\/+$/, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  if (!baseUrl) {
    throw new Error(
      "Set VECTIS_REMOTE_BASE_URL or pass --base-url http://<host>:7878 (LAN or Tailscale)",
    );
  }

  const healthUrl = `${baseUrl}/health`;
  const started = Date.now();
  let health;
  try {
    health = await fetchJson(healthUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`R10 remote health FAILED (${healthUrl}): ${message}`);
  }
  const elapsedMs = Date.now() - started;

  if (health?.status !== "ok") {
    throw new Error(`R10 remote health FAILED: status=${health?.status ?? "missing"}`);
  }

  const runId = args.runId || `r10-health-${Date.now()}`;
  const summary = {
    pass: true,
    step: "R10-E1",
    gate: "PRG-1-reachability",
    runId,
    baseUrl,
    healthUrl,
    elapsedMs,
    healthStatus: health.status,
    eventCount: health?.data_dir?.event_count ?? null,
    latestSeq: health?.data_dir?.latest_seq ?? null,
    claim: "Remote /health ok — reachability only; not pin honesty, not exchange",
    recordedAt: new Date().toISOString(),
  };

  console.log("R10 remote health passed.");
  console.log(JSON.stringify(summary, null, 2));

  if (args.exportEvidence) {
    const outDir = path.join(WORKSPACE_ROOT, "target", "r10-evidence", runId);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, "health-from-peer.json"), `${JSON.stringify(health, null, 2)}\n`);
    await fs.writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(
      path.join(outDir, "operator-notes.md"),
      `# R10 remote health\n\nPASS — GET ${healthUrl}\n\nClaim: reachability only.\n`,
    );
    console.log(`Evidence: ${outDir}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
