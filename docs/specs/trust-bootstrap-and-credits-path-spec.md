# Trust Bootstrap and Credits Path Spec

Purpose: lock how a **cold-start network** gains spendable credits and provider admission without breaking settlement invariants (D6, D7).

Status: `locked`

Last updated: July 2026

Related: [restart-decisions.md](restart-decisions.md) (D6, D7), [../foundation/market-operating-model.md](../foundation/market-operating-model.md) (Trust bootstrap), [../foundation/economic-protocol-v1.md](../foundation/economic-protocol-v1.md), [../architecture/software-fixes-lane.md](../architecture/software-fixes-lane.md).

## 1) Problem statement

Steady-state Vectis assumes:

- providers meet `incoming_vouch_score >= provider_eligibility_threshold` before `ServiceOffer`
- buyers hold sink-bound credits before `SpendCredits` into escrow
- marketplace close events mint provider rewards (synthetic lots)

**Genesis has none of this.** A pubkey with score `0` cannot post offers; a pubkey with balance `0` cannot fund escrow. The protocol must define an **explicit bootstrap path** that is replay-visible, policy-bounded, and honest about admission vs settlement.

**Non-goal:** simulate fiat on-ramps, airdrops, or admin mint buttons.

## 2) Separation of concerns

| Layer | Question | Mechanism | Fraud posture |
| --- | --- | --- | --- |
| **Admission trust** | May this key post offers? | `Vouch` graph + `provider_eligibility_threshold` | Sybil resistance; visible founding cohort |
| **Spending power** | May this key fund escrow? | `MintCredits` (contribution) or prior marketplace close lots | Human-confirmed issuance only |
| **Settlement trust** | Did this exchange close correctly? | Escrow, evidence, windows, settle handshake | Full procedure guards (GAP-01..07) |

**Locked rule:** admission trust may start centralized in a small visible cohort. **Settlement trust never does** — escrow and evidence apply from transaction one.

## 3) Credits path (buyer side)

End-to-end coordination fuel for a first marketplace purchase:

```text
IdentityCreate (buyer)
  → ContributionClaim (buyer)
  → ContributionAttest × N (distinct attestors, N ≥ claim_approval_threshold)
  → MintCredits (buyer, mintReason=contribution, references.claim)
  → SpendCredits (buyer, sinkKind=ServiceEscrowSink, orderId, milestoneId)
  → … marketplace exchange …
```

### Kernel gates (implemented)

| Step | Policy knob | Default (`v0-default`) | Reject reason (stable) |
| --- | --- | --- | --- |
| Attest | `attestor_eligibility_threshold` | `1` | attestor below threshold |
| Mint | `claim_approval_threshold` | `2` | insufficient approvals |
| Mint | `max_contribution_claim_credits` | `1000` | claim amount over cap |
| Mint | `mintReason` | `contribution` only | phase 1 only supports contribution minting |
| Spend | `allowed_sink_kinds` | includes `ServiceEscrowSink` | unsupported sink |

### Fixture evidence

| Stage | Fixture | Scenario ID |
| --- | --- | --- |
| Claim → mint → spend | `fixtures/valid/claim-mint-spend.jsonl` | SCN-02 |
| Spend → accept close | `fixtures/valid/marketplace-accept.jsonl` | SCN-04 |

**Operator note:** contribution mint is the **only** net-new issuance path before first marketplace close. Clients must not imply credits are purchasable with fiat.

## 4) Trust bootstrap path (provider side)

End-to-end admission for a first `ServiceOffer`:

```text
IdentityCreate (provider)
  → Vouch (sponsor₁ → provider)
  → Vouch (sponsor₂ → provider)   # until sum(weights) ≥ threshold
  → ServiceOffer (provider)
```

### Kernel gate (implemented)

```text
incoming_vouch_score(provider) = sum(active, non-revoked, non-expired Vouch.weight)
reject ServiceOffer if score < provider_eligibility_threshold
→ "provider does not meet trust threshold"
```

