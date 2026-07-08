# SDK stability policy (`@new-start/sdk-ts`)

Last updated: July 2026 (R4-C1)

## Scope

This package is a **thin HTTP + signing client** for the Vectis kernel. It must not embed settlement logic, policy interpretation, or credit accounting.

## Versioning

Follow [Semantic Versioning 2.0.0](https://semver.org/):

| Bump | When |
| --- | --- |
| **MAJOR** | Breaking changes to exported types, `NodeClient` method signatures, or canonical signing behavior |
| **MINOR** | Additive API (new client methods, optional fields, new exported helpers) |
| **PATCH** | Bug fixes, documentation, internal refactors with no public surface change |

Current version: **0.1.0** (pre-1.0; minor bumps may include small breaking changes until 1.0 GA).

## Stable surface (0.1.x)

These exports are covered by semver and regression-tested via `npm run v1:readiness`:

### `NodeClient`

- `submitSignedEnvelope`, `ingestEvent`, `ingestBatch`
- `listEvents`, `replay`, `getDiscovery`
- `getIdentity`, `getBalance`, `getOrder`, `getOffer`, `getMilestone`
- `getPolicyTimeline`, `getReputationHistory`
- `createSnapshot`, `fetchSnapshot`

### Signing helpers

- `createUnsignedEnvelope`, `signUnsignedEnvelope`, `verifySignedEnvelope`
- `computeEventId`, `canonicalizeUnsignedEnvelope`
- `generateEd25519KeyPair`, `derivePublicKey`
- `buildIdentityCreateUnsigned`

### Constants

- `DEFAULT_PROTOCOL_VERSION` (`v0`)
- `DEFAULT_POLICY_VERSION` (`v0-default`)

## Kernel coupling

| SDK field | Kernel contract |
| --- | --- |
| Event envelope shape | `protocol-core` v0 |
| HTTP routes | `node` crate REST API |
| Reason codes on reject | `protocol_core::reason_code_for_protocol_error` |

When the kernel bumps protocol version, expect a matching **minor or major** SDK release.

## Non-goals (do not add to SDK)

- Local balance or escrow computation
- Policy evaluation or dispute resolution
- Discovery ranking reimplementation
- Persistent key storage (callers own key handling)

## Replacement contract

Any client (CLI, web, mobile) may replace this SDK if it:

1. Signs events with the same canonical envelope rules
2. Treats kernel HTTP responses as authoritative state
3. Never displays "settled" or "accepted" milestone status without a kernel-confirmed ingest or state fetch

See `docs/v0/r4-client-kernel-audit.md` for the web shell audit checklist.
