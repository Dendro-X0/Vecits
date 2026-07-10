#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANE_TEMPLATES } from "./lib/discovery-bridge/lane-templates.mjs";
import {
  choosePort,
  stopProcess,
  waitForNode,
} from "./lib/ga6-drill-core.mjs";
import {
  buildR2ExchangeEvents,
  submitEventsViaHttp,
  verifyExchangeClosed,
} from "./lib/r2-exchange-core.mjs";
import {
  COMMUNITY_ARTIFACT_LANES,
  COMMUNITY_ARTIFACT_LANE_PRESETS,
  DISCOVERY_LANE_DEFAULTS,
  fixturePath,
  SPECIALIZED_LANES,
} from "./lib/r6-lane-template-registry.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { DATA_DIRS } from "./lib/data-dirs.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    dataDir: DATA_DIRS.r6L2,
    skipBuild: argv.includes("--no-build"),
    fixturesOnly: argv.includes("--fixtures-only"),
    lanes: [...COMMUNITY_ARTIFACT_LANES],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--data-dir") result.dataDir = path.resolve(argv[++i]);
    else if (arg === "--lane") {
      const lane = argv[++i];
      if (!COMMUNITY_ARTIFACT_LANES.includes(lane)) {
        throw new Error(`--lane must be one of: ${COMMUNITY_ARTIFACT_LANES.join(", ")}`);
      }
      result.lanes = [lane];
    }
  }

  return result;
}

async function resolveNodeBinary(skipBuild) {
  try {
    return await resolveReleaseBinary(WORKSPACE_ROOT, { buildIfMissing: !skipBuild });
  } catch {
    const fallback =
      process.platform === "win32"
        ? path.join(WORKSPACE_ROOT, "target", "release", "vectis-node.exe")
        : path.join(WORKSPACE_ROOT, "target", "release", "vectis-node");
    await fs.access(fallback);
    return fallback;
  }
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

async function validateFixtureCoverage() {
  const failures = [];

  for (const lane of COMMUNITY_ARTIFACT_LANES) {
    const preset = COMMUNITY_ARTIFACT_LANE_PRESETS[lane];
    for (const kind of ["accept", "dispute"]) {
      const file = preset.fixtures[kind];
      try {
        await fs.access(fixturePath(file));
      } catch {
        failures.push(`missing fixture for ${lane} (${kind}): fixtures/valid/${file}`);
      }
    }
  }

  for (const entry of SPECIALIZED_LANES) {
    if (entry.fixtureAccept) {
      try {
        await fs.access(fixturePath(entry.fixtureAccept));
      } catch {
        failures.push(`missing specialized fixture: fixtures/valid/${entry.fixtureAccept}`);
      }
    }
    if (entry.fixtureDispute) {
      try {
        await fs.access(fixturePath(entry.fixtureDispute));
      } catch {
        failures.push(`missing specialized fixture: fixtures/valid/${entry.fixtureDispute}`);
      }
    }
  }

  const discoveryKeys = Object.keys(LANE_TEMPLATES).sort();
  const registryKeys = Object.keys(DISCOVERY_LANE_DEFAULTS).sort();
  if (discoveryKeys.join(",") !== registryKeys.join(",")) {
    failures.push(
      `discovery lane-templates.mjs keys diverge from r6-lane-template-registry (${discoveryKeys.join(",")} vs ${registryKeys.join(",")})`,
    );
  } else {
    for (const lane of discoveryKeys) {
      if (stableJson(LANE_TEMPLATES[lane]) !== stableJson(DISCOVERY_LANE_DEFAULTS[lane])) {
        failures.push(`discovery template mismatch for lane: ${lane}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  return {
    artifactLaneCount: COMMUNITY_ARTIFACT_LANES.length,
    fixtureFilesChecked:
      COMMUNITY_ARTIFACT_LANES.length * 2 +
      SPECIALIZED_LANES.filter((entry) => entry.fixtureAccept).length,
  };
}

async function runLaneDrills({ dataDir, lanes, skipBuild }) {
  const binaryPath = await resolveNodeBinary(skipBuild);
  const { runCli, spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);
  const commandLog = [];

  try {
    await fs.access(path.join(dataDir, "manifest.json"));
  } catch {
    runCli(["node", "init", "--data-dir", dataDir], commandLog);
  }

  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serve = spawnNodeServe(dataDir, port, commandLog);
  await waitForNode(baseUrl, 45_000);

  const results = [];
  const runIdBase = Date.now();

  try {
    for (const [index, lane] of lanes.entries()) {
      const runId = `l2-${runIdBase}-${index}-${lane}`;
      const exchange = await buildR2ExchangeEvents(lane, runId);
      await submitEventsViaHttp(baseUrl, exchange.events);
      await verifyExchangeClosed(baseUrl, exchange.orderId, exchange.asOf);
      results.push({
        lane,
        orderId: exchange.orderId,
        eventCount: exchange.events.length,
        status: "closed",
      });
    }
  } finally {
    await stopProcess(serve);
  }

  return { baseUrl, dataDir, results };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixtureSummary = await validateFixtureCoverage();
  console.log(
    `R6-L2 fixture coverage OK (${fixtureSummary.fixtureFilesChecked} files, ${fixtureSummary.artifactLaneCount} artifact lanes).`,
  );

  if (args.fixturesOnly) {
    console.log("R6-L2 lane template smoke passed (fixtures-only).");
    return;
  }

  const drillSummary = await runLaneDrills(args);
  console.log("R6-L2 lane template smoke passed.");
  console.log(
    JSON.stringify(
      {
        passed: true,
        lanes: drillSummary.results,
        dataDir: drillSummary.dataDir,
        baseUrl: drillSummary.baseUrl,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("R6-L2 lane template smoke failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
