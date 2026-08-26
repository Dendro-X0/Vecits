# Vectis Documentation

**If you feel lost, read only this page first.** Everything else in `/docs` is reference.

Last updated: August 2026

**Current state:** [project-status.md](project-status.md) · **Session handoff:** [roadmap/working-context-log.md](roadmap/working-context-log.md)

Operators: [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md). Client behavior: [client/client-capabilities.md](client/client-capabilities.md). Protocol backlog: [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md).

---

## What Vectis is

Vectis is a **coordination protocol** for digital work: signed events, escrow, evidence, deterministic settlement, reputation. Credits are **coordination fuel** (non-transferable, expiring) — not money, not crypto.

The **kernel** (Rust) is the product. Web and desktop clients are replaceable shells. Operators run their own stores on the same protocol.

Plain limits: [foundation/limitations-and-disclaimers.md](foundation/limitations-and-disclaimers.md)

## What Vectis is not

- Not a payment network or bank
- Not a human arbitration court
- Not a global gig-platform SaaS (discovery is node-scoped today)
- Not Aperio — discovery and settlement are separate ([architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md))

---

## Current status (August 2026)

**Core complete** for in-protocol remote collaboration (offer → order → escrow → deliver → accept). Official client shipped. Maintainer production-for-invite bar met (R10 `PRG-1`..`PRG-4`). Human field proof (`PRG-5`) deferred.

Full tables, real-world readiness, and next work: **[project-status.md](project-status.md)**

| Layer | State |
| --- | --- |
| Kernel / protocol | R0–R2 complete; GAP-01..08 closed |
| Official client | Deal loop, workspace, marketplace, transport, global search |
| Production readiness | Maintainer remote E2E + cross-platform proof |
| Mutual aid / promotion | Lane + UX partial; no pro-bono quota policy |

Doc audit (this consolidation): [meta/documentation-audit-2026-08-26.md](meta/documentation-audit-2026-08-26.md)

---

## Verify in five minutes

```bash
cargo run --bin cli -- fixtures run
pnpm stability:pack:quick
cd apps/web && pnpm typecheck
pnpm desktop:deal-loop:smoke
```

Solo testing: [client/testing-without-users.md](client/testing-without-users.md) · Habit pack: [runbooks/stability-regression-pack.md](runbooks/stability-regression-pack.md)

---

## Navigation by role

| Role | Start with |
| --- | --- |
| Anyone lost | **This page** → [project-status.md](project-status.md) |
| Operator / first deploy | [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md) |
| Client developer | [client/development-guide.md](client/development-guide.md) → [client/ui-contract.md](client/ui-contract.md) |
| Protocol / fixtures | [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) → [v0/v0-scenario-fixture-matrix.md](v0/v0-scenario-fixture-matrix.md) |
| Discovery (Aperio → Vectis) | [architecture/aperio-engine-integration.md](architecture/aperio-engine-integration.md) |
| What's next | [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md) |
| Thesis / economics | [foundation/project-thesis.md](foundation/project-thesis.md) |

---

## Pick your path

### Big picture

1. [foundation/project-thesis.md](foundation/project-thesis.md)
2. [foundation/market-operating-model.md](foundation/market-operating-model.md)
3. [foundation/platform-vision-exploration.md](foundation/platform-vision-exploration.md)

### Run a node

1. [runbooks/operator-quickstart.md](runbooks/operator-quickstart.md)
2. [runbooks/operator-security-guide.md](runbooks/operator-security-guide.md)
3. Zero-capital: [runbooks/zero-capital-operator-runbook.md](runbooks/zero-capital-operator-runbook.md)

### Build or test the client

1. [client/client-capabilities.md](client/client-capabilities.md)
2. [client/testing-without-users.md](client/testing-without-users.md)
3. In-app guides: run client → `/help`

### Production-for-invite proof

1. [specs/production-readiness-requirements.md](specs/production-readiness-requirements.md)
2. [runbooks/r10-production-for-invite-runbook.md](runbooks/r10-production-for-invite-runbook.md)
3. Archived execution plan: [archive/roadmap/r10-production-readiness-execution-plan.md](archive/roadmap/r10-production-readiness-execution-plan.md)

---

## Directory map

```text
docs/
  index.md              ← you are here
  project-status.md     ← current state (canonical)
  foundation/           thesis, economics, doctrine
  architecture/         lanes, bridges, system shape
  specs/                locked contracts + protocol backlog
  client/               UI contract, capabilities, dev/testing
  runbooks/             operator procedures
  v0/                   fixtures, abuse matrix, evidence
  roadmap/              progress changelog + session handoff
  archive/              historical plans (roadmap, frontend phases)
  meta/                 audits, sync checklist
```

| Folder | Index |
| --- | --- |
| [specs/](specs/README.md) | Locked contracts |
| [architecture/](architecture/README.md) | Lanes and bridges |
| [foundation/](foundation/README.md) | Thesis and doctrine |
| [client/](client/README.md) | Official client docs |
| [runbooks/](runbooks/README.md) | Operator commands |
| [v0/](v0/README.md) | Fixture matrices |
| [roadmap/](roadmap/README.md) | Changelog + handoff |
| [archive/](archive/README.md) | Historical — not normative |
| [meta/](meta/README.md) | Audits and maintenance |

## Key documents

| Document | Purpose |
| --- | --- |
| [project-status.md](project-status.md) | **What's shipped, gaps, next work** |
| [client/client-capabilities.md](client/client-capabilities.md) | Shipped client behavior |
| [client/ui-contract.md](client/ui-contract.md) | Normative UI rules |
| [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) | Cold-start trust + credits |
| [architecture/software-fixes-lane.md](architecture/software-fixes-lane.md) | Reference digital lane |
| [foundation/market-operating-model.md](foundation/market-operating-model.md) | In-protocol vs off-platform |

## Meta

[meta/docs-sync-checklist.md](meta/docs-sync-checklist.md) — keep docs aligned with code

## Related repo docs

[packages/sdk-ts/STABILITY.md](../packages/sdk-ts/STABILITY.md) — SDK semver policy
