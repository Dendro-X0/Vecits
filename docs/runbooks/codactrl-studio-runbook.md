# CodaCtrl Studio — Vectis subject runbook

Last updated: 2026-07-24  
Audience: operators testing **Vectis use cases** and **security hygiene** via CodaCtrl Studio  
Related: [../.codactrl/USE-CASE-MAP.md](../.codactrl/USE-CASE-MAP.md) · [testing-without-users.md](../client/testing-without-users.md) · [operator-security-guide.md](./operator-security-guide.md) · [v0-abuse-gaming-test-matrix.md](../v0/v0-abuse-gaming-test-matrix.md)

## Position

| Layer | Owner | Role |
|-------|--------|------|
| Protocol truth (SCN/AB/RES) | Vectis fixtures + cargo/pnpm | Authoritative reject/settle proofs |
| Studio proof overlay | CodaCtrl | Orient, capture, FLS, sandbox T0, dual-window UI |

CodaCtrl does **not** replace `cargo run --bin cli -- fixtures run` or AB cargo tests.

## One-time setup

1. Install / run **CodaCtrl Studio** (CodaCtrl monorepo: `pnpm try:studio` or installed app).
2. **Open workspace** = this Vectis repo root (not the CodaCtrl monorepo).
3. Confirm present:
   - `verify.scenarios.yaml`
   - `verify.operations.yaml`
   - `client.cdp.yaml` + `client.interact.yaml` (MCP dual-window / deal-loop stepLabels)
   - `.codactrl/sandbox/*.catalog.yaml`
   - `.codactrl/logic/*.json`

4. MCP: `client_workflow_guide` → `vectisGoldenPath` / `subjectGoldenPath`.
## Use-case paths (Studio + Vectis)

| Goal | In Studio | On Vectis CLI (truth) |
|------|-----------|------------------------|
| Wiring smoke | Verify → run catalog scenarios (T0) | — |
| Protocol fixtures | — | `cargo run --bin cli -- fixtures run` |
| Stability habit | Operation `vectis-stability-quick` (T0) | `pnpm stability:pack:quick` |
| Solo deal-loop | Dual-window client_* (`client.interact.yaml` stepLabels; Playwright dual session) | `pnpm desktop:deal-loop:smoke` |
| R2 exchange | Operation pointer | `pnpm r2:exchange-drill` |
| Stress | Monitor → Hostile sandbox (Vectis stress pack) | Live kill/CDP later |

## Security paths

| Goal | In Studio | On Vectis (truth) |
|------|-----------|-------------------|
| Hygiene orientation | Monitor → Sandbox hygiene catalog | — |
| AB reject matrix | Map only (`.codactrl/USE-CASE-MAP.md`) | fixtures/invalid + cargo tests |
| FLS client drift | Logic alignment → Evaluate static | — |
| Operator security checklist | — | [operator-security-guide.md](./operator-security-guide.md) |

## MCP (agents)

```text
verify_workflow_guide
verify_scenario_list / verify_operation_list / verify_scenario_run
verify_false_green_scan
client_*  (deal-loop dual window — after node + web up)
```

Optional (when Studio MCP exposes them): `sandbox_workflow_guide`, `logic_workflow_guide`, `logic_evaluate_static`.

### CodaCtrl upgrade notes (2026-07)

- `fileExists` steps must target **files**, not directories (`fixtures` alone fails as “missing file”).
- Operations catalog requires `defaultProofTier` (see `verify.operations.yaml`).
- Protocol AB truth remains `cargo run --bin cli -- fixtures run` — Studio T0 does not replace it.

## Dual-window (unchanged Vectis flow)

With `vectis-node` on `:7878` and `pnpm dev:web` up, use two Playwright sessions and `devKey=` unlock — see [testing-without-users.md](../client/testing-without-users.md). Evidence: `.codectx/verify/client-sessions/`.

## Non-goals

- Blocking Vectis protocol roadmap on Studio loops
- Claiming AB-* fixed because a Studio T0 dry-run passed
- Field counterparty / NFC hardware proof
