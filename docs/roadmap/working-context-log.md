# Working Context Log

Purpose: preserve active implementation context across long sessions so progress is not lost when context windows rotate.

Last updated: July 2026

## Current phase snapshot

- **Frontend Phase 1 (deal loop)** — **complete** (July 2026). Evidence: `docs/frontend-phase1-completion.md`
- **Frontend Phase 2 (workspace depth)** — **complete** (July 2026). Plan: `docs/frontend-phase2-plan.md` · completion: `docs/frontend-phase2-completion.md`
- **Frontend Phase 3 (trust + lanes)** — **complete**. Summary: `docs/frontend-phase3-completion.md`
- **In-app help** — `/help` in web client; dev docs in `docs/client/`
- Active protocol plan: `docs/roadmap/restart-roadmap.md`
- **R0 complete** — gate `RG-1` = `pass`
- **R1 complete** — gate `RG-2` = `pass`
- **R2 complete** — gate `RG-3` = `pass`; evidence in `docs/roadmap/progress.md` § 2026-07
- **R4-C1..C4 complete** — client/kernel audit; `npm run r4:client-audit`
- **Next implementation slice:** **`R7-D1`** — Tauri v2 desktop scaffold ([r7-professional-client-execution-plan.md](r7-professional-client-execution-plan.md))
- R3-B1 (standalone Aperio CLI) remains parallel when repo access available
- Production operator data: `./.data/r2` (not `./.data/default`, which is for fresh init / experiments)

### R2 progress (complete)

- [x] `R2-P1` — persistent deployment (`docs/runbooks/r2-persistent-deployment-runbook.md`, `npm run r2:deploy-smoke`)
- [x] `R2-P2` — exchange drill (`npm run r2:exchange-drill`, order `r2-p2-1782943524039-order`)
- [x] `R2-P3` — evidence export (`npm run r2:evidence-export`, `npm run r2:evidence-pack`)
- [x] `R2-P4` — restore drill RDG-3 (`npm run r2:restore-drill`)
- [x] `R2-P5` — evidence linked in `docs/roadmap/progress.md`
- evidence archive: `target/r2-evidence-archive/r2-evidence-1782944591949/`

### R4 progress (C1–C4 complete)

- [x] `R4-C1` — `packages/sdk-ts/STABILITY.md`
- [x] `R4-C2` — `docs/v0/r4-client-kernel-audit.md`, `npm run r4:client-audit`
- [x] `R4-C3` — `KernelTruthNotice` (AB-15)
- [x] `R4-C4` — SOC-01-doc in onboarding + `docs/runbooks/operator-security-guide.md`
- [x] `R4-C5` — absorbed into R7-D3 (marketplace UX)

### R7 progress (active — professional client)

- [ ] `R7-D1` — Tauri v2 desktop scaffold
- [ ] `R7-D2` — `vectis-node` sidecar supervisor
- [x] `R7-D3` — marketplace-first UX
- [x] `R7-D4` — secure key vault
- [x] `R7-D5` — desktop installers
- [x] `R7-X1` — discovery draft import (ex-R3-B5)

### R1 progress (complete)

- [x] `R1-K4` — `GET /health`
- [x] `R1-K5` — `manifest.json` on init
- [x] `R1-K1` — `docs/specs/kernel-public-api.md`
- [x] `R1-D2` — `node init --data-dir`
- [x] `R1-D1` — release build + CI
- [x] `R1-D3` — Docker compose
- [x] `R1-K3` — reason-code registry
- [x] `R1-D4` — install scripts + operator quickstart
- [x] `R1-K2` — in-memory replay API
- [x] `R1-D5` — `npm run v1:ga6-drill:release`

### R0 deliverables (spec lock) — complete

- [x] `docs/roadmap/restart-roadmap.md`
- [x] `docs/roadmap/r0-spec-lock-execution-plan.md`
- [x] `docs/specs/restart-decisions.md`
- [x] `docs/specs/kernel-boundary-spec.md` (API audit fix: discovery + economics routes)
- [x] `docs/specs/deployment-distribution-spec.md`
- [x] `docs/specs/security-resilience-spec.md`
- [x] `docs/specs/discovery-bridge-spec.md`
- [x] `docs/specs/README.md`
- [x] `docs/README.md` updated with restart section
- [x] Baseline verification: `cargo test`, `fixtures run`, `v1:readiness`, `v1:ga6-drill` — all pass (July 2026)

### Historical: Phase 0 Track 5 (complete)

- Active Track 5 slices (April 2026):
  - `T5-S1`..`T5-S8`: all `completed`

## What was completed recently

### Phase 0 documentation lock

- created canonical Phase 0 tracker and linked it from roadmap/docs index
- added:
  - `docs/v0/v0-scenario-fixture-matrix.md`
  - `docs/v0/v0-abuse-gaming-test-matrix.md`
  - `docs/meta/docs-sync-checklist.md`
  - `docs/architecture/event-versioning-strategy.md`
  - `docs/v0/v0-exit-evidence-matrix.md`

### `T5-S1` onboarding hardening (`apps/web`)

- onboarding wizard now persists workspace inputs in browser storage
- explicit reset control added
- identity key normalization improved for pubkey/secret consistency checks
- self-sponsor entries are excluded with explicit UI warning
- copy actions now require valid sponsor set and resolved identity event reference
- vouch draft `createdAt` template validation added (`RFC3339` or `<TOKEN>`)
- identity reference reuse now only allowed from accepted/already-present ingest results (or refreshed node status)

Primary file:

- `apps/web/app/components/onboarding-wizard.tsx`

### `T5-S2` lane-template hardening (`apps/web`)

- added service lane templates for initial lanes and constrained offline lanes
- added template selector + reapply controls in offer mode
- added strict client preflight checks for constrained offline templates:
  - `local-resource-exchange`
  - `physical-handoff`
- order autofill now carries offer lane fields (`serviceType`, `deliveryMode`, `allowedEvidenceFormats`) to reduce mismatch risk

Primary file:

- `apps/web/app/components/marketplace-event-builder.tsx`

### `T5-S1` + `T5-S2` fixture/test evidence completion (`crates/node`)

- added deterministic onboarding guardrail API coverage:
  - `api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch`
  - proves replay/snapshot parity for duplicate active-vouch reject path and self-vouch reject path
- added deterministic offline lane-template mismatch API coverage:
  - `api_marketplace_offline_lane_template_mismatch_rejections_are_deterministic`
  - proves replay/snapshot parity for invalid order milestone evidence format and invalid delivery evidence format
- these tests close the explicit `T5-S1` and `T5-S2` fixture/test evidence gap in the readiness packet

Primary file:

- `crates/node/tests/api.rs`

### `GA2` + `GA3` lane-coverage closure (`crates/node`)

- added deterministic accepted-path lane matrix coverage for initial digital alpha lanes:
  - `api_marketplace_accept_flow_covers_initial_digital_lanes`
  - lanes covered: `software-fixes`, `feature-work`, `documentation`, `translation`, `testing`, `research`, `project-maintenance`
- added deterministic dispute-timeout lane matrix coverage for the same initial lanes:
  - `api_marketplace_dispute_timeout_covers_initial_digital_lanes`
  - verifies early `Disputed` and late `AutoRefunded` outcomes per lane
- executed full node API regression suite after these additions (`21/21` pass)

Primary file:

- `crates/node/tests/api.rs`

### `T5-S3` milestone-first accept-flow evidence (`crates/node`)

- added node API integration test for deterministic full accept path:
  - `ServiceOffer -> ServiceOrder -> SpendCredits(ServiceEscrowSink) -> ServiceDelivery -> ServiceAccept`
- test asserts post-accept state via read endpoints:
  - `/state/order/{id}` is closed with expected milestone linkage
  - `/state/milestone/{order}/{milestone}` is accepted with funded/provider reward values
  - `/state/balance/{id}` reflects deterministic buyer/provider balances
  - `/state/replay` reports zero invalid events for the scenario
- added fixed-`as_of` repeat-read check for milestone endpoint response stability

Primary file:

- `crates/node/tests/api.rs`

### `T5-S4` dispute/timeout flow hardening evidence (`crates/node`)

- added node API integration test for deterministic settlement handshake path:
  - validates `Disputed -> SettlementPending -> Settled`
  - asserts milestone/order/balance/replay state for settle outcome
- added node API integration test for deterministic timeout auto-refund path:
  - validates early `as_of` remains `Disputed`
  - validates late `as_of` transitions to `AutoRefunded`
  - asserts milestone/order/balance/replay state for timeout outcome
- added node API integration test for deadlock-edge invalid settlement path:
  - same actor attempts both settlement signatures
  - replay emits deterministic `InvalidStateTransition` invalid event (`counterparty` constraint)
  - snapshot-plus-delta replay preserves invalid-event + milestone status parity
  - late timeout still converges to `AutoRefunded`
- added node API integration test for missing-dispute-reference settlement path:
  - replay emits deterministic `MissingReference` invalid event (`dispute` reference required)
  - snapshot-plus-delta replay preserves invalid-event + milestone status parity
  - late timeout still converges to `AutoRefunded`

Primary file:

- `crates/node/tests/api.rs`

### `T5-S5` discovery default behavior hardening (`apps/web`)

- discovery explorer now queries node-ranked discovery output (`/state/discovery`)
- default discovery lane scope is policy-aligned for alpha:
  - `alpha_defaults=1` (default) => intersection of alpha initial lanes and policy `allowed_service_types`
  - explicit `service_type` filter remains supported but only if lane is policy-allowed
  - `alpha_defaults=0` enables policy-wide lane discovery
- deterministic ranking tie-break contract remains unchanged

Primary files:

- `apps/web/app/explorer/discovery/page.tsx`
- `apps/web/app/explorer/lib.ts`

### `T5-S5` discovery API contract completion (`crates/node`, `packages/sdk-ts`, `apps/web`)

- added node endpoint `GET /state/discovery` with deterministic ranking, policy-lane alignment, alpha-default filtering, and cursor pagination
- added SDK typed discovery query/view support (`NodeClient.getDiscovery`)
- switched web discovery explorer from client-side stitched ranking to node-ranked discovery output
- added node API regression coverage for:
  - alpha-default lane filtering behavior
  - policy-wide override behavior (`alpha_defaults=0`)
  - explicit lane query behavior
  - repeated-query determinism for identical inputs

Primary files:

- `crates/node/src/lib.rs`
- `crates/node/src/server.rs`
- `crates/node/tests/api.rs`
- `packages/sdk-ts/src/types.ts`
- `packages/sdk-ts/src/client.ts`
- `packages/sdk-ts/src/index.ts`
- `apps/web/app/explorer/discovery/page.tsx`

### `T5-S6` alpha-flow multi-node convergence evidence (`crates/node`)

- added sync regression coverage for shared alpha marketplace fixture bundles:
  - `fixtures/valid/marketplace-accept.jsonl`
  - `fixtures/valid/marketplace-dispute-settle.jsonl`
  - `fixtures/valid/marketplace-timeout-autorefund.jsonl`
- new test proves source/sink convergence after pull replication for each bundle on:
  - replay derived state hash at fixed `as_of`
  - discovery derived view hash (`alpha_defaults=true`) at fixed `as_of`
- broadened sync fixture helper usage with `load_fixture_events(name)` and reused it for claim flow fixture loading

Primary file:

- `crates/node/tests/sync.rs`

### `T5-S7` alpha operations runbook completion (`docs`, `apps/cli`)

- added docs-only operator runbook for closed-alpha operations:
  - ingest alpha marketplace fixture bundles
  - peer pull sync setup and convergence checks
  - snapshot create + bootstrap recovery drill
  - incident triage command set for ingest/sync/runtime/snapshot failures
  - evidence capture checklist for readiness packet
- validated runbook command path with CLI smoke execution in `target/tmp/runbook-smoke`:
  - fixture ingest and db inspect on node A
  - snapshot creation on node A
  - sync pull from node B to node A (job-hosted serve process)
  - bootstrap on node C from node A snapshot (job-hosted serve process)
- executed full docs-only dry run from a clean workspace path (`target/tmp/runbook-dryrun-1775537368434`):
  - ingested all three alpha marketplace bundles on node A (`event_count=35`, `invalid_event_count=0`)
  - synced node B from node A via `node sync pull` (`accepted_count=35`, `rejected_count=0`, `last_remote_cursor=35`)
  - bootstrapped node C from node A snapshot (`snapshot_id` resolved, `cursor_seeded_to=35`, `rejected_count=0`)
  - verified read-side counts for node A/B parity and snapshot import on node C

Primary files:

- `docs/runbooks/alpha-operations-runbook.md`
- `docs/README.md`

### `T5-S8` closed-alpha readiness packet bootstrap (`docs`)

- added readiness packet doc with explicit `GA1`..`GA6` status table, evidence links, and go/no-go outcome
- marked current decision as `go` with all `GA1`..`GA6` linked to passing evidence
- updated gate/slice statuses:
  - `GA1`: completed
  - `GA2`: completed
  - `GA3`: completed
  - `T5-S1`: completed
  - `T5-S2`: completed
  - `T5-S8`: completed

Primary files:

- `docs/v0/v0-closed-alpha-readiness-report.md`
- `docs/v0/v0-phase0-execution-plan.md`

### Phase 1 preflight packaging + exit matrix promotion (`docs`, workspace scripts)

