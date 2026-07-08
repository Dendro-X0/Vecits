# V0 Abuse and Gaming Test Matrix

Purpose: convert abuse analysis into deterministic test cases with explicit reject paths, telemetry expectations, and replay invariants.

## Priority abuse families

| Abuse ID | Pattern | Primary control | Expected deterministic outcome |
| --- | --- | --- | --- |
| `AB-01` | bad signature injection | envelope validation | reject with `ERR_BAD_SIGNATURE`; no derived-state mutation |
| `AB-02` | nonce replay / duplicate spend attempt | nonce-domain protection | reject with `ERR_INVALID_NONCE` |
| `AB-03` | missing reference chaining | reference validation | reject with `ERR_MISSING_REFERENCE` |
| `AB-04` | unauthorized actor transitions | authorization checks | reject with `ERR_UNAUTHORIZED_ACTOR` |
| `AB-05` | escrow overfunding / sink misuse | state transition + sink policy | reject with `ERR_INVALID_STATE_TRANSITION` or `ERR_POLICY_VIOLATION` |
| `AB-06` | policy takeover attempts | policy authority + timeline constraints | reject with policy guardrail reason; no policy activation |
| `AB-07` | policy version mismatch after activation | policy version enforcement | reject with deterministic policy mismatch behavior |
| `AB-08` | high-rate issuance farming | EC-2 throughput controls | reject with `ERR_ISSUANCE_RATE_LIMIT_EXCEEDED` |
| `AB-09` | low-diversity issuance loops | EC-2 diversity control | reject with `ERR_ISSUANCE_DIVERSITY_VIOLATION` |
| `AB-10` | low-quality identity exploiting issuance paths | EC-4 eligibility gating | reject with `ERR_ECONOMIC_ELIGIBILITY_VIOLATION` when thresholds enabled |
| `AB-11` | duplicate event ingest across sync peers | node idempotence contract | accepted as duplicate with `already_present=true`; no invalid row insertion |
| `AB-12` | corrupted snapshot bootstrap | snapshot integrity checks | bootstrap import fails deterministically; replay safety preserved |
| `AB-13` | health endpoint secret leakage | response field allowlist | `/health` never exposes `peers.json` read tokens |
| `AB-14` | malformed events.log tail on restart | startup log validation | node init/serve fails closed with explicit JSON line error |
| `AB-16` | HTTP ingest flooding on public source node | RES-06 per-client rate limit | reject with `ERR_INGEST_RATE_LIMIT_EXCEEDED` (HTTP 429 + `Retry-After`) |
| `AB-17` | Insider tampering with `events.log` | RES-07 optional hash chain sidecar | restart/verify fails closed when `events.chain.jsonl` diverges |

## Fixture and test mapping

