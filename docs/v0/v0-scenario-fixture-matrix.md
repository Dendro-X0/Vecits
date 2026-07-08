# V0 Scenario Fixture Matrix

Purpose: convert scenario modeling into executable, fixture-backed checks with explicit expected outcomes.

## Execution commands

- `cargo run --bin cli -- fixtures run`
- `cargo run --bin cli -- log validate --in <fixture.jsonl>`
- `cargo run --bin cli -- log replay --in <fixture.jsonl> --out <state.json>`
- `cargo test`

## Scenario matrix

| Scenario ID | Fixture(s) | Expected outcome | Verification surface |
| --- | --- | --- | --- |
| `SCN-01` identity lifecycle | `fixtures/valid/identity-rotation.jsonl` | identity rotation replay is deterministic and root identity continuity is preserved | replay output; identity and reputation reads |
| `SCN-02` contribution mint flow | `fixtures/valid/claim-mint-spend.jsonl` | claim -> attest -> mint -> spend paths validate and produce expected balances | replay output; balance reads |
| `SCN-03` credit decay behavior | `fixtures/valid/expiry-demurrage.jsonl` | expiry/demurrage rules are deterministic at same `as_of` | replay output at multiple `as_of` points |
| `SCN-04` marketplace accept path | `fixtures/valid/marketplace-accept.jsonl` | funded milestone delivery and accept settle to expected terminal state | offer/order/milestone state reads |
| `SCN-05` marketplace dispute settle path | `fixtures/valid/marketplace-dispute-settle.jsonl` | dispute + negotiated settlement transitions are deterministic | milestone state reads and derived balances |
| `SCN-06` marketplace timeout refund path | `fixtures/valid/marketplace-timeout-autorefund.jsonl` | dispute timeout path produces deterministic auto-refund outcome | milestone terminal state and refund balance effect |
| `SCN-07` policy timeline forward activation | `fixtures/valid/policy-update-forward.jsonl` | policy updates apply only after `effectiveAt` and enforce forward-only semantics | policy current/timeline reads and replay metadata |
| `SCN-08` missing reference rejection | `fixtures/invalid/missing-reference.jsonl`, `fixtures/invalid/marketplace-missing-reference.jsonl` | events are rejected with stable missing-reference semantics | invalid reason outputs and no derived state mutation |
| `SCN-09` auth and signature rejection | `fixtures/invalid/bad-signature.jsonl`, `fixtures/invalid/marketplace-unauthorized-delivery.jsonl` | unauthorized or unsigned actions are rejected deterministically | invalid reason outputs; no state transitions |
| `SCN-10` funding safety rejection | `fixtures/invalid/marketplace-overfunding.jsonl`, `fixtures/invalid/unsupported-sink.jsonl` | overfunding and unsupported sinks cannot mutate settlement state | invalid reason outputs; escrow/funding invariants |
| `SCN-11` policy safety rejection | `fixtures/invalid/policy-update-unauthorized.jsonl`, `fixtures/invalid/policy-update-backdated-effective-at.jsonl`, `fixtures/invalid/policy-update-duplicate-version.jsonl`, `fixtures/invalid/policy-update-non-monotonic-effective-at.jsonl`, `fixtures/invalid/policy-version-mismatch-post-activation.jsonl` | policy update guardrails and version enforcement are deterministic | invalid reason outputs; policy timeline invariants |
| `SCN-12` dedupe and sequencing | `fixtures/invalid/duplicate-nonce.jsonl`, `fixtures/invalid/marketplace-duplicate-offer.jsonl` | duplicate-protection paths reject replay attacks deterministically | invalid reason outputs; no duplicate state artifacts |
| `SCN-13` node API batch/pagination | `fixtures/node/batch-mixed.json`, `fixtures/node/pagination-sequence.jsonl` | batch ingestion idempotence and pagination cursor behavior are stable | node API responses and cursor progression |
| `SCN-14` `as_of` and snapshot consistency | `fixtures/node/as-of-consistency.jsonl`, `fixtures/node/corrupted-snapshot.json` | replay-source metadata and corrupted snapshot safety behavior are deterministic | replay metadata (`source`, `snapshot_id`) and error handling |
| `SCN-15` lane fixture bundles | `fixtures/valid/marketplace-feature-work-accept.jsonl`, `fixtures/valid/marketplace-documentation-accept.jsonl`, `fixtures/valid/marketplace-translation-accept.jsonl`, `fixtures/valid/marketplace-testing-accept.jsonl`, `fixtures/valid/marketplace-research-accept.jsonl`, `fixtures/valid/marketplace-project-maintenance-accept.jsonl`, `fixtures/valid/marketplace-compute-job-accept.jsonl`, `fixtures/valid/marketplace-feature-work-dispute.jsonl`, `fixtures/valid/marketplace-documentation-dispute.jsonl`, `fixtures/valid/marketplace-translation-dispute.jsonl`, `fixtures/valid/marketplace-testing-dispute.jsonl`, `fixtures/valid/marketplace-research-dispute.jsonl`, `fixtures/valid/marketplace-project-maintenance-dispute.jsonl`, `fixtures/valid/marketplace-compute-job-dispute.jsonl` | checked-in lane bundles have reproducible accept and dispute/timeout flows with deterministic replay, discovery visibility, and terminal milestone outcomes, including the compute-only Phase 2 `compute-job` lane | offer/order/milestone state reads; discovery reads; fixture ingest coverage |
| `SCN-16` marketplace procedure guards | `fixtures/invalid/marketplace-accept-after-window.jsonl`, … `marketplace-settle-without-dispute.jsonl` | procedure guard rejections with stable reason codes | `cargo run --bin cli -- fixtures run`; [protocol-fixture-gap-audit.md](protocol-fixture-gap-audit.md) |
| `SCN-17` trust bootstrap admission | `fixtures/valid/bootstrap-provider-vouch-eligibility.jsonl`, `fixtures/invalid/marketplace-offer-below-trust-threshold.jsonl` | provider crosses or fails `provider_eligibility_threshold` before `ServiceOffer` | [../specs/trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md) |
| `SCN-18` offline physical-handoff accept | `fixtures/valid/marketplace-physical-handoff-accept.jsonl` | dual-ack delivery + accept closes order under EC-5 template | replay output; order/milestone state reads |
| `SCN-19` P2H policy activation | `fixtures/valid/policy-update-p2h-activation.jsonl`, `fixtures/invalid/mint-issuance-rate-exceeded.jsonl`, `fixtures/invalid/mint-p2h-risk-band-exceeded.jsonl` | `PolicyUpdate` enables issuance window + P2H band gates; rate/diversity and risk-band rejections are deterministic | `npm run generate:p2h-policy-fixtures`; `cargo run --bin cli -- fixtures run` |

## Minimum gate for Phase 0 close

- Every scenario above is mapped to at least one automated test or documented command check.
- Every invalid scenario has a stable reason-code assertion.
- Every scenario has a linkable evidence artifact recorded in `docs/v0/v0-exit-evidence-matrix.md`.
