# Discovery Bridge Spec (Aperio → Vectis)

Purpose: implementation-ready contract for connecting the Aperio discovery engine to Vectis marketplace lanes without fiat rails or platform dependency.

Status: `locked`

Last updated: July 2026

## Problem

Maintainers and contributors need **structured opportunities**, not gig-wall keyword spam. Aperio finds signals; Vectis structures and settles exchange. The bridge must be:

- deterministic and rules-only (no LLM gate on core path)
- runnable without Next.js or commercial dashboard
- lane-aware (maps signals → template-backed offer drafts)

Reference: `docs/architecture/discovery-engine-bridge.md` (exploratory); this spec is normative for restart implementation.

## Non-goals

- Discovery does not price work, hold escrow, or mint credits
- Discovery does not replace reputation scoring in kernel
- Discovery does not guarantee opportunity quality (negative signal packs reduce noise only)

## Data flow

```text
Portfolio digest (skills, repos, intent)
        ↓
Aperio: expand probes → fetch sources → filter → dedupe → rank
        ↓
Signal export (JSONL)
        ↓
Lane classifier (rules-only)
        ↓
ServiceOffer draft JSON (+ optional signed envelope)
        ↓
Operator review → ingest to Vectis node
        ↓
Standard marketplace settlement (existing event model)
```

## Signal export schema (v1)

Each line is a JSON object:

```json
{
  "schemaVersion": "discovery-signal-v1",
  "signalId": "<sha256 canonical id>",
  "source": "github-issues",
  "externalId": "<stable external id>",
  "title": "...",
  "url": "https://...",
  "dedupeKey": "...",
  "expansionRationale": "...",
  "tags": ["maintenance", "help-wanted"],
  "discoveredAt": "2026-07-01T12:00:00Z",
  "negativeSignals": [],
  "suggestedLane": "project-maintenance"
}
```

Required fields: `schemaVersion`, `signalId`, `source`, `externalId`, `title`, `url`, `dedupeKey`, `discoveredAt`.

## Lane classifier rules (v1)

Rules-only mapping; first match wins:

| Condition | `suggestedLane` |
| --- | --- |
| source=github-issues + tags contain help-wanted/maintenance | `project-maintenance` |
| title/tags match compute/batch/gpu patterns | `compute-job` |
| source=hn/rss + research/analysis keywords | `research` |
| documentation/readme/changelog keywords | `documentation` |
| test/ci/flake/failing keywords | `testing` |
| default digital artifact work | `software-fixes` |

Classifier must be pure function: same signal → same lane.

## Offer draft mapping

Bridge emits **unsigned** `ServiceOffer` draft compatible with existing web builder and CLI sign flow:

```json
{
  "draftKind": "ServiceOffer",
  "payload": {
    "serviceType": "<from suggestedLane>",
    "title": "<from signal.title>",
    "description": "<expansionRationale + url>",
    "deliveryMode": "<lane template default>",
    "allowedEvidenceFormats": ["<lane default>"]
  },
  "provenance": {
    "signalId": "...",
    "sourceUrl": "..."
  }
}
```

Operator must review before sign+submit. No auto-ingest of unsigned offers in R-track.

## Negative signal integration

Aperio negative signal packs feed:

1. **Pre-offer filter** — suppress signals before draft emission
2. **Protocol-side reputation** — repeat bad-faith actors decay via existing dispute/metrics paths (not discovery)

Discovery negative signals do **not** directly mutate kernel state.

## CLI target (R3)

```bash
# Aperio repo — Rust headless discovery (no Next.js)
cat aperio-discover-config.json | aperio-engine discover > aperio-run.jsonl

# Vectis repo — import + lane classify + offer drafts
node scripts/v3-aperio-import.mjs --in aperio-run.jsonl --out signals.jsonl
node scripts/v3-discovery-bridge.mjs --in signals.jsonl --out offer-drafts.jsonl
```

`R3-B1` is satisfied by **Aperio `aperio-engine discover`** (shipped in Aperio `crates/`) plus Vectis `v3-aperio-import.mjs`. See [../architecture/aperio-engine-integration.md](../architecture/aperio-engine-integration.md).

During transition, npm wrappers: `pnpm v3:aperio-import:smoke`, `pnpm v3:discovery-bridge:smoke`.

## Portfolio profile schema (shared)

Minimal shared schema between Aperio and Vectis:

```json
{
  "schemaVersion": "portfolio-digest-v1",
  "maintainerPubkey": "<optional>",
  "skills": ["rust", "typescript", "devops"],
  "repos": ["owner/name"],
  "intent": ["maintenance", "oss-contribution"],
  "excludeTags": ["crypto", "nft"]
}
```

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| `DB-1` | Same profile + source snapshot → identical `signals.jsonl` (deterministic) |
| `DB-2` | Lane classifier golden tests for ≥ 20 representative signals |
| `DB-3` | Offer drafts validate against lane templates in `marketplace-event-builder` |
| `DB-4` | End-to-end demo: signal → draft → sign → ingest → offer visible in explorer |
| `DB-5` | No Next.js runtime required for DB-1..DB-4 path |

## Implementation slices

| ID | Scope | Phase |
| --- | --- | --- |
| `R3-B1` | Aperio `aperio-engine discover` + Vectis `v3-aperio-import` | R3 **done** |
| `R3-B2` | Signal schema + canonical `signalId` hashing | R3 |
| `R3-B3` | Lane classifier with golden tests | R3 |
| `R3-B4` | `signals-to-offers` draft emitter | R3 |
| `R3-B5` | Web builder import for offer draft JSON | R3 optional |
| `R4-B1` | Signed signal envelopes (optional provenance events) | R4 |

## Verification

```bash
# after implementation
pnpm v3:aperio-import:smoke     # Aperio JSONL → Vectis signals → drafts
pnpm v3:discovery-bridge:smoke   # DB-2, DB-3
pnpm v3:discovery-bridge:e2e     # DB-4 signal → draft → sign → ingest → discovery
pnpm v1:readiness
```

## Dependencies

- `R1` deployment spec (node must be ingestible from bridge output)
- Aperio `aperio-engine` binary (`crates/` in maintainer Aperio repo) — see [aperio-engine-integration.md](aperio-engine-integration.md)

## Deferred

- Automatic order creation from signals
- LLM-based signal enrichment (optional overlay only, never core path)

## Federation merge (R5)

Multi-operator signal feeds merge by `dedupeKey` (fallback: canonical `signalId`). Signed envelopes (`discovery-signal-envelope-v1`) optional for provenance verification.

```bash
npm run v3:discovery-federation:smoke
node scripts/v3-discovery-federation-merge.mjs --in a.jsonl --in b.jsonl --out merged.jsonl
```

See [../runbooks/policy-pack-export-import.md](../runbooks/policy-pack-export-import.md).
