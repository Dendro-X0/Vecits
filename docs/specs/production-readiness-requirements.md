# Production readiness — functional requirements

Purpose: lock **what “production-ready Vectis” means for the maintainer’s goals** — reciprocal non-monetary collaboration, participant-hosted nodes, and proof that goes beyond local verification.

Status: `locked` (maintainer FR decisions 2026-08-25)

Last updated: August 2026

Related: [zero-capital-operator-topology-design.md](zero-capital-operator-topology-design.md) (ZC-D1..D5 locked), [deployment-distribution-spec.md](deployment-distribution-spec.md), [trust-bootstrap-and-credits-path-spec.md](trust-bootstrap-and-credits-path-spec.md), [../roadmap/r10-production-readiness-execution-plan.md](../roadmap/r10-production-readiness-execution-plan.md), [remote-e2e-cross-platform-design.md](remote-e2e-cross-platform-design.md).

## 1) North star (this band)

Vectis is **production-ready for the maintainer’s use** when:

1. A stranger (or a second device under the maintainer’s control) can **pin a remote node**, complete **trust bootstrap → credits → one `software-fixes` exchange**, and see honest kernel truth labels — **without** fiat rails or a project-funded cloud.
2. That path is proven on **more than one OS/client class**, with evidence packs that distinguish **maintainer smoke** from **remote E2E** from **human field proof**.
3. Local fixture/CI green remains required but is **not** sufficient to claim production.

This band does **not** redefine the protocol. It closes the **operability and proof gap** between “works on my laptop” and “safe to invite others into a real deal.”

## 2) Functional requirements (must)

| ID | Requirement | Primary evidence |
| --- | --- | --- |
| **FR-01** | **Cold-start path** — new identity can reach spendable credits and provider eligibility via contribution/vouch (policy defaults), without admin mint UI | SCN-17 + ZC cold-start + client trust panels |
| **FR-02** | **Reference exchange** — `software-fixes` happy path: offer → order → escrow → delivery evidence → accept → settle | `pnpm sx:s5`, R2 exchange drill, fixtures |
| **FR-03** | **Remote pin** — second client reaches a host over **Tailscale/overlay or trusted LAN only** (RT-A/RT-B); join honesty labels correct. Public TLS/VPS does not count. | ZC-2 checklist + remote E2E design |
| **FR-04** | **Remote exchange E2E** — FR-02 completed with buyer and provider on **different hosts** (or host + remote client), not two keys on loopback only | R10 remote E2E gate |
| **FR-05** | **Cross-platform matrix (minimum)** — XP-2 + XP-3: remote SF1 with **Windows host** and with **Linux host** (release `vectis-node` + official client path). Desktop installers not required for this FR. | Platform matrix in remote-e2e design |
| **FR-06** | **Backup / restore** — production data dir survives stop/reboot; restore yields matching replay hash | RDG-3, `pnpm zc:cold-start` |
| **FR-07** | **Honesty / anti-scam** — SOC-01 off-protocol payment warnings; no “paid/settled” without kernel state; LAN pin labeled as operator node | R4 audit, marketplace trust bar |
| **FR-08** | **Convenience handoff** — low-trust counterparty can receive intro / vouch request / draft offer without installing a full stack first | R8 tiers |
| **FR-09** | **Operator docs** — one runbook chain from init → serve → pin → first exchange → backup, with claim language | ZC + R10 runbooks |
| **FR-10** | **Stability habit** — `pnpm stability:pack:quick` green before claiming any R10 gate | stability-regression-pack |

## 3) Functional requirements (should)

| ID | Requirement | Notes |
| --- | --- | --- |
| **FR-11** | Staged multi-milestone digital deal (Profile A) remotely | Extends SX-S5 beyond local |
| **FR-12** | ZC-3 replica: second node pull-sync converges after remote exchange | Uses `r5:two-node:drill` patterns over real network |
| **FR-13** | Android pin to Windows or Linux host (R7-M2) | Device-gated |
| **FR-14** | Desktop installer path (Tauri) for non-author install &lt; 30 min | RDG-1 spirit |

## 4) Explicit non-goals (this band)

| Non-goal | Why |
| --- | --- |
| Fiat / crypto on-ramps | Locked economic doctrine |
| Human arbitration in kernel | Locked |
| Hyperscale multi-region SaaS | Wrong product shape |
| Requiring a paid VPS for “production” | ZC-D1 |
| iOS production client | No macOS host for R7-M1; deferred |
| NFC field proof as production gate | Hardware-parked; optional later |
| Aperio discovery quality as production gate | Separate system; optional intake |
| Perfect subjective fairness of help quality | Off-protocol (doctrine) |

## 5) Claim language (mandatory)

| Claim | Allowed when |
| --- | --- |
| **Local verified** | Fixtures + stability pack + ZC-1 self-drill |
| **Remote E2E (maintainer)** | FR-03 + FR-04 with two machines/keys under maintainer control |
| **Cross-platform smoke** | FR-05 matrix rows green with evidence paths |
| **ZC-2 field pin** | Second physical device checklist complete |
| **Human counterparty field proof** | Real other person completes exchange (R6-PD / R10-E) |
| **Production-ready for invite** | FR-01..FR-10 + remote E2E (SF1) + Windows↔Linux matrix (XP-2/XP-3); remote dispute optional; human counterparty still optional but recommended |

Never equate CI green or loopback two-key drills with **remote E2E** or **production for invite**.

## 6) Dependency on locked work

Already done and must stay green:

- Kernel R0–R2, procedure GAP-01..08, trust-bootstrap spec
- Client R4 / R7 desktop / R8 / R9 maintainer bands
- ZC topology design + cold-start + staged exchange practice
- Release artifacts: Linux / Windows / macOS kernel binaries (CI matrix)

R10 **adds proof and operability**, not a kernel rewrite.

## 7) Maintainer lock decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | **FR-03 / remote E2E gates** count **only** on Tailscale (or equivalent overlay) or trusted LAN (RT-A / RT-B). Public TLS / VPS (RT-C) is convenience only and **does not** satisfy FR-03, FR-04, or PRG-1..3. | **locked** (2026-08-25, option A) |
| 2 | FR-05 must = **XP-2 + XP-3** only (Windows host + remote client, and Linux host + remote client). Desktop installer fresh-install (XP-6) stays **should**, not must. | **locked** (2026-08-25, option A) |
| 3 | “Production for invite” requires remote SF1 happy path only. Remote dispute/timeout is **optional harden**, not a gate. | **locked** (2026-08-25, option A) |
| 4 | macOS arm64 is **recommended** for FR-05 / XP-5; **skip if no Mac** — not required for production-for-invite. | **locked** (2026-08-25, option A) |

All §7 decisions locked. See R10 execution plan for phase gates.
