# Platform Vision Exploration

Purpose: capture the product direction for the **official Vectis client** as a marketplace platform, the mutual-aid thesis (productive cooperation outside GDP), online vs offline scope, anti-intervention doctrine, Aperio integration, and self-hosted desktop/mobile clients.

Status: `exploration` (informs R4-C5, R6, and future client tracks — not a protocol spec)

Last updated: July 2026

**Paused:** secondary-market attestation and off-protocol payment proof designs are not active.

## North star

Vectis is an **anti-financial**, **adminless** coordination protocol for **productive cooperation** — including collaboration whose value is **subjective** (support, wisdom, advice) when parties choose to structure it, and work that goes **unrecorded in GDP**.

**Techno-anarchy** (defined in [collaboration-value-doctrine.md](collaboration-value-doctrine.md)): no centralized arbitration or override inside the kernel; fairness from **technical specifications and replay**, not politics or a new legal system. Parties may always exit to courts.

The **official client** should be built as a **marketplace platform**: discover opportunities (Aperio), structure offers, escrow milestones, deliver evidence, close reputation — not a generic blockchain wallet or a traditional freelance gig wall.

Online global exchange is the **first proof surface** (tutorials, technical/medical/legal consultation *as artifact-bound lanes*, cloud/compute receipts, digital deliverables). Offline physical exchange (guitar for labor, utility credits) remains **aspirational** until objective evidence templates exist.

See also: [project-thesis.md](project-thesis.md), [product-identity.md](product-identity.md), [vectis-vs-blockchain-exploration.md](vectis-vs-blockchain-exploration.md).

## Two economies, one protocol ambition

| Realm | Examples | Vectis today | Horizon |
| --- | --- | --- | --- |
| **Online / global** | Tutorials, docs, code fixes, research artifacts, compute jobs, hosted-service receipts | **Production lanes** with fixture + API proof | Primary official client focus |
| **Offline / local** | Physical goods (guitar, bicycle), utility electricity, in-person mutual aid | **Experimental** templates (`local-resource-exchange`, `physical-handoff`) — EC-5, not deployment-gated | Lane + evidence research (R6-L3) |
| **GDP shadow** | Unpaid maintenance, community care, barter | **Reputation + contribution** paths; not fiat accounting | Document as social goal; protocol records *structured* exchanges when users choose to log them |

The protocol does not replace the mainstream economy. It offers a **parallel coordination layer** where fairness is **algorithmic** (escrow, evidence, timeouts) rather than institutional promise.

## Official client = marketplace platform

Product identity ([product-identity.md](product-identity.md)): kernel, settlement, and **official client** share the name **Vectis**. The client is not an afterthought.

### Platform loop (target mechanics)

```text
Discover (Aperio signals → lane-classified drafts)
    ↓
Structure (offer → order → milestones + criteria hashes)
    ↓
Commit (in-protocol escrow — credits, not fiat/crypto)
    ↓
Deliver (lane-valid evidence: artifacts, receipts, hashes)
    ↓
Close (accept / dispute / settle / timeout — kernel truth)
    ↓
Reputation (portable history; feeds next discovery ranking)
```

Discovery **does not** settle or mint ([discovery-bridge-spec.md](../specs/discovery-bridge-spec.md)). The marketplace client **does not** reimplement settlement ([r4-client-kernel-audit.md](../v0/r4-client-kernel-audit.md)).

Aperio is **sector-agnostic** (B2B leads, OSS, automotive, real estate, pet adoption, any indexable community). Canonical Aperio docs: `E:\Web Projects\aperio\docs`. Vectis bridge maps **selected signals** → lane offer drafts only when structured settlement is desired ([collaboration-value-doctrine.md](collaboration-value-doctrine.md)).

### Online tradables (v1 client scope)

Lanes should stay **objectively verifiable** — consultation becomes in-scope when bound to deliverables (written opinion hash, recording hash, structured report), not open-ended verbal advice.

| Category | Lane pattern | Evidence |
| --- | --- | --- |
| Tutorials / courses | `documentation` / custom digital lane | Artifact hashes, completion receipts |
| Technical services | `software-fixes`, `project-maintenance`, `feature-work` | Repo patches, CI artifacts |
| Research / analysis | `research` | Report hashes, datasets |
| Cloud / compute | `compute-job` | `job-receipt-v1` |
| Professional consultation (bounded) | Lane template TBD | **Deliverable hash required** — not verbal-only |

**“Tokens” in Vectis sense:** non-transferable, expiring **coordination credits** ([economic-protocol-v1.md](economic-protocol-v1.md)) — not tradable crypto tokens. Client UI must never imply speculative or withdrawable assets.

## Anti-financial and anti-intervention

### Anti-financial

- No in-protocol fiat, stablecoin, or crypto settlement rails.
- Credits are sink-bound, account-bound, time-bound coordination fuel.
- Durable value = **reputation and delivery history**, not hoardable balance.
- Opposes freelance-platform extraction and money-shaped scam dynamics ([market-operating-model.md](market-operating-model.md)).

