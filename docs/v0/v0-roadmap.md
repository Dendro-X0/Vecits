# V0 Roadmap

This roadmap translates the current project direction into a practical first implementation plan.

V0 should establish a reliable, inspectable, and scalable foundation before attempting broad marketplace coverage.

V0 is the first execution horizon inside a longer plan: prove protocol credibility first, make deployment boring second, and expand federation/trust portability only after the deterministic base is stable.

Phase 0 execution status (April 2026):

- roadmap lock is complete and tracked in `docs/v0/v0-phase0-execution-plan.md`
- Track 5 Phase 0 slices (`T5-S1`..`T5-S8`) are complete with gate evidence in `docs/v0/v0-closed-alpha-readiness-report.md`
- the original `Phase 1` closed-alpha market scope is now complete; recurring Phase 1 checks remain as carry-forward operator practice rather than unfinished scope
- cross-cutting backlog extraction, exit evidence mapping, and cadence sync are active and documented
- recurring Phase 1 gate checks are now packaged as `npm run v1:preflight` with GA mapping in `docs/runbooks/phase1-preflight-checklist.md`
- recurring GA6 runbook drills are now scripted via `npm run v1:ga6-drill`, with cadence captured in `docs/runbooks/phase1-operations-cadence.md`
- recurring operations evidence is now machine-readable and surfaced in web shell as Phase 1 carry-forward operations practice (`preflight-summary.json` artifacts, GA6 applied-event parity assertions, and Phase 1 operations panel status/history + failure-triage + artifact-lifecycle rendering with note/tag/archive guidance + evidence-export/prune-plan commands from current artifacts + stale-export refresh warnings + in-panel refresh controls + allowlisted in-panel export `Run Now` execution + export execution audit rows with per-action rollups/failure alerts for action/timestamp/duration/status/exit/artifact hints + policy-bounded export-audit retention/rotation planning + deterministic apply-mode smoke harness coverage + closed-alpha UX readiness focus checklist view with targeted per-row triage commands, non-pass deep links to relevant operations/explorer surfaces, and row-level command-tool execution blocks); deterministic consolidated evidence export is available via `npm run v1:evidence-manifest`, policy-bounded cleanup planning is available via `npm run v1:artifact-prune-plan`, export-audit cleanup planning is available via `npm run v1:export-audit-log-plan`, and planner apply-mode smoke coverage is available via `npm run v1:export-audit-log-plan:smoke`
- compute-job templated lane work belongs to the new `Phase 2` kickoff and is out of scope for the original Phase 1 completion flip
- v0 exit evidence sign-off now has `G1`..`G5` marked `pass` in `docs/v0/v0-exit-evidence-matrix.md`

## Delivery principles

- build the protocol core before the product shell
- keep the first service lanes narrow and artifact-verifiable
- prefer local-first deterministic behavior over distributed complexity
- prove correctness with replayable fixtures before wider networking
- treat the frontend as a client of the protocol, not the source of truth
- optimize for determinism, auditability, and deployability before breadth
- treat v0 as the foundation for later protocol, commerce, trust, resolution, and operations layers

## Track 0: Spec freeze for implementation

Goal:

Turn the current exploratory docs into an implementable technical baseline.

Outputs:

- frozen v0 event envelope
- initial event kind list
- settlement state machine
- policy parameter list
- in-scope service lane list

Acceptance checks:

- a developer can read the docs and understand the system boundary
- event ordering and invalid-event behavior are defined
- milestone lifecycle is explicit

## Track 1: Rust protocol core

Goal:

Build the source-of-truth engine in Rust.

Scope:

- canonical event serialization
- Ed25519 signing and verification
- schema validation
- deterministic replay engine
- policy evaluation
- marketplace settlement logic
- trust graph and reputation primitives

Outputs:

- `protocol-core` crate
- `state-engine` crate
- `marketplace` crate
- `reputation` crate
- test fixtures for deterministic replay

Acceptance checks:

- the same event log always derives the same state
- invalid signatures and invalid transitions are rejected
- policy-driven timeouts produce deterministic outcomes

## Track 2: Local node and storage

