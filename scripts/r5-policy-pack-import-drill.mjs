#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { signPolicyUpdateFromPack, validatePolicyPack } from "./lib/policy-pack.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
	const result = {
		packPath: path.join(WORKSPACE_ROOT, "fixtures", "policy-packs", "community-lanes-restricted.json"),
		effectiveAt: "2026-03-02T00:00:00Z",
		createdAt: "2026-03-01T00:00:00Z",
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--pack") result.packPath = path.resolve(argv[++i]);
		else if (arg === "--effective-at") result.effectiveAt = argv[++i];
		else if (arg === "--created-at") result.createdAt = argv[++i];
	}
	return result;
}

function runReplay(fixturePath, outPath) {
	const result = spawnSync(
		"cargo",
		["run", "--bin", "cli", "--", "log", "replay", "--in", fixturePath, "--out", outPath],
		{
			cwd: WORKSPACE_ROOT,
			encoding: "utf8",
		},
	);
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout || "replay failed");
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const pack = validatePolicyPack(JSON.parse(await fs.readFile(args.packPath, "utf8")));
	const update = await signPolicyUpdateFromPack(pack, {
		createdAt: args.createdAt,
		effectiveAt: args.effectiveAt,
	});

	const runDir = path.join(WORKSPACE_ROOT, "target", "tmp", `r5-policy-pack-${Date.now()}`);
	await fs.mkdir(runDir, { recursive: true });
	const fixturePath = path.join(runDir, "policy-update.jsonl");
	const replayPath = path.join(runDir, "replay.json");
	await fs.writeFile(fixturePath, `${JSON.stringify(update)}\n`);

	runReplay(fixturePath, replayPath);
	const replay = JSON.parse(await fs.readFile(replayPath, "utf8"));
	const invalidCount = Array.isArray(replay.invalid_events) ? replay.invalid_events.length : 0;
	if (invalidCount !== 0) {
		throw new Error(`replay reported ${invalidCount} invalid events`);
	}
	const effectiveVersion = replay.state?.policy?.effective_version;
	if (effectiveVersion !== pack.nextPolicyVersion) {
		throw new Error(
			`expected effective policy ${pack.nextPolicyVersion}, got ${effectiveVersion ?? "undefined"}`,
		);
	}

	const allowedLanes = replay.state?.policy?.policy?.allowed_service_types ?? [];
	if (JSON.stringify([...allowedLanes].sort()) !== JSON.stringify([...pack.policy.allowedServiceTypes].sort())) {
		throw new Error("allowed service types do not match policy pack");
	}

	console.log(
		`R5 policy pack import drill passed (${pack.packId} → ${pack.nextPolicyVersion}, ${replay.applied_event_ids?.length ?? 0} applied).`,
	);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
