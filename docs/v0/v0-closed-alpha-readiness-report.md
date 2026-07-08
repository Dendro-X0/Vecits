# V0 Closed-Alpha Readiness Report

Report date: April 11, 2026  
Scope: `T5-S8` go/no-go packet for Track 5 readiness gates (`GA1`..`GA6`)

Status note: this packet now serves as the completion baseline for the original Phase 1 closed-alpha scope. Phase 2 compute-job lane work is a separate next-phase stream and is excluded from the Phase 1 completion basis.

## Gate status summary

| Gate | Status | Evidence | Notes |
| --- | --- | --- | --- |
| `GA1` invite onboarding path passes without manual DB edits | `completed` | `apps/web/app/components/onboarding-wizard.tsx`; `crates/node/tests/api.rs` (`api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch`) | Onboarding guardrails now have deterministic replay/snapshot parity evidence for sponsor-vouch reject paths. |
| `GA2` one complete accepted exchange per initial lane | `completed` | `crates/node/tests/api.rs` (`api_marketplace_accept_flow_covers_initial_digital_lanes`) | Deterministic accepted-path coverage now spans all initial digital alpha lanes. |
| `GA3` deterministic dispute/deadlock scenario per lane | `completed` | `crates/node/tests/api.rs` (`api_marketplace_dispute_timeout_covers_initial_digital_lanes`) | Deterministic dispute-timeout coverage now spans all initial digital alpha lanes. |
| `GA4` two-node convergence proof for all alpha fixture bundles | `completed` | `crates/node/tests/sync.rs` (`sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views`, `sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views`) | Source/sink convergence proven across the three original alpha bundles plus checked-in non-software lane accept/dispute fixture bundles. |
| `GA5` deterministic discovery outputs for repeated identical queries | `completed` | `crates/node/tests/api.rs` (`api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic`) | Node endpoint + web/SDK contract validated with repeated-query determinism checks. |
| `GA6` operator runbook executable by non-author from clean environment | `completed` | `docs/runbooks/alpha-operations-runbook.md`; dry run evidence in `docs/roadmap/working-context-log.md` (`target/tmp/runbook-dryrun-1775537368434`) | Full docs-only dry run executed: ingest, sync pull, sync status, snapshot bootstrap, DB checks. |

## Track 5 slice status snapshot

| Slice | Status | Primary evidence artifact(s) |
| --- | --- | --- |
| `T5-S1` | `completed` | onboarding wizard implementation + guardrail API coverage (`api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch`) |
| `T5-S2` | `completed` | marketplace lane-template enforcement + replay reject-path coverage (`api_marketplace_offline_lane_template_mismatch_rejections_are_deterministic`) |
| `T5-S3` | `completed` | `crates/node/tests/api.rs` milestone-first accept flow test |
| `T5-S4` | `completed` | `crates/node/tests/api.rs` dispute/timeout/deadlock deterministic tests |
| `T5-S5` | `completed` | discovery endpoint + web/SDK integration and determinism tests |
| `T5-S6` | `completed` | `crates/node/tests/sync.rs` multi-node alpha-bundle convergence |
| `T5-S7` | `completed` | `docs/runbooks/alpha-operations-runbook.md` + docs-only dry-run evidence |
| `T5-S8` | `completed` | this report + gate evidence linkage |

## Verification command index

- `cargo test -p node --test api api_marketplace_accept_flow_transitions_are_replay_stable`
- `cargo test -p node --test api api_marketplace_dispute_settlement_handshake_is_replay_stable`
- `cargo test -p node --test api api_marketplace_dispute_timeout_autorefund_is_replay_stable`
- `cargo test -p node --test api api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic`
- `cargo test -p node --test api api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch`
- `cargo test -p node --test api api_marketplace_offline_lane_template_mismatch_rejections_are_deterministic`
- `cargo test -p node --test api api_marketplace_accept_flow_covers_initial_digital_lanes`
- `cargo test -p node --test api api_marketplace_dispute_timeout_covers_initial_digital_lanes`
- `cargo test -p node --test sync sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views`
- `cargo test -p node --test sync sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views`
- `cargo test -p node --test sync`
- `npm run v1:preflight`
- `npm run v1:readiness`
- `npm run v1:ga6-drill`
- `npm run v1:evidence-manifest`
- `npm run v1:artifact-prune-plan`
- `npm run v1:export-audit-log-plan`
- `npm run v1:export-audit-log-plan:smoke`

## Operations evidence exports (Phase 1 carry-forward)

- consolidated evidence manifest:
  - command: `npm run v1:evidence-manifest`
  - canonical artifact: `target/tmp/operations-evidence-manifest.json`
  - latest reproducibility snapshot: `target/tmp/operations-evidence-manifest-asof.json`
- policy-bounded artifact prune planner:
  - command: `npm run v1:artifact-prune-plan`
  - canonical artifact: `target/tmp/operations-artifact-prune-plan.json`
  - latest reproducibility snapshot: `target/tmp/operations-artifact-prune-plan-asof.json`
- export-audit retention/rotation planner:
  - command: `npm run v1:export-audit-log-plan`
  - canonical artifact: `target/tmp/operations-export-audit-log-plan.json`
  - latest reproducibility snapshot: `target/tmp/operations-export-audit-log-plan-asof.json`
  - apply-mode smoke check command: `npm run v1:export-audit-log-plan:smoke`
- readiness packet upkeep rule:
  - refresh all three exports before weekly readiness review and before any go/no-go reevaluation
  - record artifact paths and refresh outcomes in `docs/roadmap/working-context-log.md`
  - latest closeout refresh paths are recorded in `docs/roadmap/working-context-log.md` for the Phase 1 completion flip

## Go/no-go decision (current)

Current decision: `go` (all `GA1`..`GA6` currently have linked deterministic evidence).

Phase 1 completion status: `complete` for the original invite-only closed-alpha market scope.

Phase 2 separation note:

- `compute-job` lane work is a Phase 2 kickoff item.
- It is intentionally excluded from the Phase 1 completion basis in this report.
- New Phase 2 lane-template or receipt work should not be treated as reopening `GA1`..`GA6` unless it regresses an existing Phase 1 surface.

Post-go actions:

1. Keep the evidence links in this report synchronized when new lane templates or policy defaults are introduced.
2. Run recurring preflight/regression checks via `npm run v1:preflight` and `docs/runbooks/phase1-preflight-checklist.md`.
3. Run recurring GA6 runbook drill via `npm run v1:ga6-drill` and retain the generated summary artifact path in `docs/roadmap/working-context-log.md`.
4. Regenerate operations exports (`npm run v1:evidence-manifest`, `npm run v1:artifact-prune-plan`, `npm run v1:export-audit-log-plan`) and retain artifact paths in `docs/roadmap/working-context-log.md` before readiness sign-off updates.
