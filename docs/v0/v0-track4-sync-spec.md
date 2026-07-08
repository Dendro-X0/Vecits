# V0 Track 4 — Pull Replication + Bootstrap Snapshots

This document captures the implemented Track 4.0, 4.1, and 4.2 sync contracts.

## Scope

- transport remains pull-only
- deterministic replay remains protocol authority
- write APIs remain unchanged (`POST /events`, `POST /events/batch`)
- Track 4.2 adds manual snapshot bootstrap as an acceleration layer

## Peer configuration

Each node reads `<data-dir>/peers.json` (schema v1):

```json
{
  "version": 1,
  "read_token": "optional inbound bearer token",
  "peers": [
    {
      "id": "peer-a",
      "base_url": "http://127.0.0.1:7979",
      "bearer_token": "optional outbound bearer token",
      "enabled": true
    }
  ]
}
```

Validation rules:

- `id` must be unique and non-empty
- `base_url` must be absolute `http://` or `https://`
- trailing slash is normalized away
- `enabled` defaults to `true`

## Track 4.0 (one-shot CLI pull)

`node sync pull` workflow:

1. load peers config and resolve selected peers
2. load `peer_sync_state.last_remote_cursor` per peer
3. pull pages from `GET /events?cursor=<cursor>&limit=<n>`
4. ingest each envelope through normal node validation
5. persist cursor to highest processed remote `seq`
6. stop on empty page or `max-pages`

Error behavior:

- fetch/auth failure stops that peer pull and keeps committed cursor
- invalid events are counted but do not stop page processing
- cursor advances over rejected rows to avoid deadlock

Idempotency contract:

- duplicate `event_id` is accepted with `already_present=true`
- duplicates do not insert `invalid_events` rows

## Track 4.1 (background runtime in `node serve`)

`node serve` starts a sync supervisor by default.

Execution model:

- immediate cycle at startup
- then runs every `interval_seconds` (default `30`)
- reloads `peers.json` every cycle (hot reload)
- syncs enabled peers with bounded parallelism (`max_parallel_peers`, default `4`)
- per-peer pull defaults remain `limit=200`, `max_pages=100`

Serve flags:

- `--sync-enabled <bool>` (default `true`)
- `--sync-interval-seconds <n>`
- `--sync-max-parallel-peers <n>`
- `--sync-limit <n>`
- `--sync-max-pages <n>`

Backoff policy:

- per-peer exponential backoff on failures:
  - `next_delay = min(interval * 2^consecutive_failures, 300s)`
- peer is skipped while `now < next_attempt_at`
- success clears failure streak and backoff

Hot reload behavior:

- peer enable/disable changes apply next cycle
- bearer token changes apply next cycle
- added/removed peers apply next cycle
- invalid `peers.json` does not crash node:
  - cycle is skipped
  - runtime `config_error` is reported

## Track 4.2 (manual snapshot bootstrap)

`node sync bootstrap` adds operator-driven fast start:

1. resolve peer from `peers.json` by id
2. fetch snapshot id from `GET /snapshots/latest` unless `--snapshot-id` is provided
3. fetch full snapshot document via `GET /snapshots/:id`
4. validate imported snapshot:
   - `format_version >= 4`
   - checkpoint present and deserializable
   - state hash recompute matches `meta.state_hash`
   - checkpoint self-consistency replay at `meta.as_of` matches `meta.state_hash`
5. persist imported snapshot metadata/provenance
6. seed peer cursor with `max(existing_cursor, snapshot.event_seq)`
7. align local `event_order` sequence floor to the seeded remote cursor
8. run one-shot delta pull from the same peer

Conflict/idempotency rules:

- same `snapshot_id` + same `state_hash`: idempotent
- same `snapshot_id` + different `state_hash`: reject bootstrap
- failed snapshot validation: reject and do not seed cursor

## Sync state persistence

`peer_sync_state` stores:

- `peer_id`
- `last_remote_cursor`
- `last_synced_at`
- `last_error`
- `consecutive_failures`
- `next_attempt_at`
- `last_cycle_started_at`
- `last_cycle_finished_at`
- `last_result_json`

`snapshots` also stores bootstrap provenance:

- `imported_from_peer_id`
- `imported_at`
- `integrity_verified`

## HTTP contracts

Read auth boundary:

- if `read_token` is configured, these routes require `Authorization: Bearer <token>`:
  - `GET /events`
  - `GET /snapshots/latest`
  - `GET /snapshots/:id`
- if `read_token` is unset, those routes remain open

Track 4.1 observability endpoints:

- `GET /sync/status`
- `GET /sync/peers`

Track 4.2 snapshot replication endpoints:

- `GET /snapshots/latest[?as_of=<rfc3339>]`
- `GET /snapshots/:id`

## CLI contracts

Track 4.0 local sync commands:

- `node sync pull --data-dir <path> [--peer <id>|--all] [--limit <n>] [--max-pages <n>]`
- `node sync status --data-dir <path>`
- `node sync reset --data-dir <path> [--peer <id>|--all]`

Track 4.1 runtime visibility wrappers:

- `node sync runtime --base-url <url>`
- `node sync peers --base-url <url> [--peer <id>]`

Track 4.2 bootstrap command:

- `node sync bootstrap --data-dir <path> --peer <id> [--snapshot-id <id>] [--limit <n>] [--max-pages <n>]`
