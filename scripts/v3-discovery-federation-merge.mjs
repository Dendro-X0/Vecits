#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSignal } from "./lib/discovery-bridge/signal-schema.mjs";
import {
	isSignalEnvelope,
	signSignalEnvelope,
	verifySignalEnvelope,
} from "./lib/discovery-bridge/signal-envelope.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPERATOR_A_SECRET = "4444444444444444444444444444444444444444444444444444444444444444";

function parseArgs(argv) {
	const result = {
		inputs: [],
		outPath: "",
		smoke: false,
		requireSigned: false,
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--smoke") {
			result.smoke = true;
		} else if (arg === "--require-signed") {
			result.requireSigned = true;
		} else if (arg === "--in") {
			result.inputs.push(path.resolve(argv[++i]));
		} else if (arg === "--out") {
			result.outPath = path.resolve(argv[++i]);
		}
	}
	return result;
}

async function readJsonl(filePath) {
	const content = await fs.readFile(filePath, "utf8");
	return content
		.split("\n")
		.map(line => line.trim())
		.filter(Boolean)
		.map(line => JSON.parse(line));
}

async function entryToSignal(entry, { requireSigned }) {
	if (isSignalEnvelope(entry)) {
		if (!(await verifySignalEnvelope(entry))) {
			throw new Error("invalid discovery signal envelope signature");
		}
		return normalizeSignal(entry.signal);
	}
	if (requireSigned) {
		throw new Error("unsigned discovery signal rejected (--require-signed)");
	}
	return normalizeSignal(entry);
}

export async function mergeDiscoverySignals(inputs, { requireSigned = false } = {}) {
	const merged = new Map();
	const sources = [];

	for (const inputPath of inputs) {
		const entries = await readJsonl(inputPath);
		sources.push({ inputPath, count: entries.length });
		for (const entry of entries) {
			const signal = await entryToSignal(entry, { requireSigned });
			const mergeKey = signal.dedupeKey || signal.signalId;
			if (!merged.has(mergeKey)) {
				merged.set(mergeKey, {
					signal,
					sourceFiles: [inputPath],
				});
				continue;
			}
			const existing = merged.get(mergeKey);
			existing.sourceFiles.push(inputPath);
		}
	}

	return {
		signals: [...merged.values()].map(item => item.signal),
		stats: {
			inputFiles: inputs.length,
			inputEntries: sources.reduce((sum, item) => sum + item.count, 0),
			uniqueSignals: merged.size,
			duplicatesSuppressed: sources.reduce((sum, item) => sum + item.count, 0) - merged.size,
			sources,
		},
	};
}

async function runSmoke() {
	const fixtureDir = path.join(WORKSPACE_ROOT, "scripts", "fixtures");
	const operatorA = path.join(fixtureDir, "discovery-federation-operator-a.jsonl");
	const operatorB = path.join(fixtureDir, "discovery-federation-operator-b.jsonl");
	const runDir = path.join(WORKSPACE_ROOT, "target", "tmp", `discovery-federation-smoke-${Date.now()}`);
	await fs.mkdir(runDir, { recursive: true });

	const unsignedMerge = await mergeDiscoverySignals([operatorA, operatorB]);
	if (unsignedMerge.signals.length !== 3) {
		throw new Error(`expected 3 unique signals, got ${unsignedMerge.signals.length}`);
	}
	if (unsignedMerge.stats.duplicatesSuppressed !== 1) {
		throw new Error("expected one duplicate signal to be suppressed");
	}

	const signedOnlyPath = path.join(runDir, "discovery-federation-signed-only.jsonl");
	const signedEnvelope = await signSignalEnvelope(unsignedMerge.signals[0], OPERATOR_A_SECRET, "2026-07-01T12:00:00Z");
	await fs.writeFile(signedOnlyPath, `${JSON.stringify(signedEnvelope)}\n`);
	const signedMerge = await mergeDiscoverySignals([signedOnlyPath], { requireSigned: true });
	if (signedMerge.signals.length !== 1) {
		throw new Error("signed-only merge should keep one signal");
	}

	let rejected = false;
	try {
		await mergeDiscoverySignals([operatorA], { requireSigned: true });
	} catch (error) {
		rejected = error instanceof Error && error.message.includes("unsigned discovery signal rejected");
	}
	if (!rejected) {
		throw new Error("expected unsigned feed to fail with --require-signed semantics");
	}

	const sample = unsignedMerge.signals[0];
	if (!(await verifySignalEnvelope(signedEnvelope))) {
		throw new Error("round-trip signal envelope verification failed");
	}

	console.log(
		`Discovery federation smoke passed (${unsignedMerge.stats.uniqueSignals} unique signals, duplicate suppression verified, signed envelope verified).`,
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.smoke) {
		await runSmoke();
		return;
	}
	if (args.inputs.length === 0) {
		throw new Error("provide at least one --in path or use --smoke");
	}

	const merged = await mergeDiscoverySignals(args.inputs, { requireSigned: args.requireSigned });
	const outPath =
		args.outPath ||
		path.join(WORKSPACE_ROOT, "target", "tmp", `discovery-federation-${Date.now()}.jsonl`);
	await fs.mkdir(path.dirname(outPath), { recursive: true });
	await fs.writeFile(
		outPath,
		`${merged.signals.map(signal => JSON.stringify(signal)).join("\n")}\n`,
	);
	console.log(
		`${outPath} (${merged.stats.uniqueSignals} unique / ${merged.stats.inputEntries} input entries, ${merged.stats.duplicatesSuppressed} duplicates suppressed)`,
	);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
