# Protocol v0

This document specifies the v0 protocol shape.

It is intended to be implemented as a signed event log transported via a relay network.

## Protocol goals (v0)

- Signed event model with deterministic state derivation.
- Non-transferable credits with decay and expiration.
- Web-of-trust identity bootstrapping.
- Service marketplace with escrow sinks and deterministic settlement.

## Event model

All state transitions are represented as signed events.

Each event must include:

- `eventId`: hash of canonical event body
- `authorPubKey`
- `createdAt`
- `kind`
- `payload`
- `sig`

Clients derive state by replaying valid events in deterministic order.

## Identity events

### IdentityCreate

Registers identity metadata and optional recovery policy.

### IdentityUpdate

Updates metadata and supports key rotation via social recovery.

### Vouch

Creates a trust edge from one identity to another.

### VouchRevoke

Revokes a previously issued vouch.

## Eligibility tiers

Tiers are computed deterministically from the trust graph.

v0 tiers:

- Untrusted
- Trusted
- Attestor
- Provider

Tier thresholds are policy parameters.

## Credit model

Credits are account-bound.

No event may transfer credits between identities.

### Decay and expiration

Credits have both:

- expiration (default 180 days)
- demurrage (default 1% per week)

Provider-minted credits should have shorter expiry (default 60–90 days).

### Credit buckets

Recommended accounting uses time-bucketed credit lots:

- amount
- mintedAt
- expiresAt
- sourceEventId

Effective balance is computed by dropping expired buckets and applying demurrage.

## Credit events

### ContributionClaim

Contributor requests credits for contribution evidence.

### ContributionAttest

Attestor approves or rejects a claim.

### MintCredits

Mints credits if claim has sufficient approvals and caps are respected.

### SpendCredits

Spends credits into a protocol sink.

Sinks include:

- ServiceEscrowSink
- ComputeSink
- AISink
- StorageSink
- BountySink

Spend events must include a spender-unique nonce.

## Governance (v0)

Protocol parameters are controlled by policy updates.

v0 can start with a conservative mechanism and later migrate to more decentralized policy signing.

### PolicyUpdate

A signed update that changes policy parameters at an effective time.

## Notes

v0 prioritizes a stable social-economic mechanism and auditability.

Stronger correctness (checkpointing, stronger anti-double-spend) can be added incrementally.
