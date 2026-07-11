# Testing without real users

Solo development playbook when you do not have buyer/provider counterparties on a live node.

## Principle

The kernel proves correctness through **fixtures and drills**. The client proves usability through **guided flows + explorer**. You do not need two humans to validate most UI work — you need deterministic node state and two signing keys.

## 1. Seed the node with fixtures

```bash
cargo run --bin cli -- fixtures run
# or ingest a lane bundle, e.g. marketplace-accept.jsonl
```

Confirm replay:

```bash
cargo run --bin vectis-node -- db inspect --data-dir ./.data/dev
```

## 2. Use two local identities

1. Register or generate identity A (buyer) in `/register`.
2. Open a private/incognito window — register identity B (provider).
3. Sign offers and orders as provider; fund/deliver/accept as buyer (or reverse).

Store keys only in dev data dirs — never commit secrets.

## 3. Guided builder end-to-end (Phase 1)

Path: **Dashboard → Publish & transact**

| Step | Who acts |
| --- | --- |
| Publish offer | Provider key |
| Place order | Buyer key |
| Fund escrow | Buyer key |
| Deliver work | Provider key |
| Accept completion | Buyer key |

Deep-link resume: `/dashboard/builder?step=delivery&order=<orderId>`

## 4. Dispute branch without operator chrome (Phase 2-C)

Path: **Publish & transact → Resolve a problem**

| Step | Notes |
| --- | --- |
| Open dispute | Reason select + delivery reference |
| Settle outcome | Refund/reward preview |

Or start from an order: `/dashboard/builder?branch=dispute&step=dispute&order=<orderId>`

Fixture reference: `fixtures/valid/marketplace-dispute-settle.jsonl`

**Smoke checks**

- [ ] Dispute branch toggle visible on Publish & transact
- [ ] `Dispute open` badge on Transactions when milestone is Disputed
- [ ] Guided dispute link from order card / order hub

## 5. Role-aware workspace (Phase 2-A)

Path: **Dashboard → Overview** and **Dashboard → Transactions**

| Check | Expected |
| --- | --- |
| Header role hint | Shows buyer-focused, provider-focused, or balanced label when orders exist |
| Transactions tabs | All / Buying / Selling filters with counts; URL `?role=buyer` or `?role=provider` |
| Overview KPIs | Buying/selling “needs you” counts match Transactions queue |
| Role badges | Each order card shows Buying or Selling |

## 6. Order detail action hub (Phase 2-B)

1. Open a live order from **Transactions** or marketplace.
2. Confirm **hero CTA** matches protocol state (fund / deliver / accept / resolve dispute).
3. Confirm **compensation summary** when linked offer has barter/mixed mode.
4. Use **Guided builder** deep link — order id prefilled from `?order=`.
5. Scroll to **Exchange actions** panel for inline fund/deliver/accept.

## 7. Multi-milestone orders (Phase 2-D / Phase 3-B)

1. In guided **Place order**, add two milestones in the schedule editor.
2. Submit order; confirm `milestones[]` in explorer or signed payload preview.
3. On **Transactions**, confirm milestone strip and “N of M milestones” badge when applicable.
4. Fund/deliver/accept first milestone; confirm active milestone advances on queue card.
5. On downstream builder steps (fund / deliver / accept / dispute), confirm **milestone picker** when `milestones.length > 1`.
6. From order hub or transactions card, open guided builder — confirm `?milestone=` prefills the active milestone.
7. If `orderExpiresAt` is near, confirm **Expires soon** or **Order expired** badge.
8. When milestone terms use “N days after funding”, confirm relative due hint after escrow is funded (label only).

## 8. Off-protocol workspace notes (Phase 2-E / Phase 3-E)

1. Open order detail as buyer or provider.
2. Add a note in **Workspace notes** — confirm **Not on chain** labeling.
3. Save; reload page — note persists (encrypted local storage).
4. Optional: set a local reminder; grant notification permission when prompted.
5. On **Transactions**, confirm **Note** / **Reminder** badges when applicable.
6. On **order action hub**, confirm **Local note** chip when a note exists.
7. Visit **Dashboard → Overview** with a due reminder — confirm browser notification fires (permission granted).
8. **Settings → Advanced → Workspace notes backup** — export encrypted blob; confirm off-protocol copy.

## 9. In-app help

- `/help` index loads from header or dashboard sidebar
- Spot-check: `deal-flow`, `disputes`, `identity`, `node-connection`, `trust-bootstrap`, `credits-path`

## 10. Explorer cross-check

Use `/explorer/orders`, `/explorer/milestones` to verify client copy matches kernel `as_of` state. If UI and explorer disagree, fix the client loader — not the display copy.

## 11. Automated gates (run before push)

```bash
cd apps/web && pnpm typecheck
npm run r4:client-audit    # C1–C4 + Phase 2 surface + help slug checks
npm run v1:readiness
```

The audit script verifies: kernel-truth patterns, SOC-01 on marketplace entry, help article slugs, order action hub, role-aware transactions, workspace notes panel, Phase 3 lane/trust/workspace surfaces.

