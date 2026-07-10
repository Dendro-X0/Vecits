# Frontend Phase 3 — Trust, Lanes, and Production Readiness

Status: **complete** (July 2026)

Prerequisite: [frontend-phase2-plan.md](frontend-phase2-plan.md) (complete)  
Completion summary: [frontend-phase3-completion.md](frontend-phase3-completion.md)  
Canonical rules: [frontend-spec.md](frontend-spec.md)

## Goal

Move the official client from a **participant workspace** (Phase 2) to a **cold-start-ready network surface**: honest trust bootstrap UX, stronger marketplace signals, completed multi-milestone flows, and production gates — **without kernel or protocol changes**.

Phase 2 answered: *"What do I do on this order today?"*  
Phase 3 answers: *"Can I participate in this network, and can I trust what I'm seeing?"*

## Non-goals (Phase 3)

- Kernel / protocol behavior changes (`OrderAmend`, new event kinds, policy edits from UI)
- Fiat/crypto checkout or transferable credits
- Full CRM, messaging, or off-platform payment rails
- Production UX for experimental offline lanes (`physical-handoff`, `local-resource-exchange`)
- On-device mobile node sidecar (R7-M3 — spec only)
- Human arbitration or dispute override in the client

## Context: what already exists (reuse, don't rebuild)

| Capability | Today | Phase 3 action |
| --- | --- | --- |
| Onboarding + vouch tracking | `onboarding-wizard.tsx` (operator console only) | Extract into guided dashboard flow |
| Contribution → mint path | `contribution-credit-builder.tsx` (operator console only) | Simplified buyer checklist + handoff |
| Discovery draft import | R7-X1 complete in builder | Marketplace prominence + lane labels |
| Reputation API | `getReputation`, explorer pages | Surface on offer detail + listings |
| Multi-milestone compose | P2-D schedule editor on order step | Milestone picker on downstream steps |
| Off-protocol notes | P2-E workspace layer | Dashboard reminder flush + order hub chip |
| In-app help | `/help/*` | Add trust bootstrap + credits articles |

Protocol obligations: [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) §9 (client labeling).

## Tracks

### P3-A — Trust bootstrap in the main client

**Status:** complete (July 2026). Overview trust panel, offer-step admission guard, founding network label, help articles.

**Problem:** New providers hit `provider_eligibility_threshold` and buyers hit zero balance with no guidance in the guided client. Operator tools exist but are buried in Advanced → legacy console.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P3-A1` | Provider eligibility panel | Signed-in user sees vouch weight vs threshold before first offer submit; copy distinguishes **admission** from **settlement** |
| `P3-A2` | Sponsor request helper | Reuse onboarding wizard logic: copyable vouch request drafts, sponsor list progress |
| `P3-A3` | Buyer credits path checklist | Plain-language SCN-02 path: claim → attest → mint → fund escrow; links to simplified flow (not raw operator JSON) |
| `P3-A4` | Trust phase labeling | Dashboard/marketplace shows honest phase label (e.g. "Founding network") with disclaimer link |
| `P3-A5` | Help articles | `/help/trust-bootstrap`, `/help/credits-path` synced per [client/in-app-help-sync.md](client/in-app-help-sync.md) |

**Files (new / touch):** `components/dashboard/trust-bootstrap-panel.tsx`, refactor from `onboarding-wizard.tsx`, `overview-page.tsx`, `transaction-builder-panel.tsx` (offer step guard), `lib/help/articles.ts`

**Proof:** solo operator runs `npm run r2:genesis-drill` then walks guided UI without opening operator console.

---

### P3-B — Multi-milestone exchange completion

**Status:** complete (July 2026). Milestone picker on downstream builder steps, `?milestone=` handoff, order hub milestone strip, relative due-window hints (best effort).

**Problem:** Phase 2 composes multi-milestone orders but escrow/delivery/accept/dispute steps still assume a single milestone id field.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P3-B1` | Milestone picker on guided downstream steps | When `milestones.length > 1`, escrow/delivery/accept/dispute show select control |
| `P3-B2` | Builder handoff `?milestone=` | `buildBuilderHref` and order hub links include active milestone id |
| `P3-B3` | Per-milestone progress on order hub | `order-action-hub.tsx` milestone strip matches transactions card |
| `P3-B4` | Relative due-window hints (best effort) | Parse "N days after funding" when milestone `funded_at` exists; label only, no kernel claim |

**Files:** `marketplace-event-builder.tsx`, `builder-handoff.ts`, `order-deadline-hints.ts`, `order-action-hub.tsx`, `transaction-progress.ts`

---

### P3-C — Marketplace trust signals

**Status:** complete (July 2026). Provider trust on offer detail, listing snippets, discovery disclaimer, delivery history labels.

**Problem:** Marketplace shows price and lane but not **why** a provider is eligible or what reputation means.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P3-C1` | Provider eligibility on offer detail | Kernel-backed vouch weight vs `provider_eligibility_threshold` for listing author |
| `P3-C2` | Lane reputation snippet | Offer detail + listing row shows lane score when `getReputation` returns data |
| `P3-C3` | Discovery disclaimer | Marketplace discovery section reinforces scores are informational ([kernel-truth-banner.tsx](../apps/web/components/marketplace/kernel-truth-banner.tsx) pattern) |
| `P3-C4` | Delivery history hint | Completed accept count or "new provider" label from replay-visible events (no fabricated stats) |

**Files:** `app/marketplace/offers/[id]/page.tsx`, `marketplace-listings-section.tsx`, `lib/marketplace/load.ts`, new `lib/marketplace/trust-signals.ts`

---

### P3-D — Lane discovery and publish guidance

**Status:** complete (July 2026). Lane catalog route, publish lane-fit panel, discovery import CTAs with draft disclaimer, experimental lane badges.

**Problem:** Seven community lanes exist (R6-L2) but the marketplace does not help users pick the right lane or import discovery drafts.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P3-D1` | Lane catalog entry point | Marketplace links to lane picker aligned with [lane-template-catalog.md](architecture/lane-template-catalog.md) |
| `P3-D2` | Publish flow lane fit | Offer step shows evidence/delivery requirements for selected lane template |
| `P3-D3` | Discovery import CTA | Marketplace hero/toolbar promotes draft import (R7-X1) with "draft ≠ live offer" label |
| `P3-D4` | Compute/offline lane warnings | Strict lanes show experimental badge before publish |

