# Frontend Spec — Marketplace landing hero + post-job CTA

**Status:** partially implemented (August 2026). Remaining items: [../meta/design-audit-2026-08-26.md](../meta/design-audit-2026-08-26.md). Normative UI: [ui-contract.md](ui-contract.md).

## Meta

- **Product:** Vectis official marketplace client
- **Surface:** `/marketplace` hero + listings toolbar
- **Reference:** Linear/Stripe restraint (centered marketing band) + existing Vectis tokens
- **Spec status:** approved for implementation
- **API dependency:** none — links only (`/dashboard/builder?step=offer`, `/sign-in`)

## Problem

1. Hero is left-heavy: copy + four CTAs on the left, a large trust **card** on the right → unbalanced first viewport.
2. Listings browse has no clear path for newcomers who want to **post a job** (publish an offer); empty state has Publish, but populated lists do not.

## Goals

1. **Balanced hero:** one centered composition — eyebrow, headline, one supporting sentence, primary CTA pair, compact secondary links. No side card in the hero.
2. **Trust band below hero:** three equal columns (Browse / Exchange / Proof) in a full-width symmetric strip — not a floating card beside the headline.
3. **Post a job CTA** on the listings header (job list toolbar), always visible when listings load (empty or populated).
4. Signed-out users land on sign-in; after unlock, continue to the offer builder when `next` is provided.

## Non-goals

- New marketplace routes or kernel APIs.
- Redesigning category sidebar, trust bar, or kernel-truth banners.
- Adding a hero product screenshot (no asset yet).

## Layout

### Hero (first composition)

```
              [ eyebrow pill ]
         Find trusted work. Get paid…
              one supporting sentence

     [ Browse listings ]  [ Post a job ]
        Mutual aid · Lane catalog · Identity

     ┌─────────────────────────────────────┐
     │ Browse │ Exchange │ Proof           │  ← one shared surface
     ├─────────────────────────────────────┤
     │ Quiet link: Import draft in builder │  (no QR on landing)
     └─────────────────────────────────────┘
```

- Max width centered (`max-w-3xl` copy, `max-w-5xl` section).
- Below hero: one **closed** disclosure — “Kernel truth & credits”.
- Listings header: Post a job + search/sort only (Import/QR demoted to builder).

### Listings toolbar

```
Listings                          [ Post a job ]
N services · …                    [ search / sort / Apply ]
```

- Primary **Post a job** beside the Listings title row on large screens; stacks above filters on mobile.
- Do not put Import/QR in the listings header.

## Copy

| Element | Copy |
|---------|------|
| Hero supporting | Collaboration rewards are customizable — credits, barter, or shared digital work… Settles in milestones when accepted. |
| Trust · Exchange | Credits, barter, or shared work |
| Hero primary | Browse listings |
| Hero secondary primary | Post a job |
| Listings CTA | Post a job |
| CTA destination (signed in) | `/dashboard/builder?step=offer` |
| CTA destination (signed out) | `/sign-in?next=/dashboard/builder?step=offer` |

## Components

| Component | Change |
|-----------|--------|
| `marketplace-hero.tsx` | Center layout; remove side card; trust as 3-col band; Post a job CTA |
| `marketplace-toolbar.tsx` | Add Post a job control (session-aware link) |
| `post-job-cta.tsx` (new, small) | Shared link target + signed-in detection |
| `sign-in/page.tsx` | Honor `?next=` when safe (same-origin path) |

## Anti-patterns

- Do not keep a large trust **card** in the hero column.
- Do not add a fourth primary button in the hero CTA row.
- Do not use “Post a job” language that implies off-protocol fiat jobs — still Vectis offers/milestones; optional microcopy: “Publish an offer”.

## Acceptance

- [x] Hero reads as one centered composition on desktop and mobile.
- [x] Trust content appears as a symmetric three-column band under the CTAs.
- [x] Listings header shows Post a job whether the grid is empty or populated.
- [x] Signed-out Post a job → sign-in → lands on offer builder when `next` is honored.
- [x] Existing Browse listings `#listings` anchor still works.

## Verify

- Visual: `/marketplace` first viewport + listings header
- `pnpm --filter @new-start/web typecheck` (or apps/web `tsc --noEmit`)
