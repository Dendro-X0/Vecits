# Order mutual cancel — design

Purpose: lock **paired `ServiceCancel`** so buyer and provider can exit an open escrowed milestone **before delivery** with full escrow refund. This is the P4 slice that ships; full `OrderAmend` (mid-deal price/scope rewrite) remains deferred.

Status: `locked`

Last updated: August 2026

Related: [../foundation/market-operating-model.md](../foundation/market-operating-model.md), [protocol-priority-backlog.md](protocol-priority-backlog.md), [../architecture/software-fixes-lane.md](../architecture/software-fixes-lane.md).

## 1) Decision

| Item | Choice |
| --- | --- |
| Event kind | `ServiceCancel` (marketplace family) |
| Handshake | Paired — first signer proposes (`CancelPending`); counterparty matches |
| Terminal status | `Cancelled` |
| Refund | Full `funded_amount` to buyer (0 if never funded) |
| Reputation | Neutral (no refund_wins / refund_losses) |
| Renegotiate terms | Still new offer/order or paired settle — **not** this event |

## 2) Functional requirements

| ID | Requirement |
| --- | --- |
| **MC-01** | Either buyer or provider may submit the first `ServiceCancel` while milestone is `Open`, `PartiallyFunded`, or `Funded` |
| **MC-02** | First valid cancel moves milestone to `CancelPending` and records pending author + event id |
| **MC-03** | Second cancel must be from the **other** party, reference the pending cancel event, and match `orderId` / `milestoneId` |
| **MC-04** | On match: refund `funded_amount` to buyer lots; set status `Cancelled`; clear pending fields |
| **MC-05** | Reject cancel after `Delivered`, `Accepted`, `Disputed`, `SettlementPending`, `Settled`, `AutoRefunded`, or `Cancelled` |
| **MC-06** | Reject silent / unilateral cancel (single event never terminals) |
| **MC-07** | When all milestones are terminal including `Cancelled`, order status is `closed` |

## 3) Payload

```text
ServiceCancelPayload {
  orderId: string
  milestoneId: string
  cancelledAt: string (RFC3339)
  reasonHash?: string
}
```

References:

| Event | Required refs |
| --- | --- |
| First cancel | `order` → order created event id |
| Matching cancel | `order` → same; `cancel` → first cancel event id |

## 4) Invalid cases (fixtures)

| Case | Expected |
| --- | --- |
| Cancel after delivery | `InvalidStateTransition` |
| Only one cancel in the log (fixture ends pending) | Valid events apply; milestone stays `CancelPending` — **not** a closed cancel claim. Separate invalid: second cancel from same actor |
| Second cancel from same actor | `InvalidStateTransition` |
| Wrong actor (neither buyer nor provider) | `UnauthorizedActor` |
| Cancel after accept | `InvalidStateTransition` |
| Missing `order` / mismatched `cancel` ref | `MissingReference` |

## 5) Explicit non-goals

- Changing price/scope via this event — use `OrderAmend` ([order-amend-design.md](order-amend-design.md)) or new offer/order
- Cancel after delivery (use dispute / settle / timeout)
- Single-party cancel
- Client wizard UI (thin SDK kind string only for this band)

## 6) Claim language

| Claim | Allowed when |
| --- | --- |
| **Mutual cancel verified** | Valid fixture + `cli fixtures run` green; milestone `Cancelled` with refund |
| **OrderAmend shipped** | Separate band — see [order-amend-design.md](order-amend-design.md) |

## 7) Proof

- `cargo test -p protocol-core -p state-engine`
- `cargo run --bin cli -- fixtures run` including `marketplace-mutual-cancel.jsonl` and invalid siblings
