# Stalled Project Support Flow

Purpose: model stalled-project continuation as structured marketplace work (`project-maintenance`) rather than unstructured charity.

Last updated: April 7, 2026

## Lane template (reference)

`project-maintenance` template defaults:

- `serviceType`: `project-maintenance`
- `unitDefinition`: `maintenance task`
- `deliveryMode`: `artifact`
- `allowedEvidenceFormats`: `artifactHash`
- `defaultMilestoneEvidenceFormat`: `artifactHash`
- `strict`: `false`

Canonical implementation source:

- `apps/web/app/components/marketplace-event-builder.tsx` (`SERVICE_LANE_TEMPLATES`)

## Scenario: repository revival milestone

Example exchange shape:

1. Provider publishes `ServiceOffer` in lane `project-maintenance` for a scoped maintenance task.
2. Buyer creates `ServiceOrder` with explicit acceptance criteria (for example patch hash + test-log hash).
3. Buyer funds escrow via `SpendCredits` into `ServiceEscrowSink` for the milestone.
4. Provider submits `ServiceDelivery` with `artifactHash` evidence.
5. Buyer either:
   - accepts (`ServiceAccept`) when criteria are satisfied, or
   - disputes (`ServiceDispute`) and protocol timeout rules deterministically apply.

This keeps stalled-project support replayable, auditable, and policy-bounded within the same settlement mechanics as other digital lanes.

## Evidence and verification

Lane coverage already includes `project-maintenance` in deterministic API regression:

- `crates/node/tests/api.rs`:
  - `api_marketplace_accept_flow_covers_initial_digital_lanes`
  - `api_marketplace_dispute_timeout_covers_initial_digital_lanes`

Verification commands:

- `cargo test -p node --test api api_marketplace_accept_flow_covers_initial_digital_lanes`
- `cargo test -p node --test api api_marketplace_dispute_timeout_covers_initial_digital_lanes`
