# V0 Phase 0 Execution Plan

Kickoff date: April 6, 2026

This document is the canonical Phase 0 tracker for completing the remaining roadmap tasks before broader phase expansion.

## Scope

Phase 0 in this context means roadmap lock and execution framing for:

- open `Track 5` delivery items
- cross-cutting v0 tasks
- explicit v0 exit criteria evidence

## Workstream A: Status normalization

- [x] A1. Resolve docs status mismatches for active tracks (for example EC-5 slice count alignment).
- [x] A2. Add one-source status references from roadmap docs to this plan.
- [x] A3. Define status semantics (`planned`, `in_progress`, `completed`, `blocked`) and use them consistently.

## Workstream B: Track 5 backlog extraction

- [x] B1. Decompose `Track 5` scope into implementable slices with IDs and acceptance criteria.
- [x] B2. Map each slice to affected modules (`crates/node`, `crates/state-engine`, `packages/sdk-ts`, `apps/web`, fixtures/tests).
- [x] B3. Define closed-alpha readiness checks for invite onboarding, marketplace flow completion, and reputation-aware discovery.

## Status semantics

- `planned`: scoped and accepted, implementation not started
- `in_progress`: actively being implemented or validated
- `completed`: merged and validated against acceptance checks
- `blocked`: cannot proceed due to an explicit external dependency or unresolved decision

## Track 5 initial slice backlog

| ID | Status | Scope | Acceptance checks |
| --- | --- | --- | --- |
| `T5-S1` | `completed` | Invite onboarding hardening and sponsor flow reliability | Invite-only flow succeeds from identity creation to vouch request draft without manual state repair |
| `T5-S2` | `completed` | Marketplace template defaults for initial service lanes | Lane template constraints are enforced in builder and replay validation paths |
| `T5-S3` | `completed` | Milestone-first order flow runner and guardrails | Offer -> Order -> Escrow -> Delivery -> Accept path completes with deterministic state transitions |
| `T5-S4` | `completed` | Deterministic dispute/deadlock timeout flow hardening | Dispute, timeout, and settle/deadlock outcomes are replay-stable with fixture coverage |
| `T5-S5` | `completed` | Reputation-aware discovery default behavior for alpha | Discovery ranking and filters are deterministic and policy-aligned for initial lanes |
| `T5-S6` | `completed` | Multi-node convergence and replication checks for alpha flows | Independent nodes converge to equivalent derived state for shared event sets |
| `T5-S7` | `completed` | Alpha operations runbook (ingest, sync, snapshot, incident triage) | Non-author operator can execute end-to-end alpha workflow from docs only |
| `T5-S8` | `completed` | Closed-alpha go/no-go validation and sign-off packet | All Track 5 acceptance checks pass with evidence links in readiness report |

## Track 5 module mapping

| Slice | Primary modules | Supporting artifacts |
| --- | --- | --- |
| `T5-S1` | `apps/web`, `packages/sdk-ts` | onboarding fixtures, onboarding docs |
| `T5-S2` | `apps/web`, `crates/protocol-core`, `crates/state-engine` | policy/template docs, validation fixtures |
| `T5-S3` | `apps/web`, `crates/state-engine`, `crates/node` | marketplace flow fixtures, replay tests |
| `T5-S4` | `crates/state-engine`, `crates/node` | dispute/timeout fixtures, invalid reason coverage |
| `T5-S5` | `apps/web`, `crates/node`, `packages/sdk-ts` | discovery fixtures, API contract checks |
| `T5-S6` | `crates/node`, `apps/cli` | sync fixtures, replication test scenarios |
| `T5-S7` | `docs`, `apps/cli`, `crates/node` | operator runbook, command validation scripts |
| `T5-S8` | `docs` plus all modules above | readiness matrix and sign-off record |

## Closed alpha readiness gates

- `GA1`: invite onboarding path passes with no manual DB edits
- `GA2`: one complete accepted marketplace exchange per initial lane
- `GA3`: one deterministic dispute/deadlock scenario per lane with expected outcomes
- `GA4`: two-node convergence proof for all alpha fixture bundles
- `GA5`: discovery outputs are deterministic for repeated queries with same inputs
- `GA6`: operator runbook is executable by a non-author from clean environment

## Workstream C: Cross-cutting backlog extraction

- [x] C1. Convert scenario modeling into fixture-backed scenarios with explicit expected outcomes.
- [x] C2. Convert abuse/gaming analysis into deterministic reject-path and telemetry test cases.
- [x] C3. Create docs synchronization checklist tied to every merged behavior change.
- [x] C4. Draft event versioning strategy (`event envelope`, policy compatibility, migration rules).

## Workstream D: V0 exit evidence matrix

- [x] D1. Build a criterion-to-evidence matrix for all v0 exit criteria in `v0-roadmap.md`.
- [x] D2. Attach each criterion to concrete artifacts (tests, fixtures, commands, API checks, docs).
- [x] D3. Define pass/fail gates for v0 readiness sign-off.

## Workstream E: Execution cadence

- [x] E1. Establish weekly Phase 0 review rhythm with checklist updates in this file.
- [x] E2. Keep `docs/roadmap/progress.md` and `docs/archive/roadmap.md` synchronized at each milestone close.
- [x] E3. Define cutoff rule for ending Phase 0 and starting full Track 5 implementation.

## Workstream C deliverables

- `docs/v0/v0-scenario-fixture-matrix.md`
- `docs/v0/v0-abuse-gaming-test-matrix.md`
- `docs/meta/docs-sync-checklist.md`
- `docs/architecture/event-versioning-strategy.md`

## Workstream D deliverable

- `docs/v0/v0-exit-evidence-matrix.md`

## Weekly cadence

- every Monday: update this checklist and confirm active statuses
- every Friday: sync `docs/roadmap/progress.md` and `docs/archive/roadmap.md` for completed milestones
- at each merge affecting protocol/runtime/client behavior: apply `docs/meta/docs-sync-checklist.md`
- at each substantive implementation step: refresh `docs/roadmap/working-context-log.md`

Note: E2 is checked because the first synchronized milestone update has been completed; this remains a standing recurring rule.

## Phase 0 cutoff rule

Move from Phase 0 to full Track 5 implementation when:

- Workstreams A-D are complete
- Workstream E2 has been executed for at least one closed milestone
- no unresolved status conflicts remain across roadmap/progress/track docs

## Done criteria for this plan

Phase 0 is complete when:

- all items in Workstreams A-D are complete
- Workstream E cadence is active and documented
- unresolved roadmap ambiguity is removed from `docs/archive/roadmap.md` and `docs/v0/v0-roadmap.md`
