# V0 Track 3 Remaining Spec (Phase 0 Close-Out)

This document converts the remaining Track 3 work into implementation-ready slices.

It is the execution spec for closing **late Phase 0 / early Track 3** and preparing for **Phase 1 closed alpha UX**.

## Scope and constraints

- Rust protocol/node remains source of truth.
- Write surface stays event-envelope ingestion (`POST /events`, `POST /events/batch`).
- No relay/network sync changes in this document.
- No governance/policy-authoring UX beyond existing protocol semantics.
- Web and SDK changes should remain local-first and deterministic.

## Current baseline (already implemented)

- Typed TS SDK with event create/sign/submit helpers.
- Web explorer routes for offer/order/milestone/reputation/identity/balance/policy.
- Marketplace draft-sign-submit builder for core marketplace flow.
- Flow assist features: presets, step navigation, post-submit deep links, session checklist.

## Remaining Track 3 slices

## Slice T3-R1 - Persistent Session Workspace

### Summary

Persist builder session progress and checklist state so work survives page reloads/browser restart.

### Implementation changes

- Add local storage persistence for:
  - active flow route (`acceptPath`/`disputePath`)
  - active fixture preset
  - builder mode
  - latest accepted-event checklist/session state
  - base URL and optional `createdAt` draft value
- Add hydration guard for client-only loading:
  - avoid SSR mismatch by loading persisted state in `useEffect`.
- Add explicit reset controls:
  - `Reset Builder Inputs`
  - `Reset Session + Checklist`

### File targets

- `apps/web/app/components/marketplace-event-builder.tsx`
- optional helper: `apps/web/app/components/storage.ts`

### Acceptance checks

- Reloading the page preserves flow route, current step, and checklist.
- User can reset only form values or full session state.
- Persisted state schema is versioned and safely migrates/clears on mismatch.

### Test plan

- Component tests for serialize/hydrate/reset behavior.
- Manual test: submit 2+ accepted events, reload, verify checklist and mode persist.

---

## Slice T3-R2 - Guided Action Runner (Happy Path + Dispute Path)

### Summary

Turn current builder utilities into a deterministic guided runner that enforces step prerequisites.

### Implementation changes

- Add per-step prerequisites:
  - e.g., `ServiceOrder` requires `offerId` and provider/buyer keys.
  - `SpendCredits(ServiceEscrowSink)` requires order + milestone + nonce.
- Add `Next Recommended Action` panel:
  - explains current step purpose
  - displays required fields and missing items
  - provides one-click `Autofill from previous accepted event` when possible
- Add step completion status based on accepted events (current session), not merely signed drafts.

### File targets

- `apps/web/app/components/marketplace-event-builder.tsx`

### Acceptance checks

- Runner blocks invalid next-step transitions with actionable errors.
- Accept path and dispute path can be completed end-to-end in UI without manual context hunting.
- Step recommendation updates immediately after accepted submit.

### Test plan

- Unit tests for prerequisite evaluation matrix.
- Manual end-to-end tests for:
  - offer -> order -> escrow -> delivery -> accept
  - offer -> order -> escrow -> delivery -> dispute -> settle

---

## Slice T3-R3 - Preflight + Error UX Hardening

### Summary

Add predictable preflight checks and clearer failure messaging before submit.

### Implementation changes

- Add preflight checks before signing/submitting:
  - base URL validity
  - author keypair consistency
  - mode-required field validation
  - RFC3339 check for `createdAt` when provided
- Add optional `Node Reachability Check` button:
  - performs a safe read call (e.g., replay/state endpoint) and reports status.
- Add structured error rendering:
  - preserve API `code`, `message`, `status` separately
  - keep raw payload view toggle for diagnostics

### File targets

- `apps/web/app/components/marketplace-event-builder.tsx`
- optional utility reuse from explorer validation helpers

### Acceptance checks

- User sees field-specific errors before network call when input is invalid.
- Reachability failure is distinct from reducer rejection.
- API rejection reason code remains visible and copyable.

### Test plan

