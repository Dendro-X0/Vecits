# Phase 1 Preflight Checklist

Purpose: provide a repeatable preflight/regression command set for closed-alpha Phase 1 operations.

Last updated: April 7, 2026

## Run command

- `npm run v1:preflight`
- optional expanded check: `npm run v1:readiness` (includes SDK/Web typecheck)
- optional lane fixture regression: `npm run v1:lane-fixtures`
- optional expanded lane fixture regression: `npm run v1:lane-fixtures:readiness` (includes web typecheck)
- each preflight run writes `target/tmp/preflight-<timestamp>/preflight-summary.json`
- each lane fixture run writes `target/tmp/lane-fixture-check-<timestamp>/lane-fixture-check-summary.json`
- optional evidence rollup: `npm run v1:evidence-manifest` (writes `target/tmp/operations-evidence-manifest.json`)
- optional cleanup planning: `npm run v1:artifact-prune-plan` (writes `target/tmp/operations-artifact-prune-plan.json`)
- optional export-audit cleanup planning: `npm run v1:export-audit-log-plan` (writes `target/tmp/operations-export-audit-log-plan.json`)
- optional planner apply-mode smoke check: `npm run v1:export-audit-log-plan:smoke` (isolated temp-workspace harness for candidate/archive/rewrite invariants)
- optional release runbook drill (RDG-5): `npm run v1:ga6-drill:release` (uses `dist/release/vectis-node` binary, writes `target/tmp/runbook-release-dryrun-*/ga6-drill-summary.json`)

## Gate mapping

| Gate | Verification command | Pass condition |
| --- | --- | --- |
| `GA1` | `cargo test -p node --test api api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch` | deterministic onboarding guardrail reject paths pass |
| `GA2` | `cargo test -p node --test api api_marketplace_accept_flow_covers_initial_digital_lanes` | accepted-path lane coverage passes for all initial lanes |
| `GA3` | `cargo test -p node --test api api_marketplace_dispute_timeout_covers_initial_digital_lanes` | dispute-timeout lane coverage passes for all initial lanes |
| `GA4` | `cargo test -p node --test sync sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views` | multi-node convergence hash checks pass |
| `GA5` | `cargo test -p node --test api api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic` | repeated-query discovery determinism checks pass |
| `GA6` | `npm run v1:ga6-drill` (or runbook drill from `docs/runbooks/alpha-operations-runbook.md` sections 1-7 on clean dirs) | ingest/sync/bootstrap flow succeeds with `rejected_count = 0` on valid bundles, and summary artifact records applied-event parity + replay/discovery parity + zero invalid-event counts across node A/B/C |

## Optional lane fixture regression

Use this targeted check when fixture-bundle, quickstart, discovery-link, or lane-template workflow changes land:

- `npm run v1:lane-fixtures`
- optional expanded check: `npm run v1:lane-fixtures:readiness`

Current coverage:

- `cargo test -p node --test api api_checked_in_non_software_lane_fixture_bundles_replay_cleanly`
- `cargo test -p node --test sync sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views`
- `cargo test -p node --test api api_marketplace_compute_job_lane_template_mismatch_rejections_are_deterministic`
- optional web-shell typecheck when `:readiness` variant is used

## GA6 evidence capture (manual drill)

Record these artifacts for each drill:

- run directory path (for example `target/tmp/runbook-dryrun-<timestamp>`)
- summary file `ga6-drill-summary.json`
- command transcript for ingest, sync pull, sync status, snapshot create, bootstrap
- validation fields:
  - `invalid_event_count.node_a|node_b|node_c` are `0`
  - `applied_event_count_equal.node_a_vs_node_b` and `applied_event_count_equal.node_a_vs_node_c` are `true`
  - `replay_state_equal.node_a_vs_node_b` and `replay_state_equal.node_a_vs_node_c` are `true`
  - `discovery_equal.node_a_vs_node_b` and `discovery_equal.node_a_vs_node_c` are `true`
