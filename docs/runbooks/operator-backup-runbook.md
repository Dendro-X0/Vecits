# Operator Backup Runbook

Purpose: minimum backup and restore procedure for a persistent Vectis node (R2 deployment proof).

Last updated: July 2026

## What to back up

Copy the entire operator data directory (default `./.data/r2` for R2 proof):

```text
.data/r2/
  events.log          # authoritative append-only log
  node.db             # SQLite projection (rebuildable from events.log)
  manifest.json       # kernel version metadata
  peers.json          # optional sync peers
  snapshots/          # optional point-in-time exports
```

**Primary artifact:** `events.log`. If you can only back up one file, back up `events.log`.

## Backup schedule (recommended)

| Frequency | Action |
| --- | --- |
| Daily | Copy `events.log` to off-host storage |
| Weekly | Full data-dir copy + evidence export (below) |
| Before upgrades | Full data-dir copy + `npm run r2:evidence-export` |

Use your host scheduler (`cron`, Task Scheduler, systemd timer) or the repo helpers:

```bash
npm run r2:backup
```

Linux systemd timer: see `deploy/systemd/vectis-backup.timer` and `docs/runbooks/r2-persistent-deployment-runbook.md`.

Windows Task Scheduler:

```powershell
.\deploy\windows\Register-VectisBackupTask.ps1
```

Manual Bash example:

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="./.data/default"
DEST="/backup/vectis/$(date +%Y-%m-%d)"
mkdir -p "$DEST"
cp -a "$SRC/events.log" "$SRC/manifest.json" "$DEST/"
[ -f "$SRC/peers.json" ] && cp -a "$SRC/peers.json" "$DEST/"
```

## Evidence export (R2-P3)

One-shot export + restore drill (R2-P3 + R2-P4):

```bash
npm run r2:evidence-pack
```

Archive copy: `target/r2-evidence-archive/r2-evidence-<timestamp>/`

Export only:

```bash
npm run r2:evidence-export -- --data-dir ./.data/r2
```

Produces under `target/tmp/r2-evidence-<timestamp>/`:

- `events.log`, `manifest.json`, `snapshot.json`
- `replay-state-hash.txt`
- `health.json` (when node is reachable)
- `evidence-summary.json`
- `operator-notes.template.md`

Fill in `operator-notes.md` with deployment host, counterparty, lane, and outcome before archiving.

## Restore drill (R2-P4 / RDG-3)

After exporting evidence, verify backup integrity:

```bash
npm run r2:restore-drill
# or: npm run r2:restore-drill -- --evidence target/tmp/r2-evidence-<timestamp>
```

Pass criteria: replay state hash matches `replay-state-hash.txt` from the export.

## Manual restore

1. Stop the node.
2. Initialize a fresh data directory or wipe the existing one.
3. Restore `events.log` (and optionally `manifest.json`, `peers.json`).
4. Start the node; SQLite rebuilds from the log on ingest/replay paths.

```bash
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node init --data-dir ./.data/restored
cp /backup/vectis/2026-07-01/events.log ./.data/restored/
"$BIN" log replay --in ./.data/restored/events.log --out /tmp/replay-check.json
"$BIN" node serve --data-dir ./.data/restored --bind 127.0.0.1:7878
```

## Related docs

- `docs/runbooks/operator-quickstart.md`
- `docs/roadmap/r2-deployment-proof-execution-plan.md`
- `docs/specs/deployment-distribution-spec.md`
