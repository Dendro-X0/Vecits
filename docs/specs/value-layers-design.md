# Value layers design

Purpose: normative L1/L2/L3 rules for Vectis credits vs persistent world value — anti-financial conversion only.

Status: `locked`

Last updated: July 2026

Prerequisite research: [value-layers-and-credits-investigation.md](value-layers-and-credits-investigation.md)  
Practice: [staged-exchange-practice-design.md](staged-exchange-practice-design.md) · [../runbooks/staged-exchange-operator-runbook.md](../runbooks/staged-exchange-operator-runbook.md)

Related: [../foundation/economic-protocol-v1.md](../foundation/economic-protocol-v1.md), [restart-decisions.md](restart-decisions.md) (D6).

## 1) Locked decisions

| ID | Decision |
| --- | --- |
| **VL-D1** | Prefer the word **credits** (coordination fuel). Avoid coin/token/points-as-wealth in product copy. |
| **VL-D2** | **L1** credits are account-bound, sink-bound, expiring lots — not transferable, not inheritable, not a store of value. |
| **VL-D3** | **L2** reputation and delivery history are the durable in-protocol upside — not convertible into credits. |
| **VL-D4** | **L3** world artifacts (code, compute results, goods, API access grants) persist outside the ledger; the log records evidence and acceptance, not equity or royalties. |
| **VL-D5** | No telemetry mint, no royalty credits, no passive yield on past work. Ongoing value uses **new milestones** or stays L3-only. |
| **VL-D6** | Value moves at **milestone close** (accept / settle / timeout path), not as a continuous balance accrual. |

## 2) Layer diagram

```text
L3  World value (persistent artifacts / access / goods)
L2  Reputation & delivery history (durable, non-financial)
L1  Credits / lots (ephemeral coordination fuel → escrow → gone)
```

## 3) Conversion (allowed)

| From → To | Mechanism |
| --- | --- |
| Confirmed work → L1 | Contribution mint or marketplace close reward lots (expiring) |
| L1 → work | `SpendCredits` into escrow → delivery → accept |
| Residual L3 use → more L1 | Only a **new** order/milestone with fresh evidence |
| L2 ↔ L1 | Never direct conversion |

## 4) Explicit non-goals

- Securitizing L3 assets as credit claims
- Transferable API-credit balances inside Vectis that outlive escrow procedure
- Admin revaluation of lots
- Fiat/crypto FX pricing of credits

## 5) Client obligations

- Hero durable metrics: delivery history / reputation — not “savings”
- Show lot expiry where balances appear
- Staged digital vs offline one-shot guidance per [staged-exchange-practice-design.md](staged-exchange-practice-design.md)
