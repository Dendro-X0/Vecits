# V0 Exit Evidence Matrix

Purpose: map each v0 exit criterion to concrete evidence artifacts and readiness gates.

## Status labels

- `planned`: evidence path defined, execution pending
- `in_progress`: evidence generation underway
- `completed`: evidence generated and reviewed
- `blocked`: cannot complete due to external dependency

## Criterion mapping

| Exit criterion (`docs/v0/v0-roadmap.md`) | Status | Required evidence | Verification command/check |
| --- | --- | --- | --- |
| Protocol core is deterministic and replay-tested | `completed` | `crates/state-engine/tests/fixtures.rs`, `crates/state-engine/src/replay.rs`, fixture bundles in `fixtures/valid` and `fixtures/invalid` | `cargo test`; `cargo run --bin cli -- fixtures run` |
| Local node and client layer are usable by non-authors | `completed` | operator flow docs (`docs/runbooks/alpha-operations-runbook.md`), web quickstart UX checks, CLI runbook validation, recurring preflight automation (`scripts/v1-preflight.mjs`), scripted runbook drill wrapper (`scripts/v1-ga6-drill.mjs`) | runbook dry-run from clean environment; `npm run v1:readiness`; `npm run v1:ga6-drill` |
| At least one narrow service lane works end to end | `completed` | accepted/dispute lane-coverage tests in `crates/node/tests/api.rs` (`api_marketplace_accept_flow_covers_initial_digital_lanes`, `api_marketplace_dispute_timeout_covers_initial_digital_lanes`) plus multi-node convergence in `crates/node/tests/sync.rs` (`sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views`) | replay/API checks for lane fixtures; sync convergence checks |
| Stalled-project support flow is modeled clearly | `completed` | explicit lane template + scenario doc (`docs/architecture/stalled-project-support-flow.md`), lane-template source (`apps/web/app/components/marketplace-event-builder.tsx`), lane coverage tests including `project-maintenance` | docs walkthrough; `cargo test -p node --test api api_marketplace_accept_flow_covers_initial_digital_lanes`; `cargo test -p node --test api api_marketplace_dispute_timeout_covers_initial_digital_lanes` |
| Major abuse cases are understood well enough to document | `completed` | `docs/v0/v0-abuse-gaming-test-matrix.md`, deterministic reject-path tests in `crates/node/tests/api.rs` and `crates/node/tests/sync.rs` (including bad signature, duplicate nonce, missing-reference parity, unauthorized settlement actor, overfund+stale-policy precedence, policy unauthorized/timeline no-op, policy activation-boundary mismatch, mixed duplicate/new peer pull, corrupted snapshot bootstrap error contract), economics control boundary tests in `crates/state-engine/src/replay.rs` (`replay_issuance_rate_limit_recovers_after_window_advance`, `replay_issuance_diversity_allows_cross_lane_counterparty_recovery`, `economic_eligibility_is_noop_when_policy_thresholds_unset`) | abuse matrix review; targeted regression run (`cargo test -p node --test api`, `cargo test -p node --test sync`, `cargo test -p state-engine`) |

## Pass/fail gates

- `G1` Determinism gate: all required replay and fixture tests pass with stable outcomes.
- `G2` Usability gate: a non-author can complete node + client workflows from docs only.
- `G3` Lane gate: at least one initial lane has accepted and dispute/timeout end-to-end proofs.
- `G4` Abuse gate: top abuse families have explicit deterministic controls and tests.
- `G5` Documentation gate: roadmap/progress/spec docs are synchronized with implementation state.

## Sign-off template

| Gate | Result (`pass`/`fail`) | Evidence link(s) | Reviewer | Date |
| --- | --- | --- | --- | --- |
| `G1` | `pass` | `cargo test`; `cargo run --bin cli -- fixtures run`; deterministic fixture tests in `crates/state-engine/tests/fixtures.rs` | `maintainer` | `April 7, 2026` |
| `G2` | `pass` | `docs/runbooks/alpha-operations-runbook.md`; `docs/runbooks/phase1-preflight-checklist.md`; `docs/runbooks/phase1-operations-cadence.md`; `npm run v1:readiness`; `npm run v1:ga6-drill` | `maintainer` | `April 7, 2026` |
| `G3` | `pass` | lane coverage tests in `crates/node/tests/api.rs`; convergence test in `crates/node/tests/sync.rs` | `maintainer` | `April 7, 2026` |
| `G4` | `pass` | `docs/v0/v0-abuse-gaming-test-matrix.md`; `api_bad_signature_fixture_rejected_with_stable_reason_and_snapshot_parity`; `api_duplicate_nonce_rejected_with_stable_reason_and_snapshot_parity`; `api_missing_reference_fixtures_preserve_reason_code_parity_across_replay_sources`; `api_marketplace_second_settlement_signature_from_unauthorized_actor_rejects_deterministically`; `api_marketplace_overfund_with_stale_policy_version_rejects_with_policy_violation`; `api_policy_update_unauthorized_rejected_and_timeline_noops`; `api_policy_version_activation_boundary_rejects_stale_policy_version`; `sync_pull_reset_reports_mixed_duplicate_and_new_events`; `sync_bootstrap_rejects_corrupted_remote_snapshot`; `replay_issuance_rate_limit_recovers_after_window_advance`; `replay_issuance_diversity_allows_cross_lane_counterparty_recovery`; `economic_eligibility_is_noop_when_policy_thresholds_unset` | `maintainer` | `April 7, 2026` |
| `G5` | `pass` | synchronized status/docs: `docs/archive/roadmap.md`, `docs/v0/v0-roadmap.md`, `docs/v0/v0-phase0-execution-plan.md`, `docs/roadmap/working-context-log.md` | `maintainer` | `April 7, 2026` |
