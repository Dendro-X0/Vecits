# R4 Client / Kernel Audit

Purpose: verify the TypeScript client shell stays thin, replaceable, and truth-aligned with the Rust kernel.

Last updated: July 2026

## Slices

| ID | Deliverable | Status |
| --- | --- | --- |
| `R4-C1` | SDK stability policy | `packages/sdk-ts/STABILITY.md` |
| `R4-C2` | Settlement logic audit | this checklist + `npm run r4:client-audit` |
| `R4-C3` | Authoritative-state labeling | `KernelTruthNotice` in web shell (AB-15) |
| `R4-C4` | Off-protocol payment warning | onboarding + `docs/runbooks/operator-security-guide.md` (SOC-01-doc) |
| `R4-C5` | UI simplification | deferred (marketplace UX later) |

## C2 — No settlement logic in web app

The web shell **must not**:

- compute credit balances, escrow totals, or milestone settlement locally
- mint or burn credits without signed events ingested by the kernel
- show milestone/order "closed" status from browser-only state without kernel confirmation

The web shell **may**:

- sign event drafts and POST to `/events`
- display kernel JSON from `/state/*` and `/events`
- track **session** progress after `ingestResult.accepted === true` (labeled non-authoritative)

### Manual checklist

| # | Check | Pass criteria |
| --- | --- | --- |
| 1 | No local balance math | `apps/web` has no `effective_balance` / escrow aggregation logic |
| 2 | Ingest-gated session state | `sessionAcceptedEvents` only updated when kernel returns `accepted: true` |
| 3 | Explorer reads kernel | explorer pages fetch via `NodeClient`, not fixture replay in browser |
| 4 | Discovery labeled | discovery views show informational ranking disclaimer |
| 5 | SDK thin | `@new-start/sdk-ts` has no settlement helpers (see STABILITY.md non-goals) |

### Automated check

```bash
npm run r4:client-audit
```

## C3 — AB-15 client truth alignment

UI surfaces that show progress or rankings must distinguish:

- **Authoritative:** kernel API response (`/state/replay`, `/state/order`, ingest result)
- **Informational:** discovery scores, session checklist, form drafts

Component: `apps/web/app/components/kernel-truth-notice.tsx`

## C4 — SOC-01 off-platform payment

Operators and counterparties must see that PayPal/crypto/bank transfer promises are **outside** kernel enforcement. Credits are non-transferable protocol units.

Locations:

- `OnboardingWizard` — `OffProtocolPaymentWarning`
- `docs/runbooks/operator-security-guide.md` — SOC-01 section

## Verification

```bash
npm run r4:client-audit
npm run v1:readiness
cargo test -p node --test api
```

## Sign-off

| Role | Date | Notes |
| --- | --- | --- |
| Maintainer | July 2026 | R4-C1..C4 complete; C5 deferred |
