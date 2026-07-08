#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "./lib/ga6-drill-core.mjs";
import { packFromNodePolicyView, packFromPolicyUpdateEvent, validatePolicyPack } from "./lib/policy-pack.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
	const result = {
		outPath: "",
		packId: "",
		description: "",
		nextPolicyVersion: "",
		fromNode: "",
		fromEvent: "",
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--out") result.outPath = path.resolve(argv[++i]);
		else if (arg === "--pack-id") result.packId = argv[++i];
		else if (arg === "--description") result.description = argv[++i];
		else if (arg === "--next-policy-version") result.nextPolicyVersion = argv[++i];
		else if (arg === "--from-node") result.fromNode = argv[++i];
		else if (arg === "--from-event") result.fromEvent = path.resolve(argv[++i]);
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

async function main() {
	const args = parseArgs(process.argv.slice(2));
	let pack;

	if (args.fromEvent) {
		const events = await readJsonl(args.fromEvent);
		const update = events.find(event => event.kind === "PolicyUpdate");
		if (!update) {
			throw new Error(`no PolicyUpdate event found in ${args.fromEvent}`);
		}
		pack = packFromPolicyUpdateEvent(update, {
			packId: args.packId || undefined,
			description: args.description || undefined,
		});
	} else if (args.fromNode) {
		const baseUrl = args.fromNode.replace(/\/$/, "");
		const view = await fetchJson(`${baseUrl}/state/policy`);
		pack = packFromNodePolicyView(view, {
			packId: args.packId || undefined,
			description: args.description || undefined,
			nextPolicyVersion: args.nextPolicyVersion || undefined,
		});
	} else {
		throw new Error("provide --from-event or --from-node");
	}

	validatePolicyPack(pack);
	const outPath =
		args.outPath ||
		path.join(WORKSPACE_ROOT, "target", "tmp", `policy-pack-${pack.packId}.json`);
	await fs.mkdir(path.dirname(outPath), { recursive: true });
	await fs.writeFile(outPath, `${JSON.stringify(pack, null, 2)}\n`);
	console.log(outPath);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