- added repeatable recurring gate runner:
  - `scripts/v1-preflight.mjs`
  - `npm run v1:preflight` for GA1..GA5
  - `npm run v1:readiness` for GA1..GA5 plus SDK/Web typecheck support checks
- added `docs/runbooks/phase1-preflight-checklist.md`:
  - maps `GA1`..`GA6` to concrete commands/checks
  - preserves GA6 as explicit runbook drill requirement
- added `docs/architecture/stalled-project-support-flow.md`:
  - explicit `project-maintenance` lane template defaults
  - explicit stalled-project maintenance scenario flow and evidence links
- promoted `docs/v0/v0-exit-evidence-matrix.md` status:
  - criterion rows `determinism`, `non-author usability`, and `stalled-project modeling` moved to `completed`
  - sign-off gates `G1`, `G2`, `G3`, and `G5` moved to `pass`
- historical note: `G4` was pending, awaiting abuse-matrix gap closure (resolved later in this log)

Primary files:

- `scripts/v1-preflight.mjs`
- `package.json`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/architecture/stalled-project-support-flow.md`
- `docs/v0/v0-exit-evidence-matrix.md`
- `docs/v0/v0-closed-alpha-readiness-report.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`

### Abuse-matrix gap closure (partial) for `G4` (`crates/node`, `docs`)

- added node API abuse-path regression coverage:
  - `api_duplicate_nonce_rejected_with_stable_reason_and_snapshot_parity` (`AB-02`)
  - `api_policy_update_unauthorized_rejected_and_timeline_noops` (`AB-06`)
  - `api_policy_version_activation_boundary_rejects_stale_policy_version` (`AB-07`)
- added node sync abuse-path regression coverage:
  - `sync_pull_reset_reports_mixed_duplicate_and_new_events` (`AB-11`)
  - strengthened `sync_bootstrap_rejects_corrupted_remote_snapshot` with explicit deterministic error message contract assertion (`AB-12`)
- updated abuse/evidence docs to reflect closed gaps for `AB-02`, `AB-06`, `AB-07`, `AB-11`, and `AB-12`
- historical snapshot: `G4` was in progress with remaining gaps centered on `AB-03`, `AB-04`, `AB-05`, `AB-08`, `AB-09`, and `AB-10` (superseded by closure section below)

Primary files:

- `crates/node/tests/api.rs`
- `crates/node/tests/sync.rs`
- `docs/v0/v0-abuse-gaming-test-matrix.md`
- `docs/v0/v0-exit-evidence-matrix.md`
- `docs/roadmap/progress.md`

### Abuse-matrix closure complete (`G4` pass) (`crates/node`, `crates/state-engine`, `docs`)

- added node API regressions:
  - `api_bad_signature_fixture_rejected_with_stable_reason_and_snapshot_parity` (`AB-01`)
  - `api_missing_reference_fixtures_preserve_reason_code_parity_across_replay_sources` (`AB-03`)
  - `api_marketplace_second_settlement_signature_from_unauthorized_actor_rejects_deterministically` (`AB-04`)
  - `api_marketplace_overfund_with_stale_policy_version_rejects_with_policy_violation` (`AB-05`)
- added state-engine economics-boundary regressions:
  - `replay_issuance_rate_limit_recovers_after_window_advance` (`AB-08`)
  - `replay_issuance_diversity_allows_cross_lane_counterparty_recovery` (`AB-09`)
- confirmed existing `economic_eligibility_is_noop_when_policy_thresholds_unset` as explicit `AB-10` coverage
- updated abuse/exit docs:
  - `docs/v0/v0-abuse-gaming-test-matrix.md` now shows no open gaps for `AB-01`..`AB-12`
  - `docs/v0/v0-exit-evidence-matrix.md` now marks abuse row `completed` and `G4` as `pass`

Primary files:

- `crates/node/tests/api.rs`
- `crates/state-engine/src/replay.rs`
- `docs/v0/v0-abuse-gaming-test-matrix.md`
- `docs/v0/v0-exit-evidence-matrix.md`
- `docs/roadmap/progress.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`

### GA6 drill automation + Phase 1 cadence (`scripts`, `docs`)

- added scripted GA6 drill wrapper:
  - `scripts/v1-ga6-drill.mjs`
  - `npm run v1:ga6-drill`
  - executes runbook ingest/sync/snapshot/bootstrap/db-inspect command chain and writes summary artifact
- validated scripted GA6 drill run:
  - `target/tmp/runbook-dryrun-1775558664380/ga6-drill-summary.json`
  - command output confirms valid fixture ingests (`rejected_count=0`), sync pull (`rejected_count=0`), bootstrap (`rejected_count=0`), and DB inspect snapshots
- upgraded scripted GA6 drill validation:
  - summary now records `invalid_event_count` and replay/discovery parity checks across node A/B/C
  - latest verified artifact: `target/tmp/runbook-dryrun-1775560430460/ga6-drill-summary.json`
- updated preflight/readiness docs to include scripted GA6 path:
  - `docs/runbooks/phase1-preflight-checklist.md`
  - `docs/v0/v0-closed-alpha-readiness-report.md`
- added operations rhythm doc:
  - `docs/runbooks/phase1-operations-cadence.md`
  - linked in `docs/README.md`, `docs/archive/roadmap.md`, and `docs/v0/v0-roadmap.md`

Primary files:

- `scripts/v1-ga6-drill.mjs`
- `package.json`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/v0/v0-closed-alpha-readiness-report.md`
- `docs/README.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`

### Phase 1 operations UX start (`apps/web`)

- added a new `Phase 1 Operations` section to the web shell home page:
  - lists recurring ops commands (`v1:preflight`, `v1:readiness`, `v1:ga6-drill`)
  - reads the latest `ga6-drill-summary.json` under `target/tmp/runbook-dryrun-*`
  - shows invalid-event counts and replay/discovery parity booleans for node A/B/C
- this is a first UX bridge between operational runbook artifacts and day-to-day operator visibility in Phase 1

Primary file:

- `apps/web/app/page.tsx`

### Phase 1 operations workflow hardening (`scripts`, `apps/web`, `docs`)

- upgraded recurring preflight command output:
  - `scripts/v1-preflight.mjs` now writes `target/tmp/preflight-<timestamp>/preflight-summary.json`
  - summary captures per-gate command, start time, duration, pass/fail status, and failed gate when applicable
- upgraded GA6 drill validation/evidence contract:
  - `scripts/v1-ga6-drill.mjs` now records `applied_event_count` for node A/B/C
  - GA6 drill now hard-fails if `applied_event_count_equal.node_a_vs_node_b` or `node_a_vs_node_c` is false
- expanded web operations visibility:
  - `apps/web/app/page.tsx` now reads latest preflight summary (`preflight-*`) and shows overall status/check pass counts
  - Phase 1 operations panel now also shows GA6 applied-event counts and applied-event parity booleans
- refreshed cadence/checklist docs to reflect new artifact/evidence fields:
  - `docs/runbooks/phase1-preflight-checklist.md`
  - `docs/runbooks/phase1-operations-cadence.md`
- latest verified artifacts:
  - `target/tmp/preflight-1775561450232/preflight-summary.json`
  - `target/tmp/preflight-1775561719645/preflight-summary.json`
  - `target/tmp/runbook-dryrun-1775561486270/ga6-drill-summary.json`

Primary files:

- `scripts/v1-preflight.mjs`
- `scripts/v1-ga6-drill.mjs`
- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations UX: run history + triage shortcuts (`apps/web`, `docs`)

- expanded `Phase 1 Operations` panel behavior in `apps/web/app/page.tsx`:
  - reads and renders latest five preflight summary runs from `target/tmp/preflight-*`
  - reads and renders latest five GA6 summary runs from `target/tmp/runbook-dryrun-*`
  - computes pass/fail statuses from deterministic summary fields
  - adds failure-triage command shortcuts that appear only when latest preflight/GA6 state is failing
- tightened GA6 history parsing:
  - history rows are accepted only when required parity fields are present (`invalid_event_count`, `applied_event_count`, `applied_event_count_equal`, `replay_state_equal`, `discovery_equal`)
  - prevents legacy partial GA6 summaries from being shown as current parity evidence
- synchronized roadmap status language to reflect new operations UX scope:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations UX: artifact lifecycle controls (`apps/web`, `docs`)

- extended `apps/web/app/page.tsx` operations panel with artifact lifecycle analysis:
  - computes cadence-aligned staleness for latest preflight/GA6 runs from run-id timestamps
  - annotates run history rows with `stale` and `pinned` markers
  - detects pin markers from artifact directories (`.pinned`, `.keep`, `PINNED.md`)
  - computes prune candidates while preserving pinned runs and newest retained runs
- added explicit lifecycle command templates in the panel:
  - pin/unpin latest preflight and GA6 run markers
  - preview/prune candidate artifact directories using PowerShell `-WhatIf` safety defaults
- added runbook shortcut command block in the panel for:
  - incident triage section lookup
  - cadence checklist open
  - gate mapping checklist open
- synchronized docs to reflect lifecycle controls in roadmap/cadence/progress status:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations UX: incident annotations + archive shortcuts (`apps/web`, `docs`)

- extended `apps/web/app/page.tsx` lifecycle/history contracts:
  - each run history row now reads optional per-run note/tag files:
    - `OPERATIONS_NOTE.txt`
    - `INCIDENT_TAGS.txt`
  - row rendering now includes note summary and parsed tag list for preflight + GA6 runs
- extended lifecycle summary metrics:
  - added `notedRuns` and `taggedRuns` counts per lane (`preflight`, `ga6`)
  - keeps existing freshness/pin/prune metrics
- extended lifecycle command templates:
  - set note/tag files on latest preflight and latest GA6 run directories
  - archive latest run artifacts using `Compress-Archive` to `target/tmp/archive/*.zip`
  - keeps pin/unpin and prune-preview commands
- synchronized docs to reflect annotation/archive lifecycle workflow:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations evidence manifest export (`scripts`, `docs`)

- added deterministic consolidated evidence exporter:
  - `scripts/v1-evidence-manifest.mjs`
  - command: `npm run v1:evidence-manifest`
- exporter behavior:
  - scans preflight and GA6 run artifacts under `target/tmp`
  - parses summaries with strict contracts (including GA6 parity fields)
  - includes lifecycle metadata (`stale`, `pinned`, note/tag summaries, prune candidates)
  - writes canonical manifest artifact:
    - `target/tmp/operations-evidence-manifest.json`
  - supports `--as-of <rfc3339>` for reproducible age/staleness analysis snapshots
- latest generated evidence artifact:
  - `target/tmp/operations-evidence-manifest.json`
  - `target/tmp/operations-evidence-manifest-asof.json` (fixed `--as-of` reproducibility snapshot)
- synchronized command/docs references:
  - `package.json` (`v1:evidence-manifest`)
  - `docs/runbooks/phase1-preflight-checklist.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `scripts/v1-evidence-manifest.mjs`
- `package.json`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 policy-bounded prune planner export (`scripts`, `docs`)

- added deterministic prune planning script:
  - `scripts/v1-artifact-prune-plan.mjs`
  - command: `npm run v1:artifact-prune-plan`
- planner behavior:
  - scans preflight/GA6 run artifacts under `target/tmp`
  - parses lane summaries with deterministic status contracts
  - generates explicit exclusion reasons (`keep_recent_window`, `within_retention_window`, `pinned`, `has_note`, `has_tags`, `status_not_eligible`, `missing_timestamp`)
  - emits per-lane preview/dry-run/apply command templates while performing no deletion
  - default eligible statuses: `passed` only; configurable via `--eligible-status`
- latest generated plan artifact:
  - `target/tmp/operations-artifact-prune-plan.json`
  - `target/tmp/operations-artifact-prune-plan-asof.json` (fixed `--as-of` reproducibility snapshot)
- synchronized command/docs references:
  - `package.json` (`v1:artifact-prune-plan`)
  - `docs/runbooks/phase1-preflight-checklist.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `scripts/v1-artifact-prune-plan.mjs`
- `package.json`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: evidence exports integration (`apps/web`, `docs`)

- wired item 3 completion into `apps/web/app/page.tsx`:
  - panel now discovers latest `operations-evidence-manifest*.json` and `operations-artifact-prune-plan*.json` artifacts under `target/tmp`
  - renders artifact path + `analysis_as_of` + status/candidate summaries
  - exposes copy-ready command outputs derived directly from artifact `commands` fields (manifest + prune plan)
- this closes the queued follow-up action to surface evidence/prune artifacts in web UI for readiness + cleanup workflows
- synchronized status/cadence docs:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: export freshness warnings + refresh triggers (`apps/web`, `docs`)

- extended `apps/web/app/page.tsx` Evidence Exports behavior:
  - parses artifact `analysis_as_of` timestamps for manifest/prune-plan previews
  - computes staleness reasons based on:
    - export age over 24h
    - export timestamp predating latest preflight/GA6 run artifact
  - renders explicit refresh recommendation warnings when either condition is true
  - always includes top-level refresh commands:
    - `npm run v1:evidence-manifest`
    - `npm run v1:artifact-prune-plan`
  - de-duplicates generated command list across manifest/planner command sources
- synchronized docs to capture stale-export warning behavior:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Closed-alpha readiness packet: export wiring (`docs`)

