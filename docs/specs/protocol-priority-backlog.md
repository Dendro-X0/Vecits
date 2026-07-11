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

### Protocol / deployment

4. R7-M1 iOS scaffold init/dev on macOS host (`pnpm r7:mobile:ios:init`, `pnpm r7:ios:scaffold-smoke`)
5. R7-M3 on-device mobile sidecar — **spec drafted** (`docs/specs/r7-m3-on-device-sidecar-spec.md`); implementation deferred
6. Post-R6 lane operator deployment proof — spec + runbook: `docs/specs/r6-post-deployment-proof-spec.md`, `pnpm r6:post-deployment:readiness`

## Explicit non-goals (current band)

- CodaCtrl / heavy UI validation loops
- Fiat on-ramps or transferable credits
- Human arbitration in kernel

## Related docs

- [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md)
- [r8-convenience-transport-spec.md](r8-convenience-transport-spec.md)
- [../v0/protocol-fixture-gap-audit.md](../v0/protocol-fixture-gap-audit.md)
- [../v0/v0-scenario-fixture-matrix.md](../v0/v0-scenario-fixture-matrix.md)
- [../roadmap/restart-roadmap.md](../roadmap/restart-roadmap.md)
