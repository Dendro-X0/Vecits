# Client Capabilities

Technical description of shipped behavior in the official Vectis client (`apps/web` / desktop shell). Normative UI rules: [ui-contract.md](ui-contract.md). Solo testing: [testing-without-users.md](testing-without-users.md).

Status: **shipped** (July 2026). Historical phase plans live under [../archive/frontend-phases/](../archive/frontend-phases/README.md) — not normative.

## Non-goals (client shell)

- Protocol or kernel behavior changes (`OrderAmend`, new event kinds, policy edits from UI)
- Fiat/crypto checkout or transferable credits
- Full CRM, messaging, or off-platform payment rails
- Production UX for experimental offline lanes (`physical-handoff`, `local-resource-exchange`)
- On-device mobile node sidecar (R7-M3 — spec only)
- Human arbitration or dispute override in the client

## Deal loop

Reliable freelancer↔client path: agree terms, fund milestones, deliver evidence, accept or dispute, recover identity across devices.

### Shell and navigation

- Split workspace shell (sidebar + coordination canvas) with deduplicated route headers
- Overview, Transactions, Publish & transact, and Settings workflow navigation
- Theme-aware surfaces (`apps/web/lib/ui/theme-surfaces.ts`)
- Kernel-backed overview and transactions — no showcase fallbacks

### Settings

- General vs **Advanced** settings (advanced collapsed by default; `?advanced=1` deep link)
- Security callout for identity portability (backup + passkey before device switch)
- Technical operator controls behind advanced disclosure
- Advanced settings export identity-bound encrypted workspace notes backup (off-protocol)

### Guided builder

- Five-step guided flow: offer → order → escrow → deliver → accept
- Compensation mode: `credits | barter | mixed` with barter terms/tags
- Milestone terms editor: deliverable, due window, acceptance criteria + terms hash action
- Terms lock preview on order step
- Delivery evidence summary + preflight guard
- Submission lifecycle: `draft → submitting → accepted | failed` with retry/dismiss
- Operator builder for dispute/settle and fixture drills
- Discovery draft import optional and labeled `draft ≠ live offer`

### Transactions queue

- Kernel-backed order queue with role, progress steps, and next-action copy
- Prioritization: action-needed orders first
- **Guided builder** handoff via `/dashboard/builder?step=…`
- Deadline / expiry hints on stalled orders where protocol fields exist

### Marketplace and explorer

- Marketplace landing recovery states and listings section
- Explorer premium shell, grouped forms, normalized labels

## Workspace

Daily participant surfaces on top of the deal loop — still kernel-truth labeled.

### Role-aware queues

- Primary role inferred from live orders (buyer-heavy vs provider-heavy)
- Buying / selling tabs without duplicate cards
- Overview KPIs and “needs you” counts match the filtered Transactions queue
- Dashboard context strip shows role hint

### Order detail action hub

- One protocol-correct primary CTA from `deriveTransactionProgress`
- Builder handoff with `order` (and `milestone` when needed) query prefill
- Compensation / barter summary on order header when present on linked offer

### Guided dispute and settlement

- Guided branch at `?branch=dispute` — not operator-only
- Plain-language reason codes + notes hash
- Settlement guidance with refund/reward preview after dispute
- Transactions queue shows `Dispute open` when milestone status is Disputed

### Multi-milestone exchange

- Milestone schedule editor maps to `milestones[]` in `ServiceOrder`
- Per-milestone progress on Transactions cards and order hub strip
- Downstream escrow / delivery / accept / dispute steps offer a milestone picker when `milestones.length > 1`
- Relative due-window hints when funding timestamps exist (label only, no fabricated kernel claim)

### Off-protocol workspace layer

- Encrypted local notes per order, labeled “Not on chain”
- Optional browser follow-up reminders (no settlement authority)
- Overview flushes due reminders on signed-in load
- Order hub shows a local-note chip when an encrypted record exists

### Help

- In-app help center (`/help`, articles in `lib/help/articles.ts`)
- Maintainer map: [in-app-help-sync.md](in-app-help-sync.md)

## Network surface

Cold-start and trust labeling without kernel changes. Protocol obligations: [../specs/trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md) §9.

### Trust bootstrap

- Provider eligibility panel: vouch weight vs threshold before first offer submit; admission ≠ settlement
- Sponsor request helper: copyable vouch request drafts, sponsor list progress
- Buyer credits-path checklist: claim → attest → mint → fund escrow (no raw operator JSON required)
- Honest phase label (e.g. “Founding network”) with disclaimer link
- Help: `/help/trust-bootstrap`, `/help/credits-path`

### Marketplace trust signals

- Provider eligibility on offer detail (kernel-backed)
- Lane reputation snippet when `getReputation` returns data
- Discovery disclaimer: scores are informational (kernel-truth banner pattern)
- Delivery history hint from replay-visible accepts — or “new provider”; no fabricated stats

### Lane discovery and publish guidance

- Lane catalog entry aligned with [../architecture/lane-template-catalog.md](../architecture/lane-template-catalog.md)
- Offer step shows evidence / delivery requirements for selected lane template
- Discovery import CTA on marketplace with draft disclaimer
- Experimental / strict lanes show badge before publish

### Production hardening

- `r4:client-audit` covers workspace and network surfaces
- Marketplace SOC-01 honesty banner
- Documented smoke checklist in [testing-without-users.md](testing-without-users.md)

### Convenience transport (R8)

Tier 0 QR → Tier 1 signed bundles → Tier 2 experimental handoff wizard — [../specs/r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md) · [../roadmap/r8-convenience-transport-execution-plan.md](../roadmap/r8-convenience-transport-execution-plan.md).

## Verification

```bash
cd apps/web && pnpm typecheck
npm run r4:client-audit
npm run r2:genesis-drill
npm run v1:readiness
```

Manual smoke (two local keys): [testing-without-users.md](testing-without-users.md) — full deal loop, dispute branch, multi-milestone order, workspace note, role-filtered queue, trust bootstrap without operator console.

## Key files

- `apps/web/app/components/marketplace-event-builder.tsx`
- `apps/web/components/dashboard/transaction-builder-panel.tsx`
- `apps/web/components/dashboard/transactions-page.tsx`
- `apps/web/components/dashboard/overview-page.tsx`
- `apps/web/components/dashboard/dashboard-shell.tsx`
- `apps/web/components/dashboard/dashboard-settings-panel.tsx`
- `apps/web/lib/dashboard/transaction-progress.ts`
- `apps/web/lib/dashboard/load-transactions.ts`
- `apps/web/lib/workspace/`
- `apps/web/lib/help/articles.ts`

## Open follow-ups (outside this client contract)

- Post-deployment community lane field proof (R6-PD) — [../runbooks/r6-post-deployment-proof-runbook.md](../runbooks/r6-post-deployment-proof-runbook.md)
- Mobile pinned-node field proof (R7-M2) when a second host/device is available
- On-device mobile node sidecar (R7-M3 — spec only)
- iOS scaffold (R7-M1) — deferred without macOS host

← [Client docs](README.md) · [Docs index](../index.md)
