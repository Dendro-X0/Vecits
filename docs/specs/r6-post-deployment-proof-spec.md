# R6 — Post-deployment lane proof spec

Purpose: define proof that a community operator can run a **real structured exchange** on an R6 community lane outside fixture ingest — extending R2 deployment proof to the lane template catalog.

Status: `draft`

Last updated: July 2026

## Context

- **R2** proved one exchange on `project-maintenance` / `software-fixes` (RG-3).
- **R6-L1..L3** added compute-job, community lane catalog, and offline lane guards.
- This spec closes the gap: **community lane deployment proof** with HTTP submission and exportable evidence.

## Proof bar (minimum)

| Criterion | Required |
| --- | --- |
| Lane | One **community artifact lane** from R6-L2 catalog (not offline experimental) |
| Counterparties | Two distinct Ed25519 identities (buyer + provider) |
| Submission path | HTTP `POST /events` to operator node — **not** `node ingest fixtures/...` |
| Outcome | Order status `closed` (milestone accepted) |
| Evidence | Exportable event log + operator notes (R2 evidence pattern) |

Optional stretch: human counterparty on persistent host (preferred narrative over solo drill).

## Phases

### Phase A — Automated readiness (maintainer/operator preflight)

Run before attempting field proof:

```bash
pnpm r6:post-deployment:readiness
```

Pass = lane registry/fixtures aligned, offline guards green, compute-job drill path available.

### Phase B — Solo HTTP lane drill (operator self-proof)

Automated exchange on chosen community lane (same machinery as R2, extended lanes):

```bash
pnpm r6:post-deployment:drill -- --lane documentation --data-dir ./vectis-data-r6-docs
```

Uses `r2:exchange-drill` with R6 `ALLOWED_LANES`. Not a substitute for human counterparty proof, but validates HTTP path per lane.

### Phase B2 — All community artifact lanes (maintainer regression)

```bash
pnpm r6:post-deployment:multi-lane-drill -- --no-build
```

Pass = closed order on each of the seven R6-L2 community artifact lanes via isolated data dirs.

### Phase C — Human counterparty (field proof)

1. Persistent node (see [r2-persistent-deployment-runbook.md](../runbooks/r2-persistent-deployment-runbook.md)).
2. Provider posts offer on chosen lane; buyer orders, funds, accepts delivery.
3. Export evidence:

```bash
pnpm r6:post-deployment:phase-c:packet -- --data-dir <dir> --lane <lane> --order-id <id> --buyer-pubkey <hex> --provider-pubkey <hex> --base-url <url>
```

Maintainer tooling smoke (not field proof): `pnpm r6:post-deployment:phase-c:smoke`

Fill operator notes with real pubkeys and lane id.

## What does not count

- Direct fixture ingest into production data dir
- Exchange stopping before milestone accept
- Offline lanes (`local-resource-exchange`, `physical-handoff`) for first community proof
- UI-only demo without kernel-closed order

## Acceptance mapping

| ID | Scope | Exit |
| --- | --- | --- |
| R6-PD-A | Readiness bundle | `pnpm r6:post-deployment:readiness` pass |
| R6-PD-B | Solo lane drill | `pnpm r6:post-deployment:drill -- --lane <lane>` pass |
| R6-PD-B2 | All community artifact lanes (solo HTTP) | `pnpm r6:post-deployment:multi-lane-drill -- --no-build` pass |
| R6-PD-C | Human counterparty | Evidence packet + closed order on persistent host; `pnpm r6:post-deployment:phase-c:packet` |

## Related docs

- [../architecture/lane-template-catalog.md](../architecture/lane-template-catalog.md)
- [../runbooks/community-lane-templates-runbook.md](../runbooks/community-lane-templates-runbook.md)
- [../runbooks/r2-exchange-runbook.md](../runbooks/r2-exchange-runbook.md)
- [../runbooks/r6-post-deployment-proof-runbook.md](../runbooks/r6-post-deployment-proof-runbook.md)