### Anti-intervention (what it actually means)

**In-protocol:** no buyer, seller, operator, government, or law-enforcement agent can **override** milestone settlement, mint authority, or dispute outcomes through an admin API — because **none exists** (D9, kernel boundary spec).

**Honest limits:**

| Claim | True | False |
| --- | --- | --- |
| Rules are deterministic on honest replay | Yes | — |
| No human arbitration in kernel | Yes | — |
| Governments cannot seize a server or ban an app | — | No |
| Operators cannot refuse to ingest events | — | They control their node |
| Protocol works if you stop using it | Parties can always exit to off-protocol deals | — |

**Anti-intervention** = **no privileged humans inside the rules engine**, not immunity from the physical world. Users who want override courts use other systems; users who want **algorithmic fairness** use Vectis for the controllable portion of the exchange.

## Aperio and the “underground” opportunity market

Aperio fits as **opportunity radar**, not settlement:

- Surfaces maintenance, skill, and contribution signals traditional gig markets ignore.
- Feeds the discovery bridge → lane-classified `ServiceOffer` drafts.
- Reduces search cost for **mutual-aid-shaped work** (stalled repos, docs debt, testing gaps).

Official client integration path:

| Stage | Deliverable | Status |
| --- | --- | --- |
| CLI bridge | `npm run v3:discovery-bridge:e2e` | done (DB-4) |
| Standalone Aperio CLI | R3-B1 | pending (repo access) |
| Web draft import | R3-B5 | deferred |
| Marketplace browse UX | R4-C5+ | planned |

Client should label discovery rankings **informational** (SR-7); kernel reputation remains authoritative.

## Offline and physical exchange (hard problem)

Guitar-for-labor or utility-for-service involves:

- subjective delivery (instrument condition, electricity meter truth)
- regulated utilities and legal contracts outside protocol
- no global verifier without oracles or human judgment

**Current protocol stance:** experimental offline lanes with **strict evidence schemas** only ([economic-controls-track.md](economic-controls-track.md) EC-5). Production client should **not** promise fair settlement for unbounded physical barter until templates are proven.

**Product stance:** document mutual aid as **social mission**; ship **online marketplace** first; expand offline when evidence models are honest.

## Client roadmap: self-hosted official apps

**Decision (July 2026):** **Tauri v2** wraps `apps/web`; `vectis-node` runs as a **sidecar** (not embedded Next API). See [../roadmap/r7-professional-client-execution-plan.md](../roadmap/r7-professional-client-execution-plan.md).

All official clients are **self-hosted shells** over `vectis-node` + SDK — operators and users run their own stack.

| Client | Role | Status |
| --- | --- | --- |
| **Web** (`apps/web`) | Reference marketplace + explorer + onboarding; also PWA | exists |
| **Desktop** (`apps/desktop`) | Tauri v2: sidecar node, key vault, installers | **R7-D1..D5** (next) |
| **Mobile** | Tauri v2 iOS/Android; same web assets | **R7-M1** (after desktop MVP) |

Shared requirements across clients:

1. Thin over kernel (R4 audit rules).
2. Local or pinned node (`base_url`).
3. Passkey / OS keychain for key unlock (UX research).
4. White-label theming for operator stores.
5. Offline-capable **signing queue** (events sync when node reachable) — distinct from offline *economic* lanes.

Embed path: WASM/FFI replay library noted in kernel boundary spec for mobile edge verification (future).

## Operational mechanics to decide (open)

| Question | Options | Lean |
| --- | --- | --- |
| Who runs the node for casual users? | Self-host desktop bundle vs community operator | Desktop bundle ships `vectis-node` supervisor |
| Default marketplace scope | Maintainer network vs open operator stores | Federated operator stores (Shopify model) |
| Consultation lanes | New templates vs extend `research`/`documentation` | Template per deliverable type with mandatory artifact hash |
| Discovery in client | Import JSONL drafts vs live Aperio API | Draft import first (R3-B5), live feed later |
| Client release channel | Same repo vs `vectis-desktop` / `vectis-mobile` | Monorepo packages sharing `@vectis/sdk-ts` |

## Phased product sequence (suggested)

```text
R7-D1..D5 — Tauri v2 desktop MVP (ACTIVE)
  sidecar vectis-node + marketplace UX + installers

R7-X1 — Discovery draft import (parallel)

R7-M1 — Tauri mobile shells (later)

R6 — Lane expansion (background)
```

Kernel and deployment proof (R1–R2) remain done; **R7 professional client** is the primary implementation front.

## Related docs

- [market-operating-model.md](market-operating-model.md) — transaction specs, dispute boundaries
- [discovery-engine-bridge.md](../architecture/discovery-engine-bridge.md) — exploratory mapping
- [../specs/discovery-bridge-spec.md](../specs/discovery-bridge-spec.md) — normative bridge
- [../roadmap/restart-roadmap.md](../roadmap/restart-roadmap.md) — R3, R4, R6 tracks
- [../architecture/stalled-project-support-flow.md](../architecture/stalled-project-support-flow.md) — mutual-aid lane example
