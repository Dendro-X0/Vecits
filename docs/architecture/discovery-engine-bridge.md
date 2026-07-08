# Discovery Engine Bridge (Aperio → Vectis)

> **Operational guide:** [aperio-engine-integration.md](aperio-engine-integration.md) — use that doc for commands and current pipeline. This file retains exploratory context from the restart design phase.

Purpose: document how the algorithmic discovery engine in Aperio can feed the
currencyless marketplace in Vectis without fiat rails, hype, or a commercial
dashboard dependency.

Last updated: April 7, 2026

## Why this exists

`new-start` needs **verifiable signals** — stalled repos, maintenance asks, compute
jobs, structured service requests — not keyword spam or speculative tokens.

The discovery engine in `new-door` (`@aperio/discovery` + `@aperio/sources`) is
built to:

1. Expand a contributor's **portfolio intent** into concrete search probes (no LLM required)
2. Pull raw opportunities from public sources (GitHub issues, HN, RSS, etc.)
3. Filter with **negative signal packs** and watchlist deltas
4. Dedupe and cluster related signals
5. Rank pursuit candidates algorithmically

That is structurally aligned with `new-start` lanes where delivery is
**artifact- or receipt-backed** (`project-maintenance`, `compute-job`, etc.).

## Package map (portable core)

| Package | Path in `new-door` | Role |
|---------|-------------------|------|
| `@aperio/discovery` | `packages/discovery` | Plans, expansion, filter, watchlist, clusters, ranking |
| `@aperio/sources` | `packages/sources` | Source connectors |
| `@aperio/core` | `packages/core` | Shared types |
| Orchestration | `apps/web/src/lib/engine.ts` → `runDiscovery()` | Persist + enrich + match (optional) |

The web UI and Prisma layer are **not** required to run discovery. Extract
`runDiscovery` logic into a worker/CLI that emits normalized signals as JSON or
signed events.

## Mapping discovery outputs → marketplace lanes

| Discovery signal | Likely `new-start` lane | Evidence shape |
|------------------|-------------------------|----------------|
| GitHub issue: help wanted / maintenance | `project-maintenance` | patch hash + test log |
| Stalled repo with open issues | `project-maintenance` | artifact milestones |
| Compute / batch job request | `compute-job` | `job-receipt-v1` |
| Research / documentation thread | `artifact` delivery | content hash |
| Repeat bad-faith poster | negative signal pack + reputation decay | protocol-side, not discovery |

Reference: `new-door` / `@aperio/discovery` in the maintainer's Aperio monorepo (`E:\Web Projects\aperio`). Canonical docs: [Aperio docs/README.md](file:///E:/Web%20Projects/aperio/docs/README.md), [vision.md](file:///E:/Web%20Projects/aperio/docs/vision.md) — settlement lives outside Aperio; Vectis is the downstream transaction-assurance layer when parties structure exchange on-log.

See also:

- `stalled-project-support-flow.md`
- `phase2-compute-job-lane.md`
- `economic-protocol-v1.md`

## Integration sketch (no fiat)

1. **Contributor profile** — skills + repos (portfolio digest), same inputs as discovery expansion.
2. **Discovery run** — algorithmic expansion only; no LLM gate for core path.
3. **Signal export** — each new opportunity → canonical JSON:
   - `source`, `externalId`, `title`, `url`, `dedupeKey`, `expansionRationale`
4. **Marketplace ingest** — operator or node maps signals to `ServiceOffer` drafts
   in the appropriate lane template; human or policy accepts scope.
5. **Settlement** — existing `ServiceOrder` / `ServiceDelivery` / credit escrow flow;
   reputation accrues from verified delivery, not from discovery itself.

Discovery finds **work worth structuring**. The protocol enforces **exchange**.

## Non-goals

- Discovery does not price work, hold escrow, or mint credits.
- Discovery does not replace reputation — it reduces search cost for useful contributions.
- No marketing layer: signals are raw + filterable; marketplace templates add structure.

## Next engineering steps

1. **`discovery-runner` CLI** — `runDiscovery` without Next.js; stdout JSONL signals.
2. **Profile schema shared** — align portfolio digest fields between repos.
3. **Lane classifier** — rules-only mapping from source + tags → `serviceType`.
4. **Signed signal envelopes** — optional bridge into node event ingest.

## Reference commands (`new-door`)

```bash
# Typecheck discovery package only
pnpm --filter @aperio/discovery typecheck

# Run discovery via API (when web app is up)
curl -X POST http://localhost:3000/api/discover -H "Cookie: ..." \
  -d '{"matchAfter":false,"async":false}'
```

Algorithmic expansion entry points:

- `buildDiscoveryPlans`, `expandDiscoveryProfileFromPortfolio`
- `matchesNegativeSignals`, `applyWatchlistDelta`
- `rankClusterSignals`, `rankInboxCandidates`
