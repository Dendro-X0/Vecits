# Exploration Roadmap

This roadmap is for concept refinement, not product delivery.

The main objective is to reduce ambiguity and identify a realistic first implementation path.

## Stage 1: Clarify the system boundary

Questions to answer:

- Is the project a marketplace, a contribution network, or both?
- Is the first target professional services, open-source maintenance, compute jobs, or a narrower slice?
- What kinds of exchange are objective enough for protocol settlement?
- How much of v0 should focus on mutual-aid support for stalled or neglected technical projects?

Outputs:

- clear project thesis
- initial in-scope and out-of-scope list
- first candidate user journeys

## Stage 2: Define the value model

Questions to answer:

- What are credits actually for?
- Are they rewards, access rights, coordination slots, escrow units, or some mix?
- How are they minted, capped, expired, and constrained?
- What prevents balance accumulation from turning into informal money?
- How can the system reward maintenance, rescue, and continuation work that has weak direct market demand?

Outputs:

- candidate credit model
- minting constraints
- decay and expiration model
- abuse and gaming analysis

## Stage 3: Define the trust model

Questions to answer:

- How do new participants enter the system?
- How are vouches granted, revoked, and weighted?
- What makes an identity credible enough to offer services or attest work?
- What sybil resistance assumptions are acceptable in an experimental phase?

Outputs:

- identity model
- vouch graph rules
- eligibility tiers
- trust attack notes

## Stage 4: Define the exchange model

Questions to answer:

- What is the smallest useful unit of exchange?
- What evidence is acceptable for delivery?
- What makes a milestone objectively acceptable?
- What protocol outcomes occur for acceptance, dispute, timeout, and deadlock?
- How should requests for help on stalled projects differ from standard service offers, if at all?

Outputs:

- offer and order model
- milestone lifecycle
- delivery evidence requirements
- settlement state machine

## Stage 5: Define the reputation model

Questions to answer:

- What behaviors increase reputation?
- What behaviors reduce reputation?
- Should reputation decay, fragment by category, or weight diversity of counterparties?
- How should clients use reputation in discovery and risk warnings?

Outputs:

- reputation signals
- penalty and reward rules
- discovery heuristics

## Stage 6: Prototype the protocol locally

Only after earlier stages are clear:

- define signed event shapes
- build deterministic replay logic
- run scenario simulations
- test edge cases and gaming strategies
- test mutual-aid and stalled-project support scenarios alongside normal marketplace flows

Outputs:

- reference event schemas
- local state transition model
- scenario fixtures
- implementation constraints for a future CLI or app
