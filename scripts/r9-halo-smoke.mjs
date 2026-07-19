#!/usr/bin/env node

/**
 * R9-H2 — LAN halo reconcile smoke (maintainer).
 *
 * Models Mode A: designated halo node (market / LAN authority) accumulates
 * events; upstream peer pull-syncs via Track 4 and converges to the same
 * replay/discovery state. No mesh gossip; no new event kinds.
 *
 * Reuses R5 two-node convergence core with halo-oriented evidence labels.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AS_OF } from "./lib/ga6-drill-core.mjs";
import {
  createReleaseRunners,
  resolveReleaseBinary,
} from "./lib/release-binary.mjs";
import { runTwoNodeConvergenceDrill } from "./lib/two-node-convergence-core.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {
    skipBuild: argv.includes("--no-build"),
    asOf: AS_OF,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--as-of") {
      result.asOf = argv[++i];
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const binaryPath = await resolveReleaseBinary(WORKSPACE_ROOT, {
    buildIfMissing: !args.skipBuild,
  });
  const { runCli, spawnNodeServe } = createReleaseRunners(WORKSPACE_ROOT, binaryPath);

  const { runDir, summaryPath, summary } = await runTwoNodeConvergenceDrill({
    workspaceRoot: WORKSPACE_ROOT,
    runIdPrefix: "r9-halo",
    runnerMode: "release-binary",
    binaryPath,
    runCli,
    spawnNodeServe,
    asOf: args.asOf,
  });

  // Halo naming: source = market LAN node, sink = upstream/gateway peer.
  const haloNotes = `# R9 halo reconcile notes (maintainer smoke)

## Topology (Mode A)

| Role | URL | Meaning |
| --- | --- | --- |
| **Halo (LAN authority)** | ${summary.source_url} | Local operator node clients would pin at a market |
| **Upstream (peer)** | ${summary.sink_url} | Pulls from halo when uplink / reconcile runs |

## Honesty labels (required in product UX)

- While pinned only to the halo: **Local operator node — not yet reconciled with upstream**
- After ingest on halo: **Accepted by local node** (not “globally settled”)
- After this pull: **Synced with peer \`source\`** — replay hash \`${summary.validation.replay_state_hash.source}\`

## Evidence

- run id: \`${summary.run_id}\`
- as_of: \`${summary.as_of}\`
- applied events (halo = upstream): ${summary.validation.applied_event_count.source}
- invalid events: ${summary.validation.invalid_event_count.source}
- discovery hash match: yes
- binary: \`${binaryPath}\`
- summary: \`${summaryPath}\`

## Commands

\`\`\`bash
pnpm r9:halo:smoke
pnpm r9:halo:smoke -- --no-build
\`\`\`

Gate: **R9-G4** (two-node pull sync after LAN activity).
This is **maintainer smoke**, not field proof.
`;

  await fs.writeFile(path.join(runDir, "halo-operator-notes.md"), haloNotes);

  const haloSummaryPath = path.join(runDir, "r9-halo-smoke-summary.json");
  await fs.writeFile(
    haloSummaryPath,
    `${JSON.stringify(
      {
        ...summary,
        track: "R9-H2",
        gate: "R9-G4",
        topology: {
          halo_url: summary.source_url,
          upstream_url: summary.sink_url,
          sync: "pull-only peers.json → GET /events",
        },
        honesty: {
          local_only: "Local operator node — not yet reconciled with upstream",
          local_accept: "Accepted by local node",
          after_pull: "Synced with peer source",
        },
        evidence_label: "maintainer smoke",
      },
      null,
      2,
    )}\n`,
  );

  console.log("R9 halo smoke passed (R9-G4).");
  console.log(`halo: ${summary.source_url}`);
  console.log(`upstream: ${summary.sink_url}`);
  console.log(`applied events: ${summary.validation.applied_event_count.source}`);
  console.log(`replay hash: ${summary.validation.replay_state_hash.source}`);
  console.log(haloSummaryPath);
  console.log(path.join(runDir, "halo-operator-notes.md"));
}

main().catch((error) => {
  console.error("R9 halo smoke failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
