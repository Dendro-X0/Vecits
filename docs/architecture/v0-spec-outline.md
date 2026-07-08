# V0 Spec Outline

This document defines a stricter implementation-oriented v0 specification.

It is still a draft, but it is now narrow enough to drive schema work, reducer design, and fixture-based testing.

## Spec status

- all event kinds in this document are normative for v0 drafting
- required fields are mandatory unless explicitly marked optional
- unknown required fields invalidate the event version unless forward-compatibility rules are added later
- all timestamps are RFC 3339 UTC strings
- all hashes are lowercase hex-encoded content hashes
- all public keys and signatures use the selected v0 signing format consistently

## Global event envelope

Every event must conform to this envelope before kind-specific validation runs.

### Envelope schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `version` | string | yes | must equal `v0` |
| `eventId` | string | yes | hash of canonical event body excluding `sig` |
| `authorPubKey` | string | yes | valid Ed25519 public key |
| `createdAt` | string | yes | valid RFC 3339 UTC timestamp |
| `kind` | string | yes | one of the allowed v0 event kinds |
| `policyVersion` | string | yes | active policy snapshot identifier |
| `payload` | object | yes | must validate against kind schema |
| `references` | object | no | object of event references by semantic name |
| `nonce` | string | no | required for kinds that need replay protection |
| `sig` | string | yes | valid signature over canonical body |

### Canonical body

The canonical body for hashing and signing is:

- `version`
- `authorPubKey`
- `createdAt`
- `kind`
- `policyVersion`
- `payload`
- `references` when present
- `nonce` when present

`eventId` must equal the hash of this canonical body.

## Global validation rules

An event is invalid if any of the following are true:

- envelope validation fails
- `version` is unsupported
- `kind` is unsupported
- `eventId` does not match canonical body hash
- signature verification fails
- referenced prerequisite events do not exist
- referenced prerequisite events exist but are invalidated by replay rules
- actor is not authorized for the event kind
- `createdAt` is malformed
- `createdAt` exceeds allowed clock skew from local policy
- required `nonce` is missing
- protected `nonce` is reused by the same identity in the same nonce domain

## Deterministic ordering

Events must be applied in this order:

1. ascending `createdAt`
2. ascending `eventId` as lexical tie-break

If two valid events conflict, replay rules decide which event affects state. Unsupported “first writer wins” shortcuts are not allowed unless explicitly defined below.

## Shared payload types

### `IdentityMetadata`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `displayName` | string | no | max 80 chars |
| `bio` | string | no | max 500 chars |
| `links` | array<string> | no | max 5 entries |
| `serviceCategories` | array<string> | no | policy-allowed categories only |

### `CreditLot`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `amount` | integer | yes | positive integer |
| `mintedAt` | string | yes | RFC 3339 UTC |
| `expiresAt` | string | yes | RFC 3339 UTC, later than `mintedAt` |
| `sourceEventId` | string | yes | valid source event id |

### `MilestoneSpec`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `milestoneId` | string | yes | unique within `orderId` |
| `title` | string | yes | max 120 chars |
| `unitCount` | integer | yes | positive integer |
| `maxPriceCredits` | integer | yes | positive integer |
| `acceptanceCriteriaHash` | string | yes | immutable criteria hash |
| `evidenceFormat` | string | yes | policy-allowed format |
| `dueAt` | string | yes | RFC 3339 UTC |

## Event kinds

### `IdentityCreate`

Registers a new identity profile.

#### Authorization

- `authorPubKey` must be the identity being created
- only one valid `IdentityCreate` may exist per identity key

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `identityPubKey` | string | yes | must equal `authorPubKey` |
| `metadata` | `IdentityMetadata` | no | optional initial metadata |
| `recoveryPolicyHash` | string | no | optional social recovery reference |

#### References

- none

#### Invalid if

- a prior valid `IdentityCreate` already exists for `identityPubKey`

### `IdentityUpdate`

Updates metadata or rotates key by declared policy path.

#### Authorization

