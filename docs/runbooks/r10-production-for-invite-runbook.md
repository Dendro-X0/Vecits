# R10 — Production for invite (operator entry)

Purpose: single entry for bringing a participant-hosted node from **local-verified** to **production-for-invite** proof language. Implements [../roadmap/r10-production-readiness-execution-plan.md](../roadmap/r10-production-readiness-execution-plan.md).

Status: `active` (maintainer invite bar met; `PRG-5` deferred)

Last updated: August 2026

Requirements: [../specs/production-readiness-requirements.md](../specs/production-readiness-requirements.md) (locked)  
Design: [../specs/remote-e2e-cross-platform-design.md](../specs/remote-e2e-cross-platform-design.md) (locked)

## Claim language (do not over-claim)

| Claim | When |
| --- | --- |
| Local verified | Fixtures + `pnpm stability:pack:quick` + ZC-1 |
| Remote pin (`PRG-1`) | Peer `/health` + client pin with honesty label (LAN/Tailscale only) |
| Remote E2E (`PRG-2`) | `software-fixes` happy path against remote host URL |
| Cross-platform (`PRG-3`) | Windows **and** Linux host SF1 rows |
| Production for invite | FR-01..FR-10 + `PRG-1`..`PRG-3` (human counterparty optional) |

Public TLS/VPS does **not** count for remote gates (FR lock Q1 = A).

## Prerequisites

1. Release `vectis-node` (not `cargo run` for claim runs)
2. Persistent data dir (prefer `.data/zc1`)
3. Reachable bind: Tailscale IP or trusted LAN (`0.0.0.0:7878` with peer allowlist)
4. Optional: second device for pin honesty

```bash
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node serve --data-dir ./.data/zc1 --bind 0.0.0.0:7878
```

### Linux host via Docker (XP-3)

Repo root has a multi-stage `Dockerfile` and `.dockerignore` (keeps build context small). Example maintainer run:

```bash
docker build -t vectis-node:r10-xp3 .
docker run -d --name vectis-r10-xp3 -p 7879:7878 -v "$(pwd)/.data/r10-linux-xp3:/data" vectis-node:r10-xp3
export VECTIS_REMOTE_BASE_URL=http://192.168.1.4:7879   # LAN IP of the Docker host
pnpm r10:remote:e2e-sf1
```

## Repeatable remote scripts

Set the remote base URL (LAN or Tailscale — not loopback for claim runs):

```bash
export VECTIS_REMOTE_BASE_URL=http://192.168.1.4:7878
# or: http://100.x.y.z:7878
```

### Health (`R10-E1`)

```bash
pnpm r10:remote:health
pnpm r10:remote:health -- --export
```

### Software-fixes E2E (`R10-E2` / SF1)

Host must already be serving. This script POSTs signed events to the remote URL and verifies the order closes:

```bash
pnpm r10:remote:e2e-sf1
# or:
pnpm r10:remote:e2e-sf1 -- --base-url http://192.168.1.4:7878
```

Evidence lands under `target/r10-evidence/<runId>/`.

### Standing habit

```bash
pnpm stability:pack:quick
```

## Checklist (invite bar)

- [x] `PRG-1` — peer health + Local operator node pin
- [x] `PRG-2` — remote SF1 order closed
- [x] `PRG-3` — Windows host SF1 **and** Linux host SF1
- [ ] Operator backup known (`pnpm r2:backup -- --data-dir ./.data/zc1`)
- [ ] Honesty: no off-protocol “activation fee” (SOC-01)

Maintainer evidence (August 2026): `target/r10-evidence/r10-b1-20260825/` (`PRG-1`), `r10-c1-sf1-20260825/` (`PRG-2`/XP-2), `r10-d2-xp3-20260825/` (XP-3). Tooling: `pnpm r10:remote:*`.

## Related

- [zero-capital-zc2-field-checklist.md](zero-capital-zc2-field-checklist.md)
- [zero-capital-operator-runbook.md](zero-capital-operator-runbook.md)
- [stability-regression-pack.md](stability-regression-pack.md)
- [r2-exchange-runbook.md](r2-exchange-runbook.md)

← [Runbooks](README.md) · [Docs index](../index.md)
