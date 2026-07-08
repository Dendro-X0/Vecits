# Roadmap

This project is intended to evolve over years.

The roadmap focuses on stability of incentives and auditability first.

Long-term north star: build a deployable trust-and-settlement network for non-monetary exchange that is easy to launch, deterministic to operate, and portable across independent operators without relying on fiat, cryptocurrency, or standing human arbitration.

Current status (April 2026):

- Late `Phase 0`: Rust protocol/node runtime is implemented with deterministic replay, snapshots, marketplace reducers, policy timeline, and reputation read models.
- Early `Track 3` client layer is active: TypeScript SDK create/sign/submit + web read explorers are in place.
- `Track 3` discovery slice (`T3-R5`) is now implemented with deterministic client-side ranking and lane/reputation filtering.
- `Track 3` onboarding slice (`T3-R6`) is now implemented with invite-flow identity creation, sponsor request drafting, and event-derived onboarding status.
- `Track 3` Phase 0 close-out slices (`T3-R1`..`T3-R6`) are now complete.
- `Track 4.2` is now implemented with manual snapshot bootstrap replication (`node sync bootstrap`), peer cursor seeding + delta pull, and protected snapshot read APIs.
- `Phase 2` kickoff has started with a compute-only templated job lane (`compute-job`) using `deliveryMode=receipt`, `job-receipt-v1` evidence, web builder template support, checked-in accept/dispute fixtures, and replay/sync regression coverage.
- Economics-layer framing is now documented in `economic-protocol-v1.md` (anti-financial constraints + P2H direction + evaluation metrics).
- Economics controls execution has started with `EC-1` implemented (`GET /state/economics/metrics`, `node economics metrics`) for deterministic protocol health telemetry.
- Economics controls `EC-2` is now implemented with policy-executable issuance throughput limits (rolling-window caps + diversity checks) and stable reject reason codes.
- Economics controls `EC-3` is now implemented with deterministic P2H risk observability (`GET /state/economics/p2h/:id`, history pagination, and CLI parity).
- Economics controls `EC-4` is now implemented with policy-driven soft gating for issuance-sensitive paths (reputation thresholds + P2H risk-band cap) and stable reject code `ERR_ECONOMIC_ELIGIBILITY_VIOLATION`.
- Economics controls `EC-5` has advanced through Slice 65: offline alert rollups now include deterministic harmony score, delta, and harmony-capacity profiling.
- `Phase 0` roadmap lock is complete with canonical tracking in `docs/v0/v0-phase0-execution-plan.md`.
- `Phase 0` Workstreams A-D are complete and cadence sync (`E2`) is active.
- Track 5 Phase 0 slices (`T5-S1`..`T5-S8`) are now complete with gate evidence tracked in `docs/v0/v0-closed-alpha-readiness-report.md`.
- `Phase 1` closed-alpha market is now complete for the original invite-only artifact-verifiable service lanes and operator workflow scope.
- Phase 1 recurring gate preflight now has a repeatable command/checklist path (`npm run v1:preflight`, `docs/runbooks/phase1-preflight-checklist.md`).
- Phase 1 operations cadence is now documented (`docs/runbooks/phase1-operations-cadence.md`) and includes automated GA6 drill command `npm run v1:ga6-drill`.
- Phase 1 operations workflow remains active as carry-forward operational practice after closeout: preflight writes `preflight-summary.json`, GA6 drill enforces applied-event parity, and web shell shows latest status with recent history, failure-triage shortcuts, artifact lifecycle controls (stale/pin/prune plus note/tag/archive guidance), and evidence-export/prune-plan command outputs from current artifacts with stale-export refresh warnings, explicit in-panel refresh workflow controls, allowlisted `Run Now` execution for export refresh commands, export execution audit visibility (per-run rows plus per-action latest status/failure-streak/last-success rollups with failure alerts), policy-bounded export-audit retention/rotation planning via `npm run v1:export-audit-log-plan`, deterministic apply-mode coverage via `npm run v1:export-audit-log-plan:smoke`, and a closed-alpha UX readiness focus checklist view for onboarding/discovery/evidence signals with targeted per-row triage commands plus non-pass deep links to relevant operations/explorer surfaces and reusable row-level command tools (copy-first with allowlisted run controls when available); deterministic evidence rollup is available via `npm run v1:evidence-manifest`, and policy-bounded cleanup planning is available via `npm run v1:artifact-prune-plan`.
- v0 abuse-evidence matrix now has full `AB-01`..`AB-12` test linkage with `G4` marked `pass` in `docs/v0/v0-exit-evidence-matrix.md`.
- `Phase 2` compute-job kickoff is now separate follow-on work and does not redefine Phase 1 completion.

