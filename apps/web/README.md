# Web Shell

Track 3 Next.js shell that:

- reads replay state from the local node
- generates Ed25519 keypairs in-browser
- signs an `IdentityCreate` event locally
- submits signed events to `POST /events`
- provides a marketplace draft builder for `ServiceOffer`, `ServiceOrder`, `SpendCredits` (escrow), `ServiceDelivery`, `ServiceAccept`, `ServiceDispute`, and `ServiceSettle` (draft -> sign -> submit)
- includes marketplace flow-assist autofill from the last signed event to chain references/IDs across order -> escrow -> delivery -> accept/dispute -> settle
- includes fixture preset autofill for marketplace IDs/timestamps/nonces (accept-flow and timeout-flow baselines)
- includes one-click flow progression controls (accept/dispute lanes with start/prev/next step navigation)
- includes post-submit explorer deep links that carry `base_url`/`as_of` into offer/order/milestone views
- includes a session event-chain checklist with copy + clear actions for accept/dispute flow progress tracking
- persists builder workspace state (`flow`, `mode`, `preset`, `base_url`, `createdAt`, checklist events) with reset controls for inputs vs. full session
- includes a guided "Next Recommended Action" runner with required-field status and missing-count visibility
- blocks forward flow-step transitions when current step is not accepted or next-step prerequisites are missing
- supports one-click autofill from previous **accepted** events where applicable
- adds submit preflight checks (base URL validity, RFC3339 `createdAt`, required fields per mode, keypair consistency)
- includes a one-click node reachability probe (`GET /state/replay`) before submit
- renders structured submit errors with separate `status`/`code`/`message` plus raw payload toggle
- includes a dedicated contribution/credits builder for `ContributionClaim`, `ContributionAttest`, `MintCredits`, and non-escrow `SpendCredits` sink modes
- supports claim->attest->mint and mint->spend autofill from last signed/accepted events in the contribution/credits panel
- includes an invite onboarding wizard that creates `IdentityCreate`, captures sponsor pubkeys, generates copyable `Vouch` request drafts/messages, and computes onboarding status from node events
- persists onboarding wizard workspace inputs in browser storage with explicit reset controls
- blocks sponsor-request copy actions when identity reference is missing, removes self-sponsor entries, and validates vouch `createdAt` templates
- only uses identity event references from accepted/already-present ingest results (or refreshed node status), preventing draft references from failed submissions
- includes service lane templates for marketplace offers, with strict preflight constraint enforcement for offline lanes (`local-resource-exchange`, `physical-handoff`)
- syncs order autofill from accepted/signed offers to reuse serviceType, deliveryMode, and allowed evidence formats
- includes dedicated read-only explorer routes with shareable URL query params:
  - `/explorer/offers`
  - `/explorer/orders`
  - `/explorer/milestones`
  - `/explorer/reputation`
  - `/explorer/discovery`
  - `/explorer/identity`
  - `/explorer/balance`
  - `/explorer/policy`
- keeps discovery explorer defaults policy-aligned for alpha lanes (`alpha_defaults=1` by default, overridable)
- discovery explorer now reads deterministic ranked output from `GET /state/discovery`
- includes a home-page fixture quickstart panel with copyable local node/ingest commands and preset explorer links
  - quickstart now supports PowerShell/Bash command variants and `Copy All Commands`

## Run

1. Start node:
   - `cargo run --bin cli -- node serve --data-dir <path> --bind 127.0.0.1:7878`
2. Install workspace deps:
   - `npm install`
3. Start web app:
   - `npm run -w @new-start/web dev`

Optional:

- set `NODE_API_BASE_URL` if your node is not on `http://127.0.0.1:7878`
- set `NEXT_PUBLIC_NODE_API_BASE_URL` to prefill the submit form target in browser

## Explorer query params

All explorer routes accept optional `base_url` and `as_of` query params.
Each route also includes a `Copy Share URL` button and `Pretty/Compact` JSON toggles for responses.
Explorer pages now include a shared defaults bar that:

- persists `base_url` + `as_of` in browser storage
- applies stored defaults back into URL query params
- provides one-click navigation links that carry the same context across routes
- validates `as_of` and `base_url` formats before applying/saving defaults
- highlights invalid query fields inline with friendly per-field error hints
- provides one-click fixture preset links to autofill common IDs for local testing

Examples:

- `/explorer/offers?id=offer-1&as_of=2026-03-01T00:00:00Z`
- `/explorer/orders?id=order-1`
- `/explorer/milestones?order_id=order-1&milestone_id=m1`
- `/explorer/reputation?id=<pubkey>&lane=software-fixes&limit=20`
- `/explorer/discovery?service_type=software-fixes&min_score=0&alpha_defaults=1&limit=50`
- `/explorer/identity?id=<pubkey>`
- `/explorer/balance?id=<pubkey>&as_of=2026-03-01T00:00:00Z`
- `/explorer/policy?as_of=2026-03-02T12:00:00Z&limit=20`
