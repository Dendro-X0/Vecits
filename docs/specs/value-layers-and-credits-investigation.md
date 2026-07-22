# Value layers and credits — investigation

Purpose: re-examine Vectis “points” (credits) against **ephemeral coordination fuel** vs **persistent world value**, and lock how conversion stays **anti-financial**.

Status: `locked` (research complete — design locked)

Last updated: July 2026

**Follow-on design (locked):** [value-layers-design.md](value-layers-design.md) · Practice: [staged-exchange-practice-design.md](staged-exchange-practice-design.md)

Related: [../foundation/economic-protocol-v1.md](../foundation/economic-protocol-v1.md), [../foundation/project-thesis.md](../foundation/project-thesis.md), [restart-decisions.md](restart-decisions.md) (D6), [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md), [../foundation/market-operating-model.md](../foundation/market-operating-model.md).

## 1) Question

Credits are not a cryptocurrency: non-transferable, non-inheritable, time-bound lots that are spendable into sinks and then gone from spendable capacity. That is an excellent anti-speculation medium.

But some created value **persists** in the world (software that keeps running, documentation that keeps teaching, infrastructure that keeps serving). How should an anti-financial protocol handle **conversion** among:

- ephemeral coordination units
- persistent useful artifacts
- ongoing / “passive” streams of usefulness

…without turning those streams into speculative claims?

## 2) Terminology (use these, not “coin”)

| Term | Meaning in Vectis |
| --- | --- |
| **Credit / lot** | Account-bound, sink-bound, expiring **coordination access right** |
| **Points** (colloquial) | Same as credits — prefer **credits** in specs/UI |
| **Reputation / delivery history** | Replay-visible **durable coordination position** — not a balance |
| **World artifact** | Real good or digital resource outside the ledger (repo, file, machine time, physical item) |
| **Passive stream** | Ongoing usefulness after creation (uptime, readers, residual use) — **not** a Vectis asset class |

Credits are **not** randomly meaningless noise: they are **cryptographically attributed lots** with issuance reason, expiry, and sink constraints. They are “concept-like” only in that they have **no external price** and **no residual claim** after spend/expiry.

## 3) Three-layer value model (locked research frame)

```text
┌─────────────────────────────────────────────────────────────┐
│ L3  World value (persistent)                                  │
│     Artifacts, running systems, physical goods, human skill   │
│     Protocol records evidence / acceptance — not ownership of │
│     future cashflow                                           │
├─────────────────────────────────────────────────────────────┤
│ L2  Social-economic position (durable, non-financial)         │
│     Reputation, delivery history, vouch graph, eligibility    │
│     Affects admission & discovery — not transferable wealth   │
├─────────────────────────────────────────────────────────────┤
│ L1  Coordination fuel (ephemeral)                             │
│     Credits/lots → escrow sinks → burned / settled            │
│     Exist to make a deal possible; not to store value         │
└─────────────────────────────────────────────────────────────┘
```

**Doctrine already in v1 economics:** balances are short-lived capacity to request help; reputation is durable position ([economic-protocol-v1.md](../foundation/economic-protocol-v1.md) §3). Restart D6: durable value = reputation and verified delivery history — not credit stockpiles.

## 4) Why L1 must stay anti-accumulative

Gig-economy and scam dynamics reward **hoardable bait**. If L1 can be saved, transferred, inherited, or marked-to-market:

- scammers demand “fees” denominated in the unit
- speculation appears (buy low / wait / extract)
- passive income fantasies attach to the balance

Therefore L1 invariants remain non-negotiable: no transfer, no inheritance, no store-of-value, no speculative upside, sink-bound spend, expiry/demurrage.

**Spend is the point:** a lot that funds escrow and closes is doing its job when it **vanishes as spendable capacity**. Persistence of *usefulness* must not require persistence of *points*.

## 5) Where persistent value lives (and must not migrate into L1)

| Kind of lasting worth | Correct home | Forbidden encoding |
| --- | --- | --- |
| Shipped software / docs / research | L3 artifact + L2 delivery history | “Tokenized equity” credits that grow with usage |
| Ongoing ops / uptime / hosting | Recurring **milestones** (new L1 spends + new evidence) or off-protocol ops | Dividend-like automatic credit drip from past work |
| Physical good that still exists | L3 + lane evidence of handoff; future deals are new orders | Balance that “represents” the object |
| Skill / reputation | L2 | Transferable “prestige points” |
| Residual attention / SEO / fans | Outside protocol (or discovery signals only) | Monetized credit mint from views |

