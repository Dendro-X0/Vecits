# Design Principles

These principles should constrain every future protocol, product, and implementation decision.

## 1. Coordination over payment

The system is primarily a coordination mechanism, not a money substitute.

The most important design question is not how to move value between accounts. It is how to make useful cooperation reliable without central trust.

## 2. Reputation over balance

Durable value should live mostly in reputation and public contribution history.

Balances should be temporary, bounded, and purpose-limited.

## 3. Non-transferability by default

If credits or rewards are transferable like normal currency, speculation and extraction become much harder to prevent.

Default design should favor account-bound rewards or tightly constrained transfer semantics.

## 4. Non-hoardability by default

Credits should decay, expire, or otherwise lose strategic value when stockpiled.

This keeps the system focused on active contribution and exchange instead of passive accumulation.

## 5. Deterministic consequences

The protocol should avoid subjective human judgment whenever possible.

When disputes happen, the system should rely on predefined states, time windows, evidence requirements, and deterministic outcomes.

## 6. Narrow scope before generalization

The protocol should begin with service categories that can be verified through artifacts, hashes, receipts, or other objective outputs.

General-purpose commerce should come later, if at all.

## 7. Small milestones over large promises

Large vague commitments create too much room for dispute and abuse.

Work should be decomposed into small deliverable units with explicit acceptance criteria.

## 8. Trust should be earned publicly

Identity and eligibility should emerge from visible history, vouches, successful delivery, and consistent behavior.

Trust should not depend on opaque moderation or institutional approval.

## 9. Explicit limits are healthy

The system does not need to solve every kind of dispute or support every kind of market.

A narrower protocol with clear failure modes is better than a broad one with false promises.

## 10. Exploration before implementation

The project is still experimental.

Documentation, modeling, scenario analysis, and protocol simulations should come before building production software.

## 11. Protocol separate from application

The signed coordination protocol and any application shell are distinct layers.

The protocol kernel must remain a modular library that is easy to deploy and integrate without requiring a specific UI, marketplace, or platform vendor.

Applications may provide rich operating surfaces — onboarding, offer flows, explorers, discovery — but must not become the source of settlement truth. Clients query and submit events; the kernel decides outcomes.

Operators may run **custom-branded stores and marketplaces** on Vectis; the name **Vectis** still applies to kernel, settlement, and official client (`docs/foundation/product-identity.md`).

## 12. Transaction specs over identity for economic exchange

Fraud prevention and free-rider resistance come primarily from **transaction specifications** — escrow, evidence requirements, reference chains, time windows, deterministic dispute outcomes — not from proving user identity.

Identity and vouches gate admission and visibility. They do not replace settlement rules.

Off-platform settlement (fiat, crypto, external URLs) is a secondary market the protocol cannot control. In-protocol economic contracts on the controllable platform must be treated with the same rigor as technical fraud: fail closed, fully specified, and fixture-proven.

See `docs/foundation/market-operating-model.md`.
