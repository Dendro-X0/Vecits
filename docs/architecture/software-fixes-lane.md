# Software Fixes Lane

Purpose: lock the **reference v1 digital lane** for bounded bugfix and CI-repair work — protocol contract, evidence meaning, in-scope outcomes, and explicit limits.

Status: `locked`

Last updated: July 2026

Deployment proof lane (with `project-maintenance`): [../specs/restart-decisions.md](../specs/restart-decisions.md) D5.

## Lane contract

| Field | Value |
| --- | --- |
| `serviceType` | `software-fixes` |
| `unitDefinition` | `fix per issue` |
| `deliveryMode` | `artifact` |
| `allowedEvidenceFormats` | `artifactHash` |
| Milestone `evidenceFormat` | `artifactHash` |
| Template `strict` | `false` |

Canonical template source: `apps/web/app/components/marketplace-event-builder.tsx` (`SERVICE_LANE_TEMPLATES`).

## What a transaction is

One **bounded fix** per milestone — not open-ended maintenance, not vague “help with my project.”

Good fits:

- failing CI on a named crate or repo
- reproducible defect with a scoped patch
- bounded config or dependency fix with verifiable artifact

Poor fits (use another lane or stay off-protocol):

- open-ended feature work → `feature-work`
- subjective code review without deliverable → off-protocol
- physical goods or in-person work → offline lanes (experimental)

## Evidence (`artifactHash`)

### Protocol verifies

- `ServiceDelivery.evidenceFormat` is allowed on the offer
- at least one `artifactHashes` entry
- delivery references a funded `Delivered`-eligible milestone
- provider is authorized for the order

### Protocol does not verify

- hash matches a real git commit or file (SOC-05)
- CI actually passes after applying the patch
- fix resolves the buyer’s underlying problem

**Semantic guidance** (off-protocol, community norm): providers should hash deliverables buyers can independently check — e.g. patch tarball SHA-256, commit hash, CI log archive hash. Buyers should record **acceptance criteria hashes** in order metadata or milestone notes before funding escrow ([market-operating-model.md](../foundation/market-operating-model.md) SOC-02).

## Standard exchange shape

```text
ServiceOffer (software-fixes)
  → ServiceOrder (milestones + criteria)
  → SpendCredits (ServiceEscrowSink)
  → ServiceDelivery (artifactHashes)
  → ServiceAccept | ServiceDispute
  → [Settled | AutoRefunded] if disputed
```

Renegotiation (price, scope, deadline): new offer/order by mutual signed events — [market-operating-model.md](../foundation/market-operating-model.md) (Mutual amendment).

## Fixture anchors

| Scenario | Fixture |
| --- | --- |
| Happy path accept | `fixtures/valid/marketplace-accept.jsonl` |
| Dispute + paired settle | `fixtures/valid/marketplace-dispute-settle.jsonl` |
| Dispute + timeout refund | `fixtures/valid/marketplace-timeout-autorefund.jsonl` |
| Unauthorized delivery | `fixtures/invalid/marketplace-unauthorized-delivery.jsonl` |

Verify: `cargo run --bin cli -- fixtures run`

## Out of scope

- Subjective quality arbitration in kernel
- Off-platform payment (SOC-01)
- Automatic CI or GitHub integration (client/operator tooling later)
- `OrderAmend` event kind (optional future; v0 uses new offer/order)

## Related docs

- [lane-template-catalog.md](lane-template-catalog.md) — all community lane templates (R6-L2)
- [stalled-project-support-flow.md](stalled-project-support-flow.md) — `project-maintenance` sibling lane
- [../foundation/market-operating-model.md](../foundation/market-operating-model.md) — dispute and amendment doctrine
- [../foundation/limitations-and-disclaimers.md](../foundation/limitations-and-disclaimers.md) — legal and quality limits
- [../v0/protocol-fixture-gap-audit.md](../v0/protocol-fixture-gap-audit.md) — remaining fixture gaps
