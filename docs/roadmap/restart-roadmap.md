# Restart Roadmap

Kickoff: July 2026

Purpose: canonical plan for relaunching Vectis after the post–Phase 1 dormancy period. This document supersedes active execution tracking for **new work**; completed v0 Phase 0 artifacts remain historical evidence.

## Context

### What exists (do not rebuild)

- Rust kernel: `protocol-core`, `policy`, `state-engine`, `node`, `reputation`
- CLI + JSONL fixtures + SQLite node runtime + pull sync
- TypeScript SDK + Next.js operator/explorer/builder shell
- Phase 1 closed-alpha complete; v0 exit gates `G1`..`G5` passed (April 2026)
- Abuse matrix `AB-01`..`AB-12` with automated coverage
- Phase 2 compute-job lane kickoff (tooling + fixtures, not deployment-gated)

### Why restart

The reference implementation proved protocol credibility in alpha conditions. It did not yet prove:

- **boring deployment** by non-authors from release artifacts
- **kernel clarity** as an embeddable cross-platform runtime
- **first real-world exchange** outside fixture/demo flows
- **discovery → structured offer** pipeline (Aperio bridge)

### Restart north star

Transform Vectis from a maintainer-operated reference implementation into a **deployable coordination kernel** plus a **professional official client** (marketplace platform, Tauri v2 desktop/mobile) that independent operators can run, customize, and trust—without fiat rails, platform admins, or speculative token economics.

**Active focus (July 2026):** kernel core complete for v1; **R7 professional client** and **R8 convenience transport** complete; **R6-PD field proof** when a counterparty is available; **R7-M1 iOS** on macOS host.

## Pre-implementation gate

**Phase R0 — Spec lock** completed July 2026. R1 implementation authorized.

| Deliverable | Status |
| --- | --- |
| `docs/roadmap/r0-spec-lock-execution-plan.md` | `completed` |
| `docs/specs/restart-decisions.md` | `locked` |
| `docs/specs/kernel-boundary-spec.md` | `locked` |
| `docs/specs/deployment-distribution-spec.md` | `locked` |
| `docs/specs/security-resilience-spec.md` | `locked` |
| `docs/specs/discovery-bridge-spec.md` | `locked` |
| `docs/roadmap/restart-roadmap.md` | `locked` |

R0 exit evidence: `docs/roadmap/r0-spec-lock-execution-plan.md` Workstreams A–E; gate `RG-1` = `pass`.

Baseline verification (July 2026): `cargo test`, `fixtures run`, `npm run v1:readiness`, `npm run v1:ga6-drill` — all pass.

## Phase overview

```text
R0 Spec lock ──→ R1 Kernel + packaging ──→ R2 First deployment proof
                         │                           │
                         └──────────→ R3 Discovery bridge
                         │
                         └──────────→ R4 Client shell hardening (parallel)
                         │
                         └──────────→ R7 Professional client (Tauri v2) ← COMPLETE
                         │
                         └──────────→ R8 Convenience transport (QR / offline UX) ← ACTIVE
                         │
                         └──────────→ R5 Federation + policy packs
                         │
                         └──────────→ R6 Lane expansion (compute-job+)
```

| Phase | Goal | Duration (estimate) |
| --- | --- | --- |
| **R0** | Lock specs and decisions | **complete** (July 2026) |
| **R1** | Deployable kernel + release artifacts | **complete** (July 2026) |
| **R2** | First real operator deployment + exchange proof | **complete** (July 2026) |
| **R3** | Aperio → Vectis discovery bridge | 2–3 weeks |
| **R4** | Client/SDK contract hardening | parallel with R1–R2 | **C1–C5 complete** (C5 via R7-D3) |
| **R7** | Professional official client (Tauri v2) | **complete** (desktop MVP) | see [r7-professional-client-execution-plan.md](r7-professional-client-execution-plan.md) |
| **R8** | Convenience transport (QR, deep links, offline handoff UX) | 2–4 weeks (Tier 0–1) | see [r8-convenience-transport-execution-plan.md](r8-convenience-transport-execution-plan.md) |
| **R5** | Policy packs + federation polish | 3–6 weeks |
| **R6** | Lane expansion and community templates | ongoing |

Estimates assume solo maintainer with existing tooling; adjust per availability.

## Track R1: Kernel and packaging

