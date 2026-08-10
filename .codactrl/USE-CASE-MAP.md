# Vectis × CodaCtrl — use-case & security map

Last updated: 2026-07-24  
Purpose: Orient Studio Verify / sandbox / FLS against Vectis protocol truth.  
**Kernel AB/SCN fixtures remain authoritative.** CodaCtrl does not replace `cargo` / `pnpm` protocol gates.

## How to open

1. Launch CodaCtrl Studio (`pnpm try:studio` from the CodaCtrl monorepo).
2. Open workspace root: `E:/Experimental projects/vectis` (or your Vectis clone).
3. Verify Monitor → Sandbox + Logic alignment; MCP: `sandbox_workflow_guide`, `logic_workflow_guide`, `verify_workflow_guide`.

## Use cases → how to prove

| Vectis use case | Vectis command / doc (truth) | CodaCtrl surface |
|-----------------|------------------------------|------------------|
| Protocol fixtures SCN-* | `cargo run --bin cli -- fixtures run` · [v0-scenario-fixture-matrix.md](../docs/v0/v0-scenario-fixture-matrix.md) | `verify.scenarios.yaml` T0 wiring; issues register after digest pull |
| Stability habit | `pnpm stability:pack:quick` · [stability-regression-pack.md](../docs/runbooks/stability-regression-pack.md) | `verify.operations.yaml` → `vectis-stability-quick` |
| Solo deal-loop | `pnpm desktop:deal-loop:smoke` · [testing-without-users.md](../docs/client/testing-without-users.md) | Dual-window client_* (`client.cdp.yaml` + `client.interact.yaml` stepLabels) + sandbox `stress.vectis.deal_loop.dual_window@1` |
| R2 HTTP exchange | `pnpm r2:exchange-drill` · [r2-exchange-runbook.md](../docs/runbooks/r2-exchange-runbook.md) | `vectis-r2-exchange-drill` operation (T0); live drill stays Vectis |
| Staged exchange | `pnpm sx:s5` · staged-exchange runbook | Map under operations when adding SX adapter |
| Zero-capital ops | `pnpm zc:cold-start:quick` · ZC runbooks | Stress node-kill / hygiene restart scenarios |
| Software-fixes lane | fixtures lane bundles · architecture doc | Marketplace accept stress scenario |

## Security → how to prove

| Layer | Vectis IDs | Vectis proof | CodaCtrl surface |
|-------|------------|--------------|------------------|
| Protocol abuse | AB-01..AB-17 | fixtures/invalid + cargo tests · [v0-abuse-gaming-test-matrix.md](../docs/v0/v0-abuse-gaming-test-matrix.md) | Hygiene pack `mapsTo`; Monitor orientation — **do not re-implement rejects in Studio** |
| Social residual | SOC-01..SOC-08 | Operator security guide + UI warnings | FLS INV-VTX-002 (SOC-05 hash≠CI); client_* for warning visibility |
| Resilience | RES-01..RES-07 | Node restart / chain verify | Stress node_kill + hygiene crash_recovery / secrets |
| App hygiene | — | — | `.codactrl/sandbox/hygiene.catalog.yaml` |

## FLS

| Path | Role |
|------|------|
| `.codactrl/logic/vectis-kernel-boundary.v1.json` | Invariants INV-VTX-001..003 |
| `.codactrl/logic/vectis-rule-pack.v1.json` | Static RG-* detectors |
| MCP | `logic_evaluate_static`, `logic_enforce_evaluate` |

Optional block tier: set `functionalLogic.enforceOn` in `.codactrl/config.json` (e.g. `["INV-VTX-001","INV-VTX-003"]`).

## Evidence bus

| Path | Content |
|------|---------|
| `.codectx/verify/` | Runs, client sessions, issues register |
| `.codactrl/verify/` | Hub summary (when synced) |
| `.codactrl/sandbox/` | Stress + hygiene catalogs |
| `.codactrl/logic/` | FLS specs |

## Non-goals

- Replacing Vectis fixture/cargo AB matrix with Studio
- Field counterparty (R6-PD) or NFC hardware proof
- Exploit research / bounty export (CodaCtrl SB5 deferred)
