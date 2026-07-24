# Protocol Priority Backlog

Purpose: single stack-ranked view of protocol work — what is done, what is next, what is explicitly deferred.

Status: `active`

Last updated: July 2026

## Stack (protocol-first)

| Priority | Work | Status | Evidence |
| --- | --- | --- | --- |
| **P0** | Doctrine, disclaimers, reference lane (`software-fixes`) | **Done** | `docs/foundation/*`, `docs/architecture/software-fixes-lane.md` |
| **P0** | Core exchange fixtures (accept, dispute, settle, timeout) | **Done** | SCN-04..06; R2 evidence |
| **P1** | Procedure guards GAP-01..03 (windows, terminal state) | **Done** | SCN-16; `protocol-fixture-gap-audit.md` |
| **P2** | Procedure guards GAP-04..06 (delivery, duplicate accept) | **Done** | SCN-16 |
| **P3** | Procedure guards GAP-07 (settle amount edges) | **Done** | SCN-16 |
| **P3** | Trust bootstrap + credits path spec | **Done** | `trust-bootstrap-and-credits-path-spec.md`, SCN-17 |
| **P4** | `OrderAmend` / mutual cancel event kinds | **Deferred** | Spec-only; renegotiate via new order or paired settle |
| **P5** | GAP-08 offline `physical-handoff` happy path | **Done** | `marketplace-physical-handoff-accept.jsonl`, SCN-18 |
| **P6** | Federation-scale discovery + P2H issuance limits | **Done** | R5-F1..F4 complete for v1 federation band |
| **P3** | Aperio Rust engine → Vectis import (`R3-B1`) | **Done** | `aperio-engine-integration.md`, `v3:aperio-import.mjs` |

## Reference lane procedure coverage

**GAP-01..08 + SCN-19: closed for v1.** `25 invalid`, `24 valid` fixtures — `cargo run --bin cli -- fixtures run`.

## Suggested next slices (pick one)

### Client (R8 — convenience transport)

R8 complete — see [r8-convenience-transport-execution-plan.md](../roadmap/r8-convenience-transport-execution-plan.md).

### Client (R9 — offline transport)

1. R9 NFC + LAN halo — **R9-G0**..**R9-G5** sign-off (maintainer): [r9-offline-transport-spec.md](r9-offline-transport-spec.md) · `pnpm r9:g5` — field proof optional

### Protocol / deployment

1. **Zero-capital operator topologies (locked)** — [zero-capital-operator-topology-design.md](zero-capital-operator-topology-design.md) · [../runbooks/zero-capital-operator-runbook.md](../runbooks/zero-capital-operator-runbook.md) · post-reboot: [../runbooks/zero-capital-cold-start-checklist.md](../runbooks/zero-capital-cold-start-checklist.md) (`pnpm zc:cold-start`)
2. **Staged exchange practice (locked)** — [value-layers-design.md](value-layers-design.md) · [staged-exchange-practice-design.md](staged-exchange-practice-design.md) · [../runbooks/staged-exchange-operator-runbook.md](../runbooks/staged-exchange-operator-runbook.md) (`pnpm sx:s5`)
3. **Stability regression pack** — [../runbooks/stability-regression-pack.md](../runbooks/stability-regression-pack.md) (`pnpm stability:pack`)
4. Android NFC device smoke (optional) — [runbooks/r9-nfc-operator-runbook.md](../runbooks/r9-nfc-operator-runbook.md)
5. R6-PD field proof — **deferred** (needs a counterparty) — [runbooks/r6-post-deployment-proof-runbook.md](../runbooks/r6-post-deployment-proof-runbook.md)
6. R7-M1 iOS scaffold — **deferred** until macOS host
7. R7-M3 on-device mobile sidecar — **spec drafted**; implementation deferred

**Solo stage note (July 2026):** R9 + R6-PD maintainer bands are complete without field testers or macOS. Production default is participant-hosted (ZC); resume deferred items when hardware/people appear.

## Explicit non-goals (current band)

- CodaCtrl / heavy UI validation loops
- Fiat on-ramps or transferable credits
- Human arbitration in kernel

## Related docs

- [zero-capital-operator-topology-design.md](zero-capital-operator-topology-design.md)
- [value-layers-design.md](value-layers-design.md)
- [staged-exchange-practice-design.md](staged-exchange-practice-design.md)
- [serverless-p2p-feasibility-investigation.md](serverless-p2p-feasibility-investigation.md)
- [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md)
- [r8-convenience-transport-spec.md](r8-convenience-transport-spec.md)
- [../v0/protocol-fixture-gap-audit.md](../v0/protocol-fixture-gap-audit.md)
- [../v0/v0-scenario-fixture-matrix.md](../v0/v0-scenario-fixture-matrix.md)
- [../roadmap/restart-roadmap.md](../roadmap/restart-roadmap.md)