- completed queued follow-up to wire export artifacts into closed-alpha status docs:
  - updated `docs/v0/v0-closed-alpha-readiness-report.md`
  - verification index now includes:
    - `npm run v1:evidence-manifest`
    - `npm run v1:artifact-prune-plan`
  - added `Operations evidence exports (Phase 1 carry-forward)` section with:
    - canonical artifact paths
    - reproducibility snapshot paths
    - upkeep rule to refresh exports before readiness/go-no-go updates
  - post-go actions now include explicit export refresh requirement
- synced progress tracking:
  - `docs/roadmap/progress.md`

Primary files:

- `docs/v0/v0-closed-alpha-readiness-report.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: allowlisted export execution controls (`apps/web`, `docs`)

- completed queued Phase 1 operator control by enabling in-panel execution (not only copy) for export refresh commands:
  - added allowlisted server route `apps/web/app/api/operations/exports/route.ts`
  - route executes only:
    - `refresh_evidence_manifest` -> `npm run v1:evidence-manifest`
    - `refresh_artifact_prune_plan` -> `npm run v1:artifact-prune-plan`
  - route returns bounded command output tails + duration/exit metadata for deterministic operator feedback
- upgraded command tool UX in `apps/web/app/components/operations-command-tools.tsx`:
  - supports per-command runnable action metadata
  - adds `Run Now` control beside copy action
  - keeps explicit refresh-status view control and optional post-run `router.refresh()` behavior
- wired runnable action metadata in `apps/web/app/page.tsx`:
  - export workflow rows now mark allowlisted refresh commands as executable from panel
  - exported command rows keep dedupe behavior while preserving runnable metadata
- synchronized status/cadence docs:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/api/operations/exports/route.ts`
- `apps/web/app/components/operations-command-tools.tsx`
- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: export execution audit rows (`apps/web`, `docs`)

- completed queued follow-up for per-run in-panel export execution audit visibility:
  - `apps/web/app/api/operations/exports/route.ts` now appends JSONL audit rows at:
    - `target/tmp/operations-export-execution-log.jsonl`
  - each row records:
    - action id + label
    - command
    - start/completion timestamps
    - duration
    - pass/fail status
    - exit code
    - artifact path hints
- extended Evidence Exports read model/UI in `apps/web/app/page.tsx`:
  - added loader for recent export execution audit rows
  - renders recent rows with timestamp, status, duration, exit code, and artifact hints
  - includes audit log path visibility and unavailable-state messaging
- extended runbook shortcuts in `apps/web/app/page.tsx` with export-audit tail command:
  - `Get-Content -Path <target/tmp/operations-export-execution-log.jsonl> -Tail 20`
- synchronized docs:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/api/operations/exports/route.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/components/operations-command-tools.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: export audit rollups + failure alerting (`apps/web`, `docs`)

- extended export execution audit visibility with operator-facing rollups:
  - `apps/web/app/page.tsx` now computes per-action rollups from audit log rows:
    - latest status and timestamp
    - failure streak since last success
    - last-success timestamp/age
  - `Evidence Exports` now shows:
    - per-action rollup list
    - explicit latest-failure alert when any action is currently failing
    - latest-pass confirmation when no alert is active
- kept runbook shortcut to audit tail command for handoff/debug workflow
- synchronized docs:
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 export-audit retention/rotation planning (`scripts`, `apps/web`, `docs`)

- completed queued retention/rotation task for export execution audit log growth control:
  - added deterministic planner script:
    - `scripts/v1-export-audit-log-plan.mjs`
    - command: `npm run v1:export-audit-log-plan`
  - planner outputs canonical artifact:
    - `target/tmp/operations-export-audit-log-plan.json`
  - planner supports reproducible snapshot path:
    - `target/tmp/operations-export-audit-log-plan-asof.json`
  - planner contract includes:
    - size policy (`max_bytes`) and retention windows (`retain_recent_days`, `retain_failed_days`, `min_keep_lines`)
    - prune candidate rows + exclusion reason counts
    - command paths (`generate_plan`, `reproducible_snapshot`, `apply_cleanup`)
  - apply mode (`--apply`) archives pruned rows under `target/tmp/archive` before rewriting log
- extended operations panel integration:
  - allowlisted `Run Now` action added for planner refresh (`refresh_export_audit_log_plan`)
  - `apps/web/app/page.tsx` now renders `Export Audit Log Cleanup Plan` summary:
    - line keep/prune counts
    - current/projected/max bytes
    - stale-plan warning + over-policy warning states
    - last apply result warning/archive visibility
- synchronized docs and readiness references:
  - `docs/runbooks/phase1-preflight-checklist.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/v0/v0-closed-alpha-readiness-report.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `scripts/v1-export-audit-log-plan.mjs`
- `package.json`
- `apps/web/app/api/operations/exports/route.ts`
- `apps/web/app/components/operations-command-tools.tsx`
- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/v0/v0-closed-alpha-readiness-report.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 export-audit planner apply smoke harness (`scripts`, `apps/web`, `docs`)

- completed queued follow-up to guard retention-policy regressions with deterministic apply-mode checks:
  - added `scripts/v1-export-audit-log-plan-smoke.mjs`
  - added command `npm run v1:export-audit-log-plan:smoke`
  - smoke harness runs planner against isolated temp workspace fixtures and asserts:
    - prune candidate selection contract
    - apply archive creation + archived-line parity
    - rewritten-log kept-line invariants
- extended panel operator shortcuts:
  - added runbook shortcut command in `apps/web/app/page.tsx`:
    - `npm run v1:export-audit-log-plan:smoke`
- synchronized docs:
  - `docs/runbooks/phase1-preflight-checklist.md`
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `scripts/v1-export-audit-log-plan-smoke.mjs`
- `package.json`
- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: closed-alpha UX readiness focus checklist (`apps/web`, `docs`)

- completed next UX slice for operator-facing readiness visibility:
  - added `Closed-Alpha UX Readiness Focus` section in `apps/web/app/page.tsx`
  - checklist is artifact-backed and derives deterministic statuses for:
    - onboarding guardrails (`GA1`) from latest preflight check rows
    - discovery determinism (`GA5`) from latest preflight check rows
    - GA6 parity from latest drill artifact state
    - evidence-export freshness across manifest/prune/audit planning artifacts
- synchronized docs to include checklist review in recurring operations rhythm:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: readiness focus status summary counters (`apps/web`, `docs`)

- completed follow-up quick-scan UX slice for checklist triage:
  - `apps/web/app/page.tsx` now renders deterministic pass/attention/fail counters above `Closed-Alpha UX Readiness Focus`
  - counters are derived from the same row status values used by the checklist (`pass`, `attention`, `fail`) to avoid dual-source drift
- synchronized progress tracking:
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: copyable checklist view links (`apps/web`, `docs`)

- completed queued follow-up for async handoff sharing:
  - `apps/web/app/page.tsx` now renders a `Checklist View Links` command block with copyable URLs for:
    - current checklist view
    - non-pass view
    - stale view
    - stale + non-pass view
  - links preserve `focus_filter` and include `#phase1-operations` anchor for direct triage landing
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: stale-impact status counters (`apps/web`, `docs`)

- completed queued follow-up for stale triage prioritization:
  - `apps/web/app/page.tsx` now shows stale-row breakdown by status (`pass`, `attention`, `fail`) near checklist summary
  - operators can now separate stale regressions (`fail`) from stale-but-passing rows at a glance
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: per-row `why stale` hints (`apps/web`, `docs`)

- completed queued follow-up for stale-signal explainability:
  - `apps/web/app/page.tsx` now renders per-row `why stale` hint text when age badges are in warn/critical bands
  - hints include stale-source context (`run age` vs `export artifact age`) and threshold reason text (`exceeds 24h`, `exceeds 7d`)
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: active-filter view label (`apps/web`, `docs`)

- completed queued follow-up for handoff/screenshot clarity:
  - `apps/web/app/page.tsx` now shows explicit active checklist view label (`view: all/non-pass/stale/stale + non-pass`)
  - header now also shows filtered row count for current view scope
- synchronized progress tracking:
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: runbook filter-preset entry links (`apps/web`, `docs`)

- completed queued follow-up for one-click focused triage entry:
  - `apps/web/app/page.tsx` now renders filter-preset links in `Runbook Shortcuts` that jump to:
    - `/?focus_filter=non-pass#phase1-operations`
    - `/?focus_filter=stale#phase1-operations`
    - `/?focus_filter=stale-non-pass#phase1-operations`
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: export stale-severity rollup label (`apps/web`, `docs`)

- completed queued follow-up for evidence-refresh prioritization:
  - `apps/web/app/page.tsx` now derives evidence row severity rollup (`ok`, `watch`, `critical`) from age badge tones
  - evidence freshness summary now surfaces severity before detailed age/reason diagnostics
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: stale-age threshold emphasis badges (`apps/web`, `docs`)

- completed queued follow-up to make stale-but-passing checklist rows visually explicit:
  - `apps/web/app/page.tsx` now renders age badges for each `Closed-Alpha UX Readiness Focus` row with threshold labels:
    - `<=24h`
    - `>24h`
    - `>7d`
    - `unknown`
  - badge color emphasis now highlights warn/critical age bands without changing underlying pass/fail gate semantics
  - evidence row now includes per-artifact age badges for manifest/prune-plan/audit-plan recency scanning
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: compact checklist filter counts (`apps/web`, `docs`)

- completed queued follow-up for faster filter selection decisions:
  - `apps/web/app/page.tsx` now computes and renders per-filter row counts beside:
    - `all`
    - `non-pass`
    - `stale`
    - `stale + non-pass`
  - count values are derived from the same checklist source and stale-age detection logic used by row filtering
- synchronized progress tracking:
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: filter-preserving shortcut hrefs (`apps/web`, `docs`)

- completed queued follow-up for preserving checklist filter context during shortcut navigation:
  - `apps/web/app/page.tsx` now resolves row shortcut hrefs through active `focus_filter` context
  - in-page anchor shortcuts now keep current query filter state
  - cross-route shortcuts (for example `/explorer/discovery`) now carry `focus_filter` in generated hrefs
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: `stale + non-pass` checklist filter (`apps/web`, `docs`)

- completed queued follow-up for intersection triage mode:
  - `apps/web/app/page.tsx` now supports `focus_filter=stale-non-pass`
  - filter controls now include `stale + non-pass` to isolate non-pass rows with stale age badges
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: checklist quick-filter controls (`apps/web`, `docs`)

- completed queued follow-up to reduce row-scanning overhead in operational triage windows:
  - `apps/web/app/page.tsx` now accepts URL filter param `focus_filter` and applies server-rendered checklist filtering:
    - `all`
    - `non-pass`
    - `stale`
  - added in-panel filter links under `Closed-Alpha UX Readiness Focus` summary with active-filter emphasis styling
  - added empty-state message when no checklist rows match the selected filter
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: readiness checklist row age context (`apps/web`, `docs`)

- completed queued follow-up to expose recency directly in checklist rows:
  - `apps/web/app/page.tsx` now adds latest preflight run age to `GA1` and `GA5` summaries
  - `GA6` summary now includes latest drill run age in both pass and fail states
  - evidence-export row summary now includes manifest/prune-plan/audit-plan ages in addition to stale-reason diagnostics
- synchronized progress tracking:
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: non-pass row command-tool blocks (`apps/web`, `docs`)

- continued checklist triage UX hardening by replacing raw non-pass command lists with reusable command-tool rendering:
  - `apps/web/app/page.tsx` now renders `OperationsCommandTools` blocks under non-pass `Closed-Alpha UX Readiness Focus` rows
  - row-level command sets now provide copy-first workflow and preserve allowlisted `Run Now` actions when runnable metadata is present
- synchronized docs to reflect row-level command-tool workflow in recurring operations:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: non-pass readiness deep-link shortcuts (`apps/web`, `docs`)

- completed queued follow-up to reduce operator navigation latency from checklist failures:
  - extended `Closed-Alpha UX Readiness Focus` rows in `apps/web/app/page.tsx` with non-pass shortcut links to relevant surfaces:
    - `GA1` onboarding guardrails -> `#onboarding-wizard`, `#ops-failure-triage`
    - `GA5` discovery determinism -> `/explorer/discovery`, `#ops-failure-triage`
    - `GA6` runbook parity -> `#ops-recent-history`, `#ops-runbook-shortcuts`
    - evidence export freshness -> `#ops-evidence-exports`, `#ops-export-execution-audit`
  - added stable section anchors in the operations panel for direct in-page routing:
    - `phase1-operations`, `ops-recent-history`, `ops-evidence-exports`, `ops-export-execution-audit`, `ops-runbook-shortcuts`, `ops-failure-triage`
  - wrapped onboarding wizard surface with `#onboarding-wizard` anchor for checklist-driven jump navigation
- synchronized docs to reflect deep-link triage workflow:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/archive/roadmap.md`
  - `docs/v0/v0-roadmap.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: `critical stale only` filter mode (`apps/web`, `docs`)

- completed queued follow-up for urgent-age triage isolation:
  - `apps/web/app/page.tsx` now supports `focus_filter=critical-stale` (`>7d`) and applies it in server-rendered checklist filtering
  - filter controls, active-view labels, runbook preset links, and checklist view-link copy controls now include the critical-stale mode
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale urgent command rollup (`apps/web`, `docs`)

