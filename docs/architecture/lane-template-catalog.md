# Community Lane Template Catalog (R6-L2)

Purpose: single index of deployable marketplace lane templates for community operators — contracts, fixtures, drills, and when to use each lane.

Last updated: July 2026

## How to use this catalog

1. Pick a lane that matches the work shape (bounded deliverable + enumerable evidence).
2. Confirm fixtures replay: `cargo run --bin cli -- fixtures run`
3. Run lane drills before go-live: `npm run r6:lane-templates:smoke`
4. Wire discovery → drafts using aligned classifier lanes (`npm run v3:discovery-bridge:smoke`)

Canonical web template source: `apps/web/app/components/marketplace-event-builder.tsx` (`SERVICE_LANE_TEMPLATES`).

Registry source (drills + discovery alignment): `scripts/lib/r6-lane-template-registry.mjs`.

## Digital artifact lanes (community deployable)

All use `deliveryMode: artifact`, `allowedEvidenceFormats: ["artifactHash"]`, `strict: false`.

| Lane | Unit | Typical use | Accept fixture | Dispute fixture | HTTP drill |
| --- | --- | --- | --- | --- | --- |
| `software-fixes` | fix per issue | CI repair, bounded bugfix | `marketplace-accept.jsonl` | `marketplace-dispute-settle.jsonl` | `r2:exchange-drill -- --lane software-fixes` |
| `feature-work` | feature increment | Small scoped features | `marketplace-feature-work-accept.jsonl` | `marketplace-feature-work-dispute.jsonl` | `r2:exchange-drill -- --lane feature-work` |
| `documentation` | doc update | README, changelog, guides | `marketplace-documentation-accept.jsonl` | `marketplace-documentation-dispute.jsonl` | `r2:exchange-drill -- --lane documentation` |
| `translation` | translation package | Locale / copy packages | `marketplace-translation-accept.jsonl` | `marketplace-translation-dispute.jsonl` | `r2:exchange-drill -- --lane translation` |
| `testing` | test report | Repro steps, verification output | `marketplace-testing-accept.jsonl` | `marketplace-testing-dispute.jsonl` | `r2:exchange-drill -- --lane testing` |
| `research` | research brief | Structured analysis deliverables | `marketplace-research-accept.jsonl` | `marketplace-research-dispute.jsonl` | `r2:exchange-drill -- --lane research` |
| `project-maintenance` | maintenance task | Stalled-project continuation | `marketplace-project-maintenance-accept.jsonl` | `marketplace-project-maintenance-dispute.jsonl` | `r2:exchange-drill -- --lane project-maintenance` |

Lane deep-dives:

- [software-fixes-lane.md](software-fixes-lane.md) — reference v1 digital lane
- [stalled-project-support-flow.md](stalled-project-support-flow.md) — `project-maintenance` scenario

API coverage: `api_checked_in_non_software_lane_fixture_bundles_replay_cleanly` in `crates/node/tests/api.rs`.

## Specialized lanes (strict evidence)

| Lane | Delivery mode | Evidence | Drill / runbook |
| --- | --- | --- | --- |
| `compute-job` | `receipt` | `job-receipt-v1` | [compute-job-lane-runbook.md](../runbooks/compute-job-lane-runbook.md), `npm run r6:compute-job:drill` |
| `local-resource-exchange` | `local-community` | `local-resource-receipt-v1` | `npm run r6:offline-lanes:smoke`, [offline-lane-experimental-runbook.md](../runbooks/offline-lane-experimental-runbook.md) |
| `physical-handoff` | `in-person` | `physical-handoff-ack-dual-v1` | `npm run r6:offline-lanes:smoke`, `marketplace-physical-handoff-accept.jsonl` (SCN-18) |

Architecture: [phase2-compute-job-lane.md](phase2-compute-job-lane.md).

## Discovery bridge mapping

Classifier output lanes must match registry defaults in `scripts/lib/discovery-bridge/lane-templates.mjs`.

Smoke: `npm run v3:discovery-bridge:smoke` (DB-2 lane classifier golden).

## Verification bundle (R6-L2)

```bash
# Fixture presence + discovery alignment + HTTP exchange per artifact lane
npm run r6:lane-templates:smoke

# Fixtures only (no node spawn)
npm run r6:lane-templates:smoke -- --fixtures-only

# Single lane HTTP drill
npm run r2:exchange-drill -- --lane documentation --no-build
```

## Related docs

- [../runbooks/community-lane-templates-runbook.md](../runbooks/community-lane-templates-runbook.md) — operator workflow
- [../specs/restart-decisions.md](../specs/restart-decisions.md) D5 — standardized lane templates first
- [../foundation/market-operating-model.md](../foundation/market-operating-model.md) — exchange doctrine
