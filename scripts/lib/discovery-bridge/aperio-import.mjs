/**
 * Map Aperio `aperio-engine discover` JSONL export → Vectis `discovery-signal-v1`.
 *
 * Aperio event shape: { type, ts, data } where type === "signal".
 * ExportSignal uses camelCase (dedupeKey, externalId, …).
 */

import { createHash } from "node:crypto";

const SOURCE_MAP = {
	github_issues: "github-issues",
	hackernews: "hn",
	reddit: "reddit",
	rss: "rss",
	indie_hackers: "rss",
	wellfound: "wellfound",
	product_hunt: "product_hunt",
};

export function mapAperioSource(source) {
	if (!source) {
		return source;
	}
	return SOURCE_MAP[source] ?? source.replaceAll("_", "-");
}

/** Infer lane-relevant tags when Aperio export omits RawOpportunity.tags. */
export function inferTagsFromText(title, description = "") {
	const text = `${title} ${description}`.toLowerCase();
	const tags = [];
	if (/\bhelp[- ]?wanted\b/.test(text)) {
		tags.push("help-wanted");
	}
	if (/\bmaintenance\b/.test(text)) {
		tags.push("maintenance");
	}
	if (/\b(documentation|readme|changelog)\b/.test(text)) {
		tags.push("documentation");
	}
	if (/\b(test|ci|flake|failing)\b/.test(text)) {
		tags.push("testing");
	}
	if (/\b(gpu|cuda|batch|compute|inference)\b/.test(text)) {
		tags.push("compute");
	}
	return tags;
}

function deterministicDiscoveredAt({ source, externalId, dedupeKey }) {
	const base = new Date("2026-07-01T00:00:00Z");
	const canonical = JSON.stringify({
		source: source ?? "",
		externalId: externalId ?? "",
		dedupeKey: dedupeKey ?? "",
	});
	const hash = createHash("sha256").update(canonical).digest("hex");
	// Keep it within a single day window so it looks like a plausible discovery timestamp.
	const secondsInDay = 24 * 60 * 60;
	const offsetSeconds = parseInt(hash.slice(0, 8), 16) % secondsInDay;
	const at = new Date(base.getTime() + offsetSeconds * 1000);
	return at.toISOString();
}

/**
 * @param {Record<string, unknown>} exportSignal Aperio ExportSignal (camelCase)
 * @returns {import("./signal-schema.mjs").normalizeSignal extends (x: infer T) => unknown ? T : never}
 */
export function aperioExportToVectisSignal(exportSignal) {
	const title = String(exportSignal.title ?? "");
	const description = String(exportSignal.description ?? "");
	return {
		schemaVersion: "discovery-signal-v1",
		source: mapAperioSource(String(exportSignal.source ?? "")),
		externalId: String(exportSignal.externalId ?? ""),
		title,
		url: String(exportSignal.url ?? ""),
		dedupeKey: String(exportSignal.dedupeKey ?? ""),
		// DB-1 determinism: Aperio runtime-generated timestamps must not leak into our exported signals.
		// When no stable postedAt exists, we derive a deterministic timestamp from the signal identity fields.
		discoveredAt:
			exportSignal.postedAt != null
				? String(exportSignal.postedAt)
				: deterministicDiscoveredAt({
						source: String(exportSignal.source ?? ""),
						externalId: String(exportSignal.externalId ?? ""),
						dedupeKey: String(exportSignal.dedupeKey ?? ""),
					}),
		expansionRationale: String(exportSignal.expansionRationale ?? ""),
		tags: inferTagsFromText(title, description),
		negativeSignals: [],
	};
}

/**
 * Parse Aperio discover JSONL (mixed event types) into Vectis signals.
 * Skips filtered signals unless `includeFiltered` is true.
 */
export function parseAperioDiscoverJsonl(lines, { includeFiltered = false } = {}) {
	const signals = [];
	for (const line of lines) {
		if (!line?.trim()) {
			continue;
		}
		const event = JSON.parse(line);
		if (event.type !== "signal") {
			continue;
		}
		const data = event.data ?? {};
		if (data.filtered === true && !includeFiltered) {
			continue;
		}
		signals.push(aperioExportToVectisSignal(data));
	}
	return signals;
}
