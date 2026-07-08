# Market Operating Model

Purpose: describe how Vectis is intended to operate in real markets — P2P transactions across operator-run stores, unmanned dispute handling, and honest limits on what protocol algorithms can fix.

Status: `locked`

Last updated: July 2026

## Summary

Vectis does not replace human judgment for subjective fairness. It **narrows** what a dispute means to signed procedural states, escrowed milestones, time-bounded windows, and deterministic default outcomes when cooperation stops.

Social engineering, off-platform promises, and quality disagreements remain **residual risks** documented explicitly — not hidden behind false claims of full automation.

**Core doctrine:** the smart protocol **prioritizes transaction specifications over identity** when handling economic exchange. Identity (vouches, reputation) gates admission and visibility; **transaction rules** (escrow, evidence, references, timeouts) prevent fraud and free-rider extraction on everything that appears as a signed economic contract on the controllable platform.

## Transaction specs over identity

Vectis does not try to solve trust by proving “who someone really is.” It makes **in-protocol economic contracts hard to game**.

| Concern | Primary lever | Secondary lever |
| --- | --- | --- |
| Fraud / free services | Transaction spec: escrow-before-work, evidence formats, acceptance windows, dispute timeouts | Reputation and dispute telemetry after the fact |
| Sybil admission | Vouches, eligibility thresholds (bootstrap phase) | Delivery history weighting over time (D7) |
| Settlement truth | Signed events + deterministic replay | Never client UI state or off-log promises |

**Implication:** engineering effort goes first to **AB-01..AB-14** (forgery, replay, overfund, unauthorized actors, malformed logs) and marketplace state machines — not KYC, not identity scoring as settlement authority.

Identity answers: *“May this key attempt this action?”*  
Transaction spec answers: *“Did this milestone close correctly, or fail closed?”*

The most reliable anti-fraud approach is a protocol where:

- work does not start without **in-log escrow**
- delivery requires **lane-valid evidence**
- accept/dispute/settle require **authorized signatures within windows**
- stalemate triggers **deterministic default outcomes** (auto-refund, loss profiles)
- invalid or gaming attempts **reject with stable reason codes** — same rigor as technical fraud

## In-protocol contracts vs secondary market (off-platform settlement)

The hardest residual problem is the **secondary market**: users treat Vectis as coordination/chat, then settle in fiat, crypto, or external URLs — the classic freelance redirect scam (SOC-01).

```text
┌─────────────────────────────────────────────────────────────┐
│  Secondary market (NOT controllable)                          │
│  PayPal, bank transfer, crypto, external sites, DMs         │  ← human choice; out of kernel
├─────────────────────────────────────────────────────────────┤
│  Communication / discovery (partially controllable)         │
│  Storefront UI, messaging hooks, link policies                │  ← warnings, UX friction
├─────────────────────────────────────────────────────────────┤
│  In-protocol economic contracts (FULLY controllable)          │
│  Offer → Order → Escrow → Deliver → Accept/Dispute → Close  │  ← treat as fraud-critical
└─────────────────────────────────────────────────────────────┘
```

**Boundary rule:**

| Domain | Vectis stance |
| --- | --- |
| Off-platform settlement | **Beyond control.** Document limits (SOC-01). Never represent off-log payment as protocol truth. |
| On-platform economic events | **Fully controllable.** Apply the same seriousness as technical fraud — fail closed, no partial apply, fixture-proven invariants. |

Human redirect actions cannot be eliminated. The protocol must not pretend they were settled in-log. Conversely, **any economic contract that appears on the controllable platform** (signed events ingested to the log) must satisfy the full transaction spec — there is no “soft path” for marketplace settlement.

Storefronts and operators should:

1. **Never** label off-platform payment as protected by Vectis escrow.
2. **Never** show “completed” or “paid” without kernel-confirmed milestone state (AB-15).
3. **Treat in-log marketplace flows as fraud-critical** — same test discipline as AB matrix entries.
4. **Warn at onboarding** that credits ≠ fiat/crypto and off-platform deals bypass reputation close-out ([../runbooks/operator-security-guide.md](../runbooks/operator-security-guide.md)).

Redirect-to-URL patterns (SOC-01 variant): clients may surface warnings when offer/order copy references external payment rails; kernel remains agnostic because those promises are not ingested events.

## Trust bootstrap (early public phase)

