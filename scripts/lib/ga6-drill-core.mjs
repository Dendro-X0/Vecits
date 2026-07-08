import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";

export const AS_OF = "2026-03-01T00:15:00Z";
export const FIXTURES = [
  "fixtures/valid/marketplace-accept.jsonl",
  "fixtures/valid/marketplace-dispute-settle.jsonl",
  "fixtures/valid/marketplace-timeout-autorefund.jsonl",
];

export function nowStamp() {
  return Date.now().toString();
}

export function formatCommand(command, args) {
  return `${command} ${args.join(" ")}`.trim();
}

export function countInvalidEvents(replay) {
  const invalid = replay?.data?.invalid_events;
  return Array.isArray(invalid) ? invalid.length : 0;
}

export function countAppliedEvents(replay) {
  const applied = replay?.data?.applied_event_ids;
  return Array.isArray(applied) ? applied.length : 0;
}

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`request failed ${response.status}: ${url}`);
  }
  return await response.json();
}

export async function choosePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to resolve free port"));
        return;
      }
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

export async function waitForNode(baseUrl, timeoutMs) {
  const started = Date.now();
  const probe = `${baseUrl}/state/replay?as_of=${encodeURIComponent(AS_OF)}`;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(probe);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`node did not become ready in time: ${baseUrl}`);
}

export async function writePeersConfig(dataDir, peerId, baseUrl) {
  const peers = {
    version: 1,
    peers: [{ id: peerId, base_url: baseUrl, enabled: true }],
  };
  await fs.writeFile(path.join(dataDir, "peers.json"), `${JSON.stringify(peers, null, 2)}\n`);
}

export async function stopProcess(child) {
  child.kill("SIGTERM");
  await new Promise(resolve => {
    child.once("close", () => resolve());
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 5_000);
  });
}

/**
 * @param {object} options
 * @param {string} options.workspaceRoot
 * @param {string} options.runIdPrefix
 * @param {string} options.runnerMode
 * @param {string} [options.binaryPath]
 * @param {(args: string[], commandLog: string[]) => void} options.runCli
 * @param {(dataDir: string, port: number, commandLog: string[]) => import("node:child_process").ChildProcess} options.spawnNodeServe
 */