**Rule:** lasting worth may **justify future coordination preference** (L2) or **new confirmed exchanges** (fresh L1 issuance on close). It must not become a **claim on future protocol units** without new human-confirmed work.

## 6) Conversion map (anti-financial)

Conversion is allowed only as **procedure**, never as **price discovery**.

| From → To | Allowed mechanism | Notes |
| --- | --- | --- |
| L3 work → L1 | Marketplace close / contribution mint (human-confirmed) | Provider reward lots expire; not savings |
| L1 → L3 | Escrow → delivery evidence → accept | Fuel purchases coordination, not equity |
| L3 residual use → L2 | Delivery history / reputation deltas already on accept | No automatic mint from “still being used” |
| L3 residual use → L1 | **Only** via a **new** order (maintenance, support, new milestone) | Forces re-proof of capacity |
| L2 → L1 | **Never** direct | Reputation is not convertible to credits |
| L1 → L2 | Indirect: honest closes update history | Burning fuel can improve standing; standing is not cash |
| Off-platform fiat ↔ L1 | **Never in-protocol** | SOC-01 |

### Ongoing / “passive” streams — the hard case

Passive usefulness is real. Encoding it as yield on points recreates finance.

**Vectis posture:**

1. **Acknowledge L3 persistence** without ledgerizing NPV.
2. **If parties want ongoing exchange**, use **time-boxed recurring milestones** (each period: escrow → evidence → accept → new expiring lots). That is cooperation, not coupon clipping.
3. **If no new human confirmation**, the stream stays L3 only; the creator’s in-protocol durable upside is L2 (easier admission, better discovery weight), not a swelling balance.
4. **Never** mint credits from telemetry alone (downloads, uptime pings, ad views) — that is farmable and speculative.

## 7) Speculation surfaces to refuse

| Temptation | Why it fails Vectis |
| --- | --- |
| Credits as savings | Violates no store-of-value |
| Credits backed by future revenue | Securitization |
| Transferable royalty points | Reintroduces currency + scam bait |
| Admin “value adjustment” of lots | Admin arbitration / politics |
| Pricing L3 assets in credits as FX | External price oracle = financialization |

Anti-scam alignment: scammers need a unit that looks like money. Ephemeral sink-bound lots plus L2 history without cash-out are hostile to fee-extraction stories.

## 8) Client / language implications

- Prefer **credits** / **coordination fuel** over “points,” “coins,” “tokens,” “earnings balance.”
- Show **lots with expiry**, not a single wealth number as hero metric.
- Surface **delivery history / reputation** as the durable panel.
- When describing rewards after accept: “expiring coordination capacity,” not “you got paid.”
- Recurring value: UI should push **next milestone**, not “claim passive points.”

## 9) Open parameters (do not block doctrine)

These remain policy-tunable and do not change the layer model:

- demurrage / expiry curves per community pack
- how strongly L2 weights recent vs lifetime delivery
- whether maintenance lanes get distinct templates
- caps on reward lot size relative to escrow (already policy-shaped)

## 10) Verdict

| Claim | Verdict |
| --- | --- |
| Credits should be non-accumulative and spend-to-vanish | **Correct** — keep |
| Persistent world value must be represented as durable credits | **Reject** — that is financialization |
| Persistent value has a home in Vectis | **Yes** — L3 reality + L2 history; L1 only for fresh coordination |
| Passive streams need yield-bearing points | **Reject** — use recurring evidenced milestones or leave as L3 |
| Anti-financial and “lasting worth” are compatible | **Yes**, if conversion never turns residual use into hoardable claims |

## 11) Follow-on artifacts

**Locked:** [value-layers-design.md](value-layers-design.md) · [staged-exchange-practice-design.md](staged-exchange-practice-design.md) · [../runbooks/staged-exchange-operator-runbook.md](../runbooks/staged-exchange-operator-runbook.md).

Optional next: SX-S5 multi-milestone maintainer drill documentation (no new event kinds).