- completed queued follow-up for urgent command execution flow:
  - `apps/web/app/page.tsx` now renders `Critical Stale Urgent Triage Commands` when `focus_filter=critical-stale`
  - rollup aggregates non-pass row command sets into one copy/run block for faster operator handling
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale rollup impact summary (`apps/web`, `docs`)

- completed queued follow-up for execution planning clarity:
  - `apps/web/app/page.tsx` now surfaces critical-stale rollup impact metrics before the command block:
    - unique command count
    - runnable action count
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale rollup deterministic ordering (`apps/web`, `docs`)

- completed queued follow-up for reduced operator decision overhead:
  - `apps/web/app/page.tsx` now sorts critical-stale rollup commands with runnable actions first
  - remaining commands are deterministically ordered alphabetically by label and command
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale rollup row-origin labels (`apps/web`, `docs`)

- completed queued follow-up for command provenance clarity:
  - `apps/web/app/page.tsx` now aggregates critical-stale rollup commands by command string and annotates each with full row origin list (`[from: ...]`)
  - shared commands now preserve all contributing checklist sources (deterministically sorted)
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale grouped command sections (`apps/web`, `docs`)

- completed queued follow-up for long-list command scanning:
  - `apps/web/app/page.tsx` now renders critical-stale rollup as two groups:
    - `Critical Stale Urgent Triage Commands (Runnable)`
    - `Critical Stale Urgent Triage Commands (Copy-Only)`
  - keeps execution path focused by isolating runnable actions from copy-only commands
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale copy-only visibility toggle (`apps/web`, `docs`)

- completed queued follow-up for reduced incident-mode visual load:
  - `apps/web/app/page.tsx` now supports `critical_copy=hide` and renders show/hide controls in critical-stale command area
  - copy-only command group can be hidden while keeping runnable command group visible
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale hidden-copy share links (`apps/web`, `docs`)

- completed queued follow-up for stable incident-mode sharing:
  - `apps/web/app/page.tsx` now emits explicit critical-stale URLs with `critical_copy=hide` in:
    - runbook preset entry links
    - checklist view-link copy commands
  - preserves runnable-only visibility mode in shared links across handoffs
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale copy visibility badge (`apps/web`, `docs`)

- completed queued follow-up for screenshot/handoff state clarity:
  - `apps/web/app/page.tsx` now displays explicit mode badge in critical-stale command area:
    - `copy-only visibility: shown|hidden`
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: critical-stale no-non-pass warning (`apps/web`, `docs`)

- completed queued follow-up to reduce false-clear interpretation:
  - `apps/web/app/page.tsx` now warns when critical-stale view has no non-pass rows but still contains critical-stale pass rows
  - warning explicitly advises evidence refresh before declaring all-clear state
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: actionable urgent sequence block (`apps/web`, `docs`)

- upgraded critical-stale sequence guidance from plain text to actionable controls:
  - `apps/web/app/page.tsx` now renders `Critical Stale Urgent Sequence` as a command-tool block
  - sequence preserves remediation order:
    - refresh exports
    - rerun readiness
    - verify GA6 parity
  - first step is wired as runnable through existing allowlisted export refresh action
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: inline critical-stale incident share shortcut (`apps/web`, `docs`)

- completed queued follow-up for direct incident-mode handoff:
  - `apps/web/app/page.tsx` now renders `share this incident view` directly in critical-stale mode
  - shortcut uses the already-derived current incident URL, preserving both:
    - `focus_filter=critical-stale`
    - current `critical_copy` visibility state
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: inline copyable incident share controls (`apps/web`, `docs`)

- completed queued follow-up for no-navigation handoff:
  - `apps/web/app/page.tsx` now renders `Critical Stale Incident Share Links` directly beside the visible incident URL
  - controls provide copyable URLs for:
    - current incident view
    - hidden-copy incident view
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: active inline incident-share marker (`apps/web`, `docs`)

- completed queued follow-up for share-link state clarity:
  - `apps/web/app/page.tsx` now marks the active inline share command with current `critical_copy` mode (`shown` or `hidden`)
  - makes it explicit which copied URL matches the live incident view
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: alternate inline incident-share marker (`apps/web`, `docs`)

- completed queued follow-up for full share-link state clarity:
  - `apps/web/app/page.tsx` now labels the non-active inline share URL as the inactive alternate preset
  - fixed the duplicate-link edge case when `critical_copy=hide` by deriving explicit current and alternate URLs from opposite visibility modes
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: compact incident-mode summary line (`apps/web`, `docs`)

- completed queued follow-up for faster screenshot parsing:
  - `apps/web/app/page.tsx` now renders `incident mode` line beside the critical-stale share controls
  - summary combines:
    - active filter (`critical stale only (>7d)`)
    - current copy-only visibility state (`shown` or `hidden`)
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: self-describing inline share controls (`apps/web`, `docs`)

- completed queued follow-up for copy/paste handoff clarity:
  - `apps/web/app/page.tsx` now embeds current critical-stale incident-mode summary in:
    - inline share-control block title
    - inline share-control labels
  - copied URLs remain self-describing outside the live UI context
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: recommended handoff URL line (`apps/web`, `docs`)

- completed queued follow-up for zero-ambiguity sharing:
  - `apps/web/app/page.tsx` now renders `recommended handoff link` beside the critical-stale share controls
  - line highlights the preferred current incident URL without requiring operators to inspect command labels
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: copyable recommended handoff control (`apps/web`, `docs`)

- completed the queued follow-up for direct preferred-link copying:
  - `apps/web/app/page.tsx` now renders `Recommended Handoff Link` beside the visible recommended incident URL
  - control provides a copyable command row for the preferred current incident URL
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: active recommended-handoff marker (`apps/web`, `docs`)

- completed the queued follow-up for clearer preferred-link targeting:
  - `apps/web/app/page.tsx` now labels the visible recommended handoff line as `active`
  - `apps/web/app/page.tsx` now marks the `Recommended Handoff Link` command-tool block and copy label as the active current-share control
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: fallback incident-share markers (`apps/web`, `docs`)

- completed the queued follow-up for alternate-preset clarity:
  - `apps/web/app/page.tsx` now labels the broader `share this incident view` line as the `fallback` block
  - `apps/web/app/page.tsx` now marks `Critical Stale Incident Share Links` as `fallback/alternate presets`
  - alternate incident-share copy labels now use `fallback alternate` wording
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: handoff hierarchy summary line (`apps/web`, `docs`)

- completed the queued follow-up for at-a-glance handoff clarity:
  - `apps/web/app/page.tsx` now renders a one-line `handoff hierarchy` summary in critical-stale mode
  - line explicitly defines `active recommended` as the preferred current-share URL and `fallback alternate presets` as secondary incident-share options
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: share-block hierarchy title cue (`apps/web`, `docs`)

- completed the queued follow-up for cropped-share-block clarity:
  - `apps/web/app/page.tsx` now embeds `handoff hierarchy: active recommended -> fallback alternate presets` in the `Critical Stale Incident Share Links` title
  - keeps the share-control block self-describing even when the adjacent hierarchy summary line is out of frame
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: recommended-block hierarchy title cue (`apps/web`, `docs`)

- completed the queued follow-up for cropped recommended-block clarity:
  - `apps/web/app/page.tsx` now embeds `handoff hierarchy: active recommended current-share control` in the `Recommended Handoff Link` title
  - keeps the preferred-share block self-describing even when separated from the broader handoff hierarchy area
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: recommended-block fallback-usage helper (`apps/web`, `docs`)

- completed the queued follow-up for explicit alternate-preset guidance:
  - `apps/web/app/page.tsx` now renders a helper line beneath `Recommended Handoff Link`
  - helper tells operators to use the fallback share block only when they intentionally need an alternate preset
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: fallback-block alternate-preset helper (`apps/web`, `docs`)

- completed the queued follow-up for mirrored fallback guidance:
  - `apps/web/app/page.tsx` now renders a helper line beside the fallback share block
  - helper states that fallback share links are alternate presets, not the default current-share handoff path
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: shared handoff-helper alignment note (`apps/web`, `docs`)

- completed the queued follow-up for partial-visibility trust:
  - `apps/web/app/page.tsx` now renders a compact shared note beneath the handoff helper lines
  - note states that both helper cues are aligned, so either the recommended or fallback side can be trusted when the other is out of frame
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: share-block legend tokens (`apps/web`, `docs`)

- completed the queued follow-up for collapsed-title scanability:
  - `apps/web/app/page.tsx` now labels `Recommended Handoff Link` with `[recommended]`
  - `apps/web/app/page.tsx` now labels `Critical Stale Incident Share Links` with `[fallback]`
  - short tokens preserve handoff hierarchy even when helper text lines are not visible
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: visible handoff-link legend tokens (`apps/web`, `docs`)

- completed the queued follow-up for out-of-title scanability:
  - `apps/web/app/page.tsx` now labels the visible recommended handoff URL line with `[recommended]`
  - `apps/web/app/page.tsx` now labels the visible fallback incident-share URL line with `[fallback]`
  - tokens keep the two visible URLs distinguishable even without the command-block titles
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: inline handoff legend key (`apps/web`, `docs`)

- completed the queued follow-up for token self-description:
  - `apps/web/app/page.tsx` now renders a one-line legend near the critical-stale handoff area
  - legend maps `[recommended]` to preferred current-share and `[fallback]` to alternate preset
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: copied-link legend preservation note (`apps/web`, `docs`)

- completed the queued follow-up for off-page handoff clarity:
  - `apps/web/app/page.tsx` now renders a compact copied-link note in the critical-stale handoff area
  - note states that `[recommended]` and `[fallback]` legend tokens are preserved in copy labels
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: scan/copy token alignment note (`apps/web`, `docs`)

- completed the queued follow-up for scan-vs-copy consistency:
  - `apps/web/app/page.tsx` now renders a short alignment note in the critical-stale handoff area
  - note states that visible URL lines and copy actions intentionally use the same legend tokens
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: shared current-context note (`apps/web`, `docs`)

- completed the queued follow-up for handoff-target clarity:
  - `apps/web/app/page.tsx` now renders a concise context note in the critical-stale handoff area
  - note states that recommended and fallback URLs point to the same current incident context
  - note clarifies that only handoff role and preset framing differ
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: fallback-selection note (`apps/web`, `docs`)

- completed the queued follow-up for alternate-preset decision clarity:
  - `apps/web/app/page.tsx` now renders a short fallback-preference note in the critical-stale handoff area
  - note explains that fallback should be preferred only when operators intentionally need alternate share framing such as copy-only-hidden handoff
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

### Phase 1 operations panel: recommended-path note (`apps/web`, `docs`)

- completed the queued follow-up for default-path decision clarity:
  - `apps/web/app/page.tsx` now renders a short recommended-preference note in the critical-stale handoff area
  - note explains that operators should stay on the recommended current-share path when alternate preset framing is not needed
- synchronized docs:
  - `docs/runbooks/phase1-operations-cadence.md`
  - `docs/roadmap/progress.md`

Primary files:

- `apps/web/app/page.tsx`
- `docs/runbooks/phase1-operations-cadence.md`
- `docs/roadmap/progress.md`
- `docs/roadmap/working-context-log.md`

## Validation run log

