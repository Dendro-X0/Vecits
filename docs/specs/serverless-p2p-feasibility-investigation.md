# Serverless / cross-device P2P feasibility investigation

Purpose: answer whether Vectis can operate **across devices and platforms without relying on a backend server**, and what that means for **long-term operation without project funding**.

Status: `locked` (research complete — design locked)

Last updated: July 2026

**Follow-on design (locked):** [zero-capital-operator-topology-design.md](zero-capital-operator-topology-design.md) · [../runbooks/zero-capital-operator-runbook.md](../runbooks/zero-capital-operator-runbook.md)

Related: [deployment-distribution-spec.md](deployment-distribution-spec.md), [r9-offline-transport-spec.md](r9-offline-transport-spec.md), [../v0/v0-track4-sync-spec.md](../v0/v0-track4-sync-spec.md), [../foundation/limitations-and-disclaimers.md](../foundation/limitations-and-disclaimers.md), [../foundation/market-operating-model.md](../foundation/market-operating-model.md), [restart-decisions.md](restart-decisions.md) (D4), [r7-m3-on-device-sidecar-spec.md](r7-m3-on-device-sidecar-spec.md).

## 1) Question under study

> Is it possible to create a protocol that operates across devices and platforms without relying on a backend server? If the system requires funding to function, it has already failed.

This investigation treats that claim as a **design constraint**, not a slogan. It separates three different meanings of “no backend,” because they have incompatible engineering costs.

## 2) Three meanings of “no backend”

| ID | Claim | Already true for Vectis? | Long-term cost |
| --- | --- | --- | --- |
| **NB-1** | No privileged **Vectis Inc.** cloud; anyone may host | **Yes** — doctrine + operator model | Electricity/hardware paid by whoever runs a node |
| **NB-2** | No **always-on HTTP process** required for a deal to exist | **Partially** — R8/R9 offline carriers + local sidecar | Parties must meet (LAN/NFC/QR) or schedule sync windows |
| **NB-3** | **No process anywhere** persists an authoritative log; pure phone mesh settles forever | **No** — and likely **incompatible** with current kernel | Consensus, forks, or weakened settlement |

**Locked research conclusion (draft):** success should be defined as **NB-1 + maximal NB-2**, not NB-3. Demanding NB-3 while keeping deterministic escrow/replay is a category error.

## 3) What Vectis actually requires (physics of the protocol)

Settlement authority is **deterministic replay of one append-only signed event log** at a given `as_of` (kernel invariants; Track 4 relays do not settle).

Therefore something must:

1. **Accept** signed events (ingest validation)
2. **Persist** them durably
3. **Order** them into a single sequence (or an equivalent total order)
4. **Expose** them for replay / sync to other devices

That “something” is a **node** — not necessarily a rented VPS, not necessarily a company server, but it is a **process + storage**. Calling it “not a backend” does not remove the physics.

Current shipped topology:

```text
Device A (client) ──HTTP──► operator node (log) ◄──pull sync── operator node B
Device B (client) ──HTTP──►        │
Desktop sidecar   ──loopback──► local vectis-node (same binary)
Offline carriers (QR / NFC / bundle) ──► import into a node
```

Relays/peers **transport**; they do not mint credits or judge disputes ([security-resilience-spec.md](security-resilience-spec.md)).

## 4) Feasibility by scenario

### 4.1 Pairwise / small group (zero project funding) — **feasible**

| Element | Mechanism | Funding needed? |
| --- | --- | --- |
| Persistence | One party’s laptop/desktop sidecar, or a Pi at home | Party’s own electricity |
| Cross-device | Second phone/laptop pins that node (LAN, Tailscale, or temporary tunnel) | Optional free tunnel; no donation |
| Offline meet | QR / NFC / signed bundle (R8/R9) | None |
| Settlement | Same kernel replay on any honest replica after sync | None |

**Thermodynamic reading:** each participant who wants the log available pays their own hardware entropy. The project treasury is not in the loop.

This is the intended restart default (D4: single-operator, local-first).

### 4.2 Community store without a company — **feasible with social cost**

A volunteer or mutual-aid operator runs a node for a neighborhood / affinity group. Cost is real (disk, power, occasional upgrade) but **distributed to operators who benefit**, not to a donation-funded protocol foundation.

Failure mode: operator disappears → log availability drops until someone else bootstraps from backup/snapshot (already in operator backup runbooks). Settlement history remains recoverable if **any** honest replica survives.

### 4.3 Global always-on marketplace with zero hosts — **not feasible**

If no device is awake and reachable, no new events ingest and no discovery works. That is not a Vectis-specific failure; it is availability.

Paid cloud is one way to buy availability. It is **not** the only way (home always-on PC, library machine, campus club server, rotating operator duty). Project donations are a **political** choice of who pays — not a protocol necessity.

### 4.4 Pure device mesh (NB-3) with current settlement semantics — **research-hostile**

R9 explicitly deferred phone mesh gossip as authority.

Hard constraints if pursued:

| Challenge | Why it bites Vectis |
| --- | --- |
| **Total order** | Escrow/dispute timeouts need a shared clock+log; concurrent phone writers fork |
| **Mobile OS** | Background kill, NAT, battery — no reliable always-on peer |
| **Partition** | Two honest partitions can both “accept” incompatible local states |
| **Sybil / eclipse** | Mesh without admission graph is spam paradise |
| **Storage** | Full log on every phone does not scale; partial views ≠ settlement authority |
| **Incentive** | “Free forever mesh relays” usually reintroduces funded infrastructure under another name |

