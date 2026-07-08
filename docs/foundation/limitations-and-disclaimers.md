# Limitations and Disclaimers

Purpose: plain-language boundaries for operators, integrators, and end users — what Vectis is, what it is not, and where real-world resolution applies.

Status: `locked`

Last updated: July 2026

## What Vectis is

Vectis is **open-source coordination software**: a signed event log, deterministic replay, and operator-run nodes. It is not a company, bank, payment processor, insurer, escrow agent, or court.

Credits are **in-protocol coordination units** — account-bound, non-transferable, expiring. They are not fiat money, deposits, investments, or withdrawable cryptocurrency.

## What the protocol guarantees

For economic contracts **ingested to the log**, the kernel applies precommitted rules consistently:

- authorized actors only
- escrow before funded work states
- lane-valid evidence shapes
- acceptance and dispute windows
- deterministic defaults when cooperation stops (including timeout refund)

Same log and policy at the same `as_of` → same derived state on honest replay.

## What the protocol does not guarantee

| Topic | Stance |
| --- | --- |
| Subjective quality or fairness | Lane verifies **evidence format**, not worth (SOC-05) |
| Off-platform payment | PayPal, bank, crypto, DMs — **not protocol truth** (SOC-01) |
| Legal outcomes | No jurisdiction, no binding judgment across courts |
| Physical-world enforcement | Servers can be seized; operators control ingest |
| Perfect satisfaction | Clock-driven defaults may favor one party by design |

When procedural rules exhaust, parties may pursue mediation, courts, informal repair, or simply stop using the protocol.

## User autonomy and mutual amendment

Parties may change price, scope, milestones, or deadlines **only by mutual signed events** on the log. The kernel enforces **procedure**; substance is what both keys agreed to ingest, subject to lane templates and policy caps.

See [market-operating-model.md](market-operating-model.md) (Mutual amendment and user autonomy).

## Data and decentralization

| Claim | Accurate framing |
| --- | --- |
| No single company owns the protocol | True — open spec and reference implementation |
| Ledger-like, inspectable history | True — append-only events, cryptographic authorship |
| Identity is keys, not ad profiles | True — no built-in data brokerage business model |
| Zero servers anywhere | **Misleading** — each operator runs a node (self-hosted, community, or personal hardware) |
| Data never leaves your control | True when you **self-host** the node and keys; otherwise data resides where that operator persists the log |

Clients and operators should state **who hosts the node** and **which base URL is pinned**, not imply a absent central cloud.

## Operator and integrator duties

1. Never label off-platform settlement as Vectis-protected escrow.
2. Never show “paid” or “completed” without kernel-confirmed milestone state (AB-15).
3. Surface SOC-01 warnings at onboarding and marketplace entry.
4. Document node host, backup, and key handling ([../runbooks/operator-security-guide.md](../runbooks/operator-security-guide.md)).

## Software warranty

The project is provided **as-is** under its open-source license. Maintainers do not operate a universal network, hold user funds, or arbitrate disputes.

## Related docs

- [market-operating-model.md](market-operating-model.md) — transaction doctrine, dispute limits
- [collaboration-value-doctrine.md](collaboration-value-doctrine.md) — exit to legal systems
- [vectis-vs-blockchain-exploration.md](vectis-vs-blockchain-exploration.md) — ledger semantics without chain baggage
- [../specs/security-resilience-spec.md](../specs/security-resilience-spec.md) — SOC-01..SOC-08
- [../runbooks/operator-security-guide.md](../runbooks/operator-security-guide.md) — SOC-01 operator section