| Abuse ID | Existing artifacts | Gaps to close |
| --- | --- | --- |
| `AB-01` | `fixtures/invalid/bad-signature.jsonl`; `crates/node/tests/api.rs` (`api_bad_signature_fixture_rejected_with_stable_reason_and_snapshot_parity`) | no open gap for explicit bad-signature reason-code assertion |
| `AB-02` | `fixtures/invalid/duplicate-nonce.jsonl`; `crates/state-engine/src/replay.rs` tests; `crates/node/tests/api.rs` (`api_duplicate_nonce_rejected_with_stable_reason_and_snapshot_parity`) | no open gap for node API assertion |
| `AB-03` | `fixtures/invalid/missing-reference.jsonl`; `fixtures/invalid/marketplace-missing-reference.jsonl`; `crates/node/tests/api.rs` (`api_marketplace_settlement_missing_dispute_reference_rejected_deterministically`, `api_missing_reference_fixtures_preserve_reason_code_parity_across_replay_sources`) | no open gap for broader missing-reference reason-code parity checks across replay surfaces |
| `AB-04` | `fixtures/invalid/marketplace-unauthorized-delivery.jsonl`; `crates/node/tests/api.rs` (`api_marketplace_deadlock_same_actor_settlement_rejects_with_replay_parity`, `api_marketplace_second_settlement_signature_from_unauthorized_actor_rejects_deterministically`) | no open gap for unauthorized second-settlement transition coverage |
| `AB-05` | `fixtures/invalid/marketplace-overfunding.jsonl`; `fixtures/invalid/unsupported-sink.jsonl`; `crates/node/tests/api.rs` (`api_marketplace_overfund_with_stale_policy_version_rejects_with_policy_violation`) | no open gap for combined overfund + stale-policy precedence behavior |
| `AB-06` | `fixtures/invalid/policy-update-unauthorized.jsonl`; `fixtures/invalid/policy-update-backdated-effective-at.jsonl`; `fixtures/invalid/policy-update-non-monotonic-effective-at.jsonl`; `crates/node/tests/api.rs` (`api_policy_update_unauthorized_rejected_and_timeline_noops`) | no open gap for unauthorized-update timeline no-op verification |
| `AB-07` | `fixtures/invalid/policy-version-mismatch-post-activation.jsonl`; `crates/node/tests/api.rs` (`api_policy_version_activation_boundary_rejects_stale_policy_version`) | no open gap for activation-boundary as-of assertions |
| `AB-08` | EC-2 tests in `crates/state-engine` and `crates/node`; `crates/state-engine/src/replay.rs` (`replay_issuance_rate_limit_recovers_after_window_advance`) | no open gap for rate-limit recovery-after-window behavior |
| `AB-09` | EC-2 tests in `crates/state-engine` and `crates/node`; `crates/state-engine/src/replay.rs` (`replay_issuance_diversity_allows_cross_lane_counterparty_recovery`) | no open gap for cross-lane diversity boundary behavior |
| `AB-10` | EC-4 tests in `crates/state-engine` and `crates/node`; `crates/state-engine/src/replay.rs` (`economic_eligibility_is_noop_when_policy_thresholds_unset`) | no open gap for threshold-unset compatibility assertion |
| `AB-11` | `crates/node/tests/sync.rs` duplicate ingest coverage; `crates/node/tests/sync.rs` (`sync_pull_reset_reports_mixed_duplicate_and_new_events`) | no open gap for mixed duplicate/new peer-pull scenario |
| `AB-12` | `fixtures/node/corrupted-snapshot.json`; `crates/node/tests/sync.rs` (`sync_bootstrap_rejects_corrupted_remote_snapshot`) with explicit error contract assertion | no open gap for deterministic corrupted-snapshot bootstrap error contract |
| `AB-13` | `crates/node/tests/api.rs` (`api_health_endpoint_does_not_leak_peers_secrets`) | no open gap for peers.json secret leakage |
| `AB-14` | `crates/node/tests/runtime.rs` (`events_log_malformed_tail_fails_closed_on_restart`) | no open gap for malformed events.log tail fail-closed contract |
| `AB-16` | `crates/node/tests/api.rs` (`api_post_events_rate_limit_rejects_excess_requests_per_client`, `api_post_events_batch_rate_limit_rejects_excess_requests`) | no open gap for HTTP ingest rate-limit contract |
| `AB-17` | `crates/node/tests/runtime.rs` (`events_log_hash_chain_tamper_fails_closed_on_restart`); `cargo run --bin cli -- log verify-chain` | no open gap for hash-chain tamper detection on restart |

## Deterministic test requirements

- every abuse case must assert stable reject reason code or stable idempotent acceptance contract
- same event set and `as_of` must produce identical replay outcome hash
- invalid events must never satisfy references for later events
- snapshot-plus-delta and genesis replay outcomes must remain equivalent for valid logs

## Minimum gate for Phase 0 close

- all `AB-01` through `AB-12` have a linked automated test file or named fixture command
- all gating reason codes are asserted in tests, not only inspected manually
- unresolved gaps are captured as explicit tickets attached to `T5-S4` or `T5-S6` (none currently open in this matrix snapshot)
