import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
	AS_OF,
	FIXTURES,
	choosePort,
	countAppliedEvents,
	countInvalidEvents,
	fetchJson,
	nowStamp,
	stopProcess,
	waitForNode,
	writePeersConfig,
} from "./ga6-drill-core.mjs";
import { signPolicyUpdateFromPack, validatePolicyPack } from "./policy-pack.mjs";

function stableHash(value) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function writePolicyUpdateFixture(runDir, pack, commandLog, runCli, sourceDir) {
	const update = await signPolicyUpdateFromPack(pack, {
		createdAt: "2026-03-01T00:00:00Z",
		effectiveAt: "2026-03-02T00:00:00Z",
	});
	const fixturePath = path.join(runDir, "policy-update.jsonl");
	await fs.writeFile(fixturePath, `${JSON.stringify(update)}\n`);
	runCli(["node", "ingest", "--data-dir", sourceDir, "--in", fixturePath], commandLog);
	return update;
}

/**
 * @param {object} options
 * @param {string} options.workspaceRoot
 * @param {string} options.runIdPrefix
 * @param {string} options.runnerMode
 * @param {string} options.binaryPath
 * @param {(args: string[], commandLog: string[]) => void} options.runCli
 * @param {(dataDir: string, port: number, commandLog: string[]) => import("node:child_process").ChildProcess} options.spawnNodeServe
 * @param {string} [options.policyPackPath]
 * @param {string} [options.asOf]
 */