Possible research directions (not authorized work):

- **A. Session-scoped logs** — deal room lives only while both devices hold a replica; no global marketplace (closest to R8 handoff + local node)
- **B. CRDT / conflict-free state** — abandons or heavily reshapes milestone state machine
- **C. Consensus layer** (BFT, blockchain) — reintroduces capital, fees, or validator politics Vectis explicitly rejects
- **D. Store-and-forward bundles only** — already partially shipped; sync when any node wakes

**Recommendation:** keep mesh as **carrier**, never as **settlement authority** (R9-X stance preserved).

## 5) Long-term operation challenges (regardless of hosting model)

These remain even if every node is self-hosted and unpaid.

| Risk | Horizon | Mitigation already / needed |
| --- | --- | --- |
| Operator abandonment | Years | Snapshot + JSONL backup; multi-peer pull; honest client pin UX |
| Log growth | Years | Snapshots, pruning research (not yet a locked product feature) |
| Policy drift across communities | Years | Policy packs / event versioning strategy |
| Key loss | Anytime | Non-inheritance of credits (by design); social recovery out of protocol |
| Clock skew / timeout games | Ongoing | Protocol defaults; operator NTP hygiene |
| Fake operator phishing (SOC-07) | Ongoing | Client pin `base_url`; out-of-band URL verify |
| “Just pay me outside” (SOC-01) | Ongoing | UX honesty; refuse to label off-log payment as settled |
| OS/platform choke on sidecars | Ongoing | Desktop OK; mobile sidecar deferred (R7-M3) |
| Legal seizure of a host | Rare | Many replicas; no single company honeypot — but home hosts are still seizeable |

**Long-term success metric (proposed):** a stranger can complete a lane exchange using **only** participant-owned hardware and published OSS binaries, with **no** payment to a Vectis treasury and **no** requirement that a maintainer’s server be online.

Donations may still fund *development labor*; they must not be required for *runtime coordination*.

## 6) Reframe of the funding failure test

| Statement | Verdict |
| --- | --- |
| “If the protocol needs a foundation-paid AWS account forever, it failed.” | **Agree** — treat as design failure under NB-1 |
| “If someone somewhere runs a process and pays for electricity, it failed.” | **Reject** — that is thermodynamics, not capitalism capture |
| “If users must buy credits or pay gas to settle, it failed.” | **Agree** — already forbidden by economic invariants |
| “If two laptops on a LAN cannot settle without the internet, it failed.” | **Agree as a bar** — LAN halo + local sidecar are the proof path |

## 7) Mapping to shipped / deferred work

| Capability | Status | Role in serverless story |
| --- | --- | --- |
| Local `vectis-node` + data dir | Shipped | NB-1/NB-2 core |
| Desktop sidecar | Shipped (R7) | Zero-VPS operator on existing PC |
| Pull sync between peers | Shipped (Track 4) | Multi-host without central writer privilege |
| QR / bundle / NFC carriers | Shipped (R8/R9) | Cross-device without public server |
| LAN halo honesty | Shipped (R9-H) | Partition-aware claims |
| Mobile on-device sidecar | Deferred (R7-M3) | Stronger NB-2 on phones |
| Mesh gossip settlement | Deferred / non-goal (R9-X) | Avoid NB-3 trap |
| Global DHT discovery | Not planned | Would reintroduce infrastructure politics |

## 8) Research options (do not implement until locked)

Ordered by fidelity to current kernel:

1. **PRF zero-capital runbook** — document “your PC is the production host”; Tailscale/LAN invite; refuse currency copy. (Operational, not protocol change.)
2. **Replica duty design** — N participants each keep a pull peer; abandonment threshold; bootstrap from any survivor.
3. **Deal-scoped ephemeral nodes** — spin local node for one order’s lifetime; export sealed bundle; optional later merge into community log.
4. **Mobile sidecar field study** — only after R7-M3 prerequisites; measure background survival, not settlement novelty.
5. **Explicit non-research:** funded always-on Vectis cloud as settlement authority.

## 9) Verdict

| Question | Answer |
| --- | --- |
| Cross-device / cross-platform without a **company** backend? | **Yes** — already the architecture |
| Without **any** node process? | **No** — contradicts append-only settlement |
| Without **project funding** for runtime? | **Yes**, if operators/participants host; funding is for code, not for the log’s existence |
| Pure mesh settles like today’s kernel? | **Not without rewriting settlement** — do not pretend otherwise |

The catch-22 (“need VPS to earn VPS”) dissolves when **the workstation is the host**. Capitalism can still gate *global reach* and *developer time*; it does not gate *protocol validity* on a local log.

## 10) Follow-on artifact

**Locked:** [zero-capital-operator-topology-design.md](zero-capital-operator-topology-design.md) (ZC-D1..D5, topologies ZC-1..ZC-4). Operator path: [../runbooks/zero-capital-operator-runbook.md](../runbooks/zero-capital-operator-runbook.md).

**ZC-S4 / ZC-S5 done:** `pnpm zc:s4` maintainer smoke; client copy audited for zero-capital honesty.