- `authorPubKey` must be the current active identity key or an authorized recovery successor under policy

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `identityPubKey` | string | yes | target identity |
| `metadata` | `IdentityMetadata` | no | replacement or partial update per policy |
| `nextPubKey` | string | no | optional rotation target |
| `rotationReason` | string | no | required if `nextPubKey` is present |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `identityCreate` | yes | must reference a valid `IdentityCreate` or active identity root |

#### Invalid if

- target identity does not exist
- rotation path is unauthorized
- rotated-away key authors a later update after replacement becomes effective

### `Vouch`

Creates a trust edge from one identity to another.

#### Authorization

- `authorPubKey` must be an active identity
- actor must satisfy policy minimum tier for vouching

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `subjectPubKey` | string | yes | target identity |
| `weight` | integer | no | defaults to policy baseline |
| `scope` | array<string> | no | optional service-lane scopes |
| `expiresAt` | string | no | optional expiry, if policy allows |

#### References

- none

#### Invalid if

- subject identity does not exist
- actor vouches for self
- active identical vouch already exists unless replacement is policy-allowed

### `VouchRevoke`

Revokes a previously active vouch.

#### Authorization

- `authorPubKey` must equal the author of the original `Vouch`

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `subjectPubKey` | string | yes | target identity |
| `reasonCode` | string | no | optional policy-defined reason |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `vouch` | yes | must reference an active `Vouch` by same author |

### `ContributionClaim`

Requests mintable contribution credit for documented work or support.

#### Authorization

- `authorPubKey` must be the claimant identity

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `claimId` | string | yes | claimant-unique identifier |
| `claimType` | string | yes | policy-allowed contribution type |
| `artifactHash` | string | yes | evidence anchor |
| `summary` | string | yes | max 500 chars |
| `requestedCredits` | integer | yes | positive integer, capped by policy |
| `beneficiaryPubKey` | string | no | defaults to `authorPubKey`; must be same as author in v0 unless policy opens this later |

#### References

- none

#### Invalid if

- duplicate active `claimId` exists for claimant
- `beneficiaryPubKey` differs from `authorPubKey`

### `ContributionAttest`

Approves or rejects a contribution claim.

#### Authorization

- `authorPubKey` must satisfy attestor tier under active policy
- actor must not equal claimant

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `claimId` | string | yes | referenced claim identifier |
| `decision` | string | yes | `approve` or `reject` |
| `notesHash` | string | no | optional attestation notes anchor |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `claim` | yes | must reference a valid `ContributionClaim` |

#### Invalid if

- actor lacks attestor eligibility
- actor already submitted a valid attestation on same claim

### `MintCredits`

Creates account-bound credit lots after policy conditions are met.

#### Authorization

- `authorPubKey` must satisfy mint-authority rules under policy

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `beneficiaryPubKey` | string | yes | recipient identity |
| `amount` | integer | yes | positive integer |
| `expiresAt` | string | yes | RFC 3339 UTC |
| `mintReason` | string | yes | `contribution`, `accepted_milestone`, `refund`, or other policy-defined value |
| `sourceClaimId` | string | no | required when `mintReason=contribution` |
| `sourceOrderId` | string | no | required for settlement-related minting |
| `sourceMilestoneId` | string | no | required for settlement-related minting |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `claim` | conditional | required for contribution minting |
| `settlement` | conditional | required for marketplace settlement minting |

#### Invalid if

- policy preconditions for minting are unmet
- amount exceeds claim or settlement cap
- event would create forbidden transferable balance semantics

### `SpendCredits`

Consumes account-bound credits into a protocol sink.

#### Authorization

- `authorPubKey` must equal the spending identity

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `spenderPubKey` | string | yes | must equal `authorPubKey` |
| `sinkKind` | string | yes | one of allowed sink kinds |
| `amount` | integer | yes | positive integer |
| `orderId` | string | no | required for `ServiceEscrowSink` |
| `milestoneId` | string | no | required for `ServiceEscrowSink` |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `order` | conditional | required for `ServiceEscrowSink` |

#### Nonce

- required
- nonce domain is `{spenderPubKey, sinkKind}`

#### Invalid if

- spendable effective balance is insufficient at evaluation time
- sink-specific required fields are missing
- order or milestone is not eligible for funding

### `ServiceOffer`

Publishes an offer for a narrow supported service lane.

#### Authorization

