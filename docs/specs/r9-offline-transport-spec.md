# R9 — Offline transport (NFC + LAN halo)

Purpose: extend R8 convenience transport with **NFC as an alternate carrier** for Tier 1 bundles, and **LAN operator-node halos** that reuse existing pull-only peer sync — without new settlement semantics or mesh consensus.

Status: `locked` (R9-A — July 2026)

Kickoff: July 2026

Last updated: July 2026

Related: [r8-convenience-transport-spec.md](r8-convenience-transport-spec.md), [mobile-sidecar-policy-spec.md](mobile-sidecar-policy-spec.md), [../v0/v0-track4-sync-spec.md](../v0/v0-track4-sync-spec.md), [../runbooks/offline-lane-experimental-runbook.md](../runbooks/offline-lane-experimental-runbook.md).

Execution plan: [../roadmap/r9-offline-transport-execution-plan.md](../roadmap/r9-offline-transport-execution-plan.md)

## 1) Problem statement

R8 shipped QR / deep-link / paste transport and experimental offline-lane UX. Remaining friction for in-person and market-floor use:

- Aligning cameras for QR is slower and less reliable than tap in crowded spaces.
- A temporary physical market (park, fair, mutual-aid meetup) needs a **local authority node** even when the wider internet is down — then reconcile later.

R9 addresses **transport and local topology** only. It does not invent offline settlement across partitions.

## 2) Design principle (locked)

```text
NFC / LAN / Wi-Fi halo  =  transport + topology
Client vault            =  intent (human signs)
vectis-node replay      =  authority
```

| Layer | May… | Must not… |
| --- | --- | --- |
| NFC | Carry the same Tier 1 envelopes as QR | Auto-submit offers, vouch, or escrow |
| LAN halo | Pin clients to a local `vectis-node`; pull sync via peers | Claim global finality while partitioned |
| Mesh gossip (phones) | — | **Out of R9** — deferred research |

**Inherited from R8:** scanning / tapping never funds escrow, publishes offers, or grants admission without explicit review + local vault signature.

## 3) Track split

```text
R9-N  NFC carrier for Tier 1 bundles
R9-H  LAN halo (pinned local node + pull reconcile)
R9-X  Explicit non-goals (mesh gossip, partition settlement)
```

Each of N and H is shippable alone.

---

## 4) R9-N — NFC carrier

### 4.1 Decision

| Choice | Decision |
| --- | --- |
| Payload | **Identical** to R8 Tier 1 `vectis.transport.v1` JSON |
| Encoding | NDEF text or MIME (`application/vnd.vectis.transport.v1+json`) — pick one in spike; document chosen form |
| Platforms | **Android first** (read + write). iOS: prefer **read** where allowed; always keep QR/paste fallback |
| UX | Tap → same import review screen as QR scan |
| Size | Bundles must stay compact (ids, pubkeys, short intents). Full signed event logs are not NFC payloads |

### 4.2 Bundle types (reuse)

All R8 Tier 1 types remain valid over NFC:

- `identity.intro`
- `vouch.request`
- `offer.draft`
- `order.resume`

Optional later (still no new kernel kinds): staging hashes for `physical-handoff` dual-ack — same review rules as R8-D.

### 4.3 Mandatory UI copy (on every NFC import)

- “Tapping does not publish offers or move credits.”
- “Confirm node URL before connecting.”
- Expired → “Link expired — ask sender to regenerate.”

### 4.4 Security

- Never encode secret keys or recovery material.
- Reject payloads that fail R8 envelope validation (version, kind, expiry, nodeUrl).
- If NFC write fails or OS denies, fall back to QR without changing semantics.

### 4.5 Solo verification

| Check | Method |
| --- | --- |
| Round-trip | Device A writes vouch.request → Device B reads → import UI shows subject + expiry |
| Parity | Same JSON accepted via paste/QR and NFC |
| Maintainer smoke | Android emulator/device + `r8:transport:smoke` regression unchanged |

---

## 5) R9-H — LAN halo (operator node on local network)

### 5.1 Decision

| Choice | Decision |
| --- | --- |
| Topology | **Mode A — designated local node** (laptop / Pi / phone hotspot host running `vectis-node`) |
| Client join | Pin absolute node URL (HTTP LAN allowed for **dev/demo**; release mobile policy may still prefer HTTPS — document exception for halo demos) |
| Sync | Existing Track 4 **pull-only** `peers.json` + `GET /events` cursor pull |
| Settlement story | Events accepted by the **halo node** are authoritative **for that operator store**. Global/upstream reconcile is eventual and must be labeled |
| Discovery | v1: QR/NFC of node URL (+ optional fingerprint). mDNS optional later |

**Mode B (phone mesh gossip) is R9-X — deferred.**

### 5.2 Join flow (target UX)