Steady-state design (D7) assumes a web-of-trust graph. **Genesis** does not. Early public operation requires an explicit bootstrap — transparent founding vouchers, operator-scoped stores, policy-limited blast radius, then tightening via forward `PolicyUpdate`.

| Phase | Trust source | Risk cap |
| --- | --- | --- |
| 0 — Inspectability | Pinned node, public replay, deterministic timeouts | Low milestone caps; narrow lanes |
| 1 — Founding cohort | Published maintainer/operator vouches on-log | Documented sponsor pubkeys; no dispute override |
| 2 — Delivery history | Successful accepts outweigh raw vouch count | EC telemetry; dispute-rate decay |
| 3 — Policy tighten | Raised eligibility thresholds via signed policy updates | Sunset bootstrap parameters |

**Admission trust** may start centralized in a small visible cohort. **Settlement trust** never does — escrow, evidence, and dispute clocks apply equally from the first transaction.

Clients should label trust phase honestly (e.g. “Founding network”) and separate **sponsor-weighted admission** from **kernel-confirmed settlement**.

## Design stance

| Principle | Implication |
| --- | --- |
| No central executive | Kernel cannot override signed settlement paths with admin judgment |
| Deterministic consequences | Disputes resolve via policy clocks and state machines, not case-by-case review |
| Narrow lanes first | Only service types with objective evidence belong in unmanned settlement |
| Protocol ≠ platform | Many storefronts; one replayable settlement layer |
| Explicit limits | Subjective QA, KYC, legal enforcement, and chat moderation are out of kernel scope |
| Transaction over identity | Fraud prevention lives in escrow/evidence/state machines, not identity proof |
| Secondary market honesty | Off-platform settlement is uncontrollable; in-log contracts get full anti-fraud rigor |
| Mutual amendment | Economic terms change only by mutual signed events; no admin rewrite |

See also: [design-principles.md](design-principles.md), [../specs/restart-decisions.md](../specs/restart-decisions.md) (D1, D8, D9), [../specs/security-resilience-spec.md](../specs/security-resilience-spec.md), [limitations-and-disclaimers.md](limitations-and-disclaimers.md).

## Mutual amendment and user autonomy

Vectis has **no centralized human oversight** inside the kernel — and **high user autonomy** outside it. Strictness applies to **procedure** (escrow, evidence gates, windows, authorization, timeouts). **Terms** (price, scope, milestones, deadlines, split outcomes) are negotiable when both parties record agreement as signed events.

**Locked principle:**

> Parties may change economic terms only by mutual signed events. The kernel enforces procedure, not subjective fairness, except where lane templates and policy caps bind evidence and amounts.

### Procedure vs terms

| Layer | Fixed by protocol | Negotiable by parties |
| --- | --- | --- |
| Procedure | Escrow-before-work, evidence format, accept/dispute windows, settle handshake, timeout defaults | — |
| Terms | Lane template bounds, policy caps | Price, milestone amounts, criteria hashes, delivery scope, paired settle split |

Subjective satisfaction (“was the work good enough?”) remains **off-protocol** or exits to real-world resolution ([limitations-and-disclaimers.md](limitations-and-disclaimers.md)).

### How renegotiation works (v0)

The log is append-only. Parties do not edit prior events; they add new authorized events:

| Intent | v0 mechanism | Notes |
| --- | --- | --- |
| New price / scope / deadline | New `ServiceOffer` + new `ServiceOrder` | SOC-02: scope creep → new contract, not chat |
| Compromise during dispute | Paired matching `ServiceSettle` | Both buyer and provider sign same amounts/outcome |
| Community rule changes | Forward `PolicyUpdate` | Operator/policy authority; not per-case override |
| Cancel open milestone | No silent cancel | Terminal states via accept, settle, or timeout only |

A dedicated `OrderAmend` (or similar) event kind is **optional future work** — not required for mutual autonomy if clients guide users through new offer/order flows.

### Autonomy without a platform middleman

- **Identity** is cryptographic keys — not email profiles sold to advertisers.
- **Settlement truth** is replay of public signed events — not operator discretion or a corporate arbitration desk.
- **Hosting** is operator-chosen (self-hosted node, community operator, local desktop sidecar). There is no Vectis Inc. data business; honesty about **who persists the log** is part of the product story ([limitations-and-disclaimers.md](limitations-and-disclaimers.md)).

