# Frontend Phase 2 — Workspace Depth

Status: **planned** (kickoff after Phase 1 commit)

Prerequisite: [frontend-phase1-completion.md](frontend-phase1-completion.md)  
Canonical rules: [frontend-spec.md](frontend-spec.md)

## Goal

Turn the marketplace client from a **deal loop** into a **daily workspace**: role-aware dashboards, stronger order surfaces, guided dispute/settlement, and optional off-protocol client notes — without breaking kernel-truth labeling.

## Non-goals (Phase 2)

- Protocol or kernel behavior changes
- Fiat/crypto checkout or payment rails
- Full CRM parity with SaaS products
- Community “underground Spotify” apps (protocol layer; footer/docs only)

## Tracks

### P2-A — Role-aware workspace

**Problem:** Overview and Transactions treat every signed-in user the same. Buyers and providers need different default queues and copy.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P2-A1` | Detect primary role from live orders (buyer-heavy vs provider-heavy) | Dashboard context strip shows role hint |
| `P2-A2` | Role-filtered Transactions tabs or segments | Buyer queue vs selling queue without duplicate cards |
| `P2-A3` | Overview KPIs split by role | “Needs you” counts match Transactions |

**Files:** `overview-page.tsx`, `transactions-page.tsx`, `load-transactions.ts`, `dashboard-shell.tsx`

### P2-B — Order detail as action hub

**Problem:** Order detail is informational; exchange actions live in a panel without a single dominant CTA.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P2-B1` | Hero next-action strip from `deriveTransactionProgress` | One primary CTA matches protocol state |
| `P2-B2` | Deep link builder handoff with `order` query prefill | `/dashboard/builder?step=delivery&order=…` autofills order id |
| `P2-B3` | Compensation/barter summary on order header | Shows mode + terms hash when present on linked offer |

**Files:** `apps/web/app/marketplace/orders/[id]/page.tsx`, `order-exchange-panel.tsx`, `transaction-builder-panel.tsx`, `marketplace-event-builder.tsx`

### P2-C — Guided dispute and settlement

**Problem:** Dispute path exists only in operator builder — too technical for unhappy-path users.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P2-C1` | Sixth optional guided step or modal branch: “Open dispute” | Plain-language reason codes + notes hash |
| `P2-C2` | Settlement guidance after dispute | Outcome selector with refund/reward preview |
| `P2-C3` | Transactions badge for disputed orders | Stalled/dispute state visible in queue |

**Files:** `transaction-builder-panel.tsx`, `marketplace-event-builder.tsx`, `transaction-progress.ts`, `load-transactions.ts`

### P2-D — Multi-milestone and deadlines

**Problem:** Phase 1 models a single milestone; real freelance work is often phased.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P2-D1` | Milestone schedule editor (add/remove rows in guided order) | Payload maps to `milestones[]` in `ServiceOrder` |
| `P2-D2` | Per-milestone progress on Transactions cards | Step indicator reflects active milestone |
| `P2-D3` | Stale-order hints from `orderExpiresAt` / milestone due window | “Past due” or “expires soon” labels in queue |

**Files:** `marketplace-event-builder.tsx`, `transaction-progress.ts`, `transactions-page.tsx`

### P2-E — Client workspace layer (off-protocol)

**Problem:** Users want Strata-style follow-ups without polluting kernel truth.

| ID | Scope | Acceptance |
| --- | --- | --- |
| `P2-E1` | Encrypted local notes per order (buyer/provider only) | Clearly labeled “Not on chain” |
| `P2-E2` | Optional follow-up reminders (local notifications) | No settlement authority |

**Files:** new `apps/web/lib/workspace/` module, order detail + transactions integration

## Suggested implementation order

1. **P2-B** — order detail action hub (highest leverage for daily use)
2. **P2-C** — guided dispute branch (closes Phase 1 gap)
3. **P2-A** — role-aware workspace
4. **P2-D** — multi-milestone + deadlines
5. **P2-E** — client workspace notes (optional slice)

## Gates (Phase 2 done when)

- [ ] Order detail shows one protocol-correct primary CTA for signed-in participant
- [ ] Dispute can be filed from guided flow without opening operator builder
- [ ] Transactions queue distinguishes buyer vs provider “needs you” counts
- [ ] At least two milestones can be composed in guided order step
- [ ] Off-protocol notes (if shipped) are visually distinct from kernel state
- [ ] `pnpm typecheck` + manual smoke on order detail + dispute path

## Verification commands

```bash
cd apps/web && pnpm typecheck
npm run r4:client-audit
```

## References

- [foundation/market-operating-model.md](foundation/market-operating-model.md) — dispute semantics
- [specs/trust-bootstrap-and-credits-path-spec.md](specs/trust-bootstrap-and-credits-path-spec.md) — cold-start (future dashboard trust UX)
- [architecture/phase2-compute-job-lane.md](architecture/phase2-compute-job-lane.md) — protocol Phase 2 compute lane (separate from this frontend plan)
