#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT_FILE = path.join(WORKSPACE_ROOT, ".dev", "desktop-web-port");
const NODE_DIRECT = process.env.VECTIS_NODE_URL ?? "http://127.0.0.1:7878";

async function readDevWebPort() {
  try {
    const raw = await fs.readFile(PORT_FILE, "utf8");
    const port = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error instanceof Error ? error.message : String(error)
    };
  }
}

function record(results, name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(pass ? `PASS ${name}` : `FAIL ${name}`, detail ? `— ${detail}` : "");
}

async function main() {
  const results = [];
  const devPort = await readDevWebPort();
  const proxyBase = devPort ? `http://127.0.0.1:${devPort}/api/node` : null;

  const healthDirect = await fetchJson(`${NODE_DIRECT}/health`);
  record(
    results,
    "sidecar /health (direct)",
    healthDirect.ok && healthDirect.body?.status === "ok",
    healthDirect.ok ? NODE_DIRECT : `status ${healthDirect.status}`
  );

  const discoveryDirect = await fetchJson(`${NODE_DIRECT}/state/discovery?limit=1&alpha_defaults=true`);
  record(
    results,
    "sidecar /state/discovery (direct)",
    discoveryDirect.ok && Array.isArray(discoveryDirect.body?.data?.offers),
    discoveryDirect.ok ? `offers=${discoveryDirect.body.data.offers.length}` : `status ${discoveryDirect.status}`
  );

  if (proxyBase) {
    const healthProxy = await fetchJson(`${proxyBase}/health`);
    const proxyReachable = healthProxy.status !== 0;
    record(
      results,
      "Next /api/node/health (dev proxy)",
      !proxyReachable || (healthProxy.ok && healthProxy.body?.status === "ok"),
      proxyReachable
        ? healthProxy.ok
          ? proxyBase
          : `status ${healthProxy.status}`
        : `skipped — dev web server not reachable on port ${devPort}`
    );

    if (proxyReachable) {
      const discoveryProxy = await fetchJson(`${proxyBase}/state/discovery?limit=1&alpha_defaults=true`);
      record(
        results,
        "Next /api/node/state/discovery (dev proxy)",
        discoveryProxy.ok && Array.isArray(discoveryProxy.body?.data?.offers),
        discoveryProxy.ok ? `offers=${discoveryProxy.body.data.offers.length}` : `status ${discoveryProxy.status}`
      );
    }
  } else {
    record(results, "Next dev proxy checks", true, "skipped — .dev/desktop-web-port not found");
  }

  const failed = results.filter((entry) => !entry.pass);
  if (failed.length > 0) {
    console.error(`\nDesktop connection smoke failed (${failed.length}/${results.length}).`);
    process.exit(1);
  }

  console.log(`\nDesktop connection smoke passed (${results.length} checks).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
