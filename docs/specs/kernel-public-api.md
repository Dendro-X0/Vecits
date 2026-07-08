# Kernel Public API Index (R1-K1)

Purpose: document the intentional public Rust API surface for each kernel crate. Internal modules, test helpers, and accidental re-exports should not be treated as stable contracts unless listed here.

Status: `locked`

Last updated: July 2026

## Stability rules

1. Items in this index are **operator/SDK integration surfaces** or **CLI/embed entrypoints**.
2. Breaking changes require an explicit protocol or API version bump and docs sync.
3. `node` exposes many read-model structs for HTTP JSON — those are **transport DTOs**, not settlement authority.
4. Settlement truth remains in `state-engine` replay + `protocol-core` validation.

## Crate map

| Crate | Role | Stable for |
| --- | --- | --- |
| `protocol-core` | envelope, signing, validation | all clients, replay, node ingest |
| `policy` | default policy + snapshot parsing | replay, node, CLI |
| `state-engine` | deterministic replay | node, CLI, fixtures |
| `reputation` | score primitives | state-engine only (indirect to clients) |
| `node` | persistence, HTTP, sync | operator runtime, CLI, SDK HTTP client |
| `cli` / `vectis-node` | operator commands | humans, scripts, CI |

---

## `protocol-core`

### Constants

- `PROTOCOL_VERSION`
- `SERVICE_TYPE_*`, `EVIDENCE_FORMAT_*`

### Types

- `InvalidReasonCode`, `ProtocolError`
- `EventKind`, `EventPayload`, `Event`, `UnsignedEvent`
- `RawEventEnvelope`, `RawEnvelopeLoose`, `UnsignedEnvelopeLoose`
- Payload structs (`IdentityCreatePayload`, `ServiceOfferPayload`, …)
- `SinkKind`, `P2HRiskBand`, `AlertSeverity`

### Functions

- Parsing: `parse_raw_event_str`, `parse_raw_envelope_loose_str`, `parse_unsigned_event_str`, `parse_timestamp`
- Validation: `validate_static`, `verify_event`, `verify_envelope_signature`
- Reject registry: `InvalidReasonCode`, `reason_code_for_protocol_error`, `all_invalid_reason_codes`
- Identity: `signing_key_from_hex`, `verifying_key_from_hex`, `signature_from_hex`
- Signing: `compute_event_id`, `compute_event_id_loose`, `sign_event`
- Canonicalization: `canonicalize_value`
- Kind guards: `is_phase1_kind_name`, `is_marketplace_kind_name`, `is_replay_supported_kind_name`, `is_node_ingest_supported_kind_name`, …
- Lane templates: `template_for_service_type`, `expected_delivery_mode_for_templated_service`, `required_evidence_format_for_templated_service`, offline lane helpers

### Not public API

- Internal test vectors and private helpers in `lib.rs` body

---

## `policy`

### Constants

- `DEFAULT_POLICY_VERSION`, `DEFAULT_POLICY_AUTHORITY_PUB_KEY`
- Default offline alert thresholds and severities

### Types

- `Policy`, `OfflineAlertLanePolicy`

### Functions

- `default_policy()`
- `policy_from_snapshot_payload`, `normalize_policy`, `validate_policy`

---

## `state-engine`

Re-exported from `model` and `replay` modules.

### Core types

- `DerivedState`, `ReplayOutput`, `ReplayRunOutput`, `ReplayCheckpoint`
- Identity/credit/marketplace/reputation state structs
- `InvalidEventReport`, `ReplayInputLine`

### Replay entrypoints

- `replay_jsonl`, `replay_jsonl_as_of`
- `replay_jsonl_from_lines`, `replay_jsonl_from_lines_as_of`
- `replay_jsonl_resume`, `replay_jsonl_resume_as_of`
- `replay_jsonl_with_default_now`
- **`replay_raw_events`, `replay_raw_events_with_checkpoint`** — pure in-memory API (R1-K2)
- `inspect_identity`, `lot_to_public`

### Not public API

- Reducer internals in `replay.rs` private functions

---

## `reputation`

Score weight constants and accumulator helpers consumed by `state-engine`.

### Public

- Weight constants (`CLAIM_APPROVAL_WEIGHT`, `PROVIDER_ACCEPT_WEIGHT`, …)
- `LaneAccumulator`, `ReputationAccumulator`
- `contribution_score`, `marketplace_score`, `lane_score_from_accumulator`, `global_score_from_accumulator`

---

## `node`

### Kernel metadata

- `NODE_MANIFEST_SCHEMA_VERSION`, `CURRENT_SNAPSHOT_FORMAT_VERSION`, `REPLAY_ENGINE_NAME`
- `NodeManifest`, `KernelVersionInfo`, `HealthResponse`, `DataDirHealth`
- `NodeInitResult`

### Runtime

- `LocalNode`
  - `new`, `with_policy`, `initialize`
  - `data_dir`, `db_path`, `events_log_path`, `manifest_path`, `peers_config_path`
  - `kernel_version_info`, `read_manifest`, `health`, `db_inspect`
  - ingest/sync/snapshot/replay view methods used by HTTP and CLI

### HTTP (via `build_router`, `serve`)

- See `kernel-boundary-spec.md` for route list including `GET /health`

### Transport DTOs (JSON-stable, not settlement logic)

- Ingest: `IngestResult`, `BatchIngestResult`
- Snapshots: `SnapshotMeta`, `SnapshotDocument`
- State views: `ReplayView`, `PolicyStateView`, `ReputationStateView`, `DiscoveryView`, `EconomicsMetricsView`, …
- Sync: `SyncPullRequest`, `SyncPullResult`, `SyncBootstrapResult`, `SyncStatusResult`, …

### Helpers

- `replay_phase1_from_jsonl`, `hash_value`, `parse_as_of`
- `NodeDbInspectStats` alias

### Storage (limited export)

- `storage::sqlite_schema_version()` — schema version string for health/manifest

### Not public API

- `server` module handlers (use HTTP contract)
- `storage` module internals except `sqlite_schema_version`
- Private sync/economics computation helpers

---

## `cli` / `vectis-node` binary

Operator command groups:

- `keys`, `event`, `log`, `state`, `fixtures`
- `node init`, `node serve`, `node ingest`, `node snapshot`, `node policy`, `node economics`, `node reputation`, `node sync`, `node db`

Binary names:

- `cli` — development alias
- `vectis-node` — distribution alias (same entrypoint)

---

## Cross-crate dependency rule

```text
cli → node → state-engine → protocol-core, policy, reputation
                ↓
              storage (private)
```

`cli` may call `state-engine` and `protocol-core` directly for offline log tools only. It must not bypass `node` for authoritative persisted state reads/writes.

---

## Audit result (R1-K1)

| Check | Result |
| --- | --- |
| Each kernel crate has documented public surface | pass |
| Settlement logic concentrated in `state-engine` + `protocol-core` | pass |
| `node` HTTP DTOs documented as transport, not authority | pass |
| No unintended `pub mod` re-exports of internal modules | pass |
| Init/health/manifest APIs documented | pass |

Verification: documentation review against `lib.rs` exports (July 2026).