- Unit tests for field validators and error shaping.
- Manual tests for offline node, malformed keys, and invalid timestamp.

---

## Slice T3-R4 - Broader Action Builders (Contribution/Credits)

### Summary

Expand beyond marketplace actions with practical builders for contribution and credits lifecycle.

### Implementation changes

- Add a dedicated builder panel for:
  - `ContributionClaim`
  - `ContributionAttest`
  - `MintCredits`
  - `SpendCredits` (non-escrow sinks: compute/AI/storage/bounty)
- Keep flow-assist behavior:
  - references autofill from last signed/accepted event
  - fixture preset support where available
- Reuse existing local signing and submit path.

### File targets

- `apps/web/app/components/contribution-credit-builder.tsx` (new)
- `apps/web/app/page.tsx` (mount panel)
- `packages/sdk-ts` types/helpers only if needed for stricter payload typings

### Acceptance checks

- User can produce a valid claim->attest->mint sequence from web UI.
- User can submit non-escrow spend events for allowed sink kinds.
- Rejections for unsupported/invalid sink kinds are clear.

### Test plan

- Unit tests for payload formation/parsing helpers.
- Manual tests using existing valid/invalid fixture behavior against local node.

---

## Slice T3-R5 - Client Discovery Rules (Phase 1 Preparation)

### Summary

Implement client-side discovery and ranking hints using deterministic read APIs.

### Implementation changes

- Add `Discovery` page for provider/service exploration:
  - lane filter (`serviceType`)
  - optional reputation threshold filter
  - sorting by deterministic score (documented formula in client)
- Data fetch strategy:
  - list relevant marketplace events via `GET /events`
  - resolve current offer/order state and reputation via existing state endpoints
- Add clear "informational only" flags:
  - discovery score does not affect protocol validity.

### File targets

- `apps/web/app/explorer/discovery/page.tsx` (new)
- `apps/web/app/explorer/page.tsx` (link)
- `apps/web/app/explorer/lib.ts` (query params/helpers)

### Acceptance checks

- User can discover active offers by lane and inspect provider reputation context.
- Sort/filter output is deterministic for identical query inputs.
- Discovery logic is documented and testable.

### Test plan

- Contract tests for query params and sorting behavior.
- Manual tests on fixture datasets and mixed event timelines.

---

## Slice T3-R6 - Invite-Only Onboarding UX (Phase 1 Bridge)

### Summary

Provide a client workflow for invite-only onboarding aligned with web-of-trust direction.

### Implementation changes

- Add onboarding wizard:
  - create identity event
  - capture sponsor pubkeys
  - prepare/share vouch request payloads (copy links/messages)
- Add onboarding status read model (client-computed from events):
  - identity exists
  - incoming vouches count
  - threshold status (informational, policy-linked)
- No privileged admin path; all outputs are event-driven and self-serve.

### File targets

- `apps/web/app/components/onboarding-wizard.tsx` (new)
- `apps/web/app/page.tsx` (mount panel)

### Acceptance checks

- New user can complete identity creation and generate sponsor request payloads.
- User can inspect onboarding progress from node data only.
- No centralized approval control is introduced.

### Test plan

- Manual onboarding flow tests with multiple local keys/users.
- Regression tests for missing/duplicate vouch scenarios (UI logic).

---

## Delivery order and gates

Recommended implementation order:

1. **T3-R1** Persistent session workspace
2. **T3-R2** Guided action runner
3. **T3-R3** Preflight + error hardening
4. **T3-R4** Contribution/credits builders
5. **T3-R5** Discovery rules
6. **T3-R6** Invite-only onboarding UX

Track 3 is considered implementation-complete for Phase 0 close-out when:

- T3-R1 through T3-R4 are complete and validated.
- At least one of T3-R5 or T3-R6 is complete with docs + tests.
- Web docs and roadmap status are updated to reflect shipped slices.

## Out of scope for these slices

- Relay networking/sync logic (Track 4).
- New protocol event kinds.
- Marketplace reducer semantics changes.
- Policy governance UX beyond current `PolicyUpdate` execution semantics.