Ledger-like inspectability ([vectis-vs-blockchain-exploration.md](vectis-vs-blockchain-exploration.md)) without transferable tokens or on-chain VMs.

## Layered responsibility model

```text
┌─────────────────────────────────────────┐
│ Social layer                            │
│ Off-protocol promises, persuasion, chat   │  ← SOC-01..SOC-08; education + UX
├─────────────────────────────────────────┤
│ Application layer                       │
│ Storefronts, onboarding, pinned nodes   │  ← AB-15, operator-security-guide
├─────────────────────────────────────────┤
│ Protocol layer                          │
│ Escrow, milestones, dispute timeouts    │  ← AB-01..AB-14; state-engine replay
├─────────────────────────────────────────┤
│ Persistence layer                       │
│ Append-only log, snapshot integrity     │  ← AB-14, RES-07 hash chain (R3)
└─────────────────────────────────────────┘
```

**Rule:** each layer owns what it can prove. Upper layers must not pretend lower layers decided something they did not.

## Multi-store P2P operation

Operators run **custom-branded stores and marketplaces** on shared Vectis settlement rules ([product-identity.md](product-identity.md)).

| Layer | Who runs it | Authority |
| --- | --- | --- |
| Storefront | Community operator, maintainer, integrator | UX, discovery presentation, lane focus, warnings |
| Node | Each operator | Ingest, sync, query APIs, local persistence |
| Kernel | Same crates/binary everywhere | Escrow, milestone transitions, dispute timeouts, reputation deltas |

Cross-operator convergence: honest nodes that ingest the same valid event log produce the same derived state at the same `as_of`. Sync pull replication transports events; **replay** is the settlement authority.

Disputes are between **identities and milestone records on the log**, not between corporate arbitration teams. Store A and Store B may look different; they cannot silently disagree on whether milestone `M` auto-refunded at `disputedAt + disputeTimeoutSeconds` if they share the log and policy.

## Transaction lifecycle (market view)

1. **Offer** — lane template constrains `serviceType`, `deliveryMode`, `allowedEvidenceFormats`.
2. **Order + escrow** — buyer funds sink-bound credits before work proceeds.
3. **Delivery** — provider submits evidence matching lane format (e.g. artifact hash, receipt template).
4. **Accept or dispute** — buyer acts within acceptance window; both paths require authorized signed events.
5. **Settlement or timeout** — mutual `ServiceSettle` handshake **or** policy clock fires default outcome.
6. **Reputation** — public history updates from terminal milestone state; portable across deployments that replay the same log.

Clients must treat kernel API responses as authoritative ([../specs/security-resilience-spec.md](../specs/security-resilience-spec.md) SR-7, AB-15).

## Unmanned dispute handling

Vectis has no judges. It has **state machines + policy parameters + evidence gates**.

### Milestone dispute state machine (simplified)

```text
Funded → Delivered → Accepted                    (happy path)
                   ↘ Disputed → SettlementPending → Settled   (paired ServiceSettle)
                              ↘ AutoRefunded                  (dispute timeout)
```

Full transition table: [../architecture/v0-spec-outline.md](../architecture/v0-spec-outline.md) (milestone states and synthetic lot rules).

### What the protocol adjudicates without humans

| Situation | Deterministic outcome |
| --- | --- |
| Invalid signature, wrong actor, broken reference | Reject; stable reason code; no state mutation |
| Dispute opened outside acceptance window | Reject |
| Active dispute; no matching settlement before timeout | Auto-refund to buyer per policy |
| Both parties sign matching `ServiceSettle` | Escrow finalizes per outcome (`buyerWins`, `split`, etc.) |
| Settlement handshake deadlock | Policy loss profiles; penalties where defined (D9) |
| Repeat frivolous disputes | Reputation decay + dispute-rate telemetry (SOC-06, EC metrics) |

### What the protocol explicitly does not adjudicate

| Situation | Why it stays outside kernel |
| --- | --- |
| Off-platform payment promise (SOC-01) | Never ingested; not protocol truth |
| Scope creep via chat (SOC-02) | New scope requires new milestone/order |
| Valid hash, useless deliverable (SOC-05) | Subjective quality — lane verifies format, not worth |
| Charm-and-ghost off-log accept (SOC-03) | Reputation/credit close requires in-log events |
| Legal fraud across jurisdictions | No law-enforcement integration (non-goal) |
| Subjective creative disagreement | Lanes exclude open-ended subjective work (D8) |