```text
1. Operator starts vectis-node bound to LAN (e.g. 192.168.x.x:7878)
2. Operator shows join QR/NFC: nodeUrl + optional display name / fingerprint
3. Client confirms pin (hostname/IP visible) → marketplace/dashboard use that node
4. Parties sign and POST /events to the halo node as today
5. When uplink returns: halo node (or upstream) runs peer pull — normal ingest rejects duplicates
```

### 5.3 Honest labels (required)

| State | Client label |
| --- | --- |
| Pinned to LAN node, no uplink | “Local operator node — not yet reconciled with upstream” |
| Event accepted by halo | “Accepted by local node” (not “globally settled”) |
| After successful peer pull | “Synced with peer \<id\> through cursor …” |

Never show “Paid / Complete / Final” without kernel `as_of` read against the node the user is pinned to.

### 5.4 Security / ops

| Risk | Mitigation |
| --- | --- |
| Fake halo on open Wi-Fi | Explicit pin confirm; optional fingerprint/hash of TLS cert or operator pubkey in join bundle |
| Cleartext HTTP on LAN | Allowed for maintainer halo drills; release builds document risk; prefer HTTPS when feasible |
| Partition confusion | One designated halo per market; clients pin one URL; do not dual-write to two nodes in R9 |
| Stale peers | Cursor pull + existing reject paths; operator runbook for `peers.json` |

### 5.5 Solo verification

```text
Node A (halo) ← clients pin A
Node B (upstream) configured as peer of A (or A peers B)
Post events on A → pull on B → assert events present / order state matches
```

No second human required. Travel router optional; localhost multi-bind or two loopback ports suffice for CI smoke.

### 5.6 Non-goals for R9-H

- Automatic credit mint while offline from upstream policy
- Cross-partition escrow that “merges” conflicting spends
- Replacing operator trust with mesh reputation

---

## 6) Explicit non-goals (R9-X)

- Phone-to-phone mesh gossip as authority
- NFC-as-payment or “tap = paid”
- Production promotion of `physical-handoff` / `local-resource-exchange` lanes
- Federation-scale discovery over local radio
- Changing Track 4 from pull-only to push gossip in this band

---

## 7) Acceptance gates (R9 exit)

| Gate | Criterion |
| --- | --- |
| **R9-G0** | This spec + execution plan indexed in docs/roadmap — **pass** (July 2026) |
| **R9-G1** | NFC read path accepts R8 Tier 1 envelope (Android maintainer path) — **pass** (July 2026, `pnpm r9:nfc:read-unit` + import Scan NFC) |
| **R9-G2** | NFC write path for at least `vouch.request` + QR fallback — **pass** (July 2026, `pnpm r9:nfc:write-unit` + share-panel writer) |
| **R9-G3** | Halo join: pin LAN node URL via QR/NFC; client shows local-node label — **pass** (July 2026, `pnpm r9:halo:join-unit` + join confirm UI) |
| **R9-G4** | Two-node pull sync smoke after LAN activity (`peers.json`) — **pass** (July 2026, `pnpm r9:halo:smoke`) |
| **R9-G5** | `r8:transport:smoke` + `r6:offline-lanes:smoke` still pass; no kernel API break — **pass** (July 2026, `pnpm r9:g5 -- --no-build`) |

**R9 sign-off** = `R9-G0`..`R9-G5` with honest **maintainer smoke** labels (field proof optional when counterparties appear) — **signed off July 2026**.

## 8) Relationship to existing bands

| Band | Relationship |
| --- | --- |
| R8 | NFC is an additional **carrier**; envelopes unchanged |
| R7-M2 | Halo join is a specialized pinned-node flow |
| Track 4 sync | Halo reconcile = existing pull replication |
| R6 offline lanes | Unchanged experimental status; NFC may later carry ack staging only |

## 9) Related docs

- [r8-convenience-transport-spec.md](r8-convenience-transport-spec.md)
- [../roadmap/r9-offline-transport-execution-plan.md](../roadmap/r9-offline-transport-execution-plan.md)
- [r9-h1-halo-join-ux-design.md](r9-h1-halo-join-ux-design.md)
- [r9-n1-android-nfc-read-design.md](r9-n1-android-nfc-read-design.md)
- [r9-n2-android-nfc-write-design.md](r9-n2-android-nfc-write-design.md)
- [../runbooks/r9-halo-operator-runbook.md](../runbooks/r9-halo-operator-runbook.md)
- [../runbooks/r9-nfc-operator-runbook.md](../runbooks/r9-nfc-operator-runbook.md)
- [../v0/v0-track4-sync-spec.md](../v0/v0-track4-sync-spec.md)
- [r7-m2-remote-pinned-node-wiring-spec.md](r7-m2-remote-pinned-node-wiring-spec.md)
- [../client/testing-without-users.md](../client/testing-without-users.md)
