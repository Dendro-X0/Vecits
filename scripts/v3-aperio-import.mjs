#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAperioDiscoverJsonl } from "./lib/discovery-bridge/aperio-import.mjs";
import { normalizeSignal } from "./lib/discovery-bridge/signal-schema.mjs";
import { signalsToOfferDrafts } from "./lib/discovery-bridge/offer-draft.mjs";
import { validateOfferDraft } from "./lib/discovery-bridge/validate-draft.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
	const result = { inPath: "", outPath: "", smoke: false, toOffers: false };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--smoke") {
			result.smoke = true;
		} else if (arg === "--to-offers") {
			result.toOffers = true;
		} else if (arg === "--in") {
			result.inPath = argv[++i];
		} else if (arg === "--out") {
			result.outPath = argv[++i];
		}
	}
	return result;
}

async function runSmoke() {
	const samplePath = path.join(
		WORKSPACE_ROOT,
		"scripts",
		"fixtures",
		"aperio-engine-run.sample.jsonl",
	);
	const content = await fs.readFile(samplePath, "utf8");
	const lines = content.split("\n");
	const imported = parseAperioDiscoverJsonl(lines);
	if (imported.length < 2) {
		throw new Error("expected at least 2 kept signals from sample aperio run");
	}

	const normalized = imported.map(signal => normalizeSignal(signal));
	const maintenance = normalized.find(item => item.suggestedLane === "project-maintenance");
	if (!maintenance) {
		throw new Error("sample import should classify at least one project-maintenance signal");
	}

	const drafts = signalsToOfferDrafts(imported);
	for (const draft of drafts) {
		validateOfferDraft(draft);
	}

	console.log(
		`Aperio import smoke passed (${imported.length} signals → ${drafts.length} offer drafts).`,
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.smoke) {
		await runSmoke();
		return;
	}

	if (!args.inPath || !args.outPath) {
		throw new Error(
			"usage: node scripts/v3-aperio-import.mjs --in <aperio-discover.jsonl> --out <signals.jsonl> [--to-offers]",
		);
	}

	const content = await fs.readFile(path.resolve(args.inPath), "utf8");
	const imported = parseAperioDiscoverJsonl(content.split("\n"));
	const normalized = imported.map(signal => normalizeSignal(signal));

	if (args.toOffers) {
		const drafts = signalsToOfferDrafts(imported);
		await fs.writeFile(
			path.resolve(args.outPath),
			`${drafts.map(draft => JSON.stringify(draft)).join("\n")}\n`,
		);
		console.log(`Wrote ${drafts.length} offer drafts to ${args.outPath}`);
		return;
	}

	await fs.writeFile(
		path.resolve(args.outPath),
		`${normalized.map(signal => JSON.stringify(signal)).join("\n")}\n`,
	);
	console.log(`Wrote ${normalized.length} discovery signals to ${args.outPath}`);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