- `npm.cmd run -w @new-start/web typecheck` (pass)
- `npm.cmd run typecheck` (pass)
- `cargo test -p node --test api api_marketplace_accept_flow_transitions_are_replay_stable` (pass)
- `cargo test -p node --test api api_marketplace_dispute_settlement_handshake_is_replay_stable` (pass)
- `cargo test -p node --test api api_marketplace_dispute_timeout_autorefund_is_replay_stable` (pass)
- `cargo test -p node --test api api_marketplace_deadlock_same_actor_settlement_rejects_with_replay_parity` (pass)
- `cargo test -p node --test api api_marketplace_settlement_missing_dispute_reference_rejected_deterministically` (pass)
- `cargo test -p node --test api` (pass)
- `npm.cmd run -w @new-start/web typecheck` (pass, post `T5-S5` changes)
- `npm.cmd run typecheck` (pass, post `T5-S5` changes)
- `cargo test -p node --test api api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic` (pass)
- `cargo test -p node --test api` (pass, 17 tests)
- `npm.cmd run typecheck` (pass, post discovery API integration)
- `cargo test -p node --test sync sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views` (pass)
- `cargo test -p node --test sync` (pass, 16 tests)
- `cargo run --bin cli -- node ingest --data-dir target/tmp/runbook-smoke/node-a --in fixtures/valid/marketplace-accept.jsonl` (pass, `rejected_count=0`)
- `cargo run --bin cli -- node db inspect --data-dir target/tmp/runbook-smoke/node-a` (pass, `event_count=15`, `invalid_event_count=0`)
- `cargo run --bin cli -- node snapshot create --data-dir target/tmp/runbook-smoke/node-a --as-of 2026-03-01T00:15:00Z --out target/tmp/runbook-smoke/node-a/latest-snapshot.json` (pass, `event_seq=15`)
- `target/debug/cli.exe node sync pull --data-dir target/tmp/runbook-smoke/node-b --peer node-a --limit 200 --max-pages 100` (pass, `accepted_count=15`, `rejected_count=0`, via job-hosted node serve)
- `target/debug/cli.exe node sync bootstrap --data-dir target/tmp/runbook-smoke/node-c --peer node-a --limit 200 --max-pages 100` (pass, snapshot imported, via job-hosted node serve)
- `target/debug/cli.exe` full docs-only dry run at `target/tmp/runbook-dryrun-1775537368434` (pass: three-bundle ingest, sync pull convergence, snapshot bootstrap recovery)
- `cargo test -p node --test api api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch` (pass)
- `cargo test -p node --test api api_marketplace_offline_lane_template_mismatch_rejections_are_deterministic` (pass)
- `cargo test -p node --test api api_marketplace_accept_flow_covers_initial_digital_lanes` (pass)
- `cargo test -p node --test api api_marketplace_dispute_timeout_covers_initial_digital_lanes` (pass)
- `cargo test -p node --test api` (pass, 21 tests)
- `npm.cmd run v1:preflight` (pass)
- `npm.cmd run v1:readiness` (pass)
- `cargo run --bin cli -- fixtures run` (pass, `validFixtures=7`, `invalidFixtures=14`)
- `cargo test` (pass, full workspace suite)
- `cargo test -p node --test api api_policy_version_activation_boundary_rejects_stale_policy_version` (pass)
- `cargo test -p node --test api` (pass, 24 tests)
- `cargo test -p node --test sync` (pass, 17 tests)
- `cargo test -p node --test api api_missing_reference_fixtures_preserve_reason_code_parity_across_replay_sources` (pass)
- `cargo test -p node --test api api_marketplace_second_settlement_signature_from_unauthorized_actor_rejects_deterministically` (pass)
- `cargo test -p node --test api api_marketplace_overfund_with_stale_policy_version_rejects_with_policy_violation` (pass)
- `cargo test -p state-engine replay_issuance_rate_limit_recovers_after_window_advance` (pass)
- `cargo test -p state-engine replay_issuance_diversity_allows_cross_lane_counterparty_recovery` (pass)
- `cargo test -p state-engine` (pass)
- `cargo test -p node --test api api_bad_signature_fixture_rejected_with_stable_reason_and_snapshot_parity` (pass)
- `cargo test -p node --test api` (pass, 28 tests)
- `npm.cmd run v1:preflight` (pass, post abuse-closure additions)
- `npm.cmd run v1:ga6-drill` (pass; summary artifact `target/tmp/runbook-dryrun-1775558664380/ga6-drill-summary.json`)
- `npm.cmd run v1:ga6-drill` (pass; enhanced validation artifact `target/tmp/runbook-dryrun-1775560430460/ga6-drill-summary.json`)
- `npm.cmd run -w @new-start/web typecheck` (pass, post Phase 1 operations panel)
- `npm.cmd run v1:preflight` (pass; summary artifact `target/tmp/preflight-1775561450232/preflight-summary.json`)
- `npm.cmd run -w @new-start/web typecheck` (pass, post preflight/operations-panel enhancement)
- `npm.cmd run v1:ga6-drill` (pass; summary artifact `target/tmp/runbook-dryrun-1775561486270/ga6-drill-summary.json` with applied-event parity assertions)
- `npm.cmd run typecheck` (pass)
- `npm.cmd run v1:readiness` (pass; summary artifact `target/tmp/preflight-1775561719645/preflight-summary.json`)
- `npm.cmd run -w @new-start/web typecheck` (pass, post run-history/triage UX slice)
- `npm.cmd run typecheck` (pass, post run-history/triage UX slice)
- `npm.cmd run -w @new-start/web typecheck` (pass, post artifact-lifecycle UX slice)
- `npm.cmd run typecheck` (pass, post artifact-lifecycle UX slice)
- `npm.cmd run -w @new-start/web typecheck` (pass, post incident-annotation/archive UX slice)
- `npm.cmd run typecheck` (pass, post incident-annotation/archive UX slice)
- `npm.cmd run v1:evidence-manifest` (pass; summary artifact `target/tmp/operations-evidence-manifest.json`)
- `node ./scripts/v1-evidence-manifest.mjs --as-of 2026-04-07T15:00:00Z --out target/tmp/operations-evidence-manifest-asof.json` (pass)
- `npm.cmd run v1:artifact-prune-plan` (pass; summary artifact `target/tmp/operations-artifact-prune-plan.json`)
- `node ./scripts/v1-artifact-prune-plan.mjs --as-of 2026-04-07T15:00:00Z --out target/tmp/operations-artifact-prune-plan-asof.json` (pass)
- `npm.cmd run -w @new-start/web typecheck` (pass, post evidence-export panel integration)
- `npm.cmd run typecheck` (pass, post evidence-export panel integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post export-freshness warning integration)
- `npm.cmd run typecheck` (pass, post export-freshness warning integration)
- `docs/v0/v0-closed-alpha-readiness-report.md` export-wiring update (documentation-only change; no runtime checks required)
- `npm.cmd run -w @new-start/web typecheck` (pass, post allowlisted export execution controls)
- `npm.cmd run typecheck` (pass, post allowlisted export execution controls)
- `npm.cmd run -w @new-start/web typecheck` (pass, post export execution audit rows integration)
- `npm.cmd run typecheck` (pass, post export execution audit rows integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post export execution audit rollup/alert integration)
- `npm.cmd run typecheck` (pass, post export execution audit rollup/alert integration)
- `npm.cmd run v1:export-audit-log-plan` (pass; summary artifact `target/tmp/operations-export-audit-log-plan.json`)
- `node ./scripts/v1-export-audit-log-plan.mjs --as-of 2026-04-07T15:00:00Z --out target/tmp/operations-export-audit-log-plan-asof.json` (pass)
- `npm.cmd run -w @new-start/web typecheck` (pass, post export-audit retention/rotation planner integration)
- `npm.cmd run typecheck` (pass, post export-audit retention/rotation planner integration)
- `npm.cmd run v1:export-audit-log-plan:smoke` (pass, required escalated run due sandbox `spawn EPERM` on non-escalated attempt)
- `npm.cmd run -w @new-start/web typecheck` (pass, post export-audit smoke-harness + runbook shortcut integration)
- `npm.cmd run typecheck` (pass, post export-audit smoke-harness + runbook shortcut integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post closed-alpha readiness focus checklist integration)
- `npm.cmd run typecheck` (pass, post closed-alpha readiness focus checklist integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post non-pass readiness deep-link shortcut integration)
- `npm.cmd run typecheck` (pass, post non-pass readiness deep-link shortcut integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post non-pass row command-tool block integration)
- `npm.cmd run typecheck` (pass, post non-pass row command-tool block integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post readiness focus status summary counter integration)
- `npm.cmd run typecheck` (pass, post readiness focus status summary counter integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post readiness checklist row age-context integration)
- `npm.cmd run typecheck` (pass, post readiness checklist row age-context integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post stale-age threshold badge integration)
- `npm.cmd run typecheck` (pass, post stale-age threshold badge integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post focus-checklist quick-filter integration)
- `npm.cmd run typecheck` (pass, post focus-checklist quick-filter integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post `stale + non-pass` filter integration)
- `npm.cmd run typecheck` (pass, post `stale + non-pass` filter integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post filter-preserving shortcut href integration)
- `npm.cmd run typecheck` (pass, post filter-preserving shortcut href integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post compact checklist filter-count integration)
- `npm.cmd run typecheck` (pass, post compact checklist filter-count integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post per-row `why stale` hint integration)
- `npm.cmd run typecheck` (pass, post per-row `why stale` hint integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post evidence stale-severity rollup integration)
- `npm.cmd run typecheck` (pass, post evidence stale-severity rollup integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post runbook filter-preset link integration)
- `npm.cmd run typecheck` (pass, post runbook filter-preset link integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post active-filter view label integration)
- `npm.cmd run typecheck` (pass, post active-filter view label integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post checklist view-link copy controls integration)
- `npm.cmd run typecheck` (pass, post checklist view-link copy controls integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post stale-impact status counter integration)
- `npm.cmd run typecheck` (pass, post stale-impact status counter integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post `critical stale only` filter integration)
- `npm.cmd run typecheck` (pass, post `critical stale only` filter integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale urgent command rollup integration)
- `npm.cmd run typecheck` (pass, post critical-stale urgent command rollup integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale rollup impact summary integration)
- `npm.cmd run typecheck` (pass, post critical-stale rollup impact summary integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale rollup deterministic ordering integration)
- `npm.cmd run typecheck` (pass, post critical-stale rollup deterministic ordering integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale rollup row-origin label integration)
- `npm.cmd run typecheck` (pass, post critical-stale rollup row-origin label integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale grouped command sections integration)
- `npm.cmd run typecheck` (pass, post critical-stale grouped command sections integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale copy-only toggle integration)
- `npm.cmd run typecheck` (pass, post critical-stale copy-only toggle integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale hidden-copy share-link integration)
- `npm.cmd run typecheck` (pass, post critical-stale hidden-copy share-link integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale copy visibility badge integration)
- `npm.cmd run typecheck` (pass, post critical-stale copy visibility badge integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post critical-stale no-non-pass warning integration)
- `npm.cmd run typecheck` (pass, post critical-stale no-non-pass warning integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post actionable critical-stale urgent-sequence integration)
- `npm.cmd run typecheck` (pass, post actionable critical-stale urgent-sequence integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post inline critical-stale incident-share shortcut integration)
- `npm.cmd run typecheck` (pass, post inline critical-stale incident-share shortcut integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post inline critical-stale incident-share copy controls integration)
- `npm.cmd run typecheck` (pass, post inline critical-stale incident-share copy controls integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post active inline incident-share marker integration)
- `npm.cmd run typecheck` (pass, post active inline incident-share marker integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post alternate inline incident-share marker integration)
- `npm.cmd run typecheck` (pass, post alternate inline incident-share marker integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post compact incident-mode summary integration)
- `npm.cmd run typecheck` (pass, post compact incident-mode summary integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post self-describing inline share-control integration)
- `npm.cmd run typecheck` (pass, post self-describing inline share-control integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post recommended-handoff URL line integration)
- `npm.cmd run typecheck` (pass, post recommended-handoff URL line integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post recommended handoff copy-control integration)
- `npm.cmd run typecheck` (pass, post recommended handoff copy-control integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post active recommended-handoff marker integration)
- `npm.cmd run typecheck` (pass, post active recommended-handoff marker integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post fallback incident-share marker integration)
- `npm.cmd run typecheck` (pass, post fallback incident-share marker integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post handoff hierarchy summary integration)
- `npm.cmd run typecheck` (pass, post handoff hierarchy summary integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post share-block hierarchy-title integration)
- `npm.cmd run typecheck` (pass, post share-block hierarchy-title integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post recommended-block hierarchy-title integration)
- `npm.cmd run typecheck` (pass, post recommended-block hierarchy-title integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post recommended-block fallback-usage helper integration)
- `npm.cmd run typecheck` (pass, post recommended-block fallback-usage helper integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post fallback-block alternate-preset helper integration)
- `npm.cmd run typecheck` (pass, post fallback-block alternate-preset helper integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post shared handoff-helper alignment-note integration)
- `npm.cmd run typecheck` (pass, post shared handoff-helper alignment-note integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post share-block legend-token integration)
- `npm.cmd run typecheck` (pass, post share-block legend-token integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post visible handoff-link legend-token integration)
- `npm.cmd run typecheck` (pass, post visible handoff-link legend-token integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post inline handoff legend-key integration)
- `npm.cmd run typecheck` (pass, post inline handoff legend-key integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post copied-link legend-preservation note integration)
- `npm.cmd run typecheck` (pass, post copied-link legend-preservation note integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post scan/copy token-alignment note integration)
- `npm.cmd run typecheck` (pass, post scan/copy token-alignment note integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post shared current-context note integration)
- `npm.cmd run typecheck` (pass, post shared current-context note integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post fallback-selection note integration)
- `npm.cmd run typecheck` (pass, post fallback-selection note integration)
- `npm.cmd run -w @new-start/web typecheck` (pass, post recommended-path note integration)
- `npm.cmd run typecheck` (pass, post recommended-path note integration)

## Updated docs in this cycle

- `docs/roadmap/progress.md`
- `docs/README.md`
- `docs/runbooks/alpha-operations-runbook.md`
- `docs/v0/v0-closed-alpha-readiness-report.md`
- `docs/v0/v0-phase0-execution-plan.md`
- `docs/archive/roadmap.md`
- `docs/v0/v0-roadmap.md`
- `docs/roadmap/working-context-log.md`
- `docs/v0/v0-exit-evidence-matrix.md`
- `docs/runbooks/phase1-preflight-checklist.md`
- `docs/architecture/stalled-project-support-flow.md`
- `docs/v0/v0-abuse-gaming-test-matrix.md`
- `docs/runbooks/phase1-operations-cadence.md`
- `apps/web/app/page.tsx`
- `apps/web/app/components/operations-command-tools.tsx`
- `apps/web/app/api/operations/exports/route.ts`
- `scripts/v1-preflight.mjs`
- `scripts/v1-ga6-drill.mjs`
- `scripts/v1-evidence-manifest.mjs`
- `scripts/v1-artifact-prune-plan.mjs`
- `scripts/v1-export-audit-log-plan.mjs`
- `scripts/v1-export-audit-log-plan-smoke.mjs`
- `package.json`

### Planning docs: long-term goal framing refresh (`docs`)

