# Client UI Contract

Normative UI rules for the official Vectis web/desktop client (`apps/web`). Capability overview: [client-capabilities.md](client-capabilities.md). Maintainer sync for `/help`: [in-app-help-sync.md](in-app-help-sync.md).

## Dashboard shell and overview

Goal: production-grade dashboard — no showcase/demo behavior; non-technical users get an obvious next step.

### Scope

- `apps/web/components/dashboard/dashboard-shell.tsx`
- `apps/web/components/dashboard/overview-page.tsx`
- `apps/web/lib/dashboard/load-live-overview.ts`

### Rules

- No showcase/demo fallback in the dashboard.
- If the user is signed out, show an onboarding-oriented empty state.
- If the node cannot be reached, show a recovery-oriented empty state with a settings action.
- If the user is signed in but has no marketplace activity yet, show a real empty state with primary actions.
- Use one surface system across sidebar, top bar, and main content.
- Sidebar should read as workflow navigation, not a loose feature list.

### Dashboard shell

- Sidebar groups:
  - `Workspace`: Overview, Transactions
  - `Act`: Publish & transact
  - `Operate`: Settings
- Header keeps route title, short route description, and auth/theme controls.
- Mobile nav remains compact but mirrors the same route order.
- Layout targets a split workspace: stable left rail + right coordination canvas.
- Right canvas follows a consistent sequence:
  - context strip
  - KPI row
  - main chart/activity row
  - action rail

### Overview page

- Top area:
  - title and one-line explanation
  - status badge showing `Signed out`, `Live`, `No activity yet`, or `Connection issue`
- Signed-out state:
  - icon + title + short explanation
  - primary action: sign in
  - secondary action: browse marketplace
- Connection issue state:
  - icon + title + short explanation
  - primary action: open settings
  - secondary action: browse marketplace
- Empty activity state:
  - icon + title + short explanation
  - primary action: browse marketplace
  - secondary action: open offer builder
- Live state:
  - four KPI cards with kernel-backed values only
  - context strip showing node/as_of metadata
  - lane distribution card
  - recent activity card
  - bottom action rail for marketplace and builder
- Non-live states:
  - should avoid a large empty void by pairing empty/recovery cards with a lightweight workspace scaffold card.

### Data contract

- `load-live-overview.ts` returns a discriminated state:
  - `live`
  - `empty`
  - `error`
- It must never return showcase/mock stats.

## Landing / marketplace

- `apps/web/components/marketplace/marketplace-hero.tsx`
- `apps/web/components/marketplace/marketplace-status-panel.tsx`
- `apps/web/components/marketplace/marketplace-listings-section.tsx`
- `apps/web/app/marketplace/page.tsx`

Rules:

- Connection failures show a recovery panel with settings action — not raw `fetch failed`.
- Empty node state shows publish/sign-in actions — not showcase fallback.
- Hero leads with clear CTAs: browse, mutual aid, identity workspace.

## Settings

- `apps/web/components/dashboard/settings-primitives.tsx`
- `apps/web/components/dashboard/dashboard-settings-panel.tsx`
- `apps/web/components/dashboard/settings-advanced-disclosure.tsx`
- `apps/web/components/dashboard/dashboard-settings-technical-panel.tsx`

Rules:

- Two modes on one page: **General** (default) and **Advanced** (collapsed).
- General sidebar: Profile, Connection, Security — everyday fields only.
- Advanced disclosure is hidden by default; `?advanced=1` opens it for deep links.
- Technical items live in advanced only: mobile node override, operator drills, evidence export, legacy console, desktop vault removal.
- `/dashboard/settings/advanced` redirects to `/dashboard/settings?advanced=1`.
- No separate Advanced nav item in the dashboard shell.

## Publish & transact

- `apps/web/components/dashboard/transaction-builder-panel.tsx`
- `apps/web/app/dashboard/builder/page.tsx`
- `apps/web/app/components/marketplace-event-builder.tsx` (`variant="transaction"`)

Rules:

- Default dashboard builder is a guided five-step flow: publish offer → place order → fund escrow → deliver → accept.
- Operator chrome (fixture presets, lane starters, dispute path, session checklist, raw JSON dumps) stays behind "Operator builder".
- Discovery draft import is optional and collapsed by default.
- Successful submits show a plain-language confirmation and advance to the next step.
- Full event builder remains available in operator mode and in Advanced settings.

