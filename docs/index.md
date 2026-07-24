# Vectis Documentation

**If you feel lost, read only this page first.** Everything else in `/docs` is reference — not required on day one.

Last updated: July 2026

Canonical documentation for the **Vectis** coordination protocol and reference implementation.

Operators: [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md). Implementers: [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md). Session handoff: [roadmap/working-context-log.md](roadmap/working-context-log.md) · Evidence: [roadmap/progress.md](roadmap/progress.md).

## What Vectis is

Vectis is a **coordination protocol** for digital work: signed events, escrow, evidence, deterministic settlement, reputation. Credits are **coordination fuel** (non-transferable, expiring) — not money, not crypto.

The **kernel** (Rust) is the product. Web and SDK clients are replaceable shells. Operators can run their own branded stores on the same protocol.

## What Vectis is not

- Not a payment network or bank
- Not a human arbitration court
- Not a gig-platform UI play (client polish is deferred)
- Not Aperio — discovery and settlement are separate systems (see below)

Plain limits: [foundation/limitations-and-disclaimers.md](foundation/limitations-and-disclaimers.md)

## Two systems (don't merge them in your head)

| System | Repo | Job |
| --- | --- | --- |
| **Vectis** | This repo | Structure exchange on-log: offer → order → escrow → delivery → accept/dispute → settle |
| **Aperio** | `E:\Web Projects\aperio` | Find opportunities in the wild: portfolio → search → filter → ranked signals |

**Flow:** Aperio finds clues → Vectis bridge turns them into offer **drafts** → human reviews → sign → ingest → kernel enforces procedure.

Integration guide: [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md)

## Current status (July 2026)

| Layer | State |
| --- | --- |
| **Kernel / protocol** | R0–R2 complete; reference-lane procedure guards GAP-01..07 closed |
| **Trust bootstrap** | Spec locked — [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) |
| **Discovery bridge** | Classifier + offer drafts + Aperio import — [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) |
| **Client** | R4-C1..C4 complete; deal loop + workspace + network surface shipped — [client/client-capabilities.md](client/client-capabilities.md); UI rules — [client/ui-contract.md](client/ui-contract.md); **R8 convenience transport** complete — [specs/r8-convenience-transport-spec.md](specs/r8-convenience-transport-spec.md) |
| **Gates** | RG-1..RG-4 pass; RG-5 partial (Aperio live CLI optional) |

### Done (trust the kernel)

| Area | Evidence |
| --- | --- |
| Operator deploy (single node) | R2 complete — [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md) |
| Reference lane `software-fixes` | [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) |
| Marketplace procedure guards | GAP-01..07 closed — [v0/protocol-fixture-gap-audit.md](v0/protocol-fixture-gap-audit.md) |
| Trust bootstrap + credits path (spec) | [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) |
| Discovery bridge (classifier + drafts) | DB-2..DB-4 pass; Aperio import adapter shipped |
| Client/kernel boundary audit | R4-C1..C4 complete |
| Professional desktop client (R7) | R7-D1–D5 + R7-X1 — `RG-7` pass |
| Mobile client wiring (R7-M2) | Remote pinned node — `pnpm r7:mobile:readiness` |
| Mobile scaffold (R7-M1) | Android complete; **iOS deferred** (no macOS host) |
| Convenience transport (R8) | Tier 0 QR → Tier 1 bundles → Tier 2 handoff wizard — [roadmap/r8-convenience-transport-execution-plan.md](roadmap/r8-convenience-transport-execution-plan.md) |

### Not the current focus

- Federation at scale
- Offline `physical-handoff` lane **production** deployment (fixture proven — SCN-18; R8-D adds experimental UX only)
- `OrderAmend` event kind (use new order or paired settle for now)

**Client work (no live users required):** use [client/testing-without-users.md](client/testing-without-users.md) — fixtures + two local keys + `/help` guides.

Stack-ranked backlog: [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md)

## Verify in five minutes

