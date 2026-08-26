# R2 First Deployment Proof — Execution Plan

Kickoff: July 2026

**Status: complete** (July 2026). All slices `R2-P1`..`R2-P5` done; evidence in `docs/roadmap/progress.md` § 2026-07.

Purpose: prove the Vectis kernel works outside fixture/demo flows with one persistent operator instance and one completed real structured exchange.

Prerequisite: **R1 complete** (release binary, init, health, GA6 release drill, in-memory replay API).

## Scope

R2 is **operator proof**, not new protocol features. Success means:

- one persistent node deployment (maintainer-hosted or VPS)
- one completed `project-maintenance` or `software-fixes` exchange with a real counterparty
- verifiable evidence packet (event log export, snapshot, replay hash, operator notes)

## Slices

| ID | Status | Scope | Acceptance |
| --- | --- | --- | --- |
| `R2-P1` | `completed` | Deploy persistent node | `npm run r2:deploy-smoke -- --with-backup` |
| `R2-P2` | `completed` | Complete one real exchange | `npm run r2:exchange-drill` |
| `R2-P3` | `completed` | Deployment evidence packet | `npm run r2:evidence-pack` |
| `R2-P4` | `completed` | Restore drill on production backup | RDG-3 via evidence pack |
| `R2-P5` | `completed` | Update readiness docs | evidence linked in `docs/roadmap/progress.md` |

## Minimum proof bar

One counterparty, one completed milestone, one verifiable event log export.

## Recommended operator sequence

1. Build release: `npm run v1:build-release`
2. Initialize:

```bash
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node init --data-dir ./vectis-data
```

3. Serve (systemd, Docker, or foreground):

```bash
"$BIN" node serve --data-dir ./vectis-data --bind 127.0.0.1:7878
```
4. Onboard counterparty via invite/vouch flow (see `docs/runbooks/r2-exchange-runbook.md`)
5. Run one `project-maintenance` or `software-fixes` milestone exchange:

```bash
npm run r2:exchange-drill
# or with human counterparty: follow Option B in docs/runbooks/r2-exchange-runbook.md
```
6. Export evidence:

```bash
npm run r2:evidence-export
# optional: npm run r2:evidence-export -- --out ./r2-evidence-archive
```

7. Restore drill on copied backup (RDG-3):

```bash
npm run r2:restore-drill
# or: npm run r2:restore-drill -- --evidence <export-dir>
```

See `docs/runbooks/operator-backup-runbook.md` for backup schedule.

## Evidence packet template

```text
r2-evidence-<date>/
  events.log
  snapshot.json
  manifest.json
  replay-state-hash.txt
  operator-notes.md
  health.json                 # curl /health at time of export
```

## Gates

| Gate | Criterion |
| --- | --- |
| `RG-2` | Already satisfied by R1 release install + preflight |
| `RG-3` | First real exchange evidence (R2 sign-off) |

## Non-goals (R2)

- Public multi-tenant hosting
- Aperio discovery bridge (R3)
- Policy pack federation (R5)
- Compute-job lane production (R6)

## Next action

**R2 complete.** Next: **R3-B1** (Aperio standalone CLI) or **R4** client/kernel audit slices. Re-run `npm run r2:evidence-pack` weekly on production backups.