Goal: make the Rust kernel operable as a release artifact with clear boundaries.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R1-K1` | `completed` | Public Rust API audit per crate | `docs/specs/kernel-public-api.md` |
| `R1-K2` | `completed` | In-memory replay entrypoint | `replay_raw_events*` + `tests/in_memory_replay.rs` |
| `R1-K3` | `completed` | Reason-code registry consolidation | `reason_code_for_protocol_error` in `protocol-core` |
| `R1-K4` | `completed` | `GET /health` endpoint | version + data-dir status; AB-13 |
| `R1-K5` | `completed` | Data dir manifest on init | `manifest.json` with kernel versions |
| `R1-D1` | `completed` | Release binary build (Linux + Windows) | `scripts/build-release.mjs`, `.github/workflows/release-build.yml` |
| `R1-D2` | `completed` | `vectis-node init` command | `node init --data-dir` |
| `R1-D3` | `completed` | Docker compose deployment | `Dockerfile`, `docker-compose.yml`, `npm run v1:docker-smoke` |
| `R1-D4` | `completed` | Operator quickstart + install scripts | `docs/runbooks/operator-quickstart.md`, `scripts/install.sh` |
| `R1-D5` | `completed` | Release-binary GA6 drill variant | `npm run v1:ga6-drill:release` (RDG-5) |

Spec references: `specs/kernel-boundary-spec.md`, `specs/deployment-distribution-spec.md`

## Track R2: First deployment proof

Goal: one persistent operator instance runs a real structured exchange outside fixtures.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R2-P1` | `completed` | Deploy maintainer node on persistent host | `npm run r2:deploy-smoke`; `docs/runbooks/r2-persistent-deployment-runbook.md` |
| `R2-P2` | `completed` | Complete one `project-maintenance` or `software-fixes` exchange | `npm run r2:exchange-drill`; `docs/runbooks/r2-exchange-runbook.md` |
| `R2-P3` | `completed` | Deployment evidence packet | `npm run r2:evidence-pack` or `npm run r2:evidence-export` |
| `R2-P4` | `completed` | Restore drill on production backup | `npm run r2:restore-drill` (RDG-3) |
| `R2-P5` | `completed` | Update readiness docs with R2 evidence | `docs/roadmap/progress.md` (July 2026) |

Minimum proof bar: **one counterparty, one completed milestone, one verifiable event log export.**

Operator tooling: `docs/runbooks/operator-backup-runbook.md`, `npm run r2:evidence-export`, `npm run r2:restore-drill`.

## Track R3: Discovery bridge

Goal: Aperio signals become lane-aware offer drafts ingestible to Vectis.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R3-B1` | `completed` | Aperio `aperio-engine discover` + Vectis `v3-aperio-import` | no Next.js dependency |
| `R3-B2` | `completed` | Signal schema + deterministic IDs | `scripts/fixtures/discovery-signals-golden.json` |
| `R3-B3` | `completed` | Lane classifier | `DB-2`; `npm run v3:discovery-bridge:smoke` |
| `R3-B4` | `completed` | Offer draft emitter | `DB-3` smoke; `DB-4` via `npm run v3:discovery-bridge:e2e` |
| `R3-B5` | `deferred` | Web builder draft import (optional) | operator UX; not R2/R3 gate |

Spec reference: `specs/discovery-bridge-spec.md`

## Track R4: Client shell hardening

Goal: TS layer remains thin, replaceable, and truth-aligned with kernel.

**UI note:** The current Next.js shell is a reference operator UI only. Marketplace / service-station UX is **deferred** until after R2 deployment proof and R3 discovery bridge (`R4-C5` optional pass). Do not block kernel or deployment work on UI polish.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R4-C1` | `completed` | SDK API stability doc + semver policy | `packages/sdk-ts/STABILITY.md` |
| `R4-C2` | `completed` | Audit: no settlement logic in web app | `npm run r4:client-audit`; `docs/v0/r4-client-kernel-audit.md` |
| `R4-C3` | `completed` | Authoritative-state labeling in UI | `KernelTruthNotice`; AB-15 |
| `R4-C4` | `completed` | Off-protocol payment warnings in onboarding | SOC-01-doc; `docs/runbooks/operator-security-guide.md` |
| `R4-C5` | `absorbed` | Marketplace UX → **R7-D3** | see R7 plan |

Can run parallel to R1; R4-C1..C4 complete. R7 is primary product track.

## Track R7: Professional client (Tauri v2)

Goal: ship the **official Vectis marketplace client** — self-hosted, cross-platform, wrapping `apps/web` + supervising `vectis-node`.

