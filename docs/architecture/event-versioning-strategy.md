# Event Versioning Strategy (V0 -> Next)

Purpose: define how event and policy evolution stays deterministic and backward-compatible.

## Versioning principles

- protocol compatibility is explicit, never implied
- replay determinism is higher priority than convenience
- unsupported versions fail closed with deterministic reason codes
- additive evolution is preferred over in-place mutation

## Current baseline

- event envelope `version` is `v0`
- policy updates are full snapshots with forward-only `effectiveAt`
- replay ordering and validation rules are deterministic across nodes

## Event version evolution rules

1. New event fields:
- add as optional first
- define deterministic default behavior for older logs
- avoid changing canonical hash semantics for existing `v0` events

2. New event kinds:
- only introduced behind explicit allowed-kind checks
- unknown kinds must reject with deterministic unsupported-kind behavior

3. Breaking envelope changes:
- require a new envelope version identifier (for example `v1`)
- must include migration/replay strategy before activation

4. Reference semantics changes:
- must define behavior for legacy events that lack new references
- must include fixture coverage for mixed old/new logs

## Policy version evolution rules

- policy versions remain immutable snapshots
- activation must stay forward-only (`effectiveAt` monotonic)
- post-activation events must reference active policy version
- default values for new policy fields must preserve legacy replay behavior unless explicitly opted in

## Compatibility matrix

| Reader/runtime | Event version | Policy version | Expected behavior |
| --- | --- | --- | --- |
| v0 runtime | v0 | supported timeline snapshot | accept/replay normally |
| v0 runtime | unknown future event version | any | reject deterministically (unsupported version/kind) |
| upgraded runtime | v0 | older timeline snapshot | replay v0 deterministically |
| upgraded runtime | next version | compatible policy snapshot | accept/replay only when explicitly enabled |

## Migration requirements before enabling next version

- fixture bundle with mixed-version logs and expected deterministic outcomes
- replay equivalence proof where required (`genesis_replay` vs `snapshot_plus_delta`)
- reason-code coverage for unsupported-version behavior
- docs updates in `v0-spec-outline.md`, `v0-architecture.md`, `roadmap.md`, and `progress.md`

## Cutover policy

- no silent cutover
- include a documented activation point and rollback policy
- preserve ability to inspect prior-version event history
