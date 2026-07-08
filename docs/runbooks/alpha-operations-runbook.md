# Alpha Operations Runbook

Purpose: provide a docs-only operator path for closed-alpha ingest, replication, snapshot, and incident triage workflows.

Scope date: April 6, 2026 (`T5-S7` execution)

## Preconditions

- Rust toolchain installed (`cargo` available).
- Workspace root is this repository root.
- Operator has terminal access to run multiple commands in parallel shells.

## Fixture bundles used in alpha checks

- `fixtures/valid/marketplace-accept.jsonl`
- `fixtures/valid/marketplace-dispute-settle.jsonl`
- `fixtures/valid/marketplace-timeout-autorefund.jsonl`

## 1. Prepare local alpha node directories

PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path target/tmp/alpha/node-a | Out-Null
New-Item -ItemType Directory -Force -Path target/tmp/alpha/node-b | Out-Null
New-Item -ItemType Directory -Force -Path target/tmp/alpha/node-c | Out-Null
```

Bash:

```bash
mkdir -p target/tmp/alpha/node-a target/tmp/alpha/node-b
mkdir -p target/tmp/alpha/node-c
```

## 2. Seed node A with alpha fixture flow events

```bash
cargo run --bin cli -- node ingest --data-dir target/tmp/alpha/node-a --in fixtures/valid/marketplace-accept.jsonl
cargo run --bin cli -- node ingest --data-dir target/tmp/alpha/node-a --in fixtures/valid/marketplace-dispute-settle.jsonl
cargo run --bin cli -- node ingest --data-dir target/tmp/alpha/node-a --in fixtures/valid/marketplace-timeout-autorefund.jsonl
```

Expected result:

- each ingest command returns JSON with `rejected_count = 0`

## 3. Configure node B peer sync target

Create `target/tmp/alpha/node-b/peers.json`:

```json
{
  "version": 1,
  "peers": [
    {
      "id": "node-a",
      "base_url": "http://127.0.0.1:7878",
      "enabled": true
    }
  ]
}
```

## 4. Start serving node A

Run in terminal A:

```bash
cargo run --bin cli -- node serve --data-dir target/tmp/alpha/node-a --bind 127.0.0.1:7878
```

## 5. Pull replicate from node A into node B

Run in terminal B:

```bash
cargo run --bin cli -- node sync pull --data-dir target/tmp/alpha/node-b --peer node-a --limit 200 --max-pages 100
cargo run --bin cli -- node sync status --data-dir target/tmp/alpha/node-b
```

Expected result:

- pull output reports `rejected_count = 0`
- sync status for `node-a` shows `last_remote_cursor > 0`

## 6. Verify deterministic read-side convergence

Run against both data dirs:

```bash
cargo run --bin cli -- node db inspect --data-dir target/tmp/alpha/node-a
cargo run --bin cli -- node db inspect --data-dir target/tmp/alpha/node-b
```

Expected result:

- `event_count` matches on both nodes
- `invalid_event_count` matches on both nodes

Optional HTTP verification (start node B service first in terminal C):

```bash
cargo run --bin cli -- node serve --data-dir target/tmp/alpha/node-b --bind 127.0.0.1:7879
```

Then compare discovery responses:

```bash
curl "http://127.0.0.1:7878/state/discovery?as_of=2026-03-01T00:15:00Z&alpha_defaults=1&limit=50"
curl "http://127.0.0.1:7879/state/discovery?as_of=2026-03-01T00:15:00Z&alpha_defaults=1&limit=50"
```

## 7. Snapshot and bootstrap workflow (recovery drill)

Create snapshot on node A:

```bash
cargo run --bin cli -- node snapshot create --data-dir target/tmp/alpha/node-a --as-of 2026-03-01T00:15:00Z --out target/tmp/alpha/node-a/latest-snapshot.json
```

Create `target/tmp/alpha/node-c/peers.json`:

```json
{
  "version": 1,
  "peers": [
    {
      "id": "node-a",
      "base_url": "http://127.0.0.1:7878",
      "enabled": true
    }
  ]
}
```

Bootstrap command on node C:

```bash
cargo run --bin cli -- node sync bootstrap --data-dir target/tmp/alpha/node-c --peer node-a --limit 200 --max-pages 100
```

Expected result:

- bootstrap response includes non-empty `snapshot_id`
- bootstrap response has no error and `rejected_count = 0`

## 8. Incident triage commands

Ingest reject-path triage:

```bash
cargo run --bin cli -- node db inspect --data-dir <node-data-dir>
```

Look for elevated `invalid_event_count` and then inspect failed ingestion payload source.

Sync/backoff triage:

```bash
cargo run --bin cli -- node sync status --data-dir <node-data-dir>
cargo run --bin cli -- node sync reset --data-dir <node-data-dir> --peer <peer-id>
```

Use `sync reset` only after correcting peer URL/token/config issues.

Runtime observability triage (when `node serve` is active):

```bash
cargo run --bin cli -- node sync runtime --base-url http://127.0.0.1:7878
cargo run --bin cli -- node sync peers --base-url http://127.0.0.1:7878 --peer node-a
```

Snapshot integrity triage:

```bash
cargo run --bin cli -- node sync bootstrap --data-dir <node-data-dir> --peer <peer-id> --snapshot-id <snapshot-id>
```

If bootstrap fails, treat it as snapshot integrity/auth/config failure and do not manually seed cursors.

## 9. Evidence capture checklist for readiness packet

- command transcripts for ingest, sync pull, sync status, snapshot create, and bootstrap
- output JSON snippets proving `rejected_count = 0` on valid flows
- node DB inspect snippets proving matching event/invalid counts across replicated nodes
- optional discovery response hashes or payload excerpts for deterministic comparison at fixed `as_of`
