# Vectis

Vectis is a modular coordination and settlement protocol for digital skills and services — deployable like infrastructure, integrable like Stripe, customizable like Shopify.

This repo hosts the reference implementation: Rust kernel, `vectis-node` operator runtime, TypeScript SDK, and the official Vectis client (`apps/web`). Operators may run the kernel alone or launch **their own branded stores and marketplaces** on top. See [`docs/foundation/product-identity.md`](docs/foundation/product-identity.md).

**Restart (July 2026):** R0–R2 and R4-C1–C4 complete. Local operator path:

```bash
npm run v1:build-release
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node init --data-dir ./vectis-data
"$BIN" node serve --data-dir ./vectis-data --bind 127.0.0.1:7878
```

See [`docs/START-HERE.md`](docs/START-HERE.md) for orientation · [`docs/runbooks/operator-quickstart.md`](docs/runbooks/operator-quickstart.md) to run a node.

## Workspace

- `crates/protocol-core` - event types, canonicalization, hashing, signing, and verification
- `crates/policy` - embedded default V0 policy
- `crates/state-engine` - deterministic replay, reducers, derived state, and fixture tests
- `crates/node` - local node runtime with JSONL event log, SQLite indexes, snapshots, and HTTP API
- `apps/cli` - key generation, event signing, replay, validation, inspection, and fixture commands
- `fixtures/` - checked-in valid and invalid JSONL event logs

## Commands

- `cargo test`
- `cargo run --bin cli -- keys generate`
- `cargo run --bin cli -- event sign --in <draft.json> --out <event.json>`
- `cargo run --bin cli -- log validate --in <events.jsonl>`
- `cargo run --bin cli -- log replay --in <events.jsonl> --out <state.json>`
- `cargo run --bin cli -- state inspect --in <events.jsonl>`
- `cargo run --bin cli -- fixtures run`
- `cargo run --bin cli -- node serve --data-dir <path> --bind 127.0.0.1:7878`
- `cargo run --bin cli -- node ingest --data-dir <path> --in <events.jsonl>`
- `cargo run --bin cli -- node snapshot create --data-dir <path> [--as-of <rfc3339>] [--out <snapshot.json>]`
- `cargo run --bin cli -- node snapshot replay --snapshot <snapshot.json> --events <events.jsonl> [--as-of <rfc3339>]`
- `cargo run --bin cli -- node policy current --data-dir <path> [--as-of <rfc3339>]`
- `cargo run --bin cli -- node policy timeline --data-dir <path> [--as-of <rfc3339>] [--limit <n>] [--cursor <n>]`
- `cargo run --bin cli -- node reputation current --data-dir <path> --identity <pubkey> [--as-of <rfc3339>]`
- `cargo run --bin cli -- node reputation history --data-dir <path> --identity <pubkey> [--as-of <rfc3339>] [--limit <n>] [--cursor <n>] [--lane <service_type>]`
- `cargo run --bin cli -- node db inspect --data-dir <path>`

## TypeScript workspace (Track 3 kickoff)

- `npm install`
- `npm run -w @new-start/sdk-ts typecheck`
- `npm run -w @new-start/web dev`