Restart decision **D9:** deterministic loss profiles; **no human arbitration in kernel**. Third-party attestation is limited to contribution mint paths, not marketplace truth arbitration.

## Social engineering: mitigation without illusion

Social attacks exploit **human bypass** of the protocol. Vectis makes bypass costly and visible; it cannot make it impossible.

| ID | Pattern | Protocol lever | Storefront / operator lever |
| --- | --- | --- | --- |
| SOC-01 | Off-platform payment | Escrow before work; in-log settlement only | Onboarding warning; never show “paid” without kernel confirm |
| SOC-02 | Scope creep | Criteria hashes per milestone; new scope = new order | UI enforces milestone boundaries |
| SOC-03 | Charm-and-ghost | In-log accept required for reputation close | Kernel truth labels in client |
| SOC-04 | Sybil vouch rings | Delivery history weight > vouch count | Discovery rankings informational only |
| SOC-05 | Garbage artifact | Lane template evidence formats | Community norms; narrow lane choice |
| SOC-06 | Dispute spam | Reputation + dispute telemetry | Operator monitoring (SR-6) |
| SOC-07 | Fake node / phishing | Signature verification on replay | Pin `base_url`; security guide |
| SOC-08 | Log tampering | Append-only + startup validation (AB-14); hash chain (R3) | Host hardening, backup verification |

Full matrix: [../specs/security-resilience-spec.md](../specs/security-resilience-spec.md).

## Fairness without a CEO

“Fair” in Vectis means **precommitted rules applied consistently**, not “every participant feels satisfied.”

Acceptable unmanned outcomes:

- Time wins: missed windows forfeit rights to dispute or accept.
- Money-in-escrow wins: funded amount splits only via authorized settlement events or timeout refund.
- History wins: repeat abuse degrades reputation and eligibility (EC-4, dispute counters).

Unacceptable extensions (would break the model):

- Admin override of settlement for “special cases”
- Subjective AI moderation inside kernel replay
- KYC-gated human appeals with settlement reversal power
- Off-log credit transfers treated as authoritative

Kernel boundary spec forbids introducing admin override paths for dispute outcomes.

## Market fit strategy

**Good first lanes** (objective verification): software fixes, documentation, testing, artifact-delivered research, compute jobs with receipt templates, stalled-project maintenance.

**Poor first lanes** (require human judgment): physical goods, vague creative commissions, open-ended freelance, deep social interpretation.

Near-term success criterion ([project-thesis.md](project-thesis.md)): *most* disputes resolve through policy and evidence — not *all*, and not subjective ones.

## Evolution paths (without central judges)

| Direction | Preserves unmanned model because… |
| --- | --- |
| Tighter lane templates | Disputes only on enumerable evidence types |
| Stronger economics controls (EC-1..EC-5) | Bad-faith patterns become expensive |
| Community **policy packs** | Parameter governance, not per-case override |
| Cross-store policy transparency | Users see dispute windows and loss profiles before escrow |
| Log integrity (hash chain) | Detect tampering; does not judge delivery quality |
| Optional attestation (mint paths only) | Third parties vouch for contributions, not marketplace truth |

Deferred open research: [open-questions.md](open-questions.md) (Disputes and protocol outcomes).

## Verification anchors

Dispute behavior is fixture-proven, not aspirational:

- [../v0/v0-scenario-fixture-matrix.md](../v0/v0-scenario-fixture-matrix.md) — SCN-05, SCN-06, lane dispute bundles
- [../v0/v0-abuse-gaming-test-matrix.md](../v0/v0-abuse-gaming-test-matrix.md) — AB-01..AB-14
- `crates/node/tests/api.rs` — accept, dispute, timeout, deadlock parity tests
- `cargo test -p state-engine` — replay stability

## Related docs

- [limitations-and-disclaimers.md](limitations-and-disclaimers.md) — user-facing boundaries; data and hosting honesty
- [product-identity.md](product-identity.md) — Vectis naming; customizable stores
- [project-thesis.md](project-thesis.md) — problem framing and success criteria
- [../architecture/v0-spec-outline.md](../architecture/v0-spec-outline.md) — event kinds and milestone transitions
- [../runbooks/operator-security-guide.md](../runbooks/operator-security-guide.md) — SOC-01, keys, TLS