```bash
cargo run --bin cli -- fixtures run    # 24 valid, 25 invalid — all should pass
pnpm v3:discovery-bridge:smoke         # lane classifier golden
pnpm v3:aperio-import:smoke            # Aperio JSONL → Vectis offer drafts
pnpm v3:aperio-live-drill              # Aperio engine → import → review → ingest
pnpm r7:mobile:readiness               # Android scaffold + mobile pinned-node wiring
pnpm r7:client:readiness               # desktop cargo check + R4 audit + web + mobile bundle
pnpm ci:readiness                      # PR CI gate (typecheck, audits, smokes)
```

**Day-to-day operable (stability pack):** fixtures + ZC cold-start + SX-S5 + R4 audit — [runbooks/stability-regression-pack.md](runbooks/stability-regression-pack.md)

```bash
pnpm stability:pack          # full
pnpm stability:pack:quick    # --no-build for node drills
```

## Navigation by role

| Role | Start with |
| --- | --- |
| Anyone lost | **This page** |
| Operator / first deploy | [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md) |
| Protocol / fixtures | [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) → [v0/v0-scenario-fixture-matrix.md](v0/v0-scenario-fixture-matrix.md) |
| Discovery (Aperio → Vectis) | [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) |
| Client UI rules | [client/ui-contract.md](client/ui-contract.md) |
| Client capabilities + solo testing | [client/client-capabilities.md](client/client-capabilities.md) · [client/testing-without-users.md](client/testing-without-users.md) |
| What's next | [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md) |
| Maintainer / R-track | [roadmap/restart-roadmap.md](roadmap/restart-roadmap.md) |
| Spec reviewer | [specs/README.md](specs/README.md) |
| Security / abuse | [v0/v0-abuse-gaming-test-matrix.md](v0/v0-abuse-gaming-test-matrix.md) |
| Market / disputes | [foundation/market-operating-model.md](foundation/market-operating-model.md) |

## Pick your path

### "I want the big picture"

1. [foundation/project-thesis.md](foundation/project-thesis.md)
2. [foundation/market-operating-model.md](foundation/market-operating-model.md)
3. [specs/restart-decisions.md](specs/restart-decisions.md)

### "I want to run a node"

1. [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md)
2. [runbooks/operator-security-guide.md](runbooks/operator-security-guide.md)
3. Mobile clients: [runbooks/mobile-remote-pinned-node-operator-runbook.md](runbooks/mobile-remote-pinned-node-operator-runbook.md)

### "I want protocol truth (fixtures)"

1. [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md)
2. [v0/v0-scenario-fixture-matrix.md](v0/v0-scenario-fixture-matrix.md)
3. [v0/protocol-fixture-gap-audit.md](v0/protocol-fixture-gap-audit.md)

### "I want discovery → marketplace"

1. Aperio engine docs: `E:\Web Projects\aperio\docs\engine\README.md`
2. [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md)
3. [specs/discovery-bridge-spec.md](specs/discovery-bridge-spec.md)

### "I want to build or test the official client"

1. [client/development-guide.md](client/development-guide.md)
2. [client/ui-contract.md](client/ui-contract.md) · [client/client-capabilities.md](client/client-capabilities.md)
3. [client/testing-without-users.md](client/testing-without-users.md)
4. In-app user guides: run web client → `/help`

### "I want to know what's next"

**Zero-capital production (locked):** run on your own hardware — no VPS required.

1. [specs/zero-capital-operator-topology-design.md](specs/zero-capital-operator-topology-design.md) — topologies ZC-1..ZC-4
2. [runbooks/zero-capital-operator-runbook.md](runbooks/zero-capital-operator-runbook.md) — operator steps
3. After reboot: [runbooks/zero-capital-cold-start-checklist.md](runbooks/zero-capital-cold-start-checklist.md) · `pnpm zc:cold-start`
4. Standing closeout: `pnpm zc:s4` (or `pnpm zc:s4:quick`)
5. Background: [specs/serverless-p2p-feasibility-investigation.md](specs/serverless-p2p-feasibility-investigation.md)

