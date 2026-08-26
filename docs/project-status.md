# Project Status

**Canonical current-state document.** Last updated: August 2026.

For orientation and navigation, start at [index.md](index.md). For protocol stack rank, see [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md).

---

## Summary

Vectis is **core-complete for in-protocol remote collaboration**: offer → order → escrow → delivery → accept/dispute → close, with a shipped official client (web + Tauri desktop), operator runbooks, and maintainer production-for-invite proof (R10 `PRG-1`..`PRG-4`).

What remains aspirational: global public discovery without pinning an operator node, monthly pro-bono policy objects, on-chain barter settlement, and human stranger field proof (`PRG-5` deferred).

---

## Shipped layers

| Layer | State | Primary docs |
| --- | --- | --- |
| **Kernel / protocol** | R0–R2 complete; GAP-01..08 closed; OrderAmend v1 + mutual cancel shipped | [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) · [v0/protocol-fixture-gap-audit.md](v0/protocol-fixture-gap-audit.md) |
| **Trust bootstrap** | Spec locked; client UX shipped | [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) |
| **Discovery bridge** | Classifier + offer drafts + Aperio import | [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) |
| **Official client** | Deal loop, workspace, marketplace, transport, global search | [client/client-capabilities.md](client/client-capabilities.md) · [client/ui-contract.md](client/ui-contract.md) |
| **Desktop (R7)** | Tauri v2 + sidecar + installers | [archive/roadmap/r7-professional-client-execution-plan.md](archive/roadmap/r7-professional-client-execution-plan.md) |
| **Transport (R8/R9)** | QR, bundles, handoff wizard; NFC + LAN halo (maintainer) | [specs/r8-convenience-transport-spec.md](specs/r8-convenience-transport-spec.md) |
| **Production readiness (R10)** | Maintainer invite bar met | [specs/production-readiness-requirements.md](specs/production-readiness-requirements.md) · [runbooks/r10-production-for-invite-runbook.md](runbooks/r10-production-for-invite-runbook.md) |
| **Zero-capital ops** | ZC-1..ZC-4 topologies + cold-start + stability pack | [specs/zero-capital-operator-topology-design.md](specs/zero-capital-operator-topology-design.md) |

Fixtures: `27` valid / `38` invalid — `cargo run --bin cli -- fixtures run`.

---

## Real-world readiness (honest)

### Remote collaboration contracts

**Ready.** Milestone escrow, lane-valid evidence, accept/dispute/timeout, multi-milestone orders, transactions queue, order hub, guided builder with dispute/adjust branches. Smoke: `pnpm desktop:deal-loop:smoke`.

### Promoting work online

**Partial.** Publish offers on **your node**; discovery is node-scoped. Founding-network vouch gate for new providers. Share identity/transport bundles; no turnkey global “link in bio” marketplace SaaS yet.

### Mutual aid / nonprofit collaboration

**Partial.** `project-maintenance` lane + `/marketplace/mutual-aid` shelf + collaboration-rewards copy. Same milestone machine as paid lanes. **No** monthly pro-bono quota, nonprofit verification, or enforceable barter settlement (barter/mixed compensation is UI-layer; escrow settles in credits).

See [foundation/platform-vision-exploration.md](foundation/platform-vision-exploration.md) for doctrine; [foundation/market-operating-model.md](foundation/market-operating-model.md) for in-protocol vs off-platform boundaries.

---

## Active vs deferred

### Done — do not restart

- R0 spec lock, R1 kernel/packaging, R2 deployment proof
- R4 client/kernel boundary (C1–C5 via R7)
- R7 professional desktop client
- R8 convenience transport, R9 offline transport (maintainer `R9-G5`)
- R10 maintainer production-for-invite (`PRG-1`..`PRG-4`)
- Zero-capital topologies, staged exchange practice, stability regression pack

Historical execution plans: [archive/roadmap/README.md](archive/roadmap/README.md).

### Pick next (non-people-gated)

1. Client polish from [meta/design-audit-2026-08-26.md](meta/design-audit-2026-08-26.md) (per-route titles, skip link, reduced-motion)
2. Provider landing / solo-operator promotion playbook (docs + optional route)
3. Pro-bono availability policy (off-protocol convention or future metadata)
4. On-chain barter terms in `ServiceOffer` (protocol extension)
5. Guided contribution-claim UX for non-operators

Stack rank for protocol work: [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md).

### Deferred (not a project hold)

| Item | Why |
| --- | --- |
| **PRG-5 / R6-PD human field proof** | No stranger counterparty available |
| **R7-M1 iOS** | No macOS host |
| **R7-M3 on-device mobile sidecar** | Spec only |
| **Android NFC device smoke** | Parked until phone + writable tag |
| **ZC-2 second-device pin** | Needs second device |
| **Federation at scale** | R5 band; not current focus |

---

## Verify quickly

```bash
cargo run --bin cli -- fixtures run
pnpm stability:pack:quick
cd apps/web && pnpm typecheck
pnpm desktop:deal-loop:smoke    # full deal loop (dev + sidecar)
pnpm r4:client-audit
```

Solo client testing without users: [client/testing-without-users.md](client/testing-without-users.md).

---

## Documentation map (post-audit)

| Need | Read |
| --- | --- |
| **Start here** | [index.md](index.md) |
| **What's shipped / what's next** | **This page** |
| **Run a node** | [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md) |
| **Client behavior** | [client/client-capabilities.md](client/client-capabilities.md) |
| **UI rules** | [client/ui-contract.md](client/ui-contract.md) |
| **Thesis / economics** | [foundation/project-thesis.md](foundation/project-thesis.md) |
| **Session handoff** | [roadmap/working-context-log.md](roadmap/working-context-log.md) |
| **Changelog / evidence index** | [roadmap/progress.md](roadmap/progress.md) |
| **Doc maintenance** | [meta/docs-sync-checklist.md](meta/docs-sync-checklist.md) |
| **August 2026 doc audit** | [meta/documentation-audit-2026-08-26.md](meta/documentation-audit-2026-08-26.md) |

---

## Phase history (R-track)

```text
R0 Spec lock ──→ R1 Kernel + packaging ──→ R2 First deployment proof
                         ├── R3 Discovery bridge (done)
                         ├── R4 Client hardening (done)
                         ├── R7 Professional client (done)
                         ├── R8 Convenience transport (done)
                         ├── R9 Offline transport (done)
                         └── R10 Production readiness — maintainer complete (PRG-5 deferred)
R5 Federation · R6 Lane expansion — ongoing / not gating core
```

Full R0–R10 tables and gate evidence: [archive/roadmap/restart-roadmap-full.md](archive/roadmap/restart-roadmap-full.md) (archived July–August 2026 plan).