- `authorPubKey` must be an active identity
- actor must satisfy provider eligibility for the declared service lane

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `offerId` | string | yes | provider-unique identifier |
| `serviceType` | string | yes | policy-allowed lane |
| `unitDefinition` | string | yes | max 200 chars |
| `pricePerUnitCredits` | integer | yes | positive integer |
| `deliveryMode` | string | yes | `artifact`, `analysis`, `receipt`, or policy-allowed mode |
| `offerExpiresAt` | string | yes | RFC 3339 UTC |
| `termsHash` | string | no | optional immutable terms |
| `allowedEvidenceFormats` | array<string> | yes | non-empty, policy-allowed |

#### References

- none

#### Invalid if

- `offerId` is already active for same provider unless replacement semantics are added later
- service type is out of scope for v0
- lane-template service types violate template rules; current strict templates include:
  - `compute-job` → `deliveryMode=receipt`, `allowedEvidenceFormats=[job-receipt-v1]`
  - `local-resource-exchange` → `deliveryMode=local-community`, `allowedEvidenceFormats=[local-resource-receipt-v1]`
  - `physical-handoff` → `deliveryMode=in-person`, `allowedEvidenceFormats=[physical-handoff-ack-dual-v1]`

### `ServiceOrder`

Creates a milestone-based order against an offer.

#### Authorization

- `authorPubKey` must equal buyer identity

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `orderId` | string | yes | buyer-unique identifier |
| `offerId` | string | yes | referenced offer identifier |
| `providerPubKey` | string | yes | must match referenced offer owner |
| `buyerPubKey` | string | yes | must equal `authorPubKey` |
| `milestones` | array<`MilestoneSpec`> | yes | non-empty |
| `orderExpiresAt` | string | yes | RFC 3339 UTC |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `offer` | yes | must reference an active `ServiceOffer` |

#### Invalid if

- order references expired or ineligible offer
- any milestone evidence format is not allowed by the offer
- any milestone price exceeds policy or offer constraints

### `ServiceDelivery`

Submits delivery evidence for a funded milestone.

#### Authorization

- `authorPubKey` must equal the provider for the order

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `orderId` | string | yes | target order |
| `milestoneId` | string | yes | target milestone |
| `evidenceFormat` | string | yes | must match funded milestone |
| `artifactHashes` | array<string> | no | required when evidence format expects artifacts |
| `urls` | array<string> | no | optional referenced outputs |
| `notesHash` | string | no | optional notes anchor |
| `deliveredAt` | string | yes | RFC 3339 UTC |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `order` | yes | must reference valid `ServiceOrder` |

#### Invalid if

- milestone is not in `Funded`
- actor is not the order provider
- `deliveredAt` is later than the allowed delivery deadline unless policy allows grace handling
- evidence format or required evidence fields do not match lane rules
- current strict evidence templates include:
  - `job-receipt-v1` → requires at least one artifact hash, unique artifact hashes, and non-empty `notesHash`
  - `local-resource-receipt-v1` → requires at least one artifact hash, unique artifact hashes, and non-empty `notesHash`
  - `physical-handoff-ack-dual-v1` → requires exactly two distinct artifact hashes, non-empty `notesHash`, and no `urls`

### `ServiceAccept`

Accepts a delivered milestone.

#### Authorization

- `authorPubKey` must equal the buyer for the order

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `orderId` | string | yes | target order |
| `milestoneId` | string | yes | target milestone |
| `acceptedAt` | string | yes | RFC 3339 UTC |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `delivery` | yes | must reference a valid `ServiceDelivery` |

#### Invalid if

- milestone is not in `Delivered`
- acceptance window has expired

### `ServiceDispute`

Disputes a delivered milestone during the acceptance window.

#### Authorization

- `authorPubKey` must equal the buyer for the order

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `orderId` | string | yes | target order |
| `milestoneId` | string | yes | target milestone |
| `reasonCode` | string | yes | policy-defined reason |
| `notesHash` | string | no | optional dispute notes anchor |
| `disputedAt` | string | yes | RFC 3339 UTC |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `delivery` | yes | must reference a valid `ServiceDelivery` |

#### Invalid if