**Staged value exchange (locked):** credits at each milestone accept — not passive yield.

1. [specs/value-layers-design.md](specs/value-layers-design.md) · [specs/staged-exchange-practice-design.md](specs/staged-exchange-practice-design.md)
2. [runbooks/staged-exchange-operator-runbook.md](runbooks/staged-exchange-operator-runbook.md)
3. Maintainer proof: `pnpm sx:s5` (or `pnpm sx:s5:quick`)
4. In-app: `/help/staged-exchanges`

Optional later (hardware / counterparty gated):

1. Android NFC device smoke — [runbooks/r9-nfc-operator-runbook.md](runbooks/r9-nfc-operator-runbook.md)
2. R6-PD field proof — **deferred** — [runbooks/r6-post-deployment-proof-runbook.md](runbooks/r6-post-deployment-proof-runbook.md)
3. R7-M1 iOS — **deferred** — [runbooks/r7-m1-ios-mac-host-handoff-runbook.md](runbooks/r7-m1-ios-mac-host-handoff-runbook.md)

R8 + R9 signed off; R6-PD maintainer closeout via `pnpm r6:pd`.

## Directory map

[roadmap/](roadmap/README.md) · [runbooks/](runbooks/README.md) · [specs/](specs/README.md) · [architecture/](architecture/README.md) · [client/](client/README.md) · [v0/](v0/README.md) · [foundation/](foundation/README.md) · [archive/](archive/README.md) · [meta/](meta/README.md)

```text
docs/
  index.md           ← orientation + navigation (you are here)
  specs/             locked contracts + protocol backlog
  architecture/      lanes, bridges, protocol shape
  foundation/        thesis, economics, doctrine
  v0/                fixtures, abuse matrix, evidence
  runbooks/          operator install and ops
  roadmap/           R0–R9 tracks and progress
  client/            official client UI contract + capabilities + help sync
  archive/           non-normative historical records
  meta/              docs sync checklist
```

| Folder | What's in it |
| --- | --- |
| [specs/](specs/README.md) | Locked contracts — build against these |
| [architecture/](architecture/README.md) | System design, lanes, bridges |
| [foundation/](foundation/README.md) | Thesis, economics, doctrine |
| [v0/](v0/README.md) | Fixture matrices, abuse tests, evidence |
| [runbooks/](runbooks/README.md) | Operator commands |
| [roadmap/](roadmap/README.md) | R0–R9 tracks, progress, session log |
| [client/](client/README.md) | UI contract, capabilities, local client testing |
| [archive/](archive/README.md) | Legacy — not normative |

## Key documents

| Document | Purpose |
| --- | --- |
| [client/ui-contract.md](client/ui-contract.md) | Dashboard / marketplace UI rules |
| [client/client-capabilities.md](client/client-capabilities.md) | Shipped client behavior (deal loop, workspace, network surface) |
| [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) | Cold-start: vouches + contribution mint → first exchange |
| [specs/r8-convenience-transport-spec.md](specs/r8-convenience-transport-spec.md) | QR/deep-link transport; offline handoff UX tiers |
| [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) | Reference v1 digital lane |
| [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) | Aperio Rust engine → Vectis offer drafts |
| [v0/protocol-fixture-gap-audit.md](v0/protocol-fixture-gap-audit.md) | Marketplace procedure guard fixtures |
| [foundation/limitations-and-disclaimers.md](foundation/limitations-and-disclaimers.md) | Not a bank; credits ≠ money; legal exit |

## Roadmap and progress

