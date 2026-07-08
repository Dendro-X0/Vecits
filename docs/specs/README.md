# Pre-Implementation Specs (Restart Era)

Purpose: canonical specifications that must be locked before the post-dormancy restart implementation phase begins.

Kickoff: July 2026

## Read order

1. `../restart-roadmap.md` — phases, tracks, gates, and sequencing
2. `restart-decisions.md` — locked decisions that unblock implementation
3. `kernel-public-api.md` — per-crate public Rust API index (R1-K1)
4. `kernel-boundary-spec.md` — Rust kernel vs TypeScript client contract
5. `deployment-distribution-spec.md` — packaging, operator experience, upgrade path
6. `security-resilience-spec.md` — technical and social threat model for restart era
7. `discovery-bridge-spec.md` — Aperio → Vectis integration contract
8. `trust-bootstrap-and-credits-path-spec.md` — genesis admission + credits issuance path
9. `protocol-priority-backlog.md` — stack-ranked protocol work tracker

Operational integration: [../architecture/aperio-engine-integration.md](../architecture/aperio-engine-integration.md) (Aperio Rust engine → Vectis lanes).

## Relationship to v0 docs

These specs **do not replace** v0 protocol documentation. They define the restart horizon on top of a completed reference implementation:

- v0 exit gates `G1`..`G5` remain valid baseline evidence
- `docs/architecture/v0-spec-outline.md` and `docs/archive/protocol-v0.md` remain protocol-shape references
- `docs/architecture/event-versioning-strategy.md` governs any envelope or policy evolution during restart work

## Spec status semantics

- `draft` — under review, not yet implementation-blocking
- `locked` — accepted; implementation may proceed against this document
- `superseded` — replaced by a newer spec revision (keep file for history)

## Current status

| Document | Status |
| --- | --- |
| `kernel-public-api.md` | `locked` |
| `kernel-boundary-spec.md` | `locked` |
| `deployment-distribution-spec.md` | `locked` |
| `security-resilience-spec.md` | `locked` |
| `discovery-bridge-spec.md` | `locked` |
| `trust-bootstrap-and-credits-path-spec.md` | `locked` |
| `protocol-priority-backlog.md` | `active` |
| `mobile-sidecar-policy-spec.md` | `locked` |
| `r7-m2-remote-pinned-node-wiring-spec.md` | `locked` |
| `r7-m1-ios-scaffold-spec.md` | `draft` |
| `r7-m3-on-device-sidecar-spec.md` | `draft` (deferred) |
| `r6-post-deployment-proof-spec.md` | `draft` |