- milestone is not in `Delivered`
- dispute is outside acceptance window

### `ServiceSettle`

Closes a disputed milestone by mutual signed settlement.

#### Authorization

- `authorPubKey` must be either buyer or provider
- settlement is only valid when both required signatures are present by paired events or embedded countersignature, per implementation choice

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `orderId` | string | yes | target order |
| `milestoneId` | string | yes | target milestone |
| `outcome` | string | yes | `buyerWins` or `split` |
| `buyerRefundCredits` | integer | yes | zero or positive integer |
| `providerRewardCredits` | integer | yes | zero or positive integer |
| `settledAt` | string | yes | RFC 3339 UTC |

#### References

| Key | Required | Rules |
| --- | --- | --- |
| `dispute` | yes | must reference active `ServiceDispute` |

#### Invalid if

- milestone is not in `Disputed`
- mutual authorization is incomplete
- settlement values violate sink amount or policy caps
- outcome is inconsistent with amounts

### `PolicyUpdate`

Updates policy parameters effective at a future time.

#### Authorization

- `authorPubKey` must equal the currently effective `policyAuthorityPubKey`

#### Payload schema

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `nextPolicyVersion` | string | yes | new policy identifier |
| `effectiveAt` | string | yes | RFC 3339 UTC, future relative to event |
| `policy` | object | yes | full policy snapshot payload; `policy.version` must equal `nextPolicyVersion` |

#### References

- none

## Derived state models

### Identity state

| Field | Type | Rules |
| --- | --- | --- |
| `identityPubKey` | string | active identity key |
| `metadata` | object | latest valid metadata |
| `status` | string | `active` or `rotated` |
| `recoveryPolicyHash` | string | optional |

### Vouch edge state

| Field | Type | Rules |
| --- | --- | --- |
| `voucherPubKey` | string | source identity |
| `subjectPubKey` | string | target identity |
| `status` | string | `active`, `revoked`, or `expired` |
| `weight` | integer | effective weight |

### Credit balance state

| Field | Type | Rules |
| --- | --- | --- |
| `identityPubKey` | string | balance owner |
| `lots` | array<`CreditLot`> | unexpired and tracked lots |
| `effectiveBalance` | integer | post-decay spendable amount |

### Milestone state

| Field | Type | Rules |
| --- | --- | --- |
| `orderId` | string | parent order |
| `milestoneId` | string | unique within order |
| `status` | string | one of the allowed milestone states |
| `fundedAmount` | integer | current sink-funded total |
| `deliveryEventId` | string | optional latest delivery |
| `disputeEventId` | string | optional latest dispute |
| `settlementEventId` | string | optional latest settlement |

### Reputation state

| Field | Type | Rules |
| --- | --- | --- |
| `identityPubKey` | string | root identity key |
| `globalScore` | integer | deterministic `trust + contribution + marketplace` score |
| `trustScore` | integer | active incoming vouch weight at replay `as_of` |
| `contributionScore` | integer | `3*claimApprovals - 4*claimRejections + 5*contributionMints` |
| `marketplaceScore` | integer | `4*providerAccepts + buyerAccepts + 2*splitSettles + 3*refundWins - 5*refundLosses - 2*disputesAgainst` |
| `lanes` | map<string, object> | lane-scoped marketplace counters and lane scores |

## Milestone states

Allowed milestone states:

- `Open`
- `PartiallyFunded`
- `Funded`
- `Delivered`
- `Accepted`
- `Disputed`
- `SettlementPending`
- `Settled`
- `AutoRefunded`

## Milestone transition table

