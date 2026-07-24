# Zero-capital cold-start checklist

Purpose: after a **machine reboot** (or any full stop), bring a participant-hosted Vectis node back to a known-good state without wiping production data. Complements [zero-capital-operator-runbook.md](zero-capital-operator-runbook.md).

Status: `active`

Last updated: July 2026

**Not** trust-bootstrap “cold-start network” ([../specs/trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md)). This checklist is **operator machine restart**.

Claim: maintainer operable after reboot. Not a human counterparty field proof.

## Default data dir

| Role | Path |
| --- | --- |
| **ZC-1 production (preferred)** | `./.data/zc1` |
| R2 proof / legacy persistent | `./.data/r2` |
| Throwaway / quickstart | `./.data/default` — do **not** use for deals you care about |

See [`.data/README.md`](../../.data/README.md).

## Preflight (before you reboot next time)

- [ ] Know which data dir is production (`zc1` recommended).
- [ ] Last backup exists under `target/backups/` or off-host copy — [operator-backup-runbook.md](operator-backup-runbook.md).
- [ ] Release binary builds once when convenient: `pnpm v1:build-release`.

## After reboot — manual path (ZC-1 CLI)

### 1. Confirm data still exists

```bash
ls ./.data/zc1/manifest.json ./.data/zc1/events.log
```

If missing: restore from backup first — do **not** `node init` over a path that should have history unless you intend a fresh network.

### 2. Start the node (same dir as before)

```bash
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node serve --data-dir ./.data/zc1 --bind 127.0.0.1:7878
```

Desktop app path: launch Tauri; confirm sidecar uses the same profile / data dir.

### 3. Health

```bash
curl http://127.0.0.1:7878/health
```

Expect `"status":"ok"` (or equivalent ok payload).

### 4. Backup verify

```bash
pnpm r2:backup -- --data-dir ./.data/zc1
```

Confirm the printed destination contains `events.log` + `manifest.json`.

### 5. Join / halo honesty helpers (optional but recommended)

```bash
pnpm r9:halo:join-unit
pnpm r9:halo:smoke
```

### 6. Client pin

- Web/desktop Settings → Connection → pin `http://127.0.0.1:7878` (or your Tailscale URL for ZC-2).
- Trust bar must stay honest for LAN pins — [r9-halo-operator-runbook.md](r9-halo-operator-runbook.md).

### 7. Spot-check one known order (if you have deals)

Open `/dashboard/transactions` or `GET /orders/<id>` for an order you remember. If empty after a successful prior deal: stop and restore from backup before posting new events.

## After reboot — automated verify

Assumes `./.data/zc1` already has a `manifest.json` (fails closed if not — will not silent-init).

```bash
pnpm zc:cold-start          # build release if needed + verify
pnpm zc:cold-start:quick    # --no-build
```

Override dir:

```bash
node ./scripts/zc-cold-start-verify.mjs --data-dir ./.data/r2 --no-build
```

First-time only (creates dir if missing — not for post-reboot):

```bash
node ./scripts/zc-cold-start-verify.mjs --allow-init
```

Full closeout (includes deploy smoke that may init if missing): `pnpm zc:s4`.

## Pass / fail

| Pass | Fail |
| --- | --- |
| Existing data dir intact | `node init` on a path that already had deals |
| Health ok on same bind URL clients use | Pinning a different ephemeral port without updating clients |
| Backup wrote `events.log` | Backup skipped because “node is local” |
| Join/halo units green | Claiming field proof from this checklist |

## Related

- [zero-capital-operator-runbook.md](zero-capital-operator-runbook.md)
- [../specs/zero-capital-operator-topology-design.md](../specs/zero-capital-operator-topology-design.md)
- [operator-backup-runbook.md](operator-backup-runbook.md)
- [operator-quickstart.md](operator-quickstart.md)

← [Runbooks](README.md) · [Docs index](../index.md)
