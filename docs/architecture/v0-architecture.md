# V0 Architecture

This document describes the recommended technical architecture for the first implementation phase.

The proposed stack is:

- TypeScript on the frontend
- Rust for the protocol core and backend services

## Protocol vs application

Vectis is split into two layers that must stay separable:

| Layer | What it is | Role |
| --- | --- | --- |
| **Protocol** | Signed, deterministic coordination kernel | Validate events, derive state, enforce settlement rules |
| **Application** | Replaceable product shells | UX, workflows, discovery, onboarding, marketplace UI |

The **protocol is not the app**. The app is one way to operate protocol functions — explorer, marketplace builder, onboarding, sync dashboards — but operators and integrators can deploy the kernel alone and build their own surfaces.

Design goals for the protocol layer:

- **Modular library** — `protocol-core`, `policy`, `state-engine`, and `node` compose as crates with explicit boundaries (see `docs/specs/kernel-boundary-spec.md`).
- **Easy to deploy** — single binary (`vectis-node`), file-based data dir, Docker/systemd paths documented in runbooks.
- **Easy to integrate** — stable HTTP/JSON v0 API and TypeScript SDK; clients never reimplement settlement logic.

Design goals for the application layer:

- **Optional platform** — `apps/web` is the official Vectis client; it demonstrates flows but is not authoritative for truth.
- **Customizable storefronts** — operators launch their own stores and marketplaces (white-label UI, lane focus, community branding).
- **Swappable** — any client that speaks the SDK/API contract can replace the default shell.
- **Thin** — signing helpers, queries, and UX only; kernel replay remains the settlement source.

Ease target: using Vectis should feel as straightforward as **Shopify** (deploy your store) and **Stripe** (integrate settlement). See `docs/foundation/product-identity.md`.

```text
┌─────────────────────────────────────────┐
│  App (platform / UX — replaceable)        │
│  apps/web · community UIs · scripts     │
├─────────────────────────────────────────┤
│  Integration (SDK, HTTP, CLI)           │
├─────────────────────────────────────────┤
│  Protocol kernel (authoritative library)  │
│  crates/* · vectis-node                   │
└─────────────────────────────────────────┘
```

Cryptographic scope: the kernel verifies **signed** events and deterministic replay. Transport encryption (TLS) and key custody are operator responsibilities (`docs/runbooks/operator-security-guide.md`). End-to-end encrypted messaging is explicitly out of kernel scope.

## Architectural intent

V0 should be protocol-first.

The central artifact is not a website or marketplace UI. It is a deterministic protocol engine that can validate signed events, derive state, and produce inspectable outcomes without relying on trusted administrators.

## Core architecture principles

### 1. Rust is the source of truth

The authoritative implementation of protocol rules should live in Rust.

This includes:

- canonical serialization
- event validation
- signature verification
- replay and state derivation
- marketplace settlement and escrow transitions
- policy enforcement
- trust and eligibility calculations

### 2. TypeScript is the product layer

TypeScript should power:

- the frontend
- user workflows
- developer tooling
- lightweight client SDKs
- optional orchestration or gateway code

The TypeScript layer should not redefine protocol logic independently from Rust.

### 3. Local-first before network-first

Every node or client should be able to:

- ingest signed events
- verify them locally
- derive state locally
- inspect history locally

Networking should transport events, not create trusted state.

### 4. Event-sourced design

The event log is the durable history.

Derived tables, indexes, and snapshots exist for performance, but deterministic replay remains the correctness anchor.

## Proposed stack

### Frontend

- `Next.js`
- `TypeScript`
- `React`
- Tailwind CSS if UI styling is needed early

### Rust backend and protocol

- Rust stable toolchain
- `axum` for HTTP APIs
- `tokio` for async runtime
- `serde` for serialization
- `ed25519-dalek` or equivalent for signatures
- `sqlx` or `rusqlite` for SQLite integration

### Storage

- append-only event log
- SQLite for local persistence, materialized views, and query support
- optional snapshot files for fast restart

### Integration layer

- HTTP/JSON for simple v0 integration
- WebSocket or server-sent events later for streaming

## Component map

### Rust components

#### `protocol-core`

Responsibilities:

- event envelope definitions
- canonical encoding rules
- signature verification
- schema versioning
- event normalization

#### `policy`

Responsibilities:

- protocol parameters
- effective-time policy changes
- policy snapshot loading
- rule lookups during replay

#### `state-engine`

Responsibilities:

- deterministic replay
- event ordering
- invalid-event rejection
- derived state assembly
- snapshot generation
- marketplace reducers (offers, orders, milestones, settlement)
- trust and eligibility checks used by reducers

#### `node`

Responsibilities:

- local event ingestion
- persistence
- query endpoints
- synchronization hooks
- adminless inspection APIs
- node-to-node pull replication with per-peer cursor state

### TypeScript components

#### `sdk-ts`

Responsibilities:

- typed client interfaces
- event building helpers
- signing request helpers
- state query wrappers

#### `web`

Responsibilities:

- identity setup
- offer and order flows
- milestone tracking
- reputation and history views

#### `explorer`

Responsibilities:

- event inspection
- state introspection
- dispute and settlement visibility
- protocol debugging and demos

## Data flow

1. A client creates or signs an event.
2. The event is submitted to a local node or relay.
3. The Rust core validates the envelope, signature, and policy constraints.
4. Valid events are appended to the event log.
5. The state engine replays or incrementally applies the event.
6. Derived views update balances, offers, orders, milestones, and reputation.
7. The TypeScript frontend reads derived state through stable APIs.

## Suggested repository shape

For a future monorepo:

- `apps/web`
- `apps/explorer`
- `packages/sdk-ts`
- `crates/protocol-core`
- `crates/policy`
- `crates/state-engine`
- `crates/marketplace`
- `crates/reputation`
- `crates/node`

## API boundary

The frontend should only depend on stable protocol-facing APIs.

Recommended v0 boundaries:

- `POST /events`
- `GET /events`
- `GET /state/identity/:id`
- `GET /state/balance/:id`
- `GET /state/order/:id`
- `GET /state/offer/:id`
- `GET /state/milestone/:id`
- `GET /state/reputation/:id`

These endpoints are implementation conveniences, not protocol authority.

Implemented Phase 2 subset:

- `GET /health`
- `POST /events`
- `POST /events/batch`
- `GET /events`
- `GET /state/identity/:id`
- `GET /state/balance/:id`
- `GET /state/replay`
- `GET /state/offer/:id`
- `GET /state/order/:id`
- `GET /state/milestone/:order_id/:milestone_id`
- `GET /state/reputation/:id`
- `GET /state/reputation/:id/history`
- `GET /state/policy`
- `GET /state/policy/updates`
- `POST /snapshots`
- `GET /snapshots/latest`
- `GET /snapshots/:id`

These state endpoints support optional `as_of` query parameters for deterministic historical replay.

Track 4.0 transport contract:

- node pull sync consumes remote `GET /events?cursor=<seq>&limit=<n>`
- local duplicate `event_id` ingest is idempotent (`accepted=true`, `already_present=true`)
- optional bearer-token protection can be enabled for `GET /events` via `<data-dir>/peers.json` `read_token`

Track 4.1 runtime contract:

- `node serve` runs an immediate-first background pull worker (default 30s interval)
- peer config is hot-reloaded from `<data-dir>/peers.json` each cycle
- per-peer failures use exponential backoff with deterministic `next_attempt_at` scheduling (300s cap)
- read-only sync observability endpoints are available at `GET /sync/status` and `GET /sync/peers`

Track 4.2 bootstrap contract:

- `node sync bootstrap` imports a peer snapshot and then runs one-shot delta pull
- snapshot import requires integrity verification (`format_version >= 4`, checkpoint present, hash check, checkpoint self-consistency)
- peer cursor is seeded to `max(existing_cursor, snapshot.event_seq)` and local event order sequence is advanced to that floor before delta ingest
- `read_token` auth boundary applies to snapshot replication reads (`GET /snapshots/latest`, `GET /snapshots/:id`)

Phase 2.1 replay metadata contract:

- `/state/replay` returns `source` as `genesis_replay` or `snapshot_plus_delta`
- `/state/replay` includes optional `snapshot_id` when snapshot acceleration is used
- `/state/identity/:id` and `/state/balance/:id` mirror the same `source` and optional `snapshot_id`
- `/state/offer/:id`, `/state/order/:id`, and `/state/milestone/:order_id/:milestone_id` mirror the same replay metadata contract
- `/state/reputation/:id` and `/state/reputation/:id/history` mirror the same replay metadata contract
- `/state/policy` and `/state/policy/updates` mirror the same replay metadata contract
- snapshot-plus-delta is used only when a checkpoint-capable snapshot (`format_version >= 4`) is available and no replay-kind backfill exists since that snapshot; otherwise replay deterministically falls back to genesis
- `PolicyUpdate` is executed in replay with forward-only `effectiveAt` semantics and authority checks

## Blockchain position

V0 should be decentralized at the protocol level before it is deeply integrated with any external blockchain.

Exploration note: [../foundation/vectis-vs-blockchain-exploration.md](../foundation/vectis-vs-blockchain-exploration.md).

Recommended stance:

- keep the protocol chain-light in v0
- do not require smart contracts for the core market flow
- treat public-chain anchoring as optional future infrastructure for checkpoints or audit roots

This keeps the system easier to evolve while the core rules are still being refined.

## Security posture

V0 should prioritize:

- strict signature verification
- canonical event hashing
- replay safety
- duplicate detection
- deterministic invalid-event rejection
- explicit policy version handling

Rust helps here by reducing implementation risk in the most sensitive parts of the system.

## Scalability posture

V0 scalability should focus on:

- deterministic replay across growing histories
- query performance through snapshots and materialized state
- clear module boundaries for future parallelization
- independent nodes converging on the same state

It does not need to optimize for global-scale throughput yet.