**Stack:** Tauri v2 (desktop first, mobile later). Lightweight installers. Single web codebase.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R7-D1` | `completed` | Tauri v2 desktop scaffold | `pnpm dev:desktop`, `pnpm verify:desktop` |
| `R7-D2` | `completed` | `vectis-node` sidecar supervisor | health gate; `%APPDATA%/vectis-data`; `node_sidecar.rs` |
| `R7-D3` | `complete` | Marketplace-first UX (ex-R4-C5) | `r4:client-audit` pass |
| `R7-D4` | `complete` | Secure key vault | `docs/runbooks/desktop-secure-key-vault.md` |
| `R7-D5` | `complete` | Desktop installers | `docs/runbooks/desktop-release-build.md` |
| `R7-X1` | `complete` | Discovery draft import (ex-R3-B5) | `r7:discovery-draft:smoke` |
| `R7-M1` | `in_progress` | Tauri mobile scaffold (Android complete, iOS on macOS host) + sidecar policy lock | `apps/desktop/src-tauri/gen/android`, `npm run r7:mobile:scaffold-smoke`, iOS scaffold tooling (`docs/specs/r7-m1-ios-scaffold-spec.md`, `scripts/r7-mobile-ios-command.mjs`, `scripts/r7-ios-scaffold-smoke.mjs`, `npm run r7:mobile:ios:*`, `npm run r7:ios:scaffold-smoke`), `docs/specs/mobile-sidecar-policy-spec.md` |
| `R7-M2` | `complete` | Remote pinned node wiring (mobile) | `docs/specs/r7-m2-remote-pinned-node-wiring-spec.md`, `npm run r7:m2:remote-node:smoke`, `npm run r7:mobile:readiness` |
| `R7-M3` | `deferred` | On-device node sidecar (experimental) | `docs/specs/r7-m3-on-device-sidecar-spec.md` (draft; implement after R7-M1 iOS + R7-M2 field proof) |

Execution plan: [r7-professional-client-execution-plan.md](r7-professional-client-execution-plan.md)

**Next atomic step:** Complete R7-M1 iOS scaffold on macOS host. R7-M3 remains spec-only until remote pinned node is proven in the field.

## Track R8: Convenience transport (QR, deep links, offline-friendly handoff)

Goal: reduce in-person and low-trust onboarding friction without weakening kernel authority — especially when human counterparty field proof (R6-PD-C) is blocked by social cold-start.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R8-A` | `completed` | Spec + execution plan + doc index | `docs/specs/r8-convenience-transport-spec.md`, `docs/roadmap/r8-convenience-transport-execution-plan.md` |
| `R8-B` | `completed` | Tier 0 — QR display from existing hrefs (web) | `transport-qr-panel.tsx`; `npm run r4:client-audit` |
| `R8-C` | `completed` | Tier 1 — signed bundles + mobile scan (R7-M2) | `/dashboard/import`, `npm run r8:transport:smoke` |
| `R8-D` | `completed` | Tier 2 — offline lane wizard (`physical-handoff`) | `/dashboard/handoff`, `npm run r6:offline-lanes:smoke` |

Execution plan: [r8-convenience-transport-execution-plan.md](r8-convenience-transport-execution-plan.md)

**Next atomic step:** R6-PD-C field proof when a counterparty is available, or R7-M1 iOS scaffold on macOS host.

## Track R5: Customization and federation

Goal: communities deploy with policy packs; multi-node sync is operator-boring.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R5-F1` | `completed` | Policy pack export/import guide | `docs/runbooks/policy-pack-export-import.md`, `npm run r5:policy-pack:import-drill` |
| `R5-F2` | `completed` | Two-node deployment runbook (release binaries) | `docs/runbooks/two-node-deployment-runbook.md`, `npm run r5:two-node:drill` |
| `R5-F3` | `completed` | `POST /events` rate limit (configurable) | RES-06; `api_post_events_rate_limit_*` |
| `R5-F4` | `completed` | Event log hash chain (tamper detect) | RES-07; `events_log_hash_chain_tamper_fails_closed_on_restart` |

## Track R6: Lane expansion

Goal: extend lanes after deployment proof; compute-job production-ready.

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R6-L1` | `completed` | Compute-job lane operator runbook | `docs/runbooks/compute-job-lane-runbook.md`, `npm run r6:compute-job:drill` |
| `R6-L2` | `completed` | Community lane template catalog + drills | `docs/architecture/lane-template-catalog.md`, `npm run r6:lane-templates:smoke` |
| `R6-L3` | `completed` | Offline lanes remain experimental + smoke | `docs/runbooks/offline-lane-experimental-runbook.md`, `npm run r6:offline-lanes:smoke` |
| `R6-PD` | `in_progress` | Post-deployment community lane proof (HTTP, outside fixtures) | `docs/specs/r6-post-deployment-proof-spec.md`, `pnpm r6:post-deployment:readiness`, `pnpm r6:post-deployment:drill`, `pnpm r6:post-deployment:multi-lane-drill`, `pnpm r6:post-deployment:phase-c:packet` |

