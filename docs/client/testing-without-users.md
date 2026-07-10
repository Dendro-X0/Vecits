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
cargo run --bin vectis-node -- db inspect --data-dir ./vectis-data-dev
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

## 7. Multi-milestone orders (Phase 2-D)

1. In guided **Place order**, add two milestones in the schedule editor.
2. Submit order; confirm `milestones[]` in explorer or signed payload preview.
3. On **Transactions**, confirm milestone strip and “N of M milestones” badge when applicable.
4. Fund/deliver/accept first milestone; confirm active milestone advances on queue card.
5. If `orderExpiresAt` is near, confirm **Expires soon** or **Order expired** badge.

## 8. Off-protocol workspace notes (Phase 2-E)

1. Open order detail as buyer or provider.
2. Add a note in **Workspace notes** — confirm **Not on chain** labeling.
3. Save; reload page — note persists (encrypted local storage).
4. Optional: set a local reminder; grant notification permission when prompted.
5. On **Transactions**, confirm **Note** / **Reminder** badges when applicable.

## 9. In-app help

- `/help` index loads from header or dashboard sidebar
- Spot-check: `deal-flow`, `disputes`, `identity`, `node-connection`

## 10. Explorer cross-check

Use `/explorer/orders`, `/explorer/milestones` to verify client copy matches kernel `as_of` state. If UI and explorer disagree, fix the client loader — not the display copy.

## 11. Automated gates (run before push)

```bash
cd apps/web && pnpm typecheck
npm run r4:client-audit    # C1–C4 + Phase 2 surface + help slug checks
npm run v1:readiness
```

The audit script verifies: kernel-truth patterns, SOC-01 on marketplace entry, help article slugs, order action hub, role-aware transactions, and workspace notes panel.

For lane drills: `npm run r2:exchange-drill`, `npm run r6:compute-job:drill` (see runbooks).

Trust bootstrap proof (optional): `npm run r2:genesis-drill`

## 12. Phase 2 smoke checklist (quick pass)

Run after client changes touching dashboard, marketplace, or builder:

- [ ] Marketplace entry shows off-protocol payment warning (SOC-01)
- [ ] Signed-in overview loads without showcase fallback
- [ ] Transactions queue sorts action-needed first
- [ ] Order hub CTA + workspace notes panel on order detail
- [ ] Guided builder happy path + dispute branch
- [ ] Multi-milestone order compose (2+ rows)
- [ ] `pnpm typecheck` and `npm run r4:client-audit` pass

## 13. What still needs humans

- Mobile pinned-node field proof (R7-M2)
- Post-deployment community lane proof (R6-PD) with a second operator host
- Subjective UX feedback on copy and layout

Everything else in Phase 1–2 client work can be validated solo with fixtures + two keys.

← [Client docs](README.md)