| Document | Purpose |
| --- | --- |
| [roadmap/restart-roadmap.md](roadmap/restart-roadmap.md) | Canonical R0–R9 plan and gates |
| [roadmap/r7-professional-client-execution-plan.md](roadmap/r7-professional-client-execution-plan.md) | Tauri v2 official client (complete) |
| [roadmap/r8-convenience-transport-execution-plan.md](roadmap/r8-convenience-transport-execution-plan.md) | QR, deep links, offline-friendly handoff UX |
| [roadmap/r2-deployment-proof-execution-plan.md](roadmap/r2-deployment-proof-execution-plan.md) | R2 deployment proof (complete) |
| [roadmap/progress.md](roadmap/progress.md) | Milestone and evidence index |
| [roadmap/working-context-log.md](roadmap/working-context-log.md) | Rolling session handoff |

## Operator runbooks

| Document | Purpose |
| --- | --- |
| [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md) | Zero-to-running node |
| [runbooks/operator-security-guide.md](runbooks/operator-security-guide.md) | Keys, TLS, off-platform payment warning |
| [runbooks/operator-backup-runbook.md](runbooks/operator-backup-runbook.md) | Backup, evidence export, restore |
| [runbooks/r2-persistent-deployment-runbook.md](runbooks/r2-persistent-deployment-runbook.md) | Persistent host deployment |
| [runbooks/release-packaging-ci.md](runbooks/release-packaging-ci.md) | Multi-platform CI release artifacts |
| [runbooks/r2-exchange-runbook.md](runbooks/r2-exchange-runbook.md) | Exchange drill |

## Specifications

See [specs/README.md](specs/README.md). Locked specs include:

- [specs/restart-decisions.md](specs/restart-decisions.md)
- [specs/kernel-boundary-spec.md](specs/kernel-boundary-spec.md)
- [specs/discovery-bridge-spec.md](specs/discovery-bridge-spec.md)
- [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md)
- [specs/security-resilience-spec.md](specs/security-resilience-spec.md)

## Architecture

**Split:** [signed protocol kernel](architecture/v0-architecture.md#protocol-vs-application) (Rust) vs [replaceable client](specs/kernel-boundary-spec.md) (TypeScript).

| Document | Purpose |
| --- | --- |
| [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) | **Reference v1 lane** |
| [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) | **Aperio → Vectis** (operational) |
| [architecture/discovery-engine-bridge.md](architecture/discovery-engine-bridge.md) | Exploratory predecessor |
| [architecture/v0-architecture.md](architecture/v0-architecture.md) | Component boundaries |
| [architecture/v0-spec-outline.md](architecture/v0-spec-outline.md) | Protocol outline |

## v0 execution baseline

| Document | Purpose |
| --- | --- |
| [v0/v0-scenario-fixture-matrix.md](v0/v0-scenario-fixture-matrix.md) | SCN-01..17 fixture coverage |
| [v0/protocol-fixture-gap-audit.md](v0/protocol-fixture-gap-audit.md) | GAP-01..07 (closed for v1) |
| [v0/v0-abuse-gaming-test-matrix.md](v0/v0-abuse-gaming-test-matrix.md) | AB-01..AB-14 |

## Foundation

| Document | Purpose |
| --- | --- |
| [foundation/product-identity.md](foundation/product-identity.md) | Naming, white-label stores |
| [foundation/market-operating-model.md](foundation/market-operating-model.md) | P2P markets, trust bootstrap, disputes |
| [foundation/economic-protocol-v1.md](foundation/economic-protocol-v1.md) | Anti-financial economics |
| [foundation/collaboration-value-doctrine.md](foundation/collaboration-value-doctrine.md) | Vectis vs Aperio division of labor |

## Archive

Non-normative legacy: [archive/legacy-dcos-index.md](archive/legacy-dcos-index.md) · Historical frontend phase records: [archive/frontend-phases/](archive/frontend-phases/README.md)

## Meta

[meta/docs-sync-checklist.md](meta/docs-sync-checklist.md) — doc updates per behavior change

## Related repo docs

[packages/sdk-ts/STABILITY.md](../packages/sdk-ts/STABILITY.md) — SDK semver policy