**Files:** `marketplace-hero.tsx`, `marketplace-toolbar.tsx`, `discovery-draft-import-panel.tsx`, `transaction-builder-panel.tsx`

---

### P3-E — Workspace layer depth (optional slice)

**Status:** complete (July 2026). Overview reminder flush, order hub local-note chip, encrypted workspace backup export in Advanced settings.

**Problem:** P2-E notes work on order detail but reminders only flush on transactions load.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P3-E1` | Dashboard reminder flush | Overview (or shell) calls `flushDueOrderReminders` on signed-in load |
| `P3-E2` | Order hub note chip | `order-action-hub` shows "Local note" when encrypted record exists |
| `P3-E3` | Workspace backup export | Settings → Advanced: export encrypted notes blob (identity-bound); clearly off-protocol |

**Files:** `lib/workspace/*`, `overview-page.tsx`, `order-action-hub.tsx`, `dashboard-settings-panel.tsx`

---

### P3-F — Production hardening (close Phase 2 loose ends)

**Status:** complete (July 2026). `r4:client-audit` extended for Phase 2 surfaces; marketplace SOC-01 banner; smoke checklist in client docs.

**Problem:** Phase 2 plan left manual smoke and `r4:client-audit` as open gates.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P3-F1` | `r4:client-audit` pass | `npm run r4:client-audit` green on main |
| `P3-F2` | Documented smoke checklist | [client/testing-without-users.md](client/testing-without-users.md) covers P2-A..E paths |
| `P3-F3` | Docs sync | `docs/README.md` marks Phase 2 complete; this plan linked from `frontend-spec.md` |
| `P3-F4` | Typecheck + help sync CI habit | `pnpm typecheck` + help slugs verified in `r4-client-audit.mjs` |

**Files:** docs only + any audit fixes surfaced by `r4:client-audit`

## Suggested implementation order

1. **P3-F** — close audit/smoke/docs gates (cheap; unblocks confidence)
2. **P3-B** — multi-milestone picker (highest daily-use leverage from Phase 2)
3. **P3-A** — trust bootstrap (cold-start narrative)
4. **P3-C** — marketplace trust signals (buyer confidence)
5. **P3-D** — lane catalog + discovery import polish
6. **P3-E** — workspace depth (optional; ship if time allows)

## Gates (Phase 3 done when)

- [x] `npm run r4:client-audit` passes (P3-F)
- [x] Manual smoke checklist documented for Phase 2 paths (P3-F)
- [x] `docs/README.md` and `frontend-spec.md` link Phase 3 plan (P3-F)
- [x] New provider sees eligibility status in guided client before offer submit fails on-node
- [x] New buyer sees credits-path checklist without opening operator console
- [x] Multi-milestone order can be funded/delivered/accepted per-milestone from guided builder
- [x] Offer detail shows kernel-backed provider eligibility or reputation snippet with disclaimer
- [x] Marketplace links to lane catalog; offer step shows lane delivery/evidence fit
- [x] Discovery draft import promoted with "draft ≠ live offer" label in marketplace and builder
- [x] Overview flushes due workspace reminders on signed-in load
- [x] Order hub shows local-note chip when encrypted workspace record exists
- [x] Advanced settings exports identity-bound encrypted workspace notes backup (off-protocol)
- [x] `npm run r4:client-audit` passes
- [x] `cd apps/web && pnpm typecheck` passes
- [x] Manual smoke checklist documented for Phase 3 paths ([client/testing-without-users.md](client/testing-without-users.md) §13)

## Verification commands

```bash
cd apps/web && pnpm typecheck
npm run r4:client-audit
npm run r2:genesis-drill          # trust bootstrap proof
npm run v1:readiness
```

Manual (two local keys): full deal loop + dispute branch + multi-milestone order + workspace note + role-filtered transactions queue.

## Relationship to other tracks

| Track | Relationship to Phase 3 |
| --- | --- |
| **R6-PD** post-deployment proof | Protocol/deployment; Phase 3 client should display live lane offers from PD node |
| **R7-M1** iOS scaffold | Mobile shell; Phase 3 UI must work in pinned-node mobile mode |
| **Trust bootstrap spec** | Phase 3 implements §9 client obligations |
| **Protocol backlog** | No new protocol slices required for Phase 3 |

## References

- [frontend-phase2-plan.md](frontend-phase2-plan.md) — completed workspace depth
- [frontend-phase1-completion.md](frontend-phase1-completion.md) — deal loop baseline
- [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md)
- [runbooks/operator-genesis-runbook.md](runbooks/operator-genesis-runbook.md)
- [architecture/lane-template-catalog.md](architecture/lane-template-catalog.md)
- [client/testing-without-users.md](client/testing-without-users.md)
- [foundation/limitations-and-disclaimers.md](foundation/limitations-and-disclaimers.md)
