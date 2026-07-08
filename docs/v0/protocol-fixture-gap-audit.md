# Protocol Fixture Gap Audit

Purpose: list marketplace **procedure** scenarios the spec requires but lack dedicated checked-in fixtures — protocol hardening backlog without client work.

Status: `active`

Last updated: July 2026

Reference lane: [../architecture/software-fixes-lane.md](../architecture/software-fixes-lane.md)

Covered scenarios: [v0-scenario-fixture-matrix.md](v0-scenario-fixture-matrix.md)

## Already proven (no action)

| Procedure | Evidence |
| --- | --- |
| Accept after delivery | `marketplace-accept.jsonl` |
| Dispute → paired settle | `marketplace-dispute-settle.jsonl` |
| Dispute → timeout refund | `marketplace-timeout-autorefund.jsonl` |
| Unauthorized delivery | `marketplace-unauthorized-delivery.jsonl` |
| Overfunding | `marketplace-overfunding.jsonl` |
| Settlement mismatch | `marketplace-settlement-mismatch.jsonl` |
| Missing references | `marketplace-missing-reference.jsonl` |
| Per-lane accept/dispute bundles | SCN-15 matrix |

## Gaps — add fixtures when tightening protocol

| ID | Scenario | Expected kernel behavior | Priority | Status |
| --- | --- | --- | --- | --- |
| `GAP-01` | `ServiceAccept` after acceptance window | Reject; stable reason (`acceptance window has expired`) | High | **done** — `marketplace-accept-after-window.jsonl` |
| `GAP-02` | `ServiceDispute` after acceptance window | Reject; stable reason (`dispute is outside acceptance window`) | High | **done** — `marketplace-dispute-after-window.jsonl` |
| `GAP-03` | `ServiceDispute` on already `Accepted` milestone | Reject; no state mutation | High | **done** — `marketplace-dispute-after-accept.jsonl` |
| `GAP-04` | `ServiceDelivery` with wrong `evidenceFormat` for lane | Reject at ingest | Medium | **done** — `marketplace-delivery-wrong-evidence-format.jsonl` |
| `GAP-05` | `ServiceDelivery` before milestone `Funded` | Reject | Medium | **done** — `marketplace-delivery-before-funded.jsonl` |
| `GAP-06` | Second `ServiceAccept` on same milestone | Reject (dedupe / invalid transition) | Medium | **done** — `marketplace-duplicate-accept.jsonl` |
| `GAP-07` | `ServiceSettle` amounts ≠ escrow funded total | Reject (`settlement amounts must sum to milestone funded amount`) | Low | **done** — `marketplace-settle-amounts-not-funded-total.jsonl`, `marketplace-settle-without-dispute.jsonl` |
| `GAP-08` | Offline `physical-handoff` happy path | Accept under EC-5 template only | Low (R6) | **done** — `marketplace-physical-handoff-accept.jsonl` |

Regenerate GAP-01..07: `node scripts/generate-protocol-gap-fixtures.mjs` (after `pnpm --filter @new-start/sdk-ts build`).

/** Default policy `acceptanceWindowSeconds` = 7 days (`crates/policy/src/lib.rs`). */

## Non-goals (do not fixture as protocol bugs)

| Situation | Why |
| --- | --- |
| Buyer unhappy with fix quality | SOC-05 — subjective; off-protocol |
| Off-platform PayPal settlement | SOC-01 — not ingested |
| Operator deletes log file | Host compromise — RES layer |

## Suggested next slice

Reference-lane **procedure guards are complete for v1** (GAP-01..08). Trust bootstrap + credits path: [../specs/trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md) (SCN-17). P2H policy activation: SCN-19. Federation band R5-F1..F4 complete. R7 desktop MVP (`RG-7`) complete. R6-L2 community lane catalog complete. R6-L3 offline lane smoke and guardrails complete.

## Related docs

- [v0-scenario-fixture-matrix.md](v0-scenario-fixture-matrix.md)
- [v0-abuse-gaming-test-matrix.md](v0-abuse-gaming-test-matrix.md)
- [../architecture/v0-spec-outline.md](../architecture/v0-spec-outline.md)