## Long-term goals

1. Deterministic settlement:
   every exchange should be replayable from signed events, bounded evidence, and policy rules that converge on inspectable outcomes.
2. Portable trust:
   reputation, attestations, fulfillment history, and abuse signals should remain exportable across operators and deployments.
3. Boring deployment:
   the system should become easy to launch, operate, back up, and upgrade for small independent operators.
4. Procedural dispute resolution:
   human intervention should be an exception layer; the default path should be structured contracts, admissible evidence, and deterministic policy evaluation.
5. Safe federation:
   independent nodes should synchronize and interoperate without a single mandatory platform authority.
6. Abuse resistance without paywalls:
   anti-spam, anti-sybil, anti-collusion, and anti-fraud controls should not depend on monetary rails.

## Permanent product pillars

- Protocol:
  event model, contract lifecycle, settlement states, evidence formats, replay guarantees, policy/version evolution.
- Commerce layer:
  listings, offers, milestone workflows, fulfillment UX, storefront deployment, operator controls.
- Trust layer:
  identity, attestations, reputation, fraud signals, trust portability, policy-bounded eligibility.
- Resolution layer:
  deterministic dispute handling, evidence intake, timeout/finalization rules, explicit escalation boundaries.
- Operations layer:
  install flows, observability, recovery, backups, policy rollout, federation management, evidence capture.

## Phase 0: Documents and reference implementation

- Publish v0 specs (protocol, marketplace).
- Implement reference event schemas and deterministic state derivation.
- Build a minimal CLI to:
  - generate keys
  - sign events
  - publish/read events via relays
  - derive balances/offers/orders state

## Phase 1: Closed alpha market

- Status: complete.
- Invite-only web-of-trust onboarding.
- Marketplace for a small set of artifact-verifiable service types.
- Milestone-first orders enforced by client defaults.
- Reputation and discovery rules in client.

## Phase 2: Standardized job runner lane

- Add compute/AI resource types using deterministic job specs and receipts.
- Add provider tooling for receipts and artifact hashing.
- Improve audit tooling for suspicious behavior patterns.

## Phase 3: Expanded service templates

- Add templates for coaching/teaching/consulting via artifact anchors.
- Improve UX for acceptance criteria and milestone negotiation.

## Phase 4: Stronger correctness

- Add checkpointing/state roots.
- Hardening against double-spend across relays.
- Optional stronger delivery verification (reproducibility, hardware attestation).

## Phase 5: Governance decentralization

- Reduce or remove any bootstrap policy mechanism.
- Move toward slow, conservative, graph-based policy evolution.

## Horizon checkpoints

- Horizon 1: protocol credibility
  prove deterministic replay, inspectable settlement, bounded evidence, and repeatable anti-abuse controls in a narrow set of objective service lanes.
- Horizon 2: deployable marketplace product
  make onboarding, marketplace operations, incident response, and default operator workflows simple enough for small independent deployments.
- Horizon 3: federation and trust portability
  support cross-node synchronization, policy/version compatibility, portable trust signals, and convergent settlement across operators.
