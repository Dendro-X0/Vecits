# Marketplace v0 (Model 1: no arbitration)

This document defines the service/resource marketplace built on top of Protocol v0.

The protocol never decides who is right.

It enforces deterministic timeouts and outcomes.

## Goals

- Enable cross-profession value exchange.
- Make scams and griefing unprofitable.
- Keep the medium non-transferable and non-hoardable.

## Core rule

Buyers never pay providers directly.

Buyers spend credits into a ServiceEscrowSink for a milestone.

Providers are compensated via reputation and capped minting upon acceptance.

## Offer

### ServiceOffer

Provider publishes:

- serviceType
- unitDefinition
- pricePerUnitCredits
- deliveryMode (artifact/session/milestone)
- offerExpiresAt
- termsHash (optional)

## Order

### ServiceOrder

Buyer publishes an order referencing an offer.

Orders are milestone-first.

Each milestone includes:

- milestoneId
- unitCount
- maxPriceCredits
- acceptanceCriteriaHash
- dueAt

## Escrow funding

### SpendCredits (ServiceEscrowSink)

Buyer funds a milestone by spending credits into ServiceEscrowSink.

Escrow is tracked by `{orderId, milestoneId}`.

## Delivery

### ServiceDelivery

Provider delivers within due time.

Evidence is Option A in v0:

- artifact hashes
- URLs
- notesHash (optional)

## Acceptance and disputes

### ServiceAccept

Buyer accepts within the acceptance window.

### ServiceDispute

Buyer disputes within the acceptance window.

Disputes are free in v0.

## Deterministic transitions

Policy defaults (Profile G):

- gracePeriodSeconds: 72h
- acceptanceWindowSeconds: 7d
- deadlockTimeoutSeconds: 14d

### Auto-accept

If buyer does nothing within acceptanceWindowSeconds after delivery, the milestone is auto-accepted.

### Mutual settlement

Parties can settle disputed milestones by mutual signature.

### Deadlock

If disputed and not mutually settled within deadlockTimeoutSeconds:

- escrow is routed to InsuranceSink
- provider receives no reward for that milestone
- buyer receives no refund
- both receive a reputation penalty

## Settlement outcomes

Settlement finalizes escrow and emits reputation/reward events.

### Accepted

- escrow finalized (burned)
- provider reputation increases
- provider may receive capped minted credits (short expiry)

### Mutually settled: buyerWins

- escrow finalized
- buyer receives a refund via minted credits (short expiry)
- provider reputation decreases

### Mutually settled: split

- proportional mix of the above

## Reputation

Reputation is the long-term capital.

v0 recommendations:

- reward diversity of counterparties
- penalize repeated deadlocks
- downrank high dispute rates in clients

## Service category guidance

To minimize subjective disputes:

- require artifact anchors for milestones
- keep milestones small
- make acceptance criteria explicit and objective

Examples:

- web dev: deployment URL + signed challenge file hash
- design: source file hashes + export hashes
- coaching: session receipt + written plan hash