- updated planning docs to reflect the broader non-monetary settlement direction without changing active implementation slices:
  - `docs/archive/roadmap.md` now includes a long-term north star, permanent product pillars, and horizon checkpoints
  - `docs/archive/vision.md` now emphasizes deterministic settlement, portable trust, and deployable operator workflows
  - `docs/foundation/project-thesis.md` now frames the system as a deployable non-monetary settlement protocol rather than only a marketplace concept
  - `docs/README.md` current-status summary now references the five-pillar long-term structure
  - `docs/roadmap/progress.md` records the planning refresh
- verification:
  - documentation-only planning update; no runtime checks required

### Planning docs: v0 framing alignment refresh (`docs`)

- aligned execution-facing v0 docs with the broader long-term plan while keeping implementation scope unchanged:
  - `docs/v0/v0-roadmap.md` now describes v0 as the first execution horizon focused on protocol credibility and deterministic foundations
  - `docs/v0/v0-roadmap.md` now maps cross-cutting work to the long-term `protocol` / `commerce` / `trust` / `resolution` / `operations` structure
  - `docs/architecture/v0-foundation.md` now frames v0 as the base required for later deployability, federation, and trust-portability work
  - `docs/roadmap/progress.md` records the v0 planning alignment
- verification:
  - documentation-only planning update; no runtime checks required

### Phase 1 implementation: closed-alpha workflow launchers (`apps/web`)

- shifted back to implementation-first work instead of expanding handoff microcopy/docs:
  - `apps/web/app/page.tsx` now includes `Closed-Alpha Workflow Launchers` with direct entry points for onboarding, discovery, marketplace accept/dispute starters, project maintenance, and contribution flows
  - `apps/web/app/page.tsx` now anchors `marketplace-event-builder` and `contribution-credit-builder` for direct workflow launching
  - `apps/web/app/components/marketplace-event-builder.tsx` now reads `builder_starter` query state and preconfigures:
    - `alpha-accept`
    - `alpha-timeout`
    - `project-maintenance`
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: lane-specific marketplace starters (`apps/web`)

- extended the new workflow-launcher surface so it can start real alpha lanes directly:
  - `apps/web/app/page.tsx` now includes `Lane Starters` for:
    - software fixes
    - small feature work
    - documentation
    - translation
    - testing
    - research
    - project maintenance
  - `apps/web/app/components/marketplace-event-builder.tsx` now reads:
    - `builder_lane`
    - `builder_flow`
  - lane starters preconfigure the marketplace builder with lane template, accept/dispute path, and deterministic draft IDs
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: dispute-path lane starters (`apps/web`)

- extended the workflow-launcher surface with direct dispute rehearsal entry points:
  - `apps/web/app/page.tsx` now includes `Dispute Path Starters` for:
    - software fixes
    - testing
    - research
    - project maintenance
  - these links land on the marketplace builder with lane-specific `builder_lane` and `builder_flow=dispute`
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: fixture-backed workflow bundles (`apps/web`)

- paired real local commands with the new launcher flows:
  - `apps/web/app/components/fixture-quickstart.tsx` now includes `Alpha Workflow Bundles`
  - bundles cover:
    - accepted exchange
    - timeout / auto-refund
    - dispute settlement
  - each bundle provides:
    - exact local node + fixture ingest commands
    - direct launcher link into the matching marketplace-builder path
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: workflow-bundle result shortcuts (`apps/web`)

- tightened the execution loop from commands to inspection:
  - `apps/web/app/components/fixture-quickstart.tsx` workflow bundles now expose direct explorer/result links
  - each bundle includes direct offer/order/milestone shortcuts for the relevant fixture IDs
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: workflow-bundle trust/ranking shortcuts (`apps/web`)

- extended workflow bundles beyond marketplace state inspection:
  - `apps/web/app/components/fixture-quickstart.tsx` now includes direct discovery and provider-reputation links for each bundle
  - operators can inspect both derived marketplace state and post-ingest trust/ranking surfaces from the same quickstart block
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: manual lane bundles (`apps/web`)

- expanded quickstart support beyond software-fixture coverage:
  - `apps/web/app/components/fixture-quickstart.tsx` now includes `Manual Lane Bundles`
  - bundles cover:
    - feature work
    - documentation
    - translation
    - testing
    - research
    - project maintenance
  - each bundle provides:
    - local node startup command
    - direct lane-specific builder launcher
    - lane-relevant discovery / explorer / reputation links
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: manual dispute bundles + bundle-set copy actions (`apps/web`)

- batched two more workflow-execution improvements into the quickstart surface:
  - `apps/web/app/components/fixture-quickstart.tsx` now includes `Manual Dispute Bundles` for:
    - feature work
    - documentation
    - translation
    - testing
    - research
    - project maintenance
  - `apps/web/app/components/fixture-quickstart.tsx` now includes:
    - `Copy All Manual Bundles`
    - `Copy All Dispute Bundles`
  - result: operators can start non-software lanes in both accept and dispute modes without fixture-specific setup and can copy whole bundle sets in one action
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: lane inspection presets (`apps/web`)

- added a tighter post-launch inspection layer for manual lanes:
  - `apps/web/app/components/fixture-quickstart.tsx` now includes `Lane Inspection Presets`
  - presets cover each non-software manual lane with grouped links for:
    - discovery
    - reputation
    - accept starter
    - dispute starter
  - quickstart now also includes `Copy All Inspection Presets`
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: in-builder lane starter controls (`apps/web`)

- moved the lane-launch capability directly into the main workflow tool:
  - `apps/web/app/components/marketplace-event-builder.tsx` now includes:
    - `Lane accept starters`
    - `Lane dispute starters`
  - controls cover all current alpha lanes and call the same lane starter logic used by the home-page launcher links
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: stronger lane starter presets (`apps/web`)

- upgraded the lane starters from thin routing helpers to reusable draft presets:
  - `apps/web/app/components/marketplace-event-builder.tsx` now applies lane-specific preset data when launching a lane
  - preset coverage now includes:
    - deterministic draft IDs
    - Alice/Bob party defaults
    - deterministic created/delivery/accept/dispute/settle timestamps
    - escrow nonce
    - artifact hash / URL / notes hash
    - terms hash
    - lane-specific dispute reason defaults
    - settlement split defaults
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: in-builder current-lane shortcuts (`apps/web`)

- tightened the loop inside the marketplace builder itself:
  - `apps/web/app/components/marketplace-event-builder.tsx` now includes `Current Lane Shortcuts`
  - shortcut area provides:
    - current-lane discovery link
    - current-lane reputation link
    - copyable current lane starter URL
  - result: operators can inspect and share the active lane state without leaving the builder
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: non-software fixture bundles (`fixtures`, `apps/web`, `crates/node`, `docs`)

- converted the non-software quickstart paths from generator-first manual bundles into checked-in reproducible fixture bundles:
  - added accept/dispute fixture logs under `fixtures/valid/` for:
    - `feature-work`
    - `documentation`
    - `translation`
    - `testing`
    - `research`
    - `project-maintenance`
  - updated `scripts/v1-generate-lane-fixture.mjs` so generated lane logs use March 2026 timestamps (visible in current replay/discovery windows) and keep dispute fixtures on the deterministic timeout path
  - updated `apps/web/app/components/fixture-quickstart.tsx` to replace `Manual Lane Bundles` / `Manual Dispute Bundles` with checked-in lane fixture bundles, add direct offer/order/milestone result links, and include `--data-dir` in all copyable ingest commands
  - corrected non-software discovery links from unsupported `alpha_only` to supported `alpha_defaults` in:
    - `apps/web/app/components/fixture-quickstart.tsx`
    - `apps/web/app/components/marketplace-event-builder.tsx`
    - `apps/web/app/page.tsx`
  - added `api_checked_in_non_software_lane_fixture_bundles_replay_cleanly` in `crates/node/tests/api.rs` to exercise every new lane fixture through ingest, replay, milestone terminal-state, and discovery checks
  - registered the new checked-in lane-fixture family in `docs/v0/v0-scenario-fixture-matrix.md`
- verification:
  - `cargo test -p node --test api api_checked_in_non_software_lane_fixture_bundles_replay_cleanly` (pass)
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: non-software sync convergence coverage (`crates/node`, `docs`)

- extended multi-node convergence coverage to the new checked-in non-software fixture bundles:
  - added `sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views` in `crates/node/tests/sync.rs`
  - coverage now includes accept/dispute bundles for:
    - `feature-work`
    - `documentation`
    - `translation`
    - `testing`
    - `research`
    - `project-maintenance`
  - each fixture now proves:
    - source/sink replay hash convergence
    - source/sink lane-scoped discovery hash convergence with `alpha_defaults=0`
  - this keeps the newly checked-in lane fixtures aligned with the same pull-replication confidence model previously used only for the three original alpha marketplace bundles
- verification:
  - `cargo test -p node --test sync sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views` (pass)

### Phase 1 implementation: home-page lane fixture launchers (`apps/web`, `docs`)

- surfaced the checked-in non-software lane fixtures directly on the home page instead of requiring operators to discover them only through the lower quickstart section:
  - `apps/web/app/page.tsx` now adds:
    - `Open fixture bundles` to the `Closed-Alpha Workflow Launchers` grid
    - a `Checked-In Lane Fixture Bundles` section with lane cards for:
      - `feature-work`
      - `documentation`
      - `translation`
      - `testing`
      - `research`
      - `project-maintenance`
  - each lane card now exposes:
    - accept starter
    - dispute starter
    - bundle-commands deep link
    - direct accept/dispute result shortcuts
    - lane discovery shortcut
  - `apps/web/app/components/fixture-quickstart.tsx` now provides a stable `#fixture-quickstart` anchor so the new bundle-command links land on the checked-in command section consistently
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: lane-fixture regression runner (`scripts`, `docs`, workspace)

- added a dedicated optional runner for the new checked-in non-software lane fixture coverage instead of inflating the default preflight loop:
  - added `scripts/v1-lane-fixture-check.mjs`
  - workspace commands:
    - `npm run v1:lane-fixtures`
    - `npm run v1:lane-fixtures:readiness`
  - runner executes:
    - `api_checked_in_non_software_lane_fixture_bundles_replay_cleanly`
    - `sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views`
    - optional web typecheck in `:readiness` mode
  - each run writes `target/tmp/lane-fixture-check-<timestamp>/lane-fixture-check-summary.json`
  - updated:
    - `package.json`
    - `docs/runbooks/phase1-preflight-checklist.md`
    - `docs/runbooks/phase1-operations-cadence.md`
- verification:
  - `npm.cmd run v1:lane-fixtures` (pass)
  - `npm.cmd run v1:lane-fixtures:readiness` (pass)
  - summary artifacts:
    - `target/tmp/lane-fixture-check-1775840095134/lane-fixture-check-summary.json`
    - `target/tmp/lane-fixture-check-1775840095131/lane-fixture-check-summary.json`

### Phase 1 implementation: lane-fixture evidence integration (`scripts`, `apps/web`, `docs`)

- integrated the lane-fixture summaries into the normal evidence/operations surfaces instead of leaving them as isolated targeted artifacts:
  - `scripts/v1-evidence-manifest.mjs` now emits:
    - `summary.latest_lane_fixture_status`
    - `commands.generate_lane_fixtures`
    - lane-fixture prune preview/dry-run command slots
    - a full `lane_fixtures` section alongside `preflight` and `ga6`
  - `apps/web/app/page.tsx` now surfaces:
    - latest lane-fixture run summary in `Phase 1 Operations`
    - lane-fixture lifecycle counts in `Artifact Lifecycle`
    - lane-fixture status and prune counts in `Evidence Exports`
    - lane-fixture rerun / summary-inspection commands in failure triage and the readiness focus checklist
  - `docs/runbooks/phase1-operations-cadence.md` now explicitly includes reviewing lane-fixture status inside evidence-export review
- verification:
  - `npm.cmd run v1:evidence-manifest` (pass)
    - artifact: `target/tmp/operations-evidence-manifest.json`
    - latest statuses: `preflight=passed`, `ga6=passed`, `lane_fixtures=passed`, `overall=healthy`
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: lane-fixture history + prune-plan integration (`apps/web`, `scripts`, `docs`)

- completed the follow-through work for lane-fixture operations visibility and cleanup planning:
  - `apps/web/app/page.tsx` now includes `Latest lane fixture runs` in `Recent Run History`
  - `scripts/v1-artifact-prune-plan.mjs` now emits:
    - `summary.lane_fixture_candidates`
    - a `lane_fixtures` plan section beside `preflight` and `ga6`
  - the operations panel now surfaces lane-fixture prune preview/dry-run/apply commands from the prune-plan artifact
  - `docs/runbooks/phase1-operations-cadence.md` now explicitly reminds operators to review lane-fixture history and lane-fixture prune counts during weekly review
- verification:
  - `npm.cmd run v1:artifact-prune-plan` (pass)
    - artifact: `target/tmp/operations-artifact-prune-plan.json`
    - candidate counts: `preflight=0`, `ga6=0`, `lane_fixtures=0`, `total=0`
  - `npm.cmd run v1:evidence-manifest` (pass)
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: in-panel lane-fixture run controls (`apps/web`, `docs`)

