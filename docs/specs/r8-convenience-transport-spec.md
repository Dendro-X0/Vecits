# R8 — Convenience transport spec (QR, deep links, offline-friendly handoff)

Purpose: define how the official client moves **coordination intents** between people and devices without weakening kernel authority — especially when no willing counterparty exists yet for full social E2E proof.

Status: `locked` (R8-A..D shipped July 2026)

Last updated: July 2026

Related: [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md), [mobile-sidecar-policy-spec.md](mobile-sidecar-policy-spec.md), [../runbooks/offline-lane-experimental-runbook.md](../runbooks/offline-lane-experimental-runbook.md), [../client/testing-without-users.md](../client/testing-without-users.md).

Execution plan: [../roadmap/r8-convenience-transport-execution-plan.md](../roadmap/r8-convenience-transport-execution-plan.md)

## 1) Problem statement

Vectis protocol correctness is proven through fixtures and drills. **Social cold-start** is not:

- Founding operators often lack a second human willing to trust the app on short notice.
- R6-PD-C (human counterparty field proof) and subjective UX feedback remain blocked by recruitment, not by kernel gaps.
- In-person and offline-adjacent coordination (mutual aid, physical handoff, meetup onboarding) needs **low-friction transport** — typing URLs and pubkeys at a table is error-prone.

**Non-goal:** QR or NFC as a shortcut around signed events, vouches, or escrow procedure.

## 2) Design principle

```text
QR / deep link / NFC = transport layer
vectis-node replay       = authority layer
Client signing vault     = intent layer
```

| Layer | Question | QR may… | QR must not… |
| --- | --- | --- | --- |
| Transport | How do we open the right screen? | Encode URLs and signed bundles | Imply settlement completed |
| Intent | What does the user want to do? | Prefill drafts; carry vouch requests | Auto-submit high-value events |
| Authority | What is true on chain? | Deep-link to explorer/builder for verification | Override kernel `as_of` reads |

**Locked rule:** Scanning never funds escrow, publishes offers, or grants provider admission without an explicit user review step and a signature from the local vault.

## 3) Tier model

Work proceeds in three tiers — each tier is independently shippable.

```text
Tier 0 — unsigned deep links (URLs only)
    ↓
Tier 1 — signed bundles (short-lived intents)
    ↓
Tier 2 — offline lane UX (physical-handoff + deferred submit)
```

### Tier 0 — Deep-link transport (unsigned)

**Scope:** Encode existing hrefs as QR or copyable links. No new protocol types.

| Surface | Payload | Opens |
| --- | --- | --- |
| Node join | `https://<host>` or settings deep link | Connection settings with confirm step |
| Builder resume | `/dashboard/builder?step=<step>&order=<id>&milestone=<id>` | Guided builder at step |
| Dispute branch | `/dashboard/builder?branch=dispute&step=dispute&order=<id>` | Dispute flow |
| Discovery import | `/dashboard/builder?step=offer&import=discovery` | Draft import panel (**Draft ≠ live offer**) |
| Offer browse | `/marketplace/offers/<offerId>` | Offer detail (read-first) |
| Explorer cross-check | `/explorer/orders/<orderId>` | Kernel truth view |

**Security:**

- Order/offer ids alone do not authorize writes — signing still required.
- Node URL QR must show hostname + optional fingerprint before save (see RES-* in [security-resilience-spec.md](security-resilience-spec.md)).
- All Tier 0 surfaces reuse existing SOC-01 and kernel-truth labels.

**Acceptance:** User scans QR on phone → lands on correct route → sees review/confirm UI before any signed submit.

### Tier 1 — Signed bundles (short-lived intents)

**Scope:** Compact JSON payloads (optionally signed) for in-person bootstrap. Transport via QR, copy button, or file share.

#### Bundle envelope (all Tier 1 types)

