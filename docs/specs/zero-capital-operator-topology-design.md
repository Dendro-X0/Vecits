# Zero-capital operator topology design

Purpose: lock how Vectis runs in **production without project-funded hosting** — participant-owned hardware, existing binaries, Track 4 sync, and R8/R9 carriers only.

Status: `locked`

Last updated: July 2026

Prerequisite research: [serverless-p2p-feasibility-investigation.md](serverless-p2p-feasibility-investigation.md)  
Related: [deployment-distribution-spec.md](deployment-distribution-spec.md), [r9-offline-transport-spec.md](r9-offline-transport-spec.md), [../runbooks/operator-quickstart.md](../runbooks/operator-quickstart.md), [../runbooks/r9-halo-operator-runbook.md](../runbooks/r9-halo-operator-runbook.md), [../runbooks/operator-backup-runbook.md](../runbooks/operator-backup-runbook.md), [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md), [../foundation/limitations-and-disclaimers.md](../foundation/limitations-and-disclaimers.md).

Operator steps: [../runbooks/zero-capital-operator-runbook.md](../runbooks/zero-capital-operator-runbook.md)

## 1) Locked decisions

| ID | Decision |
| --- | --- |
| **ZC-D1** | **Production default is participant-hosted.** A workstation, laptop, or home always-on machine running `vectis-node` (CLI or desktop sidecar) is a valid production host. A rented VPS is optional reach, never a gate. |
| **ZC-D2** | **Success = NB-1 + maximal NB-2** from the feasibility investigation: no privileged company cloud; maximize deals that need no public paid server. **NB-3** (no process anywhere) remains a non-goal. |
| **ZC-D3** | **One designated log per community window.** Clients pin one `base_url`. Settlement truth is replay on that log (and honest replicas after pull). Mesh gossip is not settlement authority (R9-X). |
| **ZC-D4** | **No kernel or economic invariant changes** in this band. Credits stay non-transferable coordination fuel; fiat/crypto off-log payment is never labeled settled. |
| **ZC-D5** | **Runtime must not require project donations.** Developer funding is orthogonal. Electricity and disk are paid by whoever chooses to keep a replica awake. |

## 2) Success criteria (pass / fail)

A topology passes zero-capital production when:

1. A full lane exchange (offer → order → escrow → delivery evidence → accept) completes using **only** OSS binaries from this repo and **participant-owned** hardware.
2. No Vectis treasury, donation, or paid cloud account is required for that exchange.
3. Clients show honesty labels when the pin is LAN/private or not yet peer-synced.
4. At least one backup exists that can restore the data dir (or bootstrap a peer from snapshot + pull).
5. Off-platform fee demands are refused in operator/client copy — not treated as Vectis payment.

## 3) Canonical topologies

```text
ZC-1  Solo desktop          — one machine, sidecar or CLI, loopback pin
ZC-2  Two-device LAN/VPN    — host node + second client pin (Wi-Fi / Tailscale)
ZC-3  Replica set           — N≥2 nodes, pull peers, abandonment survival
ZC-4  Meet-cute carriers    — QR / NFC / signed bundle into a ZC-1/2/3 host
```

### ZC-1 — Solo desktop (minimum production)

| Element | Spec |
| --- | --- |
| Host | Desktop Tauri sidecar **or** `vectis-node serve --bind 127.0.0.1:7878` |
| Data dir | Persistent path under operator control (e.g. app data or `./.data/zc1`) — not disposable temp |
| Clients | Same machine WebView/browser pinned to that loopback URL |
| Second identity | Second keypair on same node (buyer + provider roles) for self-drill |
| Backup | Daily or per-session copy of data dir per [operator-backup-runbook.md](../runbooks/operator-backup-runbook.md) |
| When to use | Learning, genesis mint path, fixture-backed readiness, scam-rehearsal with yourself |

**Claim language:** “Local node on this device.” Never “Vectis cloud.”

### ZC-2 — Two-device LAN or overlay VPN

| Element | Spec |
| --- | --- |
| Host | One party’s machine binds reachable address: LAN IP (e.g. `0.0.0.0:7878` behind firewall allowlist) **or** Tailscale/Headscale IP with bind on that interface |
| Join | R9-H1 join confirm — show hostname/IP before pin save ([r9-h1-halo-join-ux-design.md](r9-h1-halo-join-ux-design.md)) |
| Counterparty | Second device pins host `base_url`; does **not** need its own public VPS |
| Carriers | Optional ZC-4 for key material / offer drafts when typing URLs is hostile |
| Honesty | Trust bar: local/LAN operator node until peer sync proves otherwise |
| When to use | In-person or trusted remote counterparty; anti-scam field tests |

**Bind safety:** Prefer overlay VPN (Tailscale et al.) over exposing `7878` to the whole internet. If binding on LAN, firewall to known MACs/IPs when practical. TLS termination remains operator responsibility (deployment spec).

**Claim language:** “Pinned to \<host\> — local operator node” until Track 4 pull reports sync with a named peer.

### ZC-3 — Community replica set (long-term survival)