export async function runGa6Drill({
  workspaceRoot,
  runIdPrefix,
  runnerMode,
  binaryPath,
  runCli,
  spawnNodeServe,
}) {
  const commandLog = [];
  const runId = `${runIdPrefix}-${nowStamp()}`;
  const runDir = path.join(workspaceRoot, "target", "tmp", runId);
  const nodeA = path.join(runDir, "node-a");
  const nodeB = path.join(runDir, "node-b");
  const nodeC = path.join(runDir, "node-c");
  await fs.mkdir(nodeA, { recursive: true });
  await fs.mkdir(nodeB, { recursive: true });
  await fs.mkdir(nodeC, { recursive: true });

  for (const dir of [nodeA, nodeB, nodeC]) {
    runCli(["node", "init", "--data-dir", dir], commandLog);
  }

  for (const fixture of FIXTURES) {
    runCli(["node", "ingest", "--data-dir", nodeA, "--in", fixture], commandLog);
  }

  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  await writePeersConfig(nodeB, "node-a", baseUrl);
  await writePeersConfig(nodeC, "node-a", baseUrl);

  const serveA = spawnNodeServe(nodeA, port, commandLog);

  try {
    await waitForNode(baseUrl, 45_000);

    const healthA = await fetchJson(`${baseUrl}/health`);
    if (healthA.status !== "ok") {
      throw new Error("node A health check failed in GA6 drill");
    }

    runCli(
      [
        "node",
        "sync",
        "pull",
        "--data-dir",
        nodeB,
        "--peer",
        "node-a",
        "--limit",
        "200",
        "--max-pages",
        "100",
      ],
      commandLog,
    );
    runCli(["node", "sync", "status", "--data-dir", nodeB], commandLog);
    runCli(
      [
        "node",
        "snapshot",
        "create",
        "--data-dir",
        nodeA,
        "--as-of",
        AS_OF,
        "--out",
        path.join(nodeA, "latest-snapshot.json"),
      ],
      commandLog,
    );
    runCli(
      [
        "node",
        "sync",
        "bootstrap",
        "--data-dir",
        nodeC,
        "--peer",
        "node-a",
        "--limit",
        "200",
        "--max-pages",
        "100",
      ],
      commandLog,
    );
    runCli(["node", "db", "inspect", "--data-dir", nodeA], commandLog);
    runCli(["node", "db", "inspect", "--data-dir", nodeB], commandLog);
    runCli(["node", "db", "inspect", "--data-dir", nodeC], commandLog);

    const replayA = await fetchJson(
      `${baseUrl}/state/replay?as_of=${encodeURIComponent(AS_OF)}`,
    );
    const discoveryA = await fetchJson(
      `${baseUrl}/state/discovery?as_of=${encodeURIComponent(AS_OF)}&alpha_defaults=1&limit=50`,
    );

    const portB = await choosePort();
    const portC = await choosePort();
    const baseUrlB = `http://127.0.0.1:${portB}`;
    const baseUrlC = `http://127.0.0.1:${portC}`;
    const serveB = spawnNodeServe(nodeB, portB, commandLog);
    const serveC = spawnNodeServe(nodeC, portC, commandLog);
    try {
      await waitForNode(baseUrlB, 45_000);
      await waitForNode(baseUrlC, 45_000);

      const replayB = await fetchJson(
        `${baseUrlB}/state/replay?as_of=${encodeURIComponent(AS_OF)}`,
      );
      const replayC = await fetchJson(
        `${baseUrlC}/state/replay?as_of=${encodeURIComponent(AS_OF)}`,
      );
      const discoveryB = await fetchJson(
        `${baseUrlB}/state/discovery?as_of=${encodeURIComponent(AS_OF)}&alpha_defaults=1&limit=50`,
      );
      const discoveryC = await fetchJson(
        `${baseUrlC}/state/discovery?as_of=${encodeURIComponent(AS_OF)}&alpha_defaults=1&limit=50`,
      );

      const validation = {
        invalid_event_count: {
          node_a: countInvalidEvents(replayA),
          node_b: countInvalidEvents(replayB),
          node_c: countInvalidEvents(replayC),
        },
        applied_event_count: {
          node_a: countAppliedEvents(replayA),
          node_b: countAppliedEvents(replayB),
          node_c: countAppliedEvents(replayC),
        },
        applied_event_count_equal: {
          node_a_vs_node_b: countAppliedEvents(replayA) === countAppliedEvents(replayB),
          node_a_vs_node_c: countAppliedEvents(replayA) === countAppliedEvents(replayC),
        },
        replay_state_equal: {
          node_a_vs_node_b:
            JSON.stringify(replayA?.data?.state) === JSON.stringify(replayB?.data?.state),
          node_a_vs_node_c:
            JSON.stringify(replayA?.data?.state) === JSON.stringify(replayC?.data?.state),
        },
        discovery_equal: {
          node_a_vs_node_b: JSON.stringify(discoveryA?.data) === JSON.stringify(discoveryB?.data),
          node_a_vs_node_c: JSON.stringify(discoveryA?.data) === JSON.stringify(discoveryC?.data),
        },
        health_ok: {
          node_a: healthA.status === "ok",
        },
      };

      if (validation.invalid_event_count.node_a !== 0) {
        throw new Error("node A replay has invalid events in GA6 drill");
      }
      if (validation.invalid_event_count.node_b !== 0) {
        throw new Error("node B replay has invalid events in GA6 drill");
      }
      if (validation.invalid_event_count.node_c !== 0) {
        throw new Error("node C replay has invalid events in GA6 drill");
      }
      if (!validation.applied_event_count_equal.node_a_vs_node_b) {
        throw new Error("node A/B applied-event count mismatch in GA6 drill");
      }
      if (!validation.applied_event_count_equal.node_a_vs_node_c) {
        throw new Error("node A/C applied-event count mismatch in GA6 drill");
      }
      if (!validation.replay_state_equal.node_a_vs_node_b) {
        throw new Error("node A/B replay state mismatch in GA6 drill");
      }
      if (!validation.replay_state_equal.node_a_vs_node_c) {
        throw new Error("node A/C replay state mismatch in GA6 drill");
      }
      if (!validation.discovery_equal.node_a_vs_node_b) {
        throw new Error("node A/B discovery output mismatch in GA6 drill");
      }
      if (!validation.discovery_equal.node_a_vs_node_c) {
        throw new Error("node A/C discovery output mismatch in GA6 drill");
      }

      const summary = {
        run_id: runId,
        run_dir: runDir,
        runner_mode: runnerMode,
        binary_path: binaryPath ?? null,
        node_a_url: baseUrl,
        node_b_url: baseUrlB,
        node_c_url: baseUrlC,
        fixtures: FIXTURES,
        as_of: AS_OF,
        executed_commands: commandLog,
        validation,
      };
      const summaryPath = path.join(runDir, "ga6-drill-summary.json");
      await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

      return { runDir, summaryPath, summary };
    } finally {
      await stopProcess(serveB);
      await stopProcess(serveC);
    }
  } finally {
    await stopProcess(serveA);
  }
}