For lane drills: `npm run r2:exchange-drill`, `npm run r6:compute-job:drill` (see runbooks).

Trust bootstrap proof: `npm run r2:genesis-drill` then walk guided UI (section 13 below).

## 12. Phase 2 smoke checklist (quick pass)

Run after client changes touching dashboard, marketplace, or builder:

- [ ] Marketplace entry shows off-protocol payment warning (SOC-01)
- [ ] Signed-in overview loads without showcase fallback
- [ ] Transactions queue sorts action-needed first
- [ ] Order hub CTA + workspace notes panel on order detail
- [ ] Guided builder happy path + dispute branch
- [ ] Multi-milestone order compose (2+ rows)
- [ ] `pnpm typecheck` and `npm run r4:client-audit` pass

## 13. Phase 3 smoke checklist (trust, lanes, workspace)

Run after client changes touching trust bootstrap, marketplace signals, lane catalog, or workspace depth.

### Trust bootstrap (P3-A)

Prerequisite: `npm run r2:genesis-drill` (or fixture state with low vouch weight + zero balance identities).

| Check | Expected |
| --- | --- |
| Overview trust panel | Vouch weight vs threshold; sponsor helper; credits-path checklist |
| Offer step guard | Below-threshold provider sees admission warning before submit |
| Founding network label | Marketplace trust bar shows honest phase label + disclaimer link |
| Help articles | `/help/trust-bootstrap`, `/help/credits-path` load from panel links |

### Marketplace trust signals (P3-C)

| Check | Expected |
| --- | --- |
| Offer detail | Provider eligibility or reputation snippet with kernel-truth disclaimer |
| Listing rows | Trust badges when `getReputation` returns lane data |
| Discovery section | Informational disclaimer on discovery scores |

### Lane catalog + publish guidance (P3-D)

| Check | Expected |
| --- | --- |
| Lane catalog | `/marketplace/lanes` lists community + specialized lanes |
| Hero / sidebar | Links to lane catalog; discovery import CTA with **Draft ≠ live offer** |
| Offer step lane fit | Delivery mode + evidence formats for selected template |
| Experimental lanes | Strict lanes show experimental badge before publish |
| Discovery import deep link | `/dashboard/builder?step=offer&import=discovery` opens import panel |

### Workspace depth (P3-E)

| Check | Expected |
| --- | --- |
| Overview reminder flush | Due reminders fire on Overview load (notification permission granted) |
| Order hub chip | **Local note** badge when encrypted note exists |
| Workspace backup | Settings → Advanced exports identity-bound encrypted blob |

### Phase 3 quick pass

- [ ] Trust bootstrap panel on Overview (signed in)
- [ ] Offer detail trust signals + listing trust badges
- [ ] Lane catalog + lane-fit panel on offer step
- [ ] Discovery import CTA (marketplace + builder)
- [ ] Multi-milestone picker on downstream builder steps
- [ ] Local note chip on order hub; workspace backup in Advanced settings
- [ ] `pnpm typecheck`, `npm run r4:client-audit`, `npm run r2:genesis-drill` pass

## 14. What still needs humans

- Mobile pinned-node field proof (R7-M2)
- Post-deployment community lane proof (R6-PD) with a second operator host
- Subjective UX feedback on copy and layout

Everything else in Phase 1–3 client work can be validated solo with fixtures + two keys.

## 15. R8 convenience transport (when a low-trust counterparty appears)

Complete client track: [../roadmap/r8-convenience-transport-execution-plan.md](../roadmap/r8-convenience-transport-execution-plan.md) · Spec: [../specs/r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md).

Use these asks when someone is willing to **look** but not yet **trust** the full app:

| Ask level | What you show | What they do | Trust required |
| --- | --- | --- | --- |
| **Intro only** | Identity intro QR or pubkey copy | Verify pubkey matches your display name | Minimal |
| **Sponsor vouch** | Vouch request bundle (Tier 1) | Sign `Vouch` in their own vault | Low — they never give you keys |
| **Draft offer** | Discovery import or offer draft link | Review in builder; sign `ServiceOffer` themselves | Medium — they control signature |
| **Small exchange** | Reference lane (`software-fixes`) order | Fund/deliver/accept with explicit kernel-truth labels | Medium — bounded escrow amount |

**Solo smoke for R8 (before any human):**

| Tier | Method |
| --- | --- |
| Tier 0 | **Show QR** on Overview (vouch request), order hub (builder resume), marketplace discovery import, or Settings → Connection (absolute node URL). Scan with phone → confirm route or text. |
| Tier 1 | Two browsers or `/dashboard/import` paste; confirm expiry and warning copy; optional camera scan on mobile; `npm run r8:transport:smoke` |
| Tier 2 | `/dashboard/handoff` wizard against SCN-18 fixture order (two browsers / two keys); `npm run r6:offline-lanes:smoke` |

Label evidence honestly: **maintainer smoke** ≠ **field proof** (same rule as R6-PD-C).

← [Client docs](README.md)
