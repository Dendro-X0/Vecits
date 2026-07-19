# R9 halo operator runbook (LAN market node)

Purpose: run a **designated local `vectis-node`** on market / meetup Wi-Fi, pin clients to it, then **pull-reconcile** with an upstream peer when a gateway is available.

Status: `active` (R9-H2 maintainer smoke shipped)

Last updated: July 2026

Spec: [../specs/r9-offline-transport-spec.md](../specs/r9-offline-transport-spec.md)

## Honesty first

| Situation | Say |
| --- | --- |
| Clients pinned only to the LAN node | Local operator node — not yet reconciled with upstream |
| Event accepted by the halo | Accepted by local node (not globally settled) |
| Upstream finished `node sync pull` | Synced with peer \<id\> |

Never claim “Paid / Complete / Final” without a kernel `as_of` read on the node the user is pinned to.

## Client join (R9-H1)

1. Operator: Settings → Connection → **Join this node** QR (absolute LAN URL).
2. Client: Scan/paste into **Dashboard → Import**, or Settings → **Pin a market / LAN node**.
3. Confirm screen shows **hostname/IP** (and port) before pin is saved.
4. Marketplace trust bar shows: **Local operator node — not yet reconciled with upstream** when the pinned host is private/LAN.

Design: [../specs/r9-h1-halo-join-ux-design.md](../specs/r9-h1-halo-join-ux-design.md)

```bash
pnpm r9:halo:join-unit
```

## Automated maintainer smoke (R9-G4)

Proves halo → upstream pull convergence on loopback (no travel router required):

```bash
pnpm r9:halo:smoke
# or skip rebuild:
pnpm r9:halo:smoke -- --no-build
```

Evidence under `target/tmp/r9-halo-<timestamp>/`:

- `r9-halo-smoke-summary.json`
- `halo-operator-notes.md`
- `two-node-drill-summary.json` (shared convergence core)

Related federation drill (same sync machinery): `pnpm r5:two-node:drill`

## Manual market-in-a-box

### 1. Start the halo node on LAN

```bash
npm run v1:build-release
BIN="$(npm run -s v1:resolve-release)"

"$BIN" node init --data-dir ./.data/halo
"$BIN" node serve --data-dir ./.data/halo --bind 0.0.0.0:7878
```

Confirm from another device on the same Wi-Fi:

```bash
curl http://<halo-lan-ip>:7878/health
```

### 2. Pin clients

Share a join QR/NFC (R9-H1 / R8 Tier 0) with absolute `http://<halo-lan-ip>:7878` (or HTTPS when you terminate TLS). Clients must **confirm** the host before saving the pin.

### 3. Transact on the halo

Sign and `POST /events` as usual against the pinned URL. Local marketplace state is whatever the halo replay accepts.

### 4. Reconcile upstream when uplink returns

On the **upstream** (or mirror) data dir:

```json
{
  "version": 1,
  "peers": [
    {
      "id": "halo",
      "base_url": "http://<halo-lan-ip>:7878",
      "enabled": true
    }
  ]
}
```

```bash
"$BIN" node sync pull --data-dir ./.data/upstream --peer halo --limit 200 --max-pages 100
"$BIN" node sync status --data-dir ./.data/upstream
```

Duplicates / bad nonces fail closed on ingest — transport does not weaken replay.

### 5. Optional: halo pulls from upstream

If the market node should absorb policy or history from a gateway, reverse peer direction and pull on the halo instead. R9 still assumes **one writer topology per market session** when possible.

## Security notes

- Open Wi-Fi invites fake halos — require explicit pin confirm (fingerprint optional later).
- Cleartext HTTP is acceptable for **maintainer / demo** halos; prefer HTTPS for lasting deployments.
- Do not dual-write the same order to two nodes in R9.

## Non-goals

- Phone mesh gossip
- Offline mint or merging conflicting partition spends
- Promoting experimental offline economic lanes to production gates

## Related

- [two-node-deployment-runbook.md](two-node-deployment-runbook.md)
- [../v0/v0-track4-sync-spec.md](../v0/v0-track4-sync-spec.md)
- [../roadmap/r9-offline-transport-execution-plan.md](../roadmap/r9-offline-transport-execution-plan.md)