## Transactions

- `apps/web/lib/dashboard/load-transactions.ts`
- `apps/web/lib/dashboard/transaction-progress.ts`
- `apps/web/components/dashboard/transactions-page.tsx`
- `apps/web/app/dashboard/transactions/page.tsx`

Rules:

- Kernel-backed only — no mock orders.
- Signed-out, empty, connection-error, and live states mirror overview patterns.
- Each order card shows role (buying/selling), four-step progress, and plain-language next action.
- Primary CTA opens `/marketplace/orders/[id]` where exchange actions live.
- Orders needing viewer action sort to the top.
- Live layout should mirror the same right-canvas sequence as overview:
  - context strip (node + as_of)
  - compact transaction KPIs
  - queue health/status strip
  - prioritized order cards
- When the viewer needs to act, show a secondary **Guided builder** CTA linking to `/dashboard/builder?step=…`.

## Deal loop acceptance

Reliable freelancer↔client loop with clear non-cash compensation, terms lock, delivery evidence, and submission lifecycle clarity.

Acceptance checks:

- **Compensation clarity**: offer step exposes `credits | barter | mixed` with conditional barter terms/tags and validation before submit.
- **Terms lock**: order step shows a terms lock preview (offer id, compensation mode, terms hash, barter fields, milestone terms).
- **Milestone terms**: order step captures deliverable, due window, and acceptance criteria; optional hash action writes `termsHash`.
- **Delivery evidence**: delivery step shows evidence summary and blocks submit until at least one proof item exists.
- **Submission lifecycle**: guided flow shows `draft → submitting → accepted | failed` with preserved draft on failure and explicit retry/dismiss copy.
- **Dispute entry**: accept step links to dispute tools; guided `?branch=dispute` is available without operator-only forms.
- **Identity portability**: settings security section leads with backup/passkey guidance before advanced technical controls.
- **Transactions handoff**: live order cards deep-link to the matching guided builder step when the viewer needs to act.

## Android NFC write (R9-N2)

Goal: write Tier 1 JSON to NFC from share panels; QR always remains fallback (R9-G2).

### Scope

- `TransportNfcWriter` on `TransportBundleSharePanel`
- Capability `nfc:allow-write`
- Help iOS honesty (QR/paste primary)

### Rules

- Write MIME `application/vnd.vectis.transport.v1+json` only.
- Never encode secrets.
- Design: [../specs/r9-n2-android-nfc-write-design.md](../specs/r9-n2-android-nfc-write-design.md)

## Android NFC read (R9-N1)

Goal: NDEF tag → same import review as paste/QR (R9-G1).

### Scope

- `apps/web/lib/transport/nfc-payload.ts` — NDEF decode
- `apps/web/components/transport/transport-nfc-scanner.tsx` — Scan NFC tab
- `apps/desktop` — `tauri-plugin-nfc` + capability + NFC permission

### Rules

- MIME `application/vnd.vectis.transport.v1+json` preferred; Text JSON accepted.
- Mandatory copy: tapping does not publish / confirm node URL.
- Design: [../specs/r9-n1-android-nfc-read-design.md](../specs/r9-n1-android-nfc-read-design.md)

## Halo join UX (R9-H1)

Goal: pin a LAN operator node with hostname confirm and honest local-node labels (R9-G3).

### Scope

- `apps/web/lib/halo/local-operator-node.ts` — private/LAN host classification
- `apps/web/components/transport/node-join-confirm.tsx` — confirm before pin
- Import + Settings connection + marketplace trust bar
- Help: `node-connection` LAN section

### Rules

- Never save a pin without showing hostname/IP.
- Private LAN pins show “Local operator node — not yet reconciled with upstream”.
- No new transport bundle type; join QR remains absolute node URL.
- Design: [../specs/r9-h1-halo-join-ux-design.md](../specs/r9-h1-halo-join-ux-design.md)

## In-app user help

- Routes: `/help`, `/help/deal-flow`, `/help/disputes`, `/help/identity`, `/help/node-connection`, `/help/trust-bootstrap`, `/help/credits-path`, `/help/staged-exchanges`
- Content source: `apps/web/lib/help/articles.ts`
- Linked from site header, footer, dashboard sidebar
- Maintainer sync: [in-app-help-sync.md](in-app-help-sync.md)