Goal:

Create a minimal local-first runtime for event storage and querying.

Status:

- implemented in March 2026 as Phase 2 with a Rust local node, append-only JSONL event log, SQLite indexes, HTTP endpoints, and CLI snapshot workflows
- extended in March 2026 as Phase 2.1 with snapshot-aware replay (`snapshot_plus_delta`), schema-migrated snapshot checkpoints, and deterministic backfill fallback to `genesis_replay`
- extended in March 2026 as Phase 2.2 with typed marketplace reducers, escrow-aware `SpendCredits` for `ServiceEscrowSink`, and read-only marketplace state APIs
- extended in March 2026 as Phase 2.3 with executable `PolicyUpdate` timeline semantics, strict post-activation `policyVersion` enforcement, and policy read APIs
- extended in March 2026 as Phase 2.4 with deterministic reputation reducers, root-anchored global/lane scoring, reputation history APIs, CLI read parity, and snapshot format `v4` acceleration

Scope:

- append-only local event store
- SQLite-backed query and cache layer
- state snapshots for fast reloads
- local API for reading derived state

Outputs:

- local node service in Rust
- SQLite schema for event cache and materialized views
- snapshot and replay commands

Acceptance checks:

- a user can ingest events and derive balances, offers, orders, and milestone state locally
- replay from genesis and replay from snapshot yield equivalent results
- replay metadata truthfully reports `source` as `genesis_replay` or `snapshot_plus_delta`
- `PolicyUpdate` is executed deterministically with forward-only effective times and authority checks
- policy state and policy timeline are queryable via read APIs with `as_of` metadata
- reputation profile and reputation history are queryable with deterministic `as_of` semantics and replay metadata

## Track 3: TypeScript client layer

Goal:

Build the developer and user-facing TypeScript layer on top of the Rust core.

Status:

- started in March 2026 with a workspace-scaffolded `packages/sdk-ts` typed node client and a minimal `apps/web` Next.js read shell
- expanded in March 2026 with SDK create/sign/verify helpers and a web `IdentityCreate` local sign+submit flow
- expanded in March 2026 with read-only web explorer panels for offer/order/milestone/reputation endpoints
- expanded in March 2026 with dedicated route-based explorer pages and shareable URL query-param inspection flows
- expanded in March 2026 with explorer share-link copy actions and toggleable compact/pretty JSON result views
- expanded in March 2026 with persisted explorer defaults (`base_url`, `as_of`) and context-preserving cross-page navigation
- expanded in March 2026 with field-friendly query validation (`as_of` RFC3339, `base_url` URL checks, numeric bounds, inline field errors)
- expanded in March 2026 with fixture-backed one-click explorer presets for fast local query autofill
- expanded in March 2026 with a web-shell fixture quickstart panel (copyable CLI ingest commands + direct preset explorer links)
- expanded in March 2026 with quickstart shell variants (PowerShell/Bash) and one-click copy-all command bundles
- expanded in March 2026 with additional explorer read surfaces for identity, balance, and policy timeline inspection
- expanded in March 2026 with a lightweight marketplace event builder for `ServiceOffer`/`ServiceOrder`/`SpendCredits(ServiceEscrowSink)`/`ServiceDelivery`/`ServiceAccept`/`ServiceDispute`/`ServiceSettle` draft-sign-submit flows
- expanded in March 2026 with marketplace flow-assist autofill to chain IDs/references from the last signed event across multi-step action sequences
- expanded in March 2026 with fixture-aware marketplace builder presets (accept-flow and timeout-flow ID/timestamp/nonce baselines)
- expanded in March 2026 with one-click marketplace flow progression controls (accept/dispute lanes with start/prev/next step navigation)
- expanded in March 2026 with post-submit marketplace explorer deep links carrying `base_url`/`as_of` into offer/order/milestone inspection pages
- expanded in March 2026 with a session-scoped marketplace event-chain checklist (accept/dispute path completion with copyable status output)
- expanded in March 2026 with persisted marketplace builder workspace state and explicit reset controls (`Reset Builder Inputs`, `Reset Session + Checklist`)
- expanded in March 2026 with a guided marketplace runner (`Next Recommended Action`) including prerequisite visibility, accepted-event autofill, and guarded forward step transitions
- expanded in March 2026 with preflight/error hardening: mode-required field checks, base URL + RFC3339 validation, node reachability probe, and structured submit error rendering
- expanded in March 2026 with a dedicated contribution/credits builder covering `ContributionClaim`/`ContributionAttest`/`MintCredits`/non-escrow `SpendCredits` draft-sign-submit flows with event-chain autofill
- expanded in March 2026 with a deterministic discovery explorer (`/explorer/discovery`) using `GET /events` + state lookups, lane/reputation filters, stable ranking tie-breakers, and informational-only scoring disclaimers
- expanded in March 2026 with an invite-only onboarding wizard that creates identity events, prepares sponsor vouch-request drafts/messages, and computes onboarding progress from event data only
- Track 3 Phase 0 close-out slices in `docs/v0/v0-track3-remaining-spec.md` are now implementation-complete (T3-R1 through T3-R6)