Default threshold: **`2`** (`crates/policy/src/lib.rs`).

### Fixture evidence

| Case | Fixture | Scenario ID |
| --- | --- | --- |
| Eligible after founding vouches | `fixtures/valid/bootstrap-provider-vouch-eligibility.jsonl` | SCN-17 |
| Reject below threshold | `fixtures/invalid/marketplace-offer-below-trust-threshold.jsonl` | SCN-17 |

Existing marketplace fixtures already include the two-vouch prefix; SCN-17 isolates the **admission gate** explicitly.

## 5) Phased public bootstrap (operator playbook)

Maps to [market-operating-model.md](../foundation/market-operating-model.md) Trust bootstrap:

| Phase | Operator action | Policy levers | Risk cap |
| --- | --- | --- | --- |
| **0 — Inspectability** | Pin node, publish replay endpoint, document lanes | `max_milestone_credits`, narrow `allowed_service_types` | Low caps; `software-fixes` only |
| **1 — Founding cohort** | Publish sponsor pubkeys; ingest founding `Vouch` events on-log | `provider_eligibility_threshold` (may stay `2`) | Documented sponsors; no dispute override |
| **2 — Delivery history** | Prefer providers with accepts in replay | Discovery ranking weights delivery over raw vouches (client/operator) | EC telemetry |
| **3 — Policy tighten** | Signed `PolicyUpdate` raises thresholds, lowers caps | `provider_eligibility_threshold`, `max_milestone_credits`, P2H issuance limits | Sunset bootstrap parameters |

**Phase 1 does not require kernel changes.** Founding sponsors sign `Vouch` events; providers cross the existing threshold; buyers use SCN-02 mint path.

**Phase 3** uses forward-only `PolicyUpdate` — already proven (SCN-07).

## 6) First exchange composition (reference lane)

A complete cold-start **software-fixes** exchange composes proven slices:

```text
[SCN-17] founding vouches → provider offer eligible
[SCN-02] buyer mints credits from contribution
[SCN-04] order → escrow → delivery → accept → provider reward lot
```

No new event kinds required for v1 bootstrap.

Renegotiation (v0): new `ServiceOffer`/`ServiceOrder` or paired `ServiceSettle` — no `OrderAmend` yet ([restart-decisions.md](restart-decisions.md), market-operating-model mutual amendment).

## 7) Deferred (does not block bootstrap)

| Item | Track | Notes |
| --- | --- | --- |
| Delivery-history-weighted discovery ranking | R3 / operator | Off-log ranking; replay inputs only |
| P2H issuance rate limits | Policy fields exist; defaults `0` | **SCN-19** — `npm run generate:p2h-policy-fixtures` |
| `GAP-08` offline `physical-handoff` | R6 | Separate lane; not genesis path |
| Fiat/crypto on-ramp | Out of scope | SOC-01 warnings only |

## 8) Verification commands

| Proof | Command |
| --- | --- |
| L1 — unit/replay | `cargo test` |
| L2 — fixture bundle | `cargo run --bin cli -- fixtures run` |
| L3 — bootstrap slice | `cargo run --bin cli -- log replay --in fixtures/valid/bootstrap-provider-vouch-eligibility.jsonl` |
| L4 — operator genesis | `npm run r2:genesis-drill` + publish `founding-sponsors.json` ([operator-genesis-runbook.md](../runbooks/operator-genesis-runbook.md)) |

## 9) Client / operator obligations (non-kernel)

- Label trust phase honestly (e.g. "Founding network")
- Separate sponsor-weighted admission from kernel-confirmed settlement
- Surface [limitations-and-disclaimers.md](../foundation/limitations-and-disclaimers.md) at onboarding
- Never imply credits are money or withdrawable

Kernel implementation for this spec is **complete**; remaining work is operator documentation and optional client labeling (R7, not blocking protocol).
