#!/usr/bin/env node

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
		withPolicyPack: "",
		asOf: AS_OF,
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--with-policy-pack") {
			result.withPolicyPack = path.resolve(argv[++i]);
		} else if (arg === "--as-of") {
			result.asOf = argv[++i];
		}
	}
	if (result.withPolicyPack && result.asOf === AS_OF) {
		result.asOf = "2026-03-03T00:00:00Z";
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
		runIdPrefix: "r5-two-node",
		runnerMode: "release-binary",
		binaryPath,
		runCli,
		spawnNodeServe,
		policyPackPath: args.withPolicyPack,
		asOf: args.asOf,
	});

	console.log(`R5 two-node drill completed: ${runDir}`);
	console.log(`binary: ${binaryPath}`);
	console.log(`as_of: ${summary.as_of}`);
	console.log(`policy_pack: ${summary.policy_pack ?? "none"}`);
	console.log(summaryPath);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
