#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifySignalLane, canonicalSignalBody } from "../lib/discovery-bridge/signal-schema.mjs";

const inputs = [
  { source: "github-issues", externalId: "gh-1", title: "Help wanted: revive stalled repo", url: "https://example.com/1", dedupeKey: "d1", discoveredAt: "2026-07-01T00:00:00Z", tags: ["help-wanted"] },
  { source: "github-issues", externalId: "gh-2", title: "Maintenance backlog triage", url: "https://example.com/2", dedupeKey: "d2", discoveredAt: "2026-07-01T00:01:00Z", tags: ["maintenance"] },
  { source: "github-issues", externalId: "gh-3", title: "GPU batch inference job", url: "https://example.com/3", dedupeKey: "d3", discoveredAt: "2026-07-01T00:02:00Z", tags: ["compute"] },
  { source: "hn", externalId: "hn-1", title: "Research analysis on sync protocols", url: "https://example.com/4", dedupeKey: "d4", discoveredAt: "2026-07-01T00:03:00Z", tags: [] },
  { source: "rss", externalId: "rss-1", title: "Benchmark study for replay engines", url: "https://example.com/5", dedupeKey: "d5", discoveredAt: "2026-07-01T00:04:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-4", title: "Update README and changelog docs", url: "https://example.com/6", dedupeKey: "d6", discoveredAt: "2026-07-01T00:05:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-5", title: "Fix failing CI flake in tests", url: "https://example.com/7", dedupeKey: "d7", discoveredAt: "2026-07-01T00:06:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-6", title: "Patch null pointer in parser", url: "https://example.com/8", dedupeKey: "d8", discoveredAt: "2026-07-01T00:07:00Z", tags: ["bug"] },
  { source: "github-issues", externalId: "gh-7", title: "CUDA compute pipeline optimization", url: "https://example.com/9", dedupeKey: "d9", discoveredAt: "2026-07-01T00:08:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-8", title: "Documentation cleanup for API", url: "https://example.com/10", dedupeKey: "d10", discoveredAt: "2026-07-01T00:09:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-9", title: "Translation package for onboarding", url: "https://example.com/11", dedupeKey: "d11", discoveredAt: "2026-07-01T00:10:00Z", tags: ["translation"] },
  { source: "github-issues", externalId: "gh-10", title: "Regression repro for milestone timeout", url: "https://example.com/12", dedupeKey: "d12", discoveredAt: "2026-07-01T00:11:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-11", title: "Small feature increment for explorer", url: "https://example.com/13", dedupeKey: "d13", discoveredAt: "2026-07-01T00:12:00Z", tags: [] },
  { source: "hn", externalId: "hn-2", title: "Survey of deterministic marketplaces", url: "https://example.com/14", dedupeKey: "d14", discoveredAt: "2026-07-01T00:13:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-12", title: "Training job receipt validation", url: "https://example.com/15", dedupeKey: "d15", discoveredAt: "2026-07-01T00:14:00Z", tags: ["training"] },
  { source: "github-issues", externalId: "gh-13", title: "Project maintenance: dependency refresh", url: "https://example.com/16", dedupeKey: "d16", discoveredAt: "2026-07-01T00:15:00Z", tags: ["maintenance", "help-wanted"] },
  { source: "github-issues", externalId: "gh-14", title: "Changelog documentation pass", url: "https://example.com/17", dedupeKey: "d17", discoveredAt: "2026-07-01T00:16:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-15", title: "Fix broken test suite on Windows", url: "https://example.com/18", dedupeKey: "d18", discoveredAt: "2026-07-01T00:17:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-16", title: "Research brief on escrow policy", url: "https://example.com/19", dedupeKey: "d19", discoveredAt: "2026-07-01T00:18:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-17", title: "General bugfix in settlement reducer", url: "https://example.com/20", dedupeKey: "d20", discoveredAt: "2026-07-01T00:19:00Z", tags: [] },
  { source: "github-issues", externalId: "gh-18", title: "Batch compute job for fixture replay", url: "https://example.com/21", dedupeKey: "d21", discoveredAt: "2026-07-01T00:20:00Z", tags: [] },
];

const golden = inputs.map(input => {
  const body = {
    schemaVersion: "discovery-signal-v1",
    source: input.source,
    externalId: input.externalId,
    title: input.title,
    url: input.url,
    dedupeKey: input.dedupeKey,
    discoveredAt: input.discoveredAt,
    tags: [...(input.tags ?? [])].sort(),
  };
  const expectedSignalId = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  const expectedLane = classifySignalLane({ ...input, tags: input.tags ?? [] });
  return { input: { schemaVersion: "discovery-signal-v1", ...input }, expectedLane, expectedSignalId };
});

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "discovery-signals-golden.json");
writeFileSync(out, `${JSON.stringify(golden, null, 2)}\n`);
console.log(`Wrote ${golden.length} golden signals to ${out}`);
