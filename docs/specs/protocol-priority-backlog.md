# Protocol Priority Backlog

Purpose: single stack-ranked view of protocol work — what is done, what is next, what is explicitly deferred.

Status: `active`

Last updated: August 2026

## Stack (protocol-first)

| Priority | Work | Status | Evidence |
| --- | --- | --- | --- |
| **P0** | Doctrine, disclaimers, reference lane (`software-fixes`) | **Done** | `docs/foundation/*`, `docs/architecture/software-fixes-lane.md` |
| **P0** | Core exchange fixtures (accept, dispute, settle, timeout) | **Done** | SCN-04..06; R2 evidence |
| **P1** | Procedure guards GAP-01..03 (windows, terminal state) | **Done** | SCN-16; `protocol-fixture-gap-audit.md` |
| **P2** | Procedure guards GAP-04..06 (delivery, duplicate accept) | **Done** | SCN-16 |
| **P3** | Procedure guards GAP-07 (settle amount edges) | **Done** | SCN-16 |
| **P3** | Trust bootstrap + credits path spec | **Done** | `trust-bootstrap-and-credits-path-spec.md`, SCN-17 |
| **P4** | Mutual cancel (`ServiceCancel`) | **Done** | [order-mutual-cancel-design.md](order-mutual-cancel-design.md); `marketplace-mutual-cancel.jsonl` + invalid siblings. `OrderAmend` term rewrite still deferred |
| **P5** | GAP-08 offline `physical-handoff` happy path | **Done** | `marketplace-physical-handoff-accept.jsonl`, SCN-18 |
| **P6** | Federation-scale discovery + P2H issuance limits | **Done** | R5-F1..F4 complete for v1 federation band |
| **P3** | Aperio Rust engine → Vectis import (`R3-B1`) | **Done** | `aperio-engine-integration.md`, `v3:aperio-import.mjs` |

## Reference lane procedure coverage

**GAP-01..08 + SCN-19 + P4 mutual cancel: closed for v1.** `31 invalid`, `25 valid` fixtures — `cargo run --bin cli -- fixtures run`.

## Suggested next slices (pick one)

### Post-R10 — pick non-people-gated work (August 2026)

1. **Non-people-gated backlog** — polish / deferred protocol items (e.g. `OrderAmend`, R3-B5 builder import) as needed
2. **Human counterparty** (`PRG-5` / R6-PD) — **deferred** until a real other person is available (not a project hold)
3. R10 maintainer invite bar — **done** (`PRG-1`..`PRG-4`); evidence under `target/r10-evidence/`
4. Tooling — **done** — `pnpm r10:remote:*` + [../runbooks/r10-production-for-invite-runbook.md](../runbooks/r10-production-for-invite-runbook.md)

### Already complete (do not restart)

- R8 convenience transport — [r8-convenience-transport-execution-plan.md](../roadmap/r8-convenience-transport-execution-plan.md)
- R9 NFC + LAN halo maintainer — `pnpm r9:g5`
- Zero-capital topologies + staged exchange + stability pack — ZC / SX / `pnpm stability:pack:quick`

### Parked / deferred

1. Android NFC device smoke — [../runbooks/r9-nfc-operator-runbook.md](../runbooks/r9-nfc-operator-runbook.md)
2. ZC-2 field pin (feeds R10-B) — [../runbooks/zero-capital-zc2-field-checklist.md](../runbooks/zero-capital-zc2-field-checklist.md)
3. R6-PD field proof — [../runbooks/r6-post-deployment-proof-runbook.md](../runbooks/r6-post-deployment-proof-runbook.md) (R10-F)
4. R7-M1 iOS — until macOS host
5. R7-M3 on-device mobile sidecar — spec drafted; deferred

**Solo stage note (August 2026):** R10 maintainer invite bar met (`PRG-1`..`PRG-4`: remote pin, SF1 E2E, Win+Linux matrix, tooling). Human/community field proof (`PRG-5`) remains deferred until a counterparty exists — not a hold on other work.

## Explicit non-goals (current band)

- Fiat on-ramps or transferable credits
- Human arbitration in kernel
- **Blocking** protocol work on CodaCtrl / heavy UI validation loops

**Optional overlay:** CodaCtrl Studio may be used for use-case orientation, dual-window client capture, FLS, and security-hygiene sandbox T0 — see [../runbooks/codactrl-studio-runbook.md](../runbooks/codactrl-studio-runbook.md). Protocol AB/SCN fixtures remain authoritative; Studio does not gate R* completion.

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