```json
{
  "v": 1,
  "kind": "vectis.transport.v1",
  "type": "<bundle-type>",
  "createdAt": "2026-07-10T12:00:00Z",
  "expiresAt": "2026-07-10T13:00:00Z",
  "nodeUrl": "https://node.example",
  "payload": {}
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `v` | yes | Transport schema version (`1`) |
| `kind` | yes | Constant `vectis.transport.v1` |
| `type` | yes | See bundle types below |
| `createdAt` / `expiresAt` | yes | ISO 8601; default max TTL **24h** for vouch/intro; **1h** for handoff staging |
| `nodeUrl` | yes | Pinned operator node; HTTPS in release builds |
| `payload` | yes | Type-specific body |

Optional: `signature` (Ed25519 over canonical JSON bytes) when issuer identity matters (vouch request from known sponsor).

#### Bundle types (v1 band)

| `type` | Purpose | Signed by | Client action after scan |
| --- | --- | --- | --- |
| `identity.intro` | Share pubkey + display label | optional | Show intro card; copy pubkey; link to vouch helper |
| `vouch.request` | Ask sponsor to vouch | optional (subject) | Open trust bootstrap with subject prefilled |
| `offer.draft` | Prefill offer builder fields | no (unsigned draft) | Open offer step with fields; user signs `ServiceOffer` |
| `order.resume` | Resume in-progress order | no | Open builder at step; show counterparty pubkey |

**UI copy (mandatory on every Tier 1 scan result):**

- **“Scanning does not publish offers or move credits.”**
- **“Confirm node URL before connecting.”**
- Expired bundles show **“Link expired — ask sender to regenerate.”**

**Non-goals for Tier 1:**

- Encoding private keys or recovery material
- Pre-signed `ServiceOffer` / `SpendCredits` that auto-submit without review
- Cross-node bundle replay without node URL confirmation

### Tier 2 — Offline-friendly lane UX

**Scope:** Client UX for experimental offline lanes already fixture-proven in kernel:

- `physical-handoff` — `physical-handoff-ack-dual-v1` (two artifact hashes)
- `local-resource-exchange` — `local-resource-receipt-v1`

See [../runbooks/offline-lane-experimental-runbook.md](../runbooks/offline-lane-experimental-runbook.md). Tier 2 does **not** promote these lanes to deployment gates.

#### Physical handoff flow (target UX)

```text
1. Order exists on node (escrow funded online when possible)
2. At meetup — Party A generates delivery ack draft → QR (Tier 1 staging or local-only hash)
3. Party B scans → reviews artifact hash / photo hash → signs ack in local vault
4. Either party submits when online → kernel validates evidence format + lane template
5. Buyer accept closes order per SCN-18 procedure
```

#### Deferred event queue (optional R8-D slice)

When connectivity is intermittent:

1. User signs event locally (standard SDK path).
2. Client exports **signed event blob** as QR chunk or file (not a new event kind).
3. Counterparty or same user on second device scans → queues for `POST /events` when node reachable.
4. Kernel rejects duplicates/nonces as today — transport does not weaken replay guards.

**Security balance:**

| Convenient | Required safeguard |
| --- | --- |
| One scan opens order | Show order id, parties, milestone amount |
| Pre-filled ack fields | User confirms hash on screen before sign |
| “Submit when online” | Explicit queue status; kernel-truth label after ingest |

## 4) Platform mapping

| Platform | Tier 0 | Tier 1 | Tier 2 |
| --- | --- | --- | --- |
| Web (desktop) | Show QR (display) | Import via paste or upload | Handoff wizard (two-browser solo test) |
| Web (mobile browser) | Scan via `BarcodeDetector` or manual paste | Same | Camera for ack photo → hash |
| Tauri desktop (R7) | Native share sheet + QR display | File drop + clipboard | Sidecar unchanged |
| Tauri mobile (R7-M2) | Scanner + pinned node confirm | Primary target for meetup flows | Deferred submit queue |

Default mobile mode remains **remote pinned node** ([mobile-sidecar-policy-spec.md](mobile-sidecar-policy-spec.md)). On-device sidecar (R7-M3) is not required for R8.

## 5) Solo verification (no volunteer)

R8 must not **require** a second human for maintainer proof.

| Tier | Solo method |
| --- | --- |
| 0 | Generate QR on desktop → scan with phone browser → confirm route |
| 1 | Two browsers or two devices; same operator keys acceptable for smoke |
| 2 | Two-browser physical-handoff wizard against fixture-seeded order; `npm run r6:offline-lanes:smoke` regression |

Document honest evidence labels: **“maintainer smoke”** vs **“field proof”** (same distinction as R6-PD-C).

## 6) Low-trust counterparty playbook

When one skeptical person appears, optimize for **minimal trust ask**:

1. **Identity intro QR** — “See my pubkey; no account required.”
2. **Vouch request** — sponsor signs in their own vault; subject does not hand over keys.
3. **Offer draft** — “Review draft in builder; you sign the offer yourself.”
4. **Small reference lane exchange** — `software-fixes` or mutual-aid lane; not offline experimental lanes first.

Full checklist: [../client/testing-without-users.md](../client/testing-without-users.md) §15.

## 7) Explicit non-goals

- QR-as-payment (fiat or credits purchase)
- QR that displays “Paid” or “Complete” without kernel `as_of` confirmation
- Replacing sponsor vouches with QR trust
- Federation-scale discovery over QR mesh
- Production promotion of offline lanes without community governance

## 8) Acceptance gates (R8 exit)

| Gate | Criterion |
| --- | --- |
| **R8-G0** | This spec + execution plan indexed in roadmap |
| **R8-G1** | Tier 0 QR/display on ≥3 surfaces (vouch helper, builder handoff, discovery import) |
| **R8-G2** | Tier 1 bundle parse + expiry + mandatory warning copy |
| **R8-G3** | Mobile scan path on R7-M2 shell (pinned node confirm) |
| **R8-G4** | Tier 2 physical-handoff wizard smoke (two-key solo) + `r6:offline-lanes:smoke` pass |
| **R8-G5** | `r4:client-audit` extended for transport surfaces + `r8:transport:smoke` |

**R8 sign-off** = `R8-G0`..`R8-G5` (July 2026). Tier 2 (`R8-G4`) remains experimental for offline lanes.

## 9) Verification commands (standing)

```bash
pnpm typecheck
npm run r4:client-audit
npm run r6:offline-lanes:smoke    # Tier 2 regression
npm run r7:mobile:readiness       # mobile scan host
npm run r8:transport:smoke        # Tier 0–2 transport smoke
```

## 10) Related docs

- [../roadmap/r8-convenience-transport-execution-plan.md](../roadmap/r8-convenience-transport-execution-plan.md)
- [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md)
- [r6-post-deployment-proof-spec.md](r6-post-deployment-proof-spec.md)
- [../architecture/lane-template-catalog.md](../architecture/lane-template-catalog.md)
- [../client/client-capabilities.md](../client/client-capabilities.md)
