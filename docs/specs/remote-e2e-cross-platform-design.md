# Remote E2E and cross-platform design

Purpose: define **how** Vectis proves remote end-to-end exchange and cross-platform compatibility without over-claiming local maintainer smokes.

Status: `locked` (2026-08-25; RT-A/RT-B gate topology; XP-2+XP-3 must; SF1 invite bar; macOS recommended)

Last updated: August 2026

Implements requirements: [production-readiness-requirements.md](production-readiness-requirements.md)  
Execution: [../roadmap/r10-production-readiness-execution-plan.md](../roadmap/r10-production-readiness-execution-plan.md)  
Topology: [zero-capital-operator-topology-design.md](zero-capital-operator-topology-design.md) ZC-2 / ZC-3

## 1) Problem

| Proven today | Not yet proven |
| --- | --- |
| Fixtures, stability pack, ZC-1 loopback | Two hosts over a real network for a full deal |
| `r5:two-node:drill` (often localhost / CI) | Same drill with non-loopback `base_url` + NAT/VPN |
| R7-M2 mobile pin smokes | Sustained remote pin during escrow → accept |
| Release binaries for Win/Linux/macOS | Hosted exchange where OS of host ≠ OS of client |

Remote E2E is hard because it mixes **network**, **identity**, **bind/firewall**, **client pin honesty**, and **protocol correctness**. Treat them as separate failure classes.

## 2) Failure classes (debug order)

When a remote drill fails, classify before changing protocol code:

1. **Reachability** — `GET /health` from peer fails (bind, firewall, wrong IP, VPN down)
2. **Pin / honesty** — client pinned wrong URL or LAN label missing
3. **Auth / read token** — peers.json or authenticated reads reject
4. **Clock / as_of** — wall clock skew affecting windows (rare; note in evidence)
5. **Protocol** — ingest reject, evidence shape, escrow — only then kernel bugs

Rule: **no kernel patch** until class 1–4 are ruled out with evidence.

## 3) Canonical remote topologies

### RT-A — Overlay VPN (**required topology class** for FR-03 / remote E2E gates)

```text
Host (vectis-node, persistent data dir)
  bind: Tailscale IP :7878  (or 0.0.0.0 behind Tailscale ACL)
Client B (browser / desktop / Android)
  pin: http://<tailscale-ip>:7878
```

**Locked (R10-A2 Q1 = A):** Tailscale or equivalent overlay is the gate path for FR-03 / FR-04 / PRG-1..3 (with RT-B for in-person). Matches ZC-2; no public internet exposure; works across NAT.

### RT-B — Trusted LAN

Same as RT-A with LAN IP; firewall allowlist peer only. Prefer for in-person drills. **Counts** for the same remote gates as RT-A when both hosts are on that LAN.

### RT-C — Optional public reach (**does not satisfy** FR-03 / remote E2E gates)

TLS reverse proxy or VPS mirror — allowed for convenience only. **Never** counts as FR-03 / FR-04 / PRG pass evidence (ZC-D1 + R10-A2 lock A).

### RT-D — Replica pull (should)

Source host writes; sink on second machine `sync pull` until replay hash matches (`r5:two-node` pattern over RT-A).

## 4) Remote E2E scenario (minimum — FR-04)

**Name:** `R10-E2E-SF1` — remote `software-fixes` happy path

| Step | Actor | Action |
| --- | --- | --- |
| 0 | Host | Init persistent dir; serve on RT-A; `GET /health` OK |
| 1 | Host + Client B | Both reach `/health`; Client B pin saved with honesty label |
| 2 | Identities | Two keys (buyer/provider); genesis/vouch/credits as needed for policy |
| 3 | Provider | Post `software-fixes` offer on host log |
| 4 | Buyer | Fund escrow / place order from remote client |
| 5 | Provider | Submit delivery evidence |
| 6 | Buyer | Accept |
| 7 | Either | Confirm settle / closed state via kernel-truth UI or `db inspect` |
| 8 | Operator | Export evidence pack (events + health + notes) under `target/r10-evidence/` |

**Pass:** order reaches accepted/closed; replay hash recorded; claim = **Remote E2E (maintainer)** only.