## Restart gates

| Gate | Criterion | Required tracks |
| --- | --- | --- |
| `RG-1` | Specs locked and indexed | R0 | `pass` |
| `RG-2` | Release artifact install + preflight green | R1 | `pass` |
| `RG-3` | First real exchange evidence | R2 | `pass` |
| `RG-4` | No AB-01..AB-12 regression + AB-13/14 | R1, R4 | pass (AB-13/14) |
| `RG-5` | Discovery bridge smoke passes | R3 | partial (`DB-1` now pass via live fixture determinism; `DB-2`–`DB-4` pass) |
| `RG-6` | Client/kernel audit complete | R4 | partial (`R4-C1`–`C4` pass; C5 → R7-D3) |
| `RG-7` | Professional desktop client MVP | R7 | `pass` (R7-D1–D5, R7-X1) |

Restart **v1 sign-off** = `RG-1`..`RG-4`. **`RG-7`** = v1.1 client sign-off. `RG-5` and `RG-6` remain v1.1 targets.

## Refactoring rules

During all restart phases:

1. Run `cargo test` + `npm run v1:readiness` before merging substantive changes
2. Apply `docs/meta/docs-sync-checklist.md` on behavior changes
3. Update `docs/roadmap/progress.md` at phase close
4. Refresh `docs/roadmap/working-context-log.md` at each active slice
5. Do not break sacred invariants (`specs/restart-decisions.md` D3)

## Verification commands (standing)

```bash
cargo test
cargo run --bin cli -- fixtures run
cargo test -p node --test api
cargo test -p node --test sync
npm run v1:preflight
npm run v1:readiness   # includes typecheck
npm run v1:ga6-drill
```

After R1-D1:

```bash
npm run v1:ga6-drill:release   # target script, R1-D5
npm run v3:discovery-bridge:smoke
npm run v3:discovery-bridge:e2e
npm run r2:evidence-pack
npm run r2:evidence-export
npm run r2:restore-drill
npm run r4:client-audit
```

## Documentation map

| Phase | Primary docs |
| --- | --- |
| R0 | `docs/specs/*`, this file |
| R1 | `specs/kernel-boundary-spec.md`, `specs/deployment-distribution-spec.md`, `operator-quickstart.md` (new) |
| R2 | deployment evidence packet, `progress.md` |
| R3 | `specs/discovery-bridge-spec.md` |
| R4 | SDK README, `r4-client-kernel-audit.md`, `operator-security-guide.md` |
| R7 | `r7-professional-client-execution-plan.md`, mobile sidecar specs |
| R8 | `specs/r8-convenience-transport-spec.md`, `r8-convenience-transport-execution-plan.md` |
| R5+ | `event-versioning-strategy.md`, policy pack docs |

## Relationship to v0 roadmap

- `docs/v0/v0-roadmap.md` — historical execution record through Phase 1 closeout
- `docs/v0/v0-phase0-execution-plan.md` — complete; do not reopen unless regression
- `docs/archive/roadmap.md` — update long-term status when R phases complete
- This file — **active execution tracker** from July 2026 forward

## Next action

**R1–R2 complete.** **R4-C1..C4 complete.** **R3-B1 complete** (Aperio `aperio-engine` + Vectis import).

Protocol reference-lane guards GAP-01..07 closed. See [../specs/protocol-priority-backlog.md](../specs/protocol-priority-backlog.md) for next slices.

Orientation: [../START-HERE.md](../START-HERE.md). R7 desktop MVP complete (`RG-7` pass). R7-M2 mobile remote pinned node complete. **Active client track:** R8 convenience transport — [r8-convenience-transport-execution-plan.md](r8-convenience-transport-execution-plan.md). **Field proof (when counterparty available):** R6-PD — [../runbooks/r6-post-deployment-proof-runbook.md](../runbooks/r6-post-deployment-proof-runbook.md). iOS: [../runbooks/r7-m1-ios-mac-host-handoff-runbook.md](../runbooks/r7-m1-ios-mac-host-handoff-runbook.md).
