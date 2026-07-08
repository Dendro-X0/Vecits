# Two-Node Deployment Runbook

Purpose: operator guide for federation-style deployments — source node publishes events, sink node sync-pulls and converges to identical replay/discovery/policy state.

Status: `active`

Last updated: July 2026

## When to use two nodes

| Role | Responsibility |
| --- | --- |
| **Source** | Primary writer — ingests signed events, serves read/sync API |
| **Sink** | Replica — pull-syncs from source, serves local read API |

Typical layouts:

- **LAN federation** — community source + member sink on edge hardware
- **Operator + mirror** — primary node + read-only backup mirror
- **Staging** — production source + pre-production sink for policy pack rehearsal

## Prerequisites

- Release binary built or downloaded (`npm run v1:build-release`)
- Network reachability from sink → source HTTP API
- Optional: policy pack JSON reviewed offline ([policy-pack-export-import.md](policy-pack-export-import.md))

## Automated drill (GA4 release variant)

Verifies source/sink convergence using release artifacts and alpha marketplace fixtures:

```bash
pnpm --filter @new-start/sdk-ts build   # only if using policy pack option
npm run r5:two-node:drill
```

With policy pack convergence (L4):

```bash
npm run r5:two-node:drill -- --with-policy-pack fixtures/policy-packs/community-lanes-restricted.json
```

Skip release rebuild when binary already exists:

```bash
npm run r5:two-node:drill -- --no-build
```

Evidence written to `target/tmp/r5-two-node-<timestamp>/`:

- `two-node-drill-summary.json` — replay/discovery hash equality
- `operator-notes.md` — run metadata

## Manual deployment

### 1. Build or resolve release binary

```bash
npm run v1:build-release
BIN="$(npm run -s v1:resolve-release)"
```

### 2. Initialize source node

```bash
"$BIN" node init --data-dir ./vectis-data-source
"$BIN" node ingest --data-dir ./vectis-data-source --in fixtures/valid/marketplace-accept.jsonl
"$BIN" node serve --data-dir ./vectis-data-source --bind 0.0.0.0:7878 \
  --ingest-rate-limit-max 120 --ingest-rate-limit-window-seconds 60
```

For LAN-only source nodes, omit rate-limit flags (disabled by default).

Verify: `curl http://<source-host>:7878/health`

### 3. Configure sink peers

Create `./vectis-data-sink/peers.json`:

```json
{
  "version": 1,
  "peers": [
    {
      "id": "source",
      "base_url": "http://<source-host>:7878",
      "enabled": true
    }
  ]
}
```

Optional: add `read_token` if source requires authenticated reads.

### 4. Initialize sink and pull

```bash
"$BIN" node init --data-dir ./vectis-data-sink
# copy peers.json into vectis-data-sink/ before or after init

"$BIN" node sync pull --data-dir ./vectis-data-sink --peer source --limit 200 --max-pages 100
"$BIN" node sync status --data-dir ./vectis-data-sink
"$BIN" node serve --data-dir ./vectis-data-sink --bind 127.0.0.1:7879
```

### 5. Verify convergence

Pick a shared `as_of` timestamp after the last ingested event:

```bash
AS_OF="2026-03-01T00:15:00Z"
curl "http://<source-host>:7878/state/replay?as_of=$AS_OF" > /tmp/source-replay.json
curl "http://127.0.0.1:7879/state/replay?as_of=$AS_OF" > /tmp/sink-replay.json
curl "http://<source-host>:7878/state/discovery?as_of=$AS_OF&alpha_defaults=1&limit=50" > /tmp/source-discovery.json
curl "http://127.0.0.1:7879/state/discovery?as_of=$AS_OF&alpha_defaults=1&limit=50" > /tmp/sink-discovery.json
```

Compare `data.state` and `data` sections — they must match byte-for-byte at the same `as_of`.

### 6. Policy pack rollout (optional)

1. Sign `PolicyUpdate` from a policy pack on the **source** node only.
2. Sink runs `sync pull` after `effectiveAt`.
3. Verify both nodes report the same `effective_version`:

```bash
curl "http://<source-host>:7878/state/policy?as_of=2026-03-03T00:00:00Z"
curl "http://127.0.0.1:7879/state/policy?as_of=2026-03-03T00:00:00Z"
```

See [policy-pack-export-import.md](policy-pack-export-import.md).

## Idempotent re-pull

Re-running `sync pull` on an up-to-date sink should not duplicate events. The automated drill performs a second pull to exercise this path.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Pull returns 0 events | Source has ingested events; `peers.json` `base_url` correct |
| Replay hash mismatch | Clock skew; sink missing events; compare `sync status` cursors |
| Policy version mismatch | `effectiveAt` in the past relative to `as_of`; pull after policy ingest |
| Auth failures | `read_token` in peers.json matches source config |

## Verification matrix

| Gate | Dev | Release |
| --- | --- | --- |
| GA4 two-node convergence | `cargo test -p node --test sync sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views` | `npm run r5:two-node:drill` |
| Policy pack L4 | — | `npm run r5:two-node:drill -- --with-policy-pack fixtures/policy-packs/community-lanes-restricted.json` |
| Three-node bootstrap | `npm run v1:ga6-drill` | `npm run v1:ga6-drill:release` |

## Related

- [operator-quickstart.md](operator-quickstart.md)
- [policy-pack-export-import.md](policy-pack-export-import.md)
- [phase1-preflight-checklist.md](phase1-preflight-checklist.md) — GA4 definition
