# Start Here

**If you feel lost, read only this page first.** Everything else in `/docs` is reference — not required on day one.

Last updated: July 2026

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

## Where we are right now

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

**In-person / low-trust onboarding (complete):** [roadmap/r8-convenience-transport-execution-plan.md](roadmap/r8-convenience-transport-execution-plan.md) — QR, signed bundles, and experimental handoff wizard without weakening settlement.

Stack-ranked backlog: [specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md)

## Verify in five minutes

```bash
cargo run --bin cli -- fixtures run    # 24 valid, 25 invalid — all should pass
pnpm v3:discovery-bridge:smoke         # lane classifier golden
pnpm v3:aperio-import:smoke            # Aperio JSONL → Vectis offer drafts
pnpm v3:aperio-live-drill              # Aperio engine → import → review → ingest
pnpm r7:mobile:readiness               # Android scaffold + mobile pinned-node wiring
pnpm r7:client:readiness               # desktop cargo check + R4 audit + web + mobile bundle
pnpm ci:readiness                        # PR CI gate (typecheck, audits, smokes)
```

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
2. [client/testing-without-users.md](client/testing-without-users.md)
3. In-app user guides: run web client → `/help`

### "I want to know what's next"

Current stage is **archived for solo maintainer** (R9 + R6-PD maintainer). No required next gate without hardware or a counterparty.

[specs/protocol-priority-backlog.md](specs/protocol-priority-backlog.md) — optional later:

1. Android NFC device smoke (optional) — [runbooks/r9-nfc-operator-runbook.md](runbooks/r9-nfc-operator-runbook.md)
2. R6-PD field proof — **deferred** (needs a counterparty) — [runbooks/r6-post-deployment-proof-runbook.md](runbooks/r6-post-deployment-proof-runbook.md)
3. R7-M1 iOS — **deferred** (needs macOS) — [runbooks/r7-m1-ios-mac-host-handoff-runbook.md](runbooks/r7-m1-ios-mac-host-handoff-runbook.md)
4. Mobile sidecar policy (locked) — [specs/mobile-sidecar-policy-spec.md](specs/mobile-sidecar-policy-spec.md)

R8 + R9 signed off; R6-PD maintainer closeout via `pnpm r6:pd`.

## Doc map (when you need more)

| Folder | What's in it |
| --- | --- |
| [specs/](specs/README.md) | Locked contracts — build against these |
| [architecture/](architecture/README.md) | System design, lanes, bridges |
| [foundation/](foundation/README.md) | Thesis, economics, doctrine |
| [v0/](v0/README.md) | Fixture matrices, abuse tests, evidence |
| [runbooks/](runbooks/README.md) | Operator commands |
| [roadmap/](roadmap/README.md) | R0–R9 tracks, progress, session log |
| [archive/](archive/legacy-dcos-index.md) | Legacy — not normative |

Full index: [README.md](README.md)
