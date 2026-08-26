# Frontend Spec — Guided offer publish (Standard / Advanced + preview)

**Status:** implemented (August 2026). Normative behavior: [ui-contract.md](ui-contract.md) · [client-capabilities.md](client-capabilities.md).

## Meta

- **Product:** Vectis official marketplace client
- **Audience:** Non-operator participants posting help needs (stalled projects, bug fixes, collabs) and providers browsing them
- **Reference tier:** Aperio (guided form) + Linear restraint (preview card)
- **Stack:** Next.js App Router, Tailwind, shadcn/ui, lucide-react, TypeScript
- **Spec status:** approved for implementation
- **API dependency:** Existing `ServiceOffer` ingest via guided builder — **no new kernel events**

## Problem

Publish & transact step 1 currently surfaces protocol fields (`offerId`, ISO expiry, evidence format lists, `mk-demo-*` placeholders). That raises the learning curve and makes posts look like fixtures.

## Goals

1. **Standard mode (default):** human fields only — intent, title, category, price, expiry date, optional barter note.
2. **Advanced mode:** full protocol fields (current surface) for operators and power users.
3. **Live preview:** marketplace listing card updates as the user types, before sign/submit.
4. **Auto IDs:** Standard mode generates a unique `offerId` (never leave `mk-demo-offer` as the default).
5. **Intent framing:** chips for stalled / AI-broken recovery, bug fix, feature, testing, docs, collaboration — map onto existing policy lanes (no new service types).

## Non-goals

- New kernel `service_type` values (game-mod, music) — use existing lanes + clear unit titles until policy expands.
- Changing dispute/cancel/amend flows.
- Replacing the five-step guided shell.

## Visual direction

- Same dashboard surface system; no new purple/glow chrome.
- Standard/Advanced as a compact segmented control above the offer form.
- Preview sits beside (lg+) or below (mobile) the form — one ListingCard, labeled “Preview”.
- Intent chips: outline pills; selected = primary/10 ring — not a rainbow.

## Layout (offer step, `variant="transaction"`)

```
[ Standard | Advanced ]

[ Intent chips … ]

Form column                    Preview column
─────────────────              ────────────────
Title / need                   ListingCard (live)
Category                       “How buyers will see this”
Price
Expires (date)
[Optional barter]

(Advanced only: offerId, delivery, evidence, terms hash, raw serviceType, compensation)
```

## Field mapping (Standard → protocol)

| Standard UI | Protocol field |
|-------------|----------------|
| Intent chip | `serviceLaneTemplateId` + template defaults |
| Title / need | first line of `unitDefinition` (≤200 chars total with description) |
| Description | remainder of `unitDefinition` after newline |
| Category | template → `serviceType`, `deliveryMode`, `allowedEvidenceFormats` |
| Custom category | `serviceLaneTemplateId=custom` + manual `serviceType` (policy-allowed) |
| Price | `pricePerUnitCredits` |
| Expires (date) | `offerExpiresAt` (end of selected day UTC, or keep time if advanced set it) |
| Barter note (optional) | if non-empty → `compensationMode=mixed` + `barterTerms`; else `credits` |
| (auto) | `offerId` = `offer-<timestamp>-<rand>` when blank or demo placeholder |

## Intent chips → templates

| Chip | Template id | Suggested title placeholder |
|------|-------------|-----------------------------|
| Stalled / AI-broken project | `project-maintenance` | e.g. “Unstick vibe-coded feature that won’t build” |
| Bug / broken feature | `software-fixes` | e.g. “Fix failing CI / broken login” |
| Small feature | `feature-work` | e.g. “Add export button on settings page” |
| Test / reproduce | `testing` | e.g. “Reproduce crash on Windows 11” |
| Docs | `documentation` | e.g. “Rewrite setup docs for contributors” |
| Collaboration | `project-maintenance` | e.g. “Game mod / music / OSS collab milestone” |

## Components

| Component | Responsibility |
|-----------|----------------|
| `OfferPublishEditor` (inline in builder or extracted) | Mode toggle, standard/advanced fields, wires existing state setters |
| `ListingCard` | Reused for preview with `showcase: false` and preview scores |
| `MarketplaceTrustBarLive` | Hydration-safe label (no SSR/client URL mismatch) |

## Anti-patterns

- Do not show showcase/mock listings in preview.
- Do not require users to type `artifactHash` in Standard mode.
- Do not put Offer ID above the fold in Standard mode.
- Do not invent non-policy service types in the client.

## Acceptance

- [ ] Guided publish defaults to Standard.
- [ ] Advanced reveals protocol fields without losing Standard values.
- [ ] Preview card title tracks Title field; lane badge tracks category.
- [ ] Submit still builds the same `ServiceOffer` envelope.
- [ ] No trust-bar hydration mismatch (`/api/node` vs `http://127.0.0.1:7878`).
- [ ] Demo placeholder IDs are replaced on Standard mount.

## Verify

- `pnpm --filter @new-start/web typecheck`
- Manual: Publish & transact → Standard → fill title → preview updates → Advanced shows auto offer id → Sign still validates requirements.
