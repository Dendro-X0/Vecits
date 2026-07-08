# Glossary

## Identity

A long-lived public key representing an account.

## Web-of-trust

A graph of vouches that determines eligibility tiers and influences discovery.

## Credit

A non-transferable, non-hoardable unit used for coordination and resource allocation.

Credits decay and expire.

## Reputation

Durable, identity-bound historical score derived from market participation.

Reputation is the long-term capital in the system.

## Offer

A signed advertisement of a service or resource provided by an identity.

## Order

A signed request to purchase an offer, typically structured as milestones.

## Milestone

A small unit of delivery with explicit acceptance criteria and time bounds.

## Acceptance criteria hash

A hash of objective criteria used to evaluate a milestone delivery.

## Escrow sink

A protocol sink that locks buyer credits for a milestone until settlement.

Credits are never transferred to a provider.

## Settlement

A deterministic state transition that finalizes escrow and updates reputation and provider rewards.

## Deadlock

A deterministic outcome for unresolved disputes.

Both parties are penalized; escrow is routed away; no one “wins” by force.

## Receipt

A verifiable record that a job/service ran and produced outputs.

Used for standardized job runner delivery (e.g., AI/compute lanes).