Scope:

- TypeScript SDK for event submission and state queries
- schema-aligned client types
- Next.js frontend shell
- explorer views for orders, milestones, and reputation history

Outputs:

- `sdk-ts` package
- `web` app
- `explorer` views

Acceptance checks:

- the frontend can create, sign, submit, and inspect protocol actions
- all client-visible state comes from the Rust-derived source of truth

## Track 4: Relay and synchronization

Goal:

Add transport without creating protocol authority.

Status:

- started in March 2026 as Track 4.0 with node-to-node pull replication (CLI-driven), static peer allowlist config, per-peer cursor persistence, and idempotent duplicate ingest handling
- includes optional `GET /events` bearer-token protection via local peer config while preserving existing ingestion and derived-state semantics

Scope:

- simple relay or node-to-node synchronization
- event fetch and publish endpoints
- conflict handling based on deterministic validation rules
- optional event checkpoint exports

Outputs:

- relay service or synchronization layer
- event replication tests
- duplicate and replay protection checks

Acceptance checks:

- independent nodes converge on the same valid state from the same event set
- relays do not gain privileged authority over settlement

## Track 5: Narrow alpha marketplace

Goal:

Run a small realistic alpha with narrow service lanes.

Status:

- complete for the original Phase 1 closed-alpha scope
- ongoing Phase 1 preflight/cadence/evidence work is carry-forward operations practice, not unfinished Track 5 scope
- `compute-job` lane work is Phase 2 kickoff and is excluded from Track 5 completion

Initial lanes:

- software fixes and small feature work
- documentation and translation
- testing and bug reproduction
- structured research outputs
- stalled project maintenance and continuation

Scope:

- invite-based onboarding
- milestone-first offers and orders
- deterministic acceptance, dispute, and deadlock flows
- basic reputation-aware discovery

Acceptance checks:

- users can complete real small exchanges end to end
- repeated bad-faith behavior becomes visible and costly
- stalled-project support can be modeled as structured work, not charity alone

## Cross-cutting work

These tasks should evolve alongside every track:

- scenario modeling
- abuse and gaming analysis
- fixture-based protocol tests
- docs synchronization
- event versioning strategy

The main v0 framing across those tasks should be:

- Protocol:
  make replay, policy, evidence, and settlement rules inspectable and stable.
- Commerce:
  keep service lanes narrow, objective, and milestone-first.
- Trust:
  make onboarding, reputation, and eligibility legible without introducing central custodianship.
- Resolution:
  keep disputes procedural, bounded, and deterministic by default.
- Operations:
  make local deployment, evidence capture, readiness review, and incident response repeatable.

## What v0 explicitly postpones

- general-purpose physical goods
- broad subjective creative markets
- complex governance systems
- speculative token design
- strong on-chain execution requirements
- large-scale public launch

## Exit criteria for v0

V0 is ready to move beyond internal experimentation when:

- the protocol core is deterministic and replay-tested
- the local node and client layer are usable by non-authors
- at least one narrow service lane works end to end
- the stalled-project support flow is modeled clearly
- the major abuse cases are understood well enough to document