| Current state | Trigger | Preconditions | Next state | Effects |
| --- | --- | --- | --- | --- |
| none | `ServiceOrder` | valid order exists | `Open` | create milestone record |
| `Open` | `SpendCredits(ServiceEscrowSink)` | buyer-authorized funding and no overfunding | `PartiallyFunded` or `Funded` | consume buyer lots and accumulate escrow funding |
| `PartiallyFunded` | `SpendCredits(ServiceEscrowSink)` | buyer-authorized funding and no overfunding | `PartiallyFunded` or `Funded` | consume buyer lots and accumulate escrow funding |
| `Funded` | `ServiceDelivery` | provider submits valid evidence with required `order` reference | `Delivered` | store delivery linkage and evidence metadata |
| `Delivered` | `ServiceAccept` | buyer accepts within acceptance window | `Accepted` | acceptance recorded |
| `Delivered` | `ServiceDispute` | buyer disputes within acceptance window | `Disputed` | dispute recorded |
| `Disputed` | first `ServiceSettle` | actor is buyer or provider and proposal sums to funded escrow | `SettlementPending` | open paired settlement handshake |
| `SettlementPending` | matching counterparty `ServiceSettle` | same outcome and amounts as pending proposal | `Settled` | finalize settlement and synthetic lots |
| `SettlementPending` | mismatched counterparty `ServiceSettle` | outcome or amounts differ from pending proposal | invalid (no transition) | reject event |
| `Disputed` or `SettlementPending` | replay-time timeout | `as_of >= disputedAt + disputeTimeoutSeconds` and no matched settlement | `AutoRefunded` | deterministic buyer refund synthetic lots |

## Order transition table

| Current state | Trigger | Preconditions | Next state | Effects |
| --- | --- | --- | --- | --- |
| none | `ServiceOrder` | valid order | `Open` | order created |

Terminal milestone states are:

- `Accepted`
- `Settled`
- `AutoRefunded`

## Settlement outcome table

| Prior state | Outcome source | Sink result | Buyer result | Provider result | Credit-lot expiry |
| --- | --- | --- | --- | --- | --- |
| `Delivered` | `ServiceAccept` | escrow finalized | no refund | provider synthetic reward lot for funded amount | provider reward expiry policy |
| `Disputed` | matched settle `buyerWins` | escrow finalized | buyer synthetic refund lot for full funded amount | no reward lot | buyer uses default credit expiry |
| `Disputed` | matched settle `split` | escrow finalized | buyer synthetic refund lot | provider synthetic reward lot | buyer default expiry, provider reward expiry |
| `Disputed` or `SettlementPending` | timeout auto-refund | escrow finalized | buyer synthetic refund lot for full funded amount | no reward lot | buyer uses default credit expiry |

## Authorization table

| Event kind | Authorized actor |
| --- | --- |
| `IdentityCreate` | identity owner |
| `IdentityUpdate` | active identity owner or authorized recovery actor |
| `Vouch` | eligible voucher |
| `VouchRevoke` | original voucher |
| `ContributionClaim` | claimant |
| `ContributionAttest` | eligible attestor |
| `MintCredits` | policy mint authority |
| `SpendCredits` | spender |
| `ServiceOffer` | eligible provider |
| `ServiceOrder` | buyer |
| `ServiceDelivery` | provider for order |
| `ServiceAccept` | buyer for order |
| `ServiceDispute` | buyer for order |
| `ServiceSettle` | buyer and provider jointly |
| `PolicyUpdate` | policy authority |

## Reference requirements table

| Event kind | Required references |
| --- | --- |
| `IdentityCreate` | none |
| `IdentityUpdate` | `identityCreate` |
| `Vouch` | none |
| `VouchRevoke` | `vouch` |
| `ContributionClaim` | none |
| `ContributionAttest` | `claim` |
| `MintCredits` | `claim` or `settlement` depending on reason |
| `SpendCredits` | none (uses payload `orderId` + `milestoneId` for `ServiceEscrowSink`) |
| `ServiceOffer` | none |
| `ServiceOrder` | `offer` |
| `ServiceDelivery` | `order` |
| `ServiceAccept` | `delivery` |
| `ServiceDispute` | `delivery` |
| `ServiceSettle` | `dispute` |
| `PolicyUpdate` | none |

## Policy parameter registry

The v0 policy must define at least:

| Parameter | Meaning |
| --- | --- |
| `clockSkewSeconds` | maximum tolerated timestamp skew |
| `creditDefaultExpiryDays` | default non-provider mint expiry |
| `providerRewardExpiryDays` | short expiry for provider rewards |
| `demurrageRateWeeklyBps` | weekly decay rate |
| `claimApprovalThreshold` | minimum attest approvals for minting |
| `maxContributionClaimCredits` | per-claim cap |
| `allowedServiceTypes` | allowed marketplace lanes |
| `acceptanceWindowSeconds` | buyer response window |
| `disputeTimeoutSeconds` | dispute timeout for auto-refund |
| `maxMilestonesPerOrder` | order complexity cap |
| `maxMilestoneCredits` | per-milestone funding cap |
| `providerEligibilityThreshold` | provider minimum trust threshold |
| `attestorEligibilityThreshold` | attestor minimum trust threshold |
| `allowedSinkKinds` | valid spend sinks including `ServiceEscrowSink` in Phase 2.2 |

## Invalid-event effect rules

Rejected events:

- remain visible in raw transport logs if stored there
- must not affect derived state
- must not satisfy future reference dependencies
- may be reported by audit tooling with reason codes

Suggested invalid reason codes:

- `ERR_UNSUPPORTED_VERSION`
- `ERR_BAD_SIGNATURE`
- `ERR_BAD_EVENT_ID`
- `ERR_MISSING_REFERENCE`
- `ERR_UNAUTHORIZED_ACTOR`
- `ERR_INVALID_NONCE`
- `ERR_INVALID_STATE_TRANSITION`
- `ERR_POLICY_VIOLATION`
- `ERR_BAD_TIMESTAMP`
- `ERR_FORBIDDEN_TRANSFER_SEMANTICS`

## Phase 2 node runtime behavior

The local node runtime stores all envelope-valid v0 events in append-only JSONL and indexed SQLite tables.

Phase 2.3 derived replay behavior:

- phase 1 kinds and marketplace kinds (`ServiceOffer`, `ServiceOrder`, `ServiceDelivery`, `ServiceAccept`, `ServiceDispute`, `ServiceSettle`) are fully replayed
- `PolicyUpdate` is fully replayed with deterministic reducer semantics
- unknown/non-v0 kinds are rejected with deterministic reason codes

State query behavior:

- state endpoints accept optional `as_of` timestamps
- replay semantics at `as_of` include replay-supported kinds with `createdAt <= as_of`
- snapshot creation records state hash and replay metadata for equivalence checks
- replay responses expose `source` as either `genesis_replay` or `snapshot_plus_delta`
- replay responses include optional `snapshot_id` when `source=snapshot_plus_delta`
- marketplace read endpoints are available: `GET /state/offer/:id`, `GET /state/order/:id`, and `GET /state/milestone/:order_id/:milestone_id`
- policy read endpoints are available: `GET /state/policy` and `GET /state/policy/updates`
- reputation read endpoints are available: `GET /state/reputation/:id` and `GET /state/reputation/:id/history`

Phase 2.4 reputation behavior:

- reputation is root-identity anchored so key rotation preserves score lineage
- scoring is fixed-weight and no-decay in phase 2.4
- trust score uses active incoming vouches at replay `as_of` (expired vouches excluded)
- lane scores use marketplace-only components
- timeout auto-refunds emit deterministic synthetic reputation history events keyed as `auto-refund:{orderId}:{milestoneId}`

Phase 2.1 snapshot selection behavior:

- choose the latest snapshot where `snapshot.as_of <= as_of`
- only snapshots with `format_version >= 4` and non-null checkpoint payload are eligible for delta replay
- detect replay-kind backfill as any replay-supported event ingested after `snapshot.event_seq` with `createdAt <= snapshot.as_of`
- if no eligible snapshot exists, or backfill is detected, replay must fall back to `genesis_replay`
- legacy snapshots remain readable and valid for inspection, but are excluded from snapshot-plus-delta execution

## Snapshot and replay invariants

Implementations must satisfy:

- replay from genesis yields the same derived state as replay from snapshot plus later events
- invalid events do not become valid due to replay order manipulation
- equivalent valid event sets converge to the same derived state on independent nodes

## Fixture requirements

Before implementation is considered ready, the repo should include fixtures for:

- identity creation and update
- trust graph growth and vouch revocation
- contribution claim, attestation, and mint flow
- milestone funding, delivery, and acceptance
- milestone dispute, paired settlement handshake, and timeout auto-refund
- credit expiry and demurrage application
- invalid signature rejection
- duplicate nonce rejection
- replay equivalence from snapshot
