> **Archived — not normative.** Canonical: [ui-contract.md](../../client/ui-contract.md) · [client-capabilities.md](../../client/client-capabilities.md).

# Frontend Phase 1 — Deal Loop Completion

Status: **complete** (July 2026)

Canonical spec: [frontend-spec.md](frontend-spec.md) · Next: [frontend-phase2-plan.md](frontend-phase2-plan.md)

## Goal

Ship a reliable **freelancer↔client deal loop** in the official web client: agree terms, fund milestones, deliver evidence, accept or dispute, and recover identity across devices.

## What shipped

### Dashboard and shell

- Split workspace shell (sidebar + coordination canvas) with deduplicated route headers
- Overview, Transactions, Publish & transact, and Settings workflow navigation
- Theme-aware surfaces (`apps/web/lib/ui/theme-surfaces.ts`)
- Kernel-backed overview and transactions — no showcase fallbacks

### Settings

- General vs **Advanced** settings (advanced collapsed by default; `?advanced=1` deep link)
- Security callout for identity portability (backup + passkey before device switch)
- Technical operator controls moved behind advanced disclosure

### Publish & transact (guided builder)

- Five-step guided flow: offer → order → escrow → deliver → accept
- Transaction-mode step layouts with plain-language copy
- Advanced protocol fields behind disclosures
- Compensation mode: `credits | barter | mixed` with barter terms/tags
- Milestone terms editor: deliverable, due window, acceptance criteria + terms hash action
- Terms lock preview on order step
- Delivery evidence summary + preflight guard
- Submission lifecycle: `draft → submitting → accepted | failed` with retry/dismiss
- Dispute entry points (accept step + operator deep links)
- Operator builder for dispute/settle and fixture drills

### Transactions

- Kernel-backed order queue with role, progress steps, and next-action copy
- Prioritization: action-needed orders first
- **Guided builder** handoff via `/dashboard/builder?step=…`

### Marketplace and explorer polish

- Marketplace landing recovery states and listings section
- Explorer premium shell, grouped forms, normalized labels
- shadcn-style `Select` replacing native dropdowns in builder surfaces

## Acceptance criteria (met)

| Criterion | Status |
| --- | --- |
| Full guided path: publish → order → escrow → deliver → accept | Met |
| Barter/mixed compensation representable in offer flow | Met |
| Terms lock preview before order submit | Met |
| Structured milestone terms in guided order step | Met |
| Delivery evidence required before submit | Met |
| Submit lifecycle with retry and preserved draft | Met |
| Dispute path reachable from guided flow | Partial — operator tools, not inline guided dispute |
| Identity backup/passkey surfaced in settings | Met |
| Transactions surfaces correct next action + builder handoff | Met |

## Known gaps (deferred to Phase 2)

- **Guided dispute + settlement** in main flow (not operator-only forms)
- **Order detail** single next-action hero CTA from protocol state
- **Multi-milestone schedule** editor (Phase 1 uses first milestone)
- **Transactions deadlines** and reason labels on stalled orders
- **Role-based workspace** (buyer vs provider vs operator views)
- **Client workspace layer** (CRM notes, follow-ups — off-protocol, encrypted local)

## Verification

```bash
cd apps/web && pnpm typecheck
```

Manual smoke (signed-in, node reachable):

1. `/dashboard/builder` — walk guided steps; confirm compensation + milestone terms on order
2. `/dashboard/transactions` — confirm queue + guided builder link when action needed
3. `/dashboard/settings` — security portability callout + backup/passkey panels
4. Failed submit — confirm retry label and dismiss without losing fields

## Key files

- `apps/web/app/components/marketplace-event-builder.tsx`
- `apps/web/components/dashboard/transaction-builder-panel.tsx`
- `apps/web/components/dashboard/transactions-page.tsx`
- `apps/web/lib/dashboard/transaction-progress.ts`
- `apps/web/lib/dashboard/load-transactions.ts`
- `apps/web/components/dashboard/dashboard-settings-panel.tsx`
- `apps/web/components/dashboard/dashboard-shell.tsx`
