# Zero-capital operator runbook

Purpose: run Vectis in production on **participant-owned hardware** with **no project-funded VPS**. Implements [../specs/zero-capital-operator-topology-design.md](../specs/zero-capital-operator-topology-design.md).

Status: `active`

Last updated: July 2026

## Choose a topology

| ID | Use when |
| --- | --- |
| **ZC-1** | Solo learning, self-drill, desktop daily driver |
| **ZC-2** | Second device or counterparty on LAN / Tailscale |
| **ZC-3** | Two+ volunteers keep pull replicas |
| **ZC-4** | Need QR/NFC/bundle to move pin URL or events onto a host |

## ZC-1 — Solo desktop

### Option A — Desktop app (preferred)

1. Launch the official desktop client (Tauri). Sidecar starts `vectis-node` on `http://127.0.0.1:7878`.
2. Confirm health from the shell or `curl http://127.0.0.1:7878/health`.
3. Keep using the same machine profile / data dir across sessions (do not wipe app data between “production” deals).
4. Backup: copy the node data directory on a schedule — see [operator-backup-runbook.md](operator-backup-runbook.md).

### Option B — CLI release binary

```bash
pnpm v1:build-release
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node init --data-dir ./.data/zc1
"$BIN" node serve --data-dir ./.data/zc1 --bind 127.0.0.1:7878
curl http://127.0.0.1:7878/health
```

Pin the web client to `http://127.0.0.1:7878`.

### First exchange

Follow trust bootstrap + contribution mint, then a `software-fixes` (or other artifact) lane deal:

- Spec: [../specs/trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md)
- Persistence smoke: `pnpm r2:deploy-smoke -- --with-backup`

## ZC-2 — Invite a second device (no VPS)

1. On the host, serve on a reachable address:
   - **Preferred:** install Tailscale (or similar); bind/serve so the Tailscale IP:7878 is reachable by the peer.
   - **LAN meetup:** bind `0.0.0.0:7878` only on trusted Wi-Fi; firewall if possible.
2. Create join QR / copy absolute pin URL (Settings → Connection → Join this node).
3. On the second device: Import / Pin → confirm hostname/IP → save.
4. Trust bar must show local/LAN honesty until upstream sync exists.
5. Run the deal only on-log. If they ask for an activation fee in fiat: **refuse** — not a Vectis deal.

Halo detail: [r9-halo-operator-runbook.md](r9-halo-operator-runbook.md)

Maintainer sync shape (no travel router):

```bash
pnpm r9:halo:smoke
pnpm r9:halo:join-unit
```

## ZC-3 — Replica set

1. Host A: persistent data dir + serve (as ZC-1/2).
2. Host B: `node init`, configure `peers.json` to pull A (Track 4).
3. Run pull until cursors advance; spot-check the same `event_id` on both.
4. Clients may pin A or B; document which URL is primary during market hours.
5. **Abandonment drill:** stop A → re-pin client to B → confirm order state → keep notes with backups.

```bash
# After peers.json is set (see Track 4 spec)
# vectis-node node sync pull --data-dir <b> --peer <a-id>
pnpm r9:halo:smoke   # loopback proof of pull convergence
```

## ZC-4 — Carriers

Use R8/R9 QR, NFC, or signed bundles to move pin URLs or event packages onto a ZC-1/2/3 host. Carriers are not settlement.

- [r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md)
- [r9-nfc-operator-runbook.md](r9-nfc-operator-runbook.md)

## Honesty cheat sheet

| Say this | Not this |
| --- | --- |
| Local node on this device | Vectis cloud |
| Local operator node — not yet reconciled | Globally settled |
| Synced with peer \<id\> | Final everywhere |
| Off-platform fee is not protocol truth | Paid (when only PayPal moved) |

## Standing verification

```bash
pnpm zc:s4          # ZC-S4 maintainer closeout (ZC-1 + join + halo)
pnpm zc:s4:quick    # same with --no-build
```

Claim: maintainer smoke. Not a human counterparty field proof.
