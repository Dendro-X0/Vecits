# Project Thesis

## Summary

This project explores a decentralized marketplace and settlement protocol for digital skills, services, and useful contributions without relying on traditional money.

The goal is not to create another speculative cryptocurrency.

The goal is to create a trust-minimizing coordination system where people can exchange real value, receive meaningful rewards, and build durable reputation without depending on centralized platforms, fiat rails, speculative crypto rails, or human administrators as the default control layer.

## The problem

Online work markets often fail in predictable ways:

- buyers and sellers do not trust each other
- labor is undervalued or exploited
- platforms extract fees and control access
- dispute systems are slow, biased, or inconsistent
- many useful contributions have social value but weak market value

Traditional money does not solve these problems by itself. In some cases it intensifies them by encouraging short-term extraction, speculation, and power concentration.

## The core idea

Instead of direct monetary payment, the system uses protocol-enforced coordination.

Participants do not rely on a central platform to decide fairness. They rely on:

- signed public actions
- deterministic state transitions
- milestone-based exchange
- objective evidence of delivery
- reputation derived from public history
- bounded, non-hoardable credits for coordination

Long-term, the system should behave like:

- **Shopify** in deployment simplicity — operators and communities spin up their own stores without protocol surgery
- **Stripe** in settlement clarity — integrators add coordination to existing products through a small, trustworthy API
- a **decentralized ledger** in replayability and cross-operator convergence

All of this ships under one name: **Vectis** — kernel, settlement layer, and official client are the same product family (`docs/foundation/product-identity.md`). Storefront UI is customizable; the protocol kernel is shared.

without becoming a payment network in the normal financial sense.

The deeper social goal is mutual aid with stronger structure.

People should be able to help each other obtain useful work, maintenance, upgrades, and technical support without being forced into purely cash-driven relationships.

## What makes this different

### 1. Not a normal marketplace

This is not a simple buyer-pays-seller platform with blockchain added on top.

The deeper goal is to design a system where cheating becomes irrational, cooperation becomes practical, and trust grows from transparent history rather than institutional control.

### 2. Not a normal cryptocurrency

If a token can be freely traded, hoarded, or speculated on, it will likely reproduce many of the same distortions as money-first systems.

The reward layer should therefore be designed as a utility and coordination mechanism, not as an investment asset.

### 3. Not a governance-by-committee system

The system should not depend on moderators, councils, or permanent human arbitrators.

Disputes should resolve through protocol defaults, explicit evidence requirements, and deterministic outcomes, even when those outcomes are imperfect.

## Initial scope

The best initial scope is a digital skills and services marketplace, especially categories where delivery can be evidenced clearly.

Good early candidates:

- software development
- design artifacts
- research outputs
- editing and documentation
- AI and compute jobs
- structured consulting outputs with artifact anchors
- maintenance and revival work for stalled software projects

Poor early candidates:

- physical goods
- open-ended subjective creative commissions
- vague freelance arrangements
- work that depends on deep social interpretation

## Reward philosophy

The system should reward contribution, reliability, and cooperative behavior.

It should discourage:

- speculation
- hoarding
- sybil farming
- repeated bad-faith disputes
- extractive brokerage behavior

Long-term value should come from reputation, trust graph position, and verified contribution history rather than account balance alone.

The system should also make room for non-economic support around useful but commercially weak work, including maintenance, repair, continuation, and improvement of neglected projects that still have technical or community value.

## Success criteria

This exploration is successful if it produces a system that can:

- support real exchanges of useful digital work
- reduce reliance on interpersonal trust
- discourage scams and exploitative behavior
- avoid central administrative dependence
- give meaningful rewards to useful contributors
- remain understandable, auditable, and experimentally testable

Long-term success should also mean:

- a small operator can launch a working marketplace quickly
- two independent nodes can converge on the same settlement outcome
- most disputes resolve through policy and evidence rather than manual adjudication
- trust and fulfillment history remain portable across deployments

## Near-term objective

Before implementation, the project needs a clearer definition of:

- what kinds of value can be verified objectively
- how credits are created and limited
- how reputation is earned and decays
- which dispute outcomes are acceptable without human judgment
- which narrow use cases are realistic for a first protocol

For v0 specifically, the system should optimize for reliability of rules and scalability of the model before breadth of features.

For longer horizons, the project should optimize in this order:

- determinism
- auditability
- deployability
- abuse resistance
- interoperability
- usability
