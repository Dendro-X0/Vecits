# Economic Protocol Spec v1

This document defines the first explicit economics-layer spec for the project.

It is intentionally anti-financial: the goal is reliable human coordination, not capital accumulation.

## 1) Design objective

The protocol should make useful human-to-human exchange practical in decentralized environments while reducing:

- labor extraction
- freelancing scams
- platform dependency
- token speculation incentives
- bot/script farming pressure

The medium of exchange is a coordination resource, not money.

## 2) Non-negotiable economic invariants

The v1 economics model must preserve these constraints:

1. **No fiat or external crypto settlement in-protocol**
   - protocol validity does not depend on USD, stablecoins, or exchange rates.
2. **No transferability**
   - coordination credits cannot be transferred between accounts.
3. **No inheritance**
   - credits cannot be reassigned after account loss or death.
4. **No durable store-of-value**
   - credits expire and/or demurrage applies by default.
5. **No speculative upside**
   - credits cannot be traded as investment assets.
6. **No admin arbitration**
   - disputes resolve through deterministic protocol transitions only.
7. **Human-confirmed issuance**
   - net-new spending power is created only from protocol-confirmed human exchange outcomes.

## 3) Medium semantics (credits as access rights)

Credits are modeled as **decaying, account-bound access rights**:

- account-bound: spendable only by the owning identity root
- sink-bound: spendable only into allowed sink types
- time-bound: lots include deterministic expiry/demurrage
- purpose-bound: issuance reason is explicit and auditable

Economic interpretation:

- credit balances represent short-lived capacity to request help/resources
- reputation history represents durable social/economic position

## 4) Issuance and settlement rules

### 4.1 Issuance sources

Only protocol-valid events may create lots:

- contribution mint flow (claim/attest threshold reached)
- marketplace close events (accept/settle/auto-refund synthetic lots)

No arbitrary mint paths.

### 4.2 Issuance gating

Issuance must remain contingent on direct exchange confirmation paths already modeled by state transitions:

- accepted milestone completion
- deterministic settlement outcomes
- deterministic timeout outcomes

### 4.3 Non-hoarding enforcement

- expiry windows remain mandatory
- demurrage remains mandatory
- lot selection remains deterministic (earliest-expiry first)

## 5) P2H (Proof of Human-to-Human) direction

P2H is a protocol-level anti-automation posture, not a single mechanism.

v1 target behavior:

- reward throughput should be constrained by credible human interaction paths
- repeated bilateral interactions should be less valuable than broader graph-confirmed exchange
- low-friction automation should not scale issuance efficiently

Candidate enforcement layers (to evolve in future tracks):

- trust-threshold requirements for attestors/providers
- per-identity issuance rate limits tied to trust/reputation quality
- reciprocity and counterparty-diversity weighting
- interaction-friction challenges for suspicious issuance patterns

## 6) Anti-abuse threat model

The economics layer must explicitly resist:

1. **Sybil farms**
   - many fake identities attempting coordinated attest/mint loops.
2. **Scripted self-dealing**
   - automated bilateral loops to farm issuance.
3. **Reputation laundering**
   - rotating keys/accounts to reset penalties while preserving upside.
4. **Escrow abuse**
   - overfunding/under-delivery patterns and timeout gaming.
5. **Phishing/scam extraction**
   - one-shot high-yield fraud incentives from transferable assets.

Required posture:

- make expected scam ROI negative compared with normal contribution
- tie durable upside to long-lived public behavior
- keep deterministic invalid reasons stable and inspectable

## 7) Multi-context exchange scope

This economic model supports:

- digital services and skills
- digital resources (compute/AI/storage sinks)
- constrained offline exchange lanes in local-network contexts

For offline/local-network lanes, the protocol remains authoritative only over signed events and deterministic settlement logic; physical delivery trust is still represented via explicit protocol transitions and timeout/settle outcomes.

## 8) Economic observability and success metrics

The protocol should be evaluated with explicit metrics (not token price):

- confirmed completion rate per lane
- dispute rate and dispute resolution latency
- repeat-counterparty diversity
- issuance-to-expiry ratio (hoarding pressure proxy)
- concentration risk (top-N share of active spend rights)
- invalid-event rate by abuse code family
- newcomer time-to-first-valid-earning

A release is economically healthier only if these metrics improve without introducing central moderation.

## 9) Spec-to-implementation map

Near-term implementation alignment:

- keep credits non-transferable and decaying
- keep mint flows event-driven and threshold-gated
- keep settlement fully deterministic and adminless
- extend read APIs for economic health telemetry
- prioritize anti-automation constraints as protocol rules, not operator policy

## 10) Open economics questions for next phase

1. What minimum P2H friction gives bot resistance without harming real users?
2. Should issuance caps vary by lane risk profile?
3. How should reputation penalties/rewards be bounded to avoid runaway incumbency?
4. Which offline exchange templates are objective enough for deterministic enforcement?
5. Which metrics become hard protocol alarms vs. external monitoring only?