- extended the allowlisted operations-panel execution path to support lane-fixture checks directly:
  - `apps/web/app/api/operations/exports/route.ts` now accepts `run_lane_fixture_checks`
  - `apps/web/app/components/operations-command-tools.tsx` now recognizes the lane-fixture runnable action
  - `apps/web/app/page.tsx` now marks lane-fixture commands as runnable in:
    - evidence/export command blocks
    - lane-fixture focus checklist commands
    - failure triage when a lane-fixture run fails
  - `docs/runbooks/phase1-operations-cadence.md` now documents using the allowlisted `Run Now` flow for `npm run v1:lane-fixtures`
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)
  - `npm.cmd run v1:lane-fixtures` (pass)
    - summary artifact: `target/tmp/lane-fixture-check-1775875054859/lane-fixture-check-summary.json`

### Phase 1 implementation: lane-fixture stale visibility + allowlisted audit wording (`apps/web`, `docs`)

- tightened the operations semantics around lane-fixture runs so stale coverage is more visible and the audit surface better matches reality:
  - `apps/web/app/page.tsx` now marks stale-but-passing lane-fixture coverage as `attention` in `Closed-Alpha UX Readiness Focus`
  - lane-fixture checklist rows now include a direct shortcut back to `#ops-recent-history`
  - the audit section title is now `Allowlisted Execution Audit`, and its alert language now reflects both export refreshes and lane-fixture reruns launched from the panel
  - `docs/runbooks/phase1-operations-cadence.md` now explicitly tells operators to treat stale lane-fixture coverage as `attention` and to read the audit section as broader allowlisted-operation telemetry
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: audit artifact hints for lane-fixture runs (`apps/web`, `docs`)

- improved the panel-triggered lane-fixture audit trail so operators can see the exact summary artifact path directly in the allowlisted audit surface:
  - `apps/web/app/api/operations/exports/route.ts` now resolves the latest `lane-fixture-check-summary.json` path for `run_lane_fixture_checks` and stores it in `artifact_path_hints`
  - `apps/web/app/page.tsx` now shows each audit summary row's latest artifact hints, so the lane-fixture summary path is visible without drilling into raw audit entries
  - `docs/runbooks/phase1-operations-cadence.md` now explicitly tells operators to use those artifact hints when reviewing panel-triggered lane-fixture runs
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)
  - `npm.cmd run v1:lane-fixtures` (pass)
    - summary artifact: `target/tmp/lane-fixture-check-1775880494271/lane-fixture-check-summary.json`

### Phase 1 implementation: dedicated lane-fixture stale rollup (`apps/web`, `docs`)

- added a more explicit operations-panel path for stale lane-fixture coverage instead of relying only on shared checklist counts:
  - `apps/web/app/page.tsx` now renders `Lane Fixture Stale Rollup` when lane-fixture coverage is stale
  - the rollup centralizes:
    - `npm run v1:lane-fixtures`
    - `npm run v1:lane-fixtures:readiness`
    - latest lane-fixture summary inspection command
  - the `Allowlisted Execution Audit` section now includes a compact `lane fixture audit` summary line for recent panel-triggered lane-fixture activity
  - `docs/runbooks/phase1-operations-cadence.md` now references both the stale-rollup block and the lane-fixture audit summary line
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: history anchors + compact audit hints (`apps/web`, `docs`)

- polished the operations panel for faster scanning as lane-fixture activity grows:
  - `apps/web/app/page.tsx` now adds `Recent Run History` anchors for:
    - `preflight`
    - `GA6`
    - `lane fixtures`
  - allowlisted audit summaries now collapse long artifact-path lists into a compact `primary path (+N more)` style while keeping the most useful latest hint visible
  - `docs/runbooks/phase1-operations-cadence.md` now tells operators to use the history anchors and the compact artifact-hint style during triage
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: recent-history focus filter (`apps/web`, `docs`)

- upgraded the history-navigation work from anchor-only links into a real targeted filter:
  - `apps/web/app/page.tsx` now supports `history_focus=all|preflight|ga6|lane-fixtures` for `Recent Run History`
  - the lane-fixture checklist shortcut now deep-links into the `lane-fixtures` history view directly
  - `docs/runbooks/phase1-operations-cadence.md` now tells operators to use the history-focus filter when they want to isolate lane-fixture runs during targeted review
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: history-focus filtering for run review (`apps/web`, `docs`)

- turned the recent-history navigation into a real targeted review control instead of keeping it anchor-only:
  - `apps/web/app/page.tsx` now applies `history_focus=all|preflight|ga6|lane-fixtures` to the `Recent Run History` section itself
  - lane-fixture shortcuts now land on a lane-fixture-only history view, which is more useful during larger batched sessions
  - `docs/runbooks/phase1-operations-cadence.md` now explicitly points operators to `history_focus=lane-fixtures` for targeted lane-bundle review
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: compact path rendering (`apps/web`, `docs`)

- reduced visual noise from long absolute paths in the operations panel while keeping the important artifact context visible:
  - added a shared compact-path helper in `apps/web/app/page.tsx`
  - applied compact rendering to:
    - run directories
    - evidence/prune/audit artifact paths
    - audit log paths
    - archive-path mentions
  - full path values are still preserved in the rendered title attributes for exact inspection when needed
  - `docs/runbooks/phase1-operations-cadence.md` now notes the compact-path reading pattern for operations review
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: compact command previews (`apps/web`, `docs`)

- reduced visual noise from long single-line operations commands without changing copy/run fidelity:
  - `apps/web/app/components/operations-command-tools.tsx` now compacts long single-line command previews in the panel
  - multi-line commands still render fully, while the underlying full command remains the source for copy/run actions
  - `docs/runbooks/phase1-operations-cadence.md` now notes the compact-preview pattern for command blocks
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: per-block command expansion toggle (`apps/web`, `docs`)

- added a low-friction way to inspect full commands inline without giving up the compact default view:
  - `apps/web/app/components/operations-command-tools.tsx` now shows `Show Full Commands` when a command block contains compacted single-line commands
  - toggling switches the block between compact previews and full inline command text without affecting copy/run behavior
  - `docs/runbooks/phase1-operations-cadence.md` now tells operators to use the per-block toggle when deeper command inspection is needed
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: collapsible lane-fixture history subsection (`apps/web`, `docs`)

- promoted the lane-fixture history area from a plain list into a dedicated collapsible subsection:
  - `apps/web/app/page.tsx` now renders lane-fixture history inside a `details` block in `Recent Run History`
  - the subsection opens automatically for `history_focus=lane-fixtures`
  - it also includes focused review links back to the lane-fixture-only history view and to `#fixture-quickstart`
  - `docs/runbooks/phase1-operations-cadence.md` now explains the default scan path versus the dedicated focused-history path
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: per-entry lane-fixture actions (`apps/web`, `docs`)

- added lightweight run-specific actions directly inside the collapsible lane-fixture history subsection:
  - each lane-fixture history row now has an `Actions` disclosure with:
    - `Inspect this summary`
    - `Run lane fixture checks`
    - `Run lane fixture readiness checks`
  - this lets operators inspect or rerun a specific lane-fixture flow without leaving the subsection
  - `docs/runbooks/phase1-operations-cadence.md` now points operators to the per-entry action blocks during lane-fixture review
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: per-entry actions across run histories (`apps/web`, `docs`)

- expanded the row-level action pattern beyond lane-fixture history so the broader operations histories are equally actionable:
  - preflight history rows now expose:
    - `Inspect this summary`
    - `Run full preflight`
    - `Run full readiness`
  - GA6 history rows now expose:
    - `Inspect this summary`
    - `Rerun GA6 drill`
  - `docs/runbooks/phase1-operations-cadence.md` now documents the shared row-level action pattern across preflight, GA6, and lane-fixture run histories
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 1 implementation: collapsed-by-default dense command blocks (`apps/web`, `docs`)

- applied the new collapsed command-block mode to the densest operations sections so the panel stays compact by default:
  - `apps/web/app/page.tsx` now starts these blocks collapsed by default when present:
    - `Export Commands`
    - `Checklist View Links`
    - critical-stale share/triage command blocks
  - operators can still expand them and use the existing full-command toggle when deeper inspection is needed
  - `docs/runbooks/phase1-operations-cadence.md` now notes that dense command blocks may begin collapsed by default
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)

### Phase 2 implementation: compute-only job lane kickoff (`crates`, `apps/web`, `fixtures`, `docs`)

- started the roadmap `Phase 2` direction with a compute-only templated job lane instead of a broader compute+AI surface:
  - added strict templated-lane protocol support for:
    - `serviceType=compute-job`
    - `deliveryMode=receipt`
    - `allowedEvidenceFormats=[job-receipt-v1]`
  - `job-receipt-v1` delivery now requires:
    - at least one artifact hash
    - unique artifact hashes
    - non-empty `notesHash`
  - updated default policy allowlist to include `compute-job`
  - added a strict `compute-job` service template to `apps/web/app/components/marketplace-event-builder.tsx`
  - extended `scripts/v1-generate-lane-fixture.mjs` and checked in:
    - `fixtures/valid/marketplace-compute-job-accept.jsonl`
    - `fixtures/valid/marketplace-compute-job-dispute.jsonl`
  - extended checked-in lane-fixture coverage and `npm run v1:lane-fixtures` to include the compute lane and a deterministic compute template-mismatch regression
  - updated docs:
    - `docs/archive/roadmap.md`
    - `docs/architecture/v0-spec-outline.md`
    - `docs/v0/v0-scenario-fixture-matrix.md`
    - `docs/runbooks/phase1-preflight-checklist.md`
    - `docs/runbooks/phase1-operations-cadence.md`
- verification:
  - `cargo test -p protocol-core static_validation_rejects_compute_job_offer_with_wrong_schema` (pass)
  - `cargo test -p protocol-core static_validation_rejects_compute_job_delivery_without_notes_hash` (pass)
  - `cargo test -p node --test api api_marketplace_compute_job_lane_template_mismatch_rejections_are_deterministic` (pass)
  - `cargo test -p node --test sync sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views` (pass)
  - `npm.cmd run v1:lane-fixtures` (pass)
    - summary artifact: `target/tmp/lane-fixture-check-1775916307938/lane-fixture-check-summary.json`
  - `npm.cmd run -w @new-start/web typecheck` (pass)
### Phase 1 implementation: closeout + status flip (`docs`, `apps/web`)

- completed the Phase 1 closure batch as status normalization and evidence refresh rather than new feature work:
  - updated status docs so the original Phase 1 closed-alpha market is now explicitly complete
  - clarified that recurring preflight/GA6/evidence workflows remain active as carry-forward operator practice, not unfinished Phase 1 scope
  - clarified that `compute-job` is Phase 2 kickoff work and excluded from the Phase 1 completion basis
  - updated web copy so the `Phase 1 Operations` panel reads as carry-forward operations work and fixture quickstart explicitly distinguishes the experimental compute lane from the completed Phase 1 baseline
- closure evidence refresh:
  - `npm.cmd run v1:preflight` (pass)
    - artifact: `target/tmp/preflight-1775921251673/preflight-summary.json`
  - `npm.cmd run v1:readiness` (pass)
    - artifact: `target/tmp/preflight-1775921251676/preflight-summary.json`
  - `npm.cmd run v1:ga6-drill` (pass)
    - artifact dir: `target/tmp/runbook-dryrun-1775921251677`
    - summary: `target/tmp/runbook-dryrun-1775921251677/ga6-drill-summary.json`
  - `npm.cmd run v1:evidence-manifest` (pass)
    - artifact: `target/tmp/operations-evidence-manifest.json`
  - `npm.cmd run v1:artifact-prune-plan` (pass)
    - artifact: `target/tmp/operations-artifact-prune-plan.json`
  - `npm.cmd run v1:export-audit-log-plan` (pass)
    - artifact: `target/tmp/operations-export-audit-log-plan.json`
  - `npm.cmd run -w @new-start/web typecheck` (pass)
### Phase 2 implementation: compute-job home launcher surface (`apps/web`)

- added the first dedicated user-facing entry point for the new Phase 2 compute lane instead of relying only on the builder template dropdown and fixture quickstart:
  - `apps/web/app/page.tsx` now includes a `Phase 2 Compute Preview` section on the home page
  - the section exposes:
    - compute accept starter
    - compute dispute starter
    - compute discovery link
    - compute fixture-bundle shortcut
    - direct result links for the checked-in compute accept/dispute fixture IDs
  - the section also makes the current strict compute template contract visible inline:
    - `deliveryMode=receipt`
    - `allowedEvidenceFormats=[job-receipt-v1]`
    - receipt delivery requires artifact hashes + `notesHash`
- verification:
  - `npm.cmd run -w @new-start/web typecheck` (pass)
  - `npm.cmd run typecheck` (pass)
### Phase 2 implementation: compute receipt tooling (`scripts`, `apps/web`, `docs`)

- added the first provider-oriented tooling slice for the compute-only Phase 2 lane:
  - added `scripts/v2-compute-receipt.mjs`
  - workspace commands:
    - `npm run v2:compute-receipt`
    - `npm run v2:compute-receipt:smoke`
  - generator outputs:
    - `job-receipt-v1.json`
    - `job-receipt-v1.sha256`
    - `job-receipt-v1-notes.sha256`
    - `job-receipt-v1-delivery-hints.json`
  - `apps/web/app/page.tsx` now includes a copy-first provider tooling block inside `Phase 2 Compute Preview`
  - added `docs/architecture/phase2-compute-job-lane.md` and indexed it from `docs/README.md`
