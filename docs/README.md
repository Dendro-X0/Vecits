# Vectis Documentation

Canonical documentation for the **Vectis** coordination protocol and reference implementation.

**→ New or lost? [START-HERE.md](START-HERE.md)** — read this first; everything else is optional reference.

Operators: [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md). Implementers: [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md).

## Current status (July 2026)

| Layer | State |
| --- | --- |
| **Kernel / protocol** | R0–R2 complete; reference-lane procedure guards GAP-01..07 closed |
| **Trust bootstrap** | Spec locked — [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) |
| **Discovery bridge** | Classifier + offer drafts + Aperio import — [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) |
| **Client** | R4-C1..C4 complete; frontend Phase 1–3 complete ([frontend-phase3-completion.md](frontend-phase3-completion.md)) — layout: [../REPOSITORY.md](../REPOSITORY.md) |
| **Gates** | RG-1..RG-4 pass; RG-5 partial (Aperio live CLI optional) |

Session handoff: [roadmap/working-context-log.md](roadmap/working-context-log.md) · Evidence: [roadmap/progress.md](roadmap/progress.md)

## Navigation by role

| Role | Start with |
| --- | --- |
| Anyone lost | **[START-HERE.md](START-HERE.md)** |
| Operator / first deploy | [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md) |
| Protocol / fixtures | [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) → [v0/v0-scenario-fixture-matrix.md](v0/v0-scenario-fixture-matrix.md) |
| Discovery (Aperio → Vectis) | [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) |
| What's next (client UX) | [frontend-phase3-completion.md](frontend-phase3-completion.md) · [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md) |
| Client dev + solo testing | [client/development-guide.md](client/development-guide.md) · [client/testing-without-users.md](client/testing-without-users.md) |
| What's next (protocol) | [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md) |
| Maintainer / R-track | [roadmap/restart-roadmap.md](roadmap/restart-roadmap.md) |
| Spec reviewer | [specs/README.md](specs/README.md) |
| Security / abuse | [v0/v0-abuse-gaming-test-matrix.md](v0/v0-abuse-gaming-test-matrix.md) |
| Market / disputes | [foundation/market-operating-model.md](foundation/market-operating-model.md) |

## Directory map

[roadmap/](roadmap/README.md) · [runbooks/](runbooks/README.md) · [specs/](specs/README.md) · [architecture/](architecture/README.md) · [v0/](v0/README.md) · [foundation/](foundation/README.md) · [archive/](archive/README.md) · [meta/](meta/README.md)

```text
docs/
  START-HERE.md      ← orientation (read first if lost)
  README.md          ← full index (you are here)
  specs/             locked contracts + protocol backlog
  architecture/      lanes, bridges, protocol shape
  foundation/        thesis, economics, doctrine
  v0/                fixtures, abuse matrix, evidence
  runbooks/          operator install and ops
  roadmap/           R0–R7 tracks and progress
  client/            official client dev + in-app help sync
```

## Key documents (recent)

| Document | Purpose |
| --- | --- |
| [frontend-spec.md](frontend-spec.md) | Dashboard / marketplace UI rules |
| [frontend-phase1-completion.md](frontend-phase1-completion.md) | Deal loop Phase 1 completion record |
| [frontend-phase2-plan.md](frontend-phase2-plan.md) | Role workspace + order hub Phase 2 plan |
| [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) | Cold-start: vouches + contribution mint → first exchange |
| [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) | Reference v1 digital lane |
| [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) | Aperio Rust engine → Vectis offer drafts |
| [v0/protocol-fixture-gap-audit.md](v0/protocol-fixture-gap-audit.md) | Marketplace procedure guard fixtures |
| [foundation/limitations-and-disclaimers.md](foundation/limitations-and-disclaimers.md) | Not a bank; credits ≠ money; legal exit |

## Roadmap and progress

| Document | Purpose |
| --- | --- |
| [roadmap/restart-roadmap.md](roadmap/restart-roadmap.md) | Canonical R0–R7 plan and gates |
| [roadmap/r7-professional-client-execution-plan.md](roadmap/r7-professional-client-execution-plan.md) | Tauri v2 official client (parallel) |
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

Non-normative legacy: [archive/legacy-dcos-index.md](archive/legacy-dcos-index.md)

## Meta

[meta/docs-sync-checklist.md](meta/docs-sync-checklist.md) — doc updates per behavior change

## Related repo docs

[packages/sdk-ts/STABILITY.md](../packages/sdk-ts/STABILITY.md) — SDK semver policy
