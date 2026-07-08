import { createHash } from "node:crypto";

const COMPUTE_PATTERN = /\b(gpu|cuda|batch|compute|inference|training|job queue)\b/i;
const RESEARCH_PATTERN = /\b(research|analysis|survey|benchmark|study)\b/i;
const DOC_PATTERN = /\b(documentation|readme|changelog|docs|doc update)\b/i;
const TEST_PATTERN = /\b(test|ci|flake|failing|repro|regression)\b/i;

function haystack(signal) {
  const tags = Array.isArray(signal.tags) ? signal.tags.join(" ") : "";
  return `${signal.title ?? ""} ${tags}`.toLowerCase();
}

/** Rules-only lane classifier (first match wins). */
export function classifySignalLane(signal) {
  const text = haystack(signal);
  const tags = (signal.tags ?? []).map(tag => tag.toLowerCase());

  if (
    signal.source === "github-issues" &&
    tags.some(tag => tag.includes("help-wanted") || tag.includes("maintenance"))
  ) {
    return "project-maintenance";
  }

  if (COMPUTE_PATTERN.test(text)) {
    return "compute-job";
  }

  if (
    (signal.source === "hn" || signal.source === "rss") &&
    RESEARCH_PATTERN.test(text)
  ) {
    return "research";
  }

  if (DOC_PATTERN.test(text)) {
    return "documentation";
  }

  if (TEST_PATTERN.test(text)) {
    return "testing";
  }

  return "software-fixes";
}

export function canonicalSignalBody(signal) {
  return {
    schemaVersion: signal.schemaVersion,
    source: signal.source,
    externalId: signal.externalId,
    title: signal.title,
    url: signal.url,
    dedupeKey: signal.dedupeKey,
    discoveredAt: signal.discoveredAt,
    tags: [...(signal.tags ?? [])].sort(),
  };
}

export function signalIdFor(signal) {
  const canonical = JSON.stringify(canonicalSignalBody(signal));
  return createHash("sha256").update(canonical).digest("hex");
}

export function normalizeSignal(raw) {
  const signal = {
    schemaVersion: raw.schemaVersion ?? "discovery-signal-v1",
    source: raw.source,
    externalId: raw.externalId,
    title: raw.title,
    url: raw.url,
    dedupeKey: raw.dedupeKey,
    expansionRationale: raw.expansionRationale ?? "",
    tags: raw.tags ?? [],
    discoveredAt: raw.discoveredAt,
    negativeSignals: raw.negativeSignals ?? [],
  };

  for (const field of [
    "source",
    "externalId",
    "title",
    "url",
    "dedupeKey",
    "discoveredAt",
  ]) {
    if (!signal[field]) {
      throw new Error(`signal missing required field: ${field}`);
    }
  }

  signal.signalId = signalIdFor(signal);
  signal.suggestedLane = classifySignalLane(signal);
  return signal;
}
