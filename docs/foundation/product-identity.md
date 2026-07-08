# Vectis Product Identity

Purpose: define how the **Vectis** name applies across the stack and what “easy like Stripe and Shopify” means for operators and end users.

Status: `locked`

Last updated: July 2026

## One name, three surfaces

Everything in this repository ships under **Vectis**. There is no separate brand for the kernel, the settlement engine, or the reference client.

| Surface | What users experience | Repo anchor |
| --- | --- | --- |
| **Vectis kernel** | Deployable protocol runtime — ingest, replay, sync, snapshots | `crates/*`, `vectis-node` |
| **Vectis settlement** | Deterministic coordination and escrow — the “underground Stripe” layer: signed events, milestone settlement, credit sinks, dispute timeouts | `state-engine`, node API |
| **Vectis client** | Official reference app for operating a node — onboarding, offers, explorer, operator panels; **target: marketplace platform** | `apps/web`, `@new-start/sdk-ts` (→ `@vectis/*` when renamed) |

“Underground Stripe” is positioning language, not a second product. It means: **settlement clarity and inspectable outcomes** without becoming a fiat payment processor. Vectis coordinates value; it does not move bank money (see `docs/runbooks/operator-security-guide.md`, SOC-01).

## Customizable UI, operator-owned stores

The user interface is **not fixed**. Vectis is a platform others build on:

- Operators run their own **stores and marketplaces** with custom branding, lanes, and workflows.
- The reference web app (`apps/web`) is a **template and proof**, not the only storefront.
- Any shell that uses the SDK/API may replace it — community marketplaces, maintainer portals, lane-specific UIs.

Kernel truth stays in the event log and replay. Storefronts differ; settlement rules converge.

## Ease target: Stripe × Shopify

Long-term UX and operator goals (from `docs/foundation/project-thesis.md`):

| Analog | Vectis equivalent |
| --- | --- |
| **Shopify** | Spin up a coordination storefront or operator node without protocol expertise — install, configure lanes, go live |
| **Stripe** | Integrate settlement into an existing product with a small API surface — submit events, query state, trust deterministic outcomes |
| **Decentralized ledger** | Same valid log + same `as_of` → same state on every honest node |

“Easy” means:

1. **Deploy** — one binary, one data dir, documented runbooks (`docs/runbooks/operator-quickstart.md`).
2. **Integrate** — thin SDK, stable HTTP v0, no reimplemented settlement logic.
3. **Customize** — white-label UI; operator-owned marketplace identity.
4. **Verify** — replay, snapshots, and evidence export for audit without platform trust.

## What Vectis is not

- Not a single centralized marketplace operated by the repo maintainer
- Not a payment processor for PayPal, cards, or crypto rails
- Not a mandatory UI — only the protocol kernel is required for cross-operator convergence

## Related docs

- [design-principles.md](design-principles.md) — principle 11: protocol separate from application
- [../architecture/v0-architecture.md](../architecture/v0-architecture.md) — protocol vs application layers
- [../specs/restart-decisions.md](../specs/restart-decisions.md) — D1 product identity, D11 naming
- [project-thesis.md](project-thesis.md) — problem and coordination thesis
- [market-operating-model.md](market-operating-model.md) — disputes, social threats, P2P store operation