**Optional harden (not invite gate — R10-A2 Q3 = A):** separate scenario `R10-E2E-SF-DISPUTE` after SF1 passes.

## 5) Cross-platform matrix

### 5.1 Minimum for FR-05 (must)

**Locked (R10-A2 Q2 = A):** XP-2 + XP-3 only. Installer fresh-install (XP-6) is should, not must.

| Row | Host OS | Client | Scenario | Status |
| --- | --- | --- | --- | --- |
| XP-1 | Windows x64 | Same-machine second browser / desktop | ZC-1 regression | local baseline |
| XP-2 | Windows x64 | Second device via Tailscale (any OS) | R10-E2E-SF1 | **pass** (2026-08-25 RT-B LAN; evidence `r10-c1-sf1-20260825`) |
| XP-3 | Linux x64 | Windows or Linux client via Tailscale | R10-E2E-SF1 | **pass** (2026-08-25 Debian 12 Docker + Windows client LAN; evidence `r10-d2-xp3-20260825`) |

XP-2 and XP-3 may share one physical second device if host OS differs across runs.

### 5.2 Should (FR-13 / FR-14)

| Row | Host OS | Client | Notes |
| --- | --- | --- | --- |
| XP-4 | Windows or Linux | Android pin (R7-M2) | Device-gated |
| XP-5 | macOS arm64 | Any | Recommended; skip if no Mac (**R10-A2 Q4 = A**) |
| XP-6 | Any | Desktop installer fresh install + pin | RDG-1 spirit |

### 5.3 Explicit defer

- iOS client production
- ARM Linux edge hosts
- WASM embed

## 6) Automation vs manual

| Layer | Automate | Manual / field |
| --- | --- | --- |
| L1 unit/fixtures | CI | — |
| L2 stability pack | `pnpm stability:pack:quick` | — |
| L3 two-node localhost | `pnpm r5:two-node:drill` | — |
| L4 remote health + pin | Scriptable smoke: curl health from peer IP | Confirm honesty UI |
| L5 remote full exchange | Semi-scripted (SDK/CLI ingest) preferred | UI accept path optional |
| L6 human counterparty | — | People-gated |

**Target tooling (implementation slice, not required to lock this design):**

- `pnpm r10:remote:health` — given `VECTIS_REMOTE_BASE_URL`, assert `/health`
- `pnpm r10:remote:e2e-sf1` — SDK/CLI driven SF1 against remote URL + two keys
- Evidence writer under `target/r10-evidence/<runId>/`

Until scripts exist, run SF1 manually with the checklist in the R10 plan and archive notes.

## 7) Evidence pack schema (minimum files)

```text
target/r10-evidence/<runId>/
  summary.json          # topology, OS, URLs (no secrets), pass/fail
  health-host.json
  health-from-peer.json # or curl transcript
  operator-notes.md     # failure class if any
  replay-state-hash.txt
  events.jsonl          # or export subset
```

Do **not** commit private keys or Tailscale auth material.

## 8) Cross-platform compatibility rules

1. **Kernel is source of truth** — same event log must replay identically on every OS (`fixtures run` + remote export replay).
2. **Clients are shells** — UI differences must not change settlement claims (AB-15 / kernel-truth).
3. **Path separators / bind addresses** — Windows `vectis-node` must accept documented `--bind` forms used in RT-A.
4. **Release artifacts only** for remote E2E claims — prefer release binary over `cargo run` (RDG-5 spirit).
5. **One policy generation** — both parties use the same policy; no silent policy drift mid-deal.

## 9) Risks

| Risk | Mitigation |
| --- | --- |
| Flaky VPN | Record Tailscale status in notes; retry; don’t mark gate pass on flaky run |
| Accidental public bind | Default docs to Tailscale; warn on `0.0.0.0` without ACL |
| “Works on Windows only” | Require XP-3 Linux host row |
| Scope creep into R5 federation polish | RT-D is should; SF1 is must |
| Confusing with R6-PD | Human stranger exchange is R10-E / R6-PD — separate gate |

## 10) Exit criteria for this design

**Met (2026-08-25):** FR §7 Q1–Q4 locked; RT-A/RT-B accepted as sole gate topology for remote E2E; XP-2+XP-3 must; SF1 invite bar; macOS recommended.
