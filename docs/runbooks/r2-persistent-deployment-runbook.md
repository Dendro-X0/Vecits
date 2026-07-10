# R2 Persistent Deployment Runbook (R2-P1)

Purpose: deploy a maintainer node that stays up, backs up on schedule, and passes health checks.

Last updated: July 2026

## Scope (R2-P1)

| Requirement | Deliverable |
| --- | --- |
| Persistent node | `vectis-node serve` under process manager or Docker |
| Health check | `GET /health` returns `"status":"ok"` |
| Backup schedule | daily backup via cron / Task Scheduler / systemd timer |
| Verification | `npm run r2:deploy-smoke` |

**Production data directory:** `./.data/r2` (R2 exchange proof log — do not mix with fixture experiments in `./.data/default`).

## Quick verify (local)

```bash
npm run v1:build-release
npm run r2:deploy-smoke -- --with-backup
```

Pass criteria: `R2-P1 deploy smoke passed` and backup manifest written under `target/backups/r2-<date>/`.

## Option A — Release binary (Linux VPS)

### 1. Install

```bash
npm run v1:build-release
BIN="$(npm run -s v1:resolve-release)"
sudo install -d /opt/vectis/bin /var/lib/vectis/data
sudo install -m 755 "$BIN" /opt/vectis/bin/vectis-node
sudo /opt/vectis/bin/vectis-node node init --data-dir /var/lib/vectis/data
```

Copy `deploy/systemd/vectis-node.service` to `/etc/systemd/system/`, adjust paths, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vectis-node
curl http://127.0.0.1:7878/health
```

Put nginx/Caddy in front if exposing beyond localhost.

### 2. Daily backup (systemd timer)

```bash
sudo install -d /var/backups/vectis
sudo cp deploy/systemd/vectis-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vectis-backup.timer
```

Manual backup:

```bash
./deploy/scripts/r2-backup.sh /var/lib/vectis/data /var/backups/vectis
```

## Option B — Docker (production compose)

From repo root:

```bash
docker compose -f deploy/docker-compose.production.yml up --build -d
curl http://127.0.0.1:7878/health
```

Data persists in Docker volume `vectis-data`. Back up by copying the volume or running `npm run r2:backup` against a mounted host path.

## Option C — Windows (maintainer workstation)

### Serve (foreground or separate terminal)

```powershell
npm run v1:build-release
$bin = npm run -s v1:resolve-release
& $bin node serve --data-dir .\.data\r2 --bind 127.0.0.1:7878
curl http://127.0.0.1:7878/health
```

### Daily backup (Task Scheduler)

```powershell
.\deploy\windows\Register-VectisBackupTask.ps1 -DataDir "E:\Experimental projects\vectis\.data\r2"
```

Manual backup:

```bash
npm run r2:backup
```

## Backup commands (all platforms)

```bash
npm run r2:backup
# custom paths:
node ./scripts/r2-backup.mjs --data-dir ./.data/r2 --dest ./target/backups/manual-run
```

Weekly: add `npm run r2:evidence-export -- --data-dir ./.data/r2`.

## Uptime expectations

| Check | Frequency |
| --- | --- |
| `GET /health` | every 1–5 min (monitoring) |
| `npm run r2:backup` | daily |
| `npm run r2:restore-drill` | weekly (after evidence export) |

## Related docs

- `docs/runbooks/operator-backup-runbook.md`
- `docs/runbooks/r2-exchange-runbook.md`
- `docs/runbooks/operator-quickstart.md`
- `docs/specs/deployment-distribution-spec.md`
