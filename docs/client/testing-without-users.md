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

## 3. Guided builder end-to-end

Path: **Dashboard → Publish & transact**

| Step | Who acts |
| --- | --- |
| Publish offer | Provider key |
| Place order | Buyer key |
| Fund escrow | Buyer key |
| Deliver work | Provider key |
| Accept completion | Buyer key |

Deep-link resume: `/dashboard/builder?step=delivery&order=<orderId>`

## 4. Dispute branch without operator chrome

Path: **Publish & transact → Resolve a problem**

| Step | Notes |
| --- | --- |
| Open dispute | Reason select + delivery reference |
| Settle outcome | Refund/reward preview |

Or start from an order: `/dashboard/builder?branch=dispute&step=dispute&order=<orderId>`

Fixture reference: `fixtures/valid/marketplace-dispute-settle.jsonl`

## 5. Transactions and order hub

1. Complete at least one exchange on the node with your pubkey as participant.
2. Open **Dashboard → Transactions** — confirm sort order and badges.
3. Open order detail — confirm hero CTA, compensation summary, inline actions.

## 6. Explorer cross-check

Use `/explorer/orders`, `/explorer/milestones` to verify client copy matches kernel `as_of` state. If UI and explorer disagree, fix the client loader — not the display copy.

## 7. Automated gates

```bash
npm run v1:readiness
npm run r4:client-audit
cd apps/web && pnpm typecheck
```

For lane drills: `npm run r2:exchange-drill`, `npm run r6:compute-job:drill` (see runbooks).

## 8. What still needs humans

- Mobile pinned-node field proof (R7-M2)
- Post-deployment community lane proof (R6-PD) with a second operator host
- Subjective UX feedback on copy and layout

Everything else in Phase 1–2 client work can be validated solo with fixtures + two keys.

← [Client docs](README.md)