- verification:
  - `npm.cmd run v2:compute-receipt:smoke`
  - `npm.cmd run v1:lane-fixtures`
  - `npm.cmd run -w @new-start/web typecheck`
  - `npm.cmd run typecheck`
### Phase 2 implementation: compute delivery-hints import (`apps/web`, `docs`)

- tightened the provider workflow on top of the new compute receipt tooling:
  - `apps/web/app/components/marketplace-event-builder.tsx` now includes a `Compute Receipt Delivery Hints` helper in delivery mode when the lane is `compute-job`
  - providers can paste `job-receipt-v1-delivery-hints.json` and apply it directly into:
    - `evidenceFormat`
    - `artifactHashes`
    - `urls`
    - `notesHash`
  - updated `docs/architecture/phase2-compute-job-lane.md` to document the new paste-and-apply path
- verification:
  - `npm.cmd run v2:compute-receipt:smoke`
  - `npm.cmd run v1:lane-fixtures`
  - `npm.cmd run -w @new-start/web typecheck`
  - `npm.cmd run typecheck`
## Immediate next actions

1. Continue R7-M1 (iOS scaffold on macOS host).
2. Start R7-M2 remote pinned node flow wiring.
3. Keep `npm run v1:preflight`, `npm run v1:readiness`, `npm run v1:ga6-drill`, and `npm run v1:lane-fixtures` on cadence.

### R6-L2 community lane template catalog (July 2026)

- **Registry:** `scripts/lib/r6-lane-template-registry.mjs` — seven artifact lanes + discovery alignment
- **Smoke:** `scripts/r6-lane-templates-smoke.mjs` — fixture coverage + HTTP exchange per lane
- **Docs:** `docs/architecture/lane-template-catalog.md`, `docs/runbooks/community-lane-templates-runbook.md`
- **Extended:** `r2-exchange-core.mjs` now drills all community artifact lanes
- **Verification:** `npm run r6:lane-templates:smoke -- --no-build` (pass)

### R6-L3 offline lane experimental polish (July 2026)

- **Smoke bundle:** `scripts/r6-offline-lanes-smoke.mjs` (`npm run r6:offline-lanes:smoke`)
- **Scope:** deterministic offline mismatch reject path + offline telemetry + SCN-18 fixture replay
- **Runbook:** `docs/runbooks/offline-lane-experimental-runbook.md`
- **Docs synced:** roadmap status + runbook index + lane catalog
- **Verification:** `npm run r6:offline-lanes:smoke` (pass)

### R7-M1 mobile scaffold kickoff (July 2026)

- **Android initialized:** `pnpm exec tauri android init --ci` created `apps/desktop/src-tauri/gen/android`
- **Workspace scripts:** `r7:mobile:android:init`, `r7:mobile:android:dev`, `r7:mobile:android:build`
- **Smoke:** `scripts/r7-mobile-scaffold-smoke.mjs` (`npm run r7:mobile:scaffold-smoke`)
- **Runbook:** `docs/runbooks/mobile-scaffold-runbook.md`
- **Verification:** `npm run r7:mobile:scaffold-smoke` (pass)

### R7-M1 sidecar policy lock (July 2026)

- **Spec:** `docs/specs/mobile-sidecar-policy-spec.md` (`status: locked`)
- **Decision:** `R7-M2` defaults to remote pinned node over HTTPS; on-device sidecar deferred to later experimental slice.
- **Docs synced:** restart roadmap, R7 execution plan, START-HERE, mobile runbook.

### R7-M2 kickoff: pinned node runtime guards (July 2026)

- Added node connection resolver with source metadata in `apps/web/lib/node-client-base-url.ts`
  - supports mobile pinned URL resolution
  - enforces HTTPS when `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE=1`
- Added Settings UI kernel connection panel in `apps/web/components/dashboard/dashboard-settings-panel.tsx`
  - displays connected node URL + source
  - surfaces mobile release HTTPS policy status
- Verification:
  - `pnpm --filter @new-start/web typecheck` (pass)

### R7-M2 command wiring: Android build flavors (July 2026)

- Added `scripts/r7-mobile-android-command.mjs` wrapper for `tauri android dev|build`.
- Root scripts now route through wrapper:
  - `r7:mobile:android:dev`
  - `r7:mobile:android:build`
- Wrapper injects runtime policy env vars and enforces HTTPS in `--release` mode.

### R7-M2 UI wiring: mobile node override controls (July 2026)

- Added local mobile pinned-node override support in `apps/web/lib/node-client-base-url.ts`
  - key: `vectis.mobile.pinnedNodeUrlOverride`
  - source label: `mobile-local-override`
- Added Dashboard Settings controls for mobile runtime:
  - editable pinned node override in non-release mode
  - release mode remains policy-locked with HTTPS validation status
- Verification:
  - `pnpm --filter @new-start/web typecheck` (pass)

### R7-M2 UI refinement: runtime default + reset control (July 2026)

- Added runtime pinned URL reader to node URL lib: `readRuntimeMobilePinnedNodeUrl()`.
- Settings panel now shows runtime default pinned node URL in mobile non-release mode.
- Added "Reset to runtime default" action that clears local override and refreshes resolved node source.
- Fixed mobile pinned URL validator to require HTTPS only in mobile release mode.

### R7-M2 completion: remote pinned node wiring spec + smoke (July 2026)

- Added Phase 1 spec + runbook:
  - `docs/specs/r7-m2-remote-pinned-node-wiring-spec.md`
  - `docs/runbooks/r7-m2-remote-node-smoke-runbook.md`
- Hardened mobile resolver behavior:
  - `apps/web/lib/node-client-base-url.ts` now distinguishes pinned source (`mobile-runtime` vs `mobile-env`) and fails fast when mobile runtime is enabled but no pinned URL is present (no silent `/api/node` fallback).
- Hardened mobile identity create path:
  - `apps/web/components/auth/register-form.tsx` validates and uses the pinned node URL in mobile runtime and hides the manual node URL field.
- Added automated smoke:
  - `scripts/r7-m2-remote-node-smoke.mjs`
  - `pnpm r7:m2:remote-node:smoke`
- Verification:
  - `pnpm r7:m2:remote-node:smoke` (pass)
  - `pnpm --filter @new-start/web typecheck` (pass)

### R7-M1 follow-up: iOS scaffold prep (July 2026)

- Added iOS scaffold spec and extended mobile runbook with macOS host steps:
  - `docs/specs/r7-m1-ios-scaffold-spec.md`
  - `docs/runbooks/mobile-scaffold-runbook.md` (iOS section)

### R7-M1 follow-up: iOS command wrapper + scaffold smoke (July 2026)

- Added iOS pinned-node env injection wrapper:
  - `scripts/r7-mobile-ios-command.mjs`
  - `npm run r7:mobile:ios:dev` / `npm run r7:mobile:ios:build` (via wrapper)
- Added iOS scaffold smoke script:
  - `scripts/r7-ios-scaffold-smoke.mjs`
  - `npm run r7:ios:scaffold-smoke`
- Verified on Windows host:
  - iOS scripts parse check (`node -c ...`)
  - web typecheck (`pnpm --filter @new-start/web typecheck`)
- iOS scaffold smoke made less brittle (checks expected scaffold directories + any Info.plist in likely locations)

### Preflight fix: pnpm typecheck on Windows (July 2026)

- Fixed `scripts/v1-preflight.mjs` and `scripts/v1-lane-fixture-check.mjs` to use `pnpm --filter ... typecheck` instead of `npm run -w ...` (pnpm workspace)
- Verification: `pnpm v1:readiness` (pass)

### R7 mobile readiness bundle (Windows-compatible)

- Added: `scripts/r7-mobile-readiness.mjs` (`pnpm r7:mobile:readiness`)
- Bundle steps: Android scaffold smoke, R7-M2 remote-node smoke, iOS/Android command wrapper dry-runs; iOS scaffold smoke when `gen/ios` exists
- Verification: `pnpm r7:mobile:readiness` (pass)

### R7-M2 UX: mobile kernel unreachable notice (July 2026)

- Added shared helper `resolveMobilePinnedNodeError()` in `apps/web/lib/node-client-base-url.ts`
- Added `apps/web/components/mobile/mobile-pinned-node-notice.tsx` with Settings link
- Wired notice into register + marketplace exchange panels
- Locked `docs/specs/r7-m2-remote-pinned-node-wiring-spec.md`
- Verification: `pnpm r7:m2:remote-node:smoke`, `pnpm --filter @new-start/web typecheck` (pass)

### R7-M2 operator runbook: mobile remote pinned node (July 2026)

- Added: `docs/runbooks/mobile-remote-pinned-node-operator-runbook.md`
- Indexed in `docs/runbooks/README.md`, `docs/START-HERE.md`, `docs/roadmap/progress.md`

### R7-M3 spec draft: on-device sidecar (deferred, July 2026)

- Added: `docs/specs/r7-m3-on-device-sidecar-spec.md` (Mode B experimental track)
- Updated restart roadmap + protocol backlog + R7 execution plan
- Implementation explicitly deferred until R7-M1 iOS + R7-M2 field proof

### R7 client readiness bundle (July 2026)

- Added: `scripts/r7-client-readiness.mjs` (`pnpm r7:client:readiness`)
- Steps: desktop cargo check, R4 client audit, web typecheck, mobile readiness bundle
- Verification: `pnpm r7:client:readiness` (pass)

### R7-M1 iOS macOS handoff runbook (July 2026)

- Added: `docs/runbooks/r7-m1-ios-mac-host-handoff-runbook.md`
- Indexed in runbooks README, mobile-scaffold-runbook, START-HERE, restart-roadmap next action

### R6-PD kickoff: post-deployment lane proof (July 2026)

- Spec: `docs/specs/r6-post-deployment-proof-spec.md`
- Runbook: `docs/runbooks/r6-post-deployment-proof-runbook.md`
- Scripts: `pnpm r6:post-deployment:readiness`, `pnpm r6:post-deployment:drill`, `pnpm r6:post-deployment:multi-lane-drill`
- Verification:
  - `pnpm r6:post-deployment:readiness` (pass)
  - `pnpm r6:post-deployment:drill -- --lane documentation --no-build` (pass)

### R6-PD-B2: multi-lane HTTP drill (July 2026)

- Script: `pnpm r6:post-deployment:multi-lane-drill`
- Verification: all seven community artifact lanes passed with `--no-build`:
  - `software-fixes`, `feature-work`, `documentation`, `translation`, `testing`, `research`, `project-maintenance`
- Next: `R6-PD-C` human counterparty on persistent host per `docs/runbooks/r2-persistent-deployment-runbook.md`

### R6-PD-C tooling: evidence packet + smoke (July 2026)

- Scripts: `pnpm r6:post-deployment:phase-c:packet`, `pnpm r6:post-deployment:phase-c:smoke`
- Packet exports R2 evidence + restore drill + `r6-pd-phase-c-summary.json` + `r6-pd-operator-notes.md`
- Verification: `pnpm r6:post-deployment:phase-c:smoke` (pass)
- Windows fix: R6 drill wrappers use `shell: false` so `--data-dir` paths with spaces parse correctly

### DB-1 determinism hardening: discoveredAt leak fix (July 2026)

- Root cause: `aperio-engine discover` emits runtime-generated timestamps; Vectis import adapter included them in exported `vectis-signals.jsonl`, breaking exact run-to-run equality.
- Fix: updated `scripts/lib/discovery-bridge/aperio-import.mjs` so exported `discoveredAt` is deterministic when no stable `postedAt` exists (derived from signal identity fields).
- Verification:
  - `pnpm v3:aperio-live-drill -- --no-ingest` fixture mode exported identical `vectis-signals.jsonl` SHA-256 across two fresh runs.
  - `pnpm v3:discovery-bridge:smoke` ✅
  - `pnpm v3:discovery-bridge:e2e` ✅

- Live connectors check (Windows):
  - `pnpm v3:aperio-live-drill:live -- --no-ingest` exported identical `vectis-signals.jsonl` SHA-256 across two fresh runs.

- Added automated determinism guard scripts:
  - `pnpm v3:aperio-live-drill:determinism` ✅
  - `pnpm v3:aperio-live-drill:determinism:live` ✅

### R3 discovery readiness bundle (Windows-compatible)

- Added: `pnpm v3:discovery-readiness`
- Run:
  - `pnpm v3:discovery-readiness` (pass) ✅

- **R7 band complete:** marked `RG-7` pass in restart roadmap; R7-D1..D5 + R7-X1 done.
- **R6-L1 shipped:**
  - `docs/runbooks/compute-job-lane-runbook.md`
  - `scripts/lib/r6-compute-job-core.mjs` — compute-job exchange builder with `job-receipt-v1` delivery hints
  - `scripts/r6-compute-job-drill.mjs` — HTTP ingest drill (17 events, order closed)
  - `npm run r6:compute-job:drill`
- **Fix:** drill vouch bootstrap matches R2 pattern (buyer vouches sponsors before contribution attests).
- **Verification:**
  - `npm run r6:compute-job:drill -- --no-build` (pass)
  - `npm run v2:compute-receipt:smoke` (pass)

## Update protocol

- update this file after each substantive implementation step
- include:
  - changed slices/status
  - files touched
  - verification commands and result
  - next concrete actions