| Element | Spec |
| --- | --- |
| Membership | ≥2 volunteer hosts; each runs full `vectis-node` with same policy generation expectations |
| Sync | Track 4 pull-only `peers.json`; no privileged writer — ingest validates every event |
| Duty | Social agreement: at least one replica awake during agreed market windows |
| Abandonment | If host A dies: any surviving replica is authority for clients that re-pin; bootstrap new host via snapshot + `sync pull` / `sync bootstrap` |
| Discovery | Out-of-band (chat, meetup QR for pin URL) — no funded DHT required |
| When to use | Mutual-aid circle, club, persistent community storefront |

**Abandonment drill (required for ZC-3 claim):**

1. Stop host A.
2. Re-pin a client to host B.
3. Confirm health + replay-derived order state matches pre-stop `as_of` for shared events.
4. Record drill notes next to backup evidence.

### ZC-4 — Offline carriers into a host (not a topology alone)

QR, NFC, and signed bundles move **artifacts** (pin URLs, event bundles, handoff payloads). They do not replace a designated log. After import, events must land on a ZC-1/2/3 node. See R8/R9 specs.

## 4) Honesty and anti-currency labels (locked copy intent)

| Situation | Required framing |
| --- | --- |
| Loopback / desktop sidecar | Local node on this device |
| Private/LAN/VPN pin, no upstream peer sync | Local operator node — not yet reconciled with upstream |
| After successful peer pull | Synced with peer \<id\> through cursor … |
| Counterparty asks for PayPal / gift card / “activation fee” | Not a Vectis deal — off-platform payment is not protocol truth |
| Credits | Coordination fuel — not money, not withdrawable |

Clients and runbooks must not imply a foundation-operated always-on network.

## 5) Genesis and first exchange (zero capital)

Cold start uses existing paths only:

1. Init persistent data dir + serve (ZC-1 or ZC-2 host).
2. Trust bootstrap / contribution mint as in [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md) (SCN-02 composition).
3. Lane exchange on `software-fixes` or another fixture-proven artifact lane.
4. Optional: second device join (ZC-2) before funded work if counterparty is remote.

No fiat on-ramp. No admin mint button beyond protocol-confirmed contribution attestation rules already locked.

## 6) Long-term operations checklist

| Concern | Operator duty |
| --- | --- |
| Disk growth | Monitor data dir size; retain snapshots; pruning remains future research — do not delete `events.log` ad hoc |
| Host sleep | Laptops that sleep pause ingest — use always-on spare, scheduled windows, or ZC-3 |
| Key custody | Keys stay on client devices; node compromise ≠ key compromise if clients sign locally |
| Pin phishing (SOC-07) | Verify pin URL out-of-band before first escrow |
| Upgrades | Follow deployment upgrade path; same event version policy |
| Exit | Publish final snapshot hash + peer list so survivors can continue |

## 7) Explicit non-goals

- Project-funded always-on Vectis cloud as settlement authority
- Phone mesh gossip as settlement authority
- Fiat/crypto rails or transferable credits
- Requiring a public IPv4 VPS for “production” status
- Changing Track 4 to push-gossip in this band
- Implementing R7-M3 mobile sidecar (separate deferred track)

## 8) Implementation band (docs-first)

| ID | Work | Status |
| --- | --- | --- |
| `ZC-S1` | This design locked | **done** |
| `ZC-S2` | Operator runbook `zero-capital-operator-runbook.md` | **done** (companion) |
| `ZC-S3` | Index `docs/index.md` + backlog + investigation pointer | **done** with this lock |
| `ZC-S4` | Maintainer smoke: ZC-1 health + backup + join/halo helpers | **done** — `pnpm zc:s4` |
| `ZC-S5` | Client copy audit for “cloud / paid host required” implications | **done** — help + trust notes + honesty constants |

**No new protocol events or kernel crates in ZC-S\*.**

## 9) Proof commands (standing)

```bash
# ZC-S4 maintainer closeout (ZC-1 persistent + join + halo)
pnpm zc:s4
# or skip rebuild:
pnpm zc:s4:quick

# Pieces
pnpm v1:build-release
curl http://127.0.0.1:7878/health
pnpm r2:deploy-smoke -- --data-dir ./.data/zc1 --with-backup
pnpm r9:halo:smoke
pnpm r9:halo:join-unit
```

Field proof with a human counterparty remains optional and separate (R6-PD field deferred pattern).

## 10) Relationship to prior phases

| Prior work | Role under ZC |
| --- | --- |
| R1 / R2 | Binary + persistent deploy evidence — **reuse**, do not require VPS wording as mandatory |
| R7 desktop sidecar | Preferred ZC-1 host |
| R8 / R9 | ZC-4 carriers + ZC-2 join honesty |
| R5 federation | Optional later scale; not required for zero-capital production claim |
| Feasibility investigation | Normative background; ZC decisions supersede open “proposed next artifact” |

## 11) Claim discipline

| Allowed | Forbidden |
| --- | --- |
| “Zero-capital production on participant hardware (ZC-1/2/3)” | “Serverless with no node process” |
| “Community replicas; no Vectis Inc. cloud” | “Globally available forever with zero hosts” |
| “Maintainer smoke passed” | “Field-proven against scammers” without a recorded counterparty exchange |