export async function runTwoNodeConvergenceDrill({
	workspaceRoot,
	runIdPrefix,
	runnerMode,
	binaryPath,
	runCli,
	spawnNodeServe,
	policyPackPath = "",
	asOf = AS_OF,
}) {
	const commandLog = [];
	const runId = `${runIdPrefix}-${nowStamp()}`;
	const runDir = path.join(workspaceRoot, "target", "tmp", runId);
	const sourceDir = path.join(runDir, "source");
	const sinkDir = path.join(runDir, "sink");
	await fs.mkdir(sourceDir, { recursive: true });
	await fs.mkdir(sinkDir, { recursive: true });

	for (const dir of [sourceDir, sinkDir]) {
		runCli(["node", "init", "--data-dir", dir], commandLog);
	}

	for (const fixture of FIXTURES) {
		runCli(["node", "ingest", "--data-dir", sourceDir, "--in", fixture], commandLog);
	}

	let policyPack = null;
	if (policyPackPath) {
		policyPack = validatePolicyPack(JSON.parse(await fs.readFile(policyPackPath, "utf8")));
		await writePolicyUpdateFixture(runDir, policyPack, commandLog, runCli, sourceDir);
	}

	const sourcePort = await choosePort();
	const sourceUrl = `http://127.0.0.1:${sourcePort}`;
	await writePeersConfig(sinkDir, "source", sourceUrl);

	const sourceServe = spawnNodeServe(sourceDir, sourcePort, commandLog);

	try {
		await waitForNode(sourceUrl, 45_000);

		runCli(
			[
				"node",
				"sync",
				"pull",
				"--data-dir",
				sinkDir,
				"--peer",
				"source",
				"--limit",
				"200",
				"--max-pages",
				"100",
			],
			commandLog,
		);
		runCli(["node", "sync", "status", "--data-dir", sinkDir], commandLog);
		runCli(
			[
				"node",
				"sync",
				"pull",
				"--data-dir",
				sinkDir,
				"--peer",
				"source",
				"--limit",
				"200",
				"--max-pages",
				"100",
			],
			commandLog,
		);

		const replaySource = await fetchJson(
			`${sourceUrl}/state/replay?as_of=${encodeURIComponent(asOf)}`,
		);
		const discoverySource = await fetchJson(
			`${sourceUrl}/state/discovery?as_of=${encodeURIComponent(asOf)}&alpha_defaults=1&limit=50`,
		);

		const sinkPort = await choosePort();
		const sinkUrl = `http://127.0.0.1:${sinkPort}`;
		const sinkServe = spawnNodeServe(sinkDir, sinkPort, commandLog);

		try {
			await waitForNode(sinkUrl, 45_000);

			const replaySink = await fetchJson(
				`${sinkUrl}/state/replay?as_of=${encodeURIComponent(asOf)}`,
			);
			const discoverySink = await fetchJson(
				`${sinkUrl}/state/discovery?as_of=${encodeURIComponent(asOf)}&alpha_defaults=1&limit=50`,
			);

			const validation = {
				invalid_event_count: {
					source: countInvalidEvents(replaySource),
					sink: countInvalidEvents(replaySink),
				},
				applied_event_count: {
					source: countAppliedEvents(replaySource),
					sink: countAppliedEvents(replaySink),
				},
				replay_state_hash: {
					source: stableHash(replaySource?.data?.state),
					sink: stableHash(replaySink?.data?.state),
				},
				discovery_hash: {
					source: stableHash(discoverySource?.data),
					sink: stableHash(discoverySink?.data),
				},
			};

			if (validation.invalid_event_count.source !== 0) {
				throw new Error("source replay has invalid events");
			}
			if (validation.invalid_event_count.sink !== 0) {
				throw new Error("sink replay has invalid events");
			}
			if (validation.applied_event_count.source !== validation.applied_event_count.sink) {
				throw new Error("source/sink applied-event count mismatch");
			}
			if (validation.replay_state_hash.source !== validation.replay_state_hash.sink) {
				throw new Error("source/sink replay state hash mismatch");
			}
			if (validation.discovery_hash.source !== validation.discovery_hash.sink) {
				throw new Error("source/sink discovery hash mismatch");
			}

			let policyValidation = null;
			if (policyPack) {
				const policySource = await fetchJson(
					`${sourceUrl}/state/policy?as_of=${encodeURIComponent(asOf)}`,
				);
				const policySink = await fetchJson(
					`${sinkUrl}/state/policy?as_of=${encodeURIComponent(asOf)}`,
				);
				policyValidation = {
					source_effective_version: policySource?.data?.effective_version,
					sink_effective_version: policySink?.data?.effective_version,
					expected: policyPack.nextPolicyVersion,
				};
				if (policyValidation.source_effective_version !== policyPack.nextPolicyVersion) {
					throw new Error("source policy version mismatch after pack import");
				}
				if (policyValidation.sink_effective_version !== policyPack.nextPolicyVersion) {
					throw new Error("sink policy version mismatch after sync");
				}
				if (stableHash(policySource?.data) !== stableHash(policySink?.data)) {
					throw new Error("source/sink policy state mismatch after sync");
				}
			}

			const summary = {
				run_id: runId,
				run_dir: runDir,
				runner_mode: runnerMode,
				binary_path: binaryPath,
				source_url: sourceUrl,
				sink_url: sinkUrl,
				fixtures: FIXTURES,
				as_of: asOf,
				policy_pack: policyPack?.packId ?? null,
				executed_commands: commandLog,
				validation,
				policy_validation: policyValidation,
				passed: true,
			};
			const summaryPath = path.join(runDir, "two-node-drill-summary.json");
			await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

			const notes = `# R5 two-node operator notes

- source node: ${sourceUrl}
- sink node: ${sinkUrl}
- runner mode: ${runnerMode}
- binary: ${binaryPath}
- as_of: ${asOf}
- fixtures: ${FIXTURES.length} alpha marketplace bundles
- policy pack: ${policyPack?.packId ?? "none"}
- replay state hash: ${validation.replay_state_hash.source}
- discovery hash: ${validation.discovery_hash.source}
- applied events: ${validation.applied_event_count.source}
- run id: ${runId}

Automated via \`npm run r5:two-node:drill\`.
`;
			await fs.writeFile(path.join(runDir, "operator-notes.md"), notes);

			return { runDir, summaryPath, summary };
		} finally {
			await stopProcess(sinkServe);
		}
	} finally {
		await stopProcess(sourceServe);
	}
}
