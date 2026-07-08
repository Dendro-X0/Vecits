# Kernel Boundary Spec

Purpose: define the Vectis protocol kernel, its public contracts, and what client layers may never reimplement.

Status: `locked`

Last updated: July 2026

## Architectural model

The coordination protocol and the application are **separate products**:

- The **protocol** is a modular, deployable library (Rust crates + `vectis-node`) that any host can run.
- The **application** is an optional platform layer for operating those functions — UI, onboarding, discovery UX — without owning settlement truth.

Integrators should be able to ship the kernel alone, embed it behind their own API, or pair it with the reference web app.

```text
┌──────────────────────────────────────────────────────────┐
│ Client shells (replaceable)                              │
│  apps/web · future mobile · community UIs · scripts      │
├──────────────────────────────────────────────────────────┤
│ TypeScript SDK (`packages/sdk-ts`)                       │
│  event builders · signing helpers · HTTP client wrappers │
├──────────────────────────────────────────────────────────┤
│ Transport boundary (versioned, documented)               │
│  HTTP/JSON v0 · future FFI/IPC (optional)                │
├──────────────────────────────────────────────────────────┤
│ Vectis kernel (authoritative)                            │
│  protocol-core · policy · state-engine · node            │
└──────────────────────────────────────────────────────────┘
```

The kernel is **foundational runtime**, not an OS kernel module. Any platform hosts the same engine; only shells differ.

## Kernel crate responsibilities

### `protocol-core`

Owns:

- event envelope schema (`v0`)
- canonical JSON encoding and event ID hashing
- Ed25519 sign/verify
- envelope validation (required fields, kind constraints)
- lane/evidence format constants and template lookups

Must not own:

- persistence
- HTTP transport
- derived marketplace state assembly (beyond envelope validation)

### `policy`

Owns:

- embedded default policy snapshot
- policy parameter lookup
- effective-time policy timeline semantics
- policy version compatibility checks

Must not own:

- event ingestion side effects
- network sync

### `state-engine`

Owns:

- deterministic event ordering
- replay reducers (identity, credits, marketplace, reputation, economics controls)
- invalid-event rejection with stable reason codes
- snapshot checkpoint generation semantics
- `as_of` replay behavior

Must not own:

- SQLite schema
- HTTP routing

### `node`

Owns:

- append-only JSONL event log persistence
- SQLite indexes and materialized query tables
- HTTP API for ingest, state reads, snapshots, sync
- pull replication, peer cursor state, idempotent duplicate ingest
- snapshot import/bootstrap integrity checks

Must not own:

- client signing UX
- discovery ranking (client-side or auxiliary service)

### `reputation`

Owns:

- reputation scoring primitives consumed by `state-engine`

Must not own:

- independent settlement rules conflicting with replay

### `apps/cli`

Owns:

- operator commands wrapping `node` and kernel libraries
- key generation, local sign, fixture runner, sync workflows

Must not own:

- protocol rules diverging from kernel crates

## Sacred invariants (kernel contract)

These are externally visible guarantees. Breaking them requires an explicit protocol version cutover.

| ID | Invariant |
| --- | --- |
| `K-01` | Valid event log + `as_of` produces identical derived state on all honest nodes |
| `K-02` | Invalid events never mutate derived state |
| `K-03` | Reject reason codes are stable across ingest, replay, and snapshot paths |
| `K-04` | `genesis_replay` and `snapshot_plus_delta` produce equivalent outcomes for valid logs |
| `K-05` | Credits cannot transfer between identities via any event sequence |
| `K-06` | Marketplace settlement transitions are reference-validated and actor-authorized |
| `K-07` | Policy updates are forward-only; post-activation events must match active policy version |
| `K-08` | Sync duplicate ingest is idempotent (`already_present=true`, no invalid row) |

## HTTP API boundary (v0 restart baseline)

Clients may depend on these endpoints. They are **convenience surfaces**, not alternate protocol authority.

### Write path

- `POST /events`
- `POST /events/batch`

### Read path (state)

- `GET /state/replay`
- `GET /state/discovery`
- `GET /state/identity/:id`
- `GET /state/balance/:id`
- `GET /state/offer/:id`
- `GET /state/order/:id`
- `GET /state/milestone/:order_id/:milestone_id`
- `GET /state/reputation/:id`
- `GET /state/reputation/:id/history`
- `GET /state/policy`
- `GET /state/policy/updates`
- `GET /state/economics/metrics`
- `GET /state/economics/p2h/:id`
- `GET /state/economics/p2h/:id/history`

### Read path (events and snapshots)

- `GET /events` (optional bearer token via `peers.json`)
- `POST /snapshots`
- `GET /snapshots/latest`
- `GET /snapshots/:id`

### Sync observability

- `GET /sync/status`
- `GET /sync/peers`

### Liveness

- `GET /health` (no auth; kernel versions + data-dir status)

All state endpoints support optional `as_of` (RFC3339) for historical replay.

## Client prohibitions

TypeScript (and any future client) **must not**:

1. Reimplement settlement transitions locally for authoritative state
2. Accept events that the kernel would reject
3. Compute balances, escrow, or reputation scores independently for display as truth
4. Soften invalid-event handling (no "best effort" apply)
5. Introduce admin override paths for dispute outcomes

Clients **may**:

1. Build unsigned drafts and request local signing
2. Perform discovery ranking as informational views over kernel-derived data
3. Cache read results with explicit staleness indicators
4. Validate form fields for UX before submission (must match kernel rules)

## Refactor targets (R1 implementation)

These are intentional kernel improvements, not boundary changes:

| Slice | Goal | Acceptance |
| --- | --- | --- |
| `R1-K1` | Document public Rust API surface per crate (`lib.rs` exports audit) | crate README or rustdoc module index |
| `R1-K2` | Extract pure replay entrypoint callable without SQLite | `state-engine` integration test with in-memory event vec |
| `R1-K3` | Consolidate reason-code enum/registry in one module | no duplicate reason strings across node/state-engine |
| `R1-K4` | Add `GET /health` (liveness + schema version + replay engine version) | API test; no auth required on localhost default |
| `R1-K5` | Kernel version manifest written to data dir on first boot | file present; CLI `node db inspect` shows versions |

## Future boundary (optional, post-R2)

Not required for first deployment proof:

- FFI/WASM embeddable replay library for mobile/edge
- gRPC alternative to HTTP/JSON
- read-only relay nodes vs full operator nodes

Any future boundary must preserve `K-01`..`K-08`.

## Verification commands (baseline)

```bash
cargo test
cargo run --bin cli -- fixtures run
cargo test -p node --test api
cargo test -p node --test sync
npm run v1:readiness
```

Restart work must not regress these without updating fixtures and abuse matrix docs.
