# Order amend — design (v1)

Purpose: lock **paired `OrderAmend`** so buyer and provider can rewrite milestone **amount** and order **expiry** in place **before delivery**, with escrow delta reconciliation. Broader term rewrite (evidence format, milestones add/remove) stays out of this band.

Status: `locked`

Last updated: August 2026

Related: [../foundation/market-operating-model.md](../foundation/market-operating-model.md), [order-mutual-cancel-design.md](order-mutual-cancel-design.md), [protocol-priority-backlog.md](protocol-priority-backlog.md).

## 1) Decision

| Item | Choice |
| --- | --- |
| Event kind | `OrderAmend` (marketplace family) |
| Handshake | Paired — first signer proposes (`AmendPending`); counterparty matches |
| Allowed statuses | `Open`, `PartiallyFunded`, `Funded` only |
| Mutable fields | Milestone `amountCredits` + order `orderExpiresAt` |
| Escrow | Decrease: refund `funded_amount - new_amount` to buyer; Increase: leave underfunded until more `SpendCredits`; Equal: stay `Funded` |
| Reputation | Neutral |
| Exit without rewrite | Still `ServiceCancel` or new offer/order |

## 2) Functional requirements

| ID | Requirement |
| --- | --- |
| **OA-01** | Either buyer or provider may submit the first `OrderAmend` while milestone is `Open`, `PartiallyFunded`, or `Funded` |
| **OA-02** | First valid amend moves milestone to `AmendPending` and records pending author, event id, proposed amount, proposed expiry |
| **OA-03** | Second amend must be from the **other** party, reference the pending amend event, and match `orderId` / `milestoneId` / `amountCredits` / `orderExpiresAt` |
| **OA-04** | On match: apply amount to milestone + order expiry; reconcile escrow (refund excess if funded above new amount); set status from funded vs amount (`Open` / `PartiallyFunded` / `Funded`); clear pending fields |
| **OA-05** | Reject amend after `Delivered`, `Accepted`, `Disputed`, `SettlementPending`, `Settled`, `AutoRefunded`, `Cancelled`, or while `CancelPending` |
| **OA-06** | Reject silent / unilateral amend (single event never applies terms) |
| **OA-07** | `amountCredits` must be &gt; 0 and ≤ policy `max_milestone_credits`; `orderExpiresAt` must be after event `createdAt` |
| **OA-08** | Concurrent `CancelPending` blocks amend (and vice versa): cancel and amend are exclusive pending handshakes |

## 3) Payload

```text
OrderAmendPayload {
  orderId: string
  milestoneId: string
  amountCredits: u64
  orderExpiresAt: string (RFC3339)
  amendedAt: string (RFC3339)
  reasonHash?: string
}
```

References:

| Event | Required refs |
| --- | --- |
| First amend | `order` → order created event id |
| Matching amend | `order` → same; `amend` → first amend event id |

## 4) Escrow delta (on match)

| Condition | Effect |
| --- | --- |
| `funded_amount` &gt; new `amountCredits` | Refund excess (`funded_amount - amountCredits`) to buyer lots; set `funded_amount = amountCredits`; status `Funded` |
| `funded_amount` == new amount | Status `Funded` (or `Open` if both zero — amount must be &gt; 0 so N/A) |
| `funded_amount` &lt; new amount | Keep `funded_amount`; status `Open` if 0 else `PartiallyFunded`; buyer may add `SpendCredits` |

Also update `ReplayOrderRecord.order_expires_at` and the milestone spec `amount_credits` on the order.

## 5) Invalid cases (fixtures)

| Case | Expected |
| --- | --- |
| Amend after delivery | `InvalidStateTransition` |
| Second amend from same actor | `InvalidStateTransition` |
| Wrong actor | `UnauthorizedActor` |
| Missing `order` / mismatched `amend` ref | `MissingReference` |
| Handshake amount/expiry mismatch | `InvalidStateTransition` |
| Amount over `max_milestone_credits` or zero | `PolicyViolation` / `InvalidPayload` |
| `orderExpiresAt` ≤ event time | `InvalidPayload` / `BadTimestamp` |

## 6) Explicit non-goals

- Changing `evidenceFormat`, `termsHash`, service type, or delivery mode
- Adding / removing milestones
- Amend after delivery (use dispute / settle / timeout)
- Single-party amend
- Client wizard UI (thin SDK kind string only)

## 7) Claim language

| Claim | Allowed when |
| --- | --- |
| **OrderAmend v1 verified** | Valid fixture + `cli fixtures run` green; amount/expiry applied with escrow delta |
| **Full term rewrite** | **Never** from this band — evidence/milestone shape still deferred |

## 8) Proof

- `cargo test -p protocol-core -p state-engine`
- `cargo run --bin cli -- fixtures run` including amend valid/invalid fixtures
