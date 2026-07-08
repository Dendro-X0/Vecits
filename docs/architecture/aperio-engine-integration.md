# Aperio Engine → Vectis Integration

Purpose: operational guide for connecting [Aperio](file:///E:/Web%20Projects/aperio/docs/engine/README.md)'s Rust discovery engine to Vectis marketplace lanes — **no fiat rails, no Next.js dependency on the discovery path**.

Status: `active`

Last updated: July 2026

Normative bridge contract: [discovery-bridge-spec.md](../specs/discovery-bridge-spec.md)

## Division of labor

| System | Role |
| --- | --- |
| **Aperio `aperio-engine`** | Object-matching discovery: expand portfolio → fetch public sources → negative filter → dedupe → rank |
| **Vectis bridge** | Map signals → lane classifier → `ServiceOffer` drafts → operator sign → kernel ingest |
| **Vectis kernel** | Escrow, evidence, settlement, reputation — unchanged |

Aperio answers: *what opportunities exist in the wild that match this portfolio?*

Vectis answers: *how do we structure and close exchange on-log fairly?*

See Aperio [overview.md](file:///E:/Web%20Projects/aperio/docs/engine/overview.md) — payment and settlement are explicit non-goals there.

## Why Rust engine (not Next.js `runDiscovery`)

Aperio ships a production **embeddable Rust core** (`crates/aperio-engine`, `crates/aperio-cli`):

- Headless `discover` command — JSON config on stdin, JSONL events on stdout
- Deterministic algorithmic path (no LLM required)
- Connectors: GitHub Issues, HN, Reddit, RSS, Indie Hackers, Wellfound, Product Hunt
- NDJSON RPC daemon (`serve`) for batch workloads

Vectis **R3-B1** is satisfied by invoking this binary — not by extracting the Aperio web app's Prisma-backed orchestration.

Reference: [rust-engine.md](file:///E:/Web%20Projects/aperio/docs/engine/rust-engine.md)

## Niche ecosystem adjustments (currencyless coordination)

Minor config changes adapt the general engine to Vectis's lane:

| Adjustment | Where | Why |
| --- | --- | --- |
| Negative signal packs | `negativeSignals` in discover config | Drop crypto bait, unpaid/equity-only, job-board spam |
| Narrow source hints | `sourceHints: github_issues, hackernews, rss` | OSS + maintainer signals, not volume gig boards |
| Portfolio intent | profile `intent` + skills | Align expansion with `software-fixes`, `project-maintenance` |
| Lane classifier | Vectis `signal-schema.mjs` | Rules-only map → `serviceType` templates |
| No auto-ingest | Operator review before sign | Discovery ≠ settlement truth |

Example Vectis-tuned discover config: `scripts/fixtures/aperio-discover-vectis.example.json`

Portfolio digest (shared schema): `scripts/fixtures/vectis-portfolio-digest.example.json`

## End-to-end pipeline

```text
Portfolio + intent (JSON)
        ↓
aperio-engine discover          ← Aperio repo: pnpm engine:discover
        ↓
JSONL { type: "signal", data: ExportSignal }
        ↓
v3-aperio-import.mjs              ← source map + tag inference + filter drops
        ↓
discovery-signal-v1 JSONL
        ↓
v3-discovery-bridge.mjs           ← lane classifier → ServiceOffer drafts
        ↓
Operator review → SDK sign → vectis-node ingest
        ↓
Standard marketplace settlement (SCN-04..06)
```

## Commands

### 1. Run discovery (Aperio repo)

```bash
cd "E:/Web Projects/aperio"
pnpm engine:build

cat "/path/to/aperio-discover-vectis.example.json" | pnpm engine:discover \
  > /tmp/aperio-run.jsonl
```

Or use the Vectis example config (copy or symlink):

```bash
cat "E:/Experimental projects/vectis/scripts/fixtures/aperio-discover-vectis.example.json" \
  | pnpm engine:discover > /tmp/aperio-run.jsonl
```

Set `GITHUB_TOKEN` for live GitHub Issues fetch. Other connectors use public APIs.

### 2. Import to Vectis signals

```bash
cd "E:/Experimental projects/vectis"

node scripts/v3-aperio-import.mjs \
  --in /tmp/aperio-run.jsonl \
  --out /tmp/vectis-signals.jsonl
```

Skip filtered signals by default (`filtered: true` rows are dropped).

Direct to offer drafts:

```bash
node scripts/v3-aperio-import.mjs \
  --in /tmp/aperio-run.jsonl \
  --out /tmp/offer-drafts.jsonl \
  --to-offers
```

### 3. Bridge to offer drafts (if not using `--to-offers`)

```bash
node scripts/v3-discovery-bridge.mjs \
  --in /tmp/vectis-signals.jsonl \
  --out /tmp/offer-drafts.jsonl
```

### 4. Verify (no live network)

```bash
pnpm v3:aperio-import:smoke    # Aperio JSONL sample → classify → drafts
pnpm v3:discovery-bridge:smoke # golden classifier (DB-2, DB-3)
pnpm v3:discovery-bridge:e2e   # draft → sign → ingest → discovery read (DB-4)
pnpm v3:aperio-live-drill      # engine discover (fixture) → import → review → ingest
pnpm v3:aperio-live-drill:live # same pipeline with live network connectors
pnpm v3:aperio-live-drill:determinism      # DB-1 guard: run twice (fixture) and assert identical signals
pnpm v3:aperio-live-drill:determinism:live # DB-1 guard: run twice (live) and assert identical signals

# One-shot readiness bundle (DB-1..DB-4)
pnpm v3:discovery-readiness
```

### 5. End-to-end drill (fixture mode, deterministic)

Uses `scripts/fixtures/aperio-discover-vectis.fixture.json` with `fixtureSources` so CI does not require GitHub/HN network access:

```bash
pnpm --filter @new-start/sdk-ts build
cd "E:/Web Projects/aperio" && cargo build --manifest-path crates/Cargo.toml -p aperio-cli

pnpm v3:aperio-live-drill
```

Artifacts: `target/tmp/v3-aperio-live-<runId>/` — `aperio-discover.jsonl`, `offer-drafts.jsonl`, `review-queue.jsonl`, `live-summary.json`.

## Schema mapping

| Aperio `ExportSignal` | Vectis `discovery-signal-v1` |
| --- | --- |
| `source: github_issues` | `source: github-issues` |
| `source: hackernews` | `source: hn` |
| `dedupeKey` | `dedupeKey` |
| `externalId` | `externalId` |
| `expansionRationale` | `expansionRationale` |
| (tags not in export) | inferred from title/description |

Implementation: `scripts/lib/discovery-bridge/aperio-import.mjs`

**Future Aperio tweak (optional):** include `tags` on `ExportSignal` for richer lane classification without inference.

## Acceptance criteria status

| ID | Criterion | Status |
| --- | --- | --- |
| `DB-1` | Deterministic signals from same profile + snapshot | **Aperio** golden runs (`pnpm engine:golden`); Vectis import is pure |
| `DB-2` | Lane classifier golden tests | **Pass** — `v3:discovery-bridge:smoke` |
| `DB-3` | Offer drafts validate lane templates | **Pass** — smoke + e2e |
| `DB-4` | Signal → draft → sign → ingest | **Pass** — `v3:discovery-bridge:e2e` |
| `DB-5` | No Next.js on core path | **Pass** — `aperio-engine` + Vectis scripts only |
| `DB-6` | Live engine discover → import → review → ingest | **Pass** — `v3:aperio-live-drill` |

`R3-B1` (standalone discovery CLI): **closed** via Aperio Rust engine + Vectis import adapter.

## Related

- [trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md) — buyers still need contribution mint before escrow
- [software-fixes-lane.md](software-fixes-lane.md) — default classified lane
- [discovery-engine-bridge.md](discovery-engine-bridge.md) — exploratory predecessor (superseded operationally by this doc + locked spec)
