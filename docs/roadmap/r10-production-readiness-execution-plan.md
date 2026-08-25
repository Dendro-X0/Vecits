# R10 — Production readiness execution plan

Purpose: bring Vectis from **local-verified** to **production-for-invite** standards for the maintainer’s functional goals — especially **remote end-to-end** and **cross-platform** proof.

Status: `active-complete-maintainer` (`PRG-1`..`PRG-4` pass; `PRG-5` deferred — no human counterparty; **not** a project hold)

Kickoff: August 2026

Requirements: [../specs/production-readiness-requirements.md](../specs/production-readiness-requirements.md)  
Design: [../specs/remote-e2e-cross-platform-design.md](../specs/remote-e2e-cross-platform-design.md)  
Does not replace: [restart-roadmap.md](restart-roadmap.md) R0–R9 (complete / deferred as recorded)

## Context

Restart era R0–R9 proved kernel, packaging, client, convenience/offline transport, and zero-capital **local** production topology. Explicitly still open:

- Remote E2E exchange (not loopback-only)
- Cross-platform host↔client matrix under real network
- Human counterparty field proof (people-gated; optional for invite, required for “community proven”)

R10 is a **proof and operability** band. Prefer scripts + runbooks over new protocol features.

## Phase overview

```text
R10-A  Requirements lock
   │
R10-B  Remote lab (health + pin)     ──→  PRG-1
   │
R10-C  Remote software-fixes E2E     ──→  PRG-2
   │
R10-D  Cross-platform matrix         ──→  PRG-3
   │
R10-E  Tooling + docs harden         ──→  PRG-4
   │
R10-F  Invite / counterparty (opt.)  ──→  PRG-5
```

| Phase | Goal | Gate |
| --- | --- | --- |
| **R10-A** | Lock FR list + remote design defaults | Maintainer sign-off on draft specs |
| **R10-B** | Remote reachability + pin honesty (RT-A) | `PRG-1` |
| **R10-C** | Full remote `software-fixes` happy path | `PRG-2` |
| **R10-D** | XP-2 + XP-3 matrix rows | `PRG-3` |
| **R10-E** | Automate remote health/E2E smoke; docs chain | `PRG-4` |
| **R10-F** | Human counterparty or explicit defer | `PRG-5` or `deferred` |

## R10-A — Requirements lock (complete)

| ID | Work | Acceptance |
| --- | --- | --- |
| `R10-A1` | Draft FR + remote design + this plan | Files exist under `docs/specs/` + `docs/roadmap/` |
| `R10-A2` | Maintainer answers open questions (Tailscale default, matrix, dispute drill, macOS) | Specs status → `locked` |
| `R10-A3` | Index + backlog + working-context point at R10 | Links live |

**R10-A2 locked (2026-08-25):** all **A** — (1) Tailscale/LAN only for remote gates; (2) FR-05 = XP-2 + XP-3; (3) SF1 enough for invite; (4) macOS recommended / skip-if-no-Mac.

## R10-B — Remote lab (`PRG-1`)

| ID | Work | Acceptance |
| --- | --- | --- |
| `R10-B1` | Host on Tailscale (or LAN); release `vectis-node` serve | `GET /health` from host |
| `R10-B2` | Peer machine/device curls `/health` | Evidence in `target/r10-evidence/` |
| `R10-B3` | Client pin + honesty label screenshot or notes | Matches ZC-2 claim language |
| `R10-B4` | Failure-class log if any flake | Class 1–4 before protocol changes |

**R10-B1 pass (2026-08-25):** release binary on Windows host, bind `0.0.0.0:7878`, data `.data/zc1`, topology **RT-B** (LAN `192.168.1.4` — Tailscale not installed). Evidence: `target/r10-evidence/r10-b1-20260825/`. Host `/health` 200 on loopback + LAN IP.

**R10-B2 pass (2026-08-25):** peer curled `http://192.168.1.4:7878/health` → ok (screenshot `peer-health-curl.png`).

**R10-B3 pass (2026-08-25):** web client pin of LAN URL with hostname confirm + **Local operator node** honesty (`b3-pin-confirm.png`, `b3-pin-honesty.json`).

**`PRG-1` PASS (2026-08-25, RT-B).** Remote pin works; **not** yet a full exchange.

**Checklist seed:** [../runbooks/zero-capital-zc2-field-checklist.md](../runbooks/zero-capital-zc2-field-checklist.md)

## R10-C — Remote exchange E2E (`PRG-2`)

| ID | Work | Acceptance |
| --- | --- | --- |
| `R10-C1` | Run `R10-E2E-SF1` (see remote design §4) | Order accepted/closed |
| `R10-C2` | Evidence pack complete | `summary.json` + replay hash |
| `R10-C3` | Prefer release binary on host | Note cargo-only runs as non-claim |
| `R10-C4` | Optional: dispute/timeout remote drill | Not required for invite (R10-A2 Q3 = A); FR-11 should only |

**`PRG-2` PASS (2026-08-25):** `R10-E2E-SF1` on RT-B LAN — release host `.data/zc1`, HTTP ingest to `http://192.168.1.4:7878`, lane `software-fixes`, order **closed**. Evidence: `target/r10-evidence/r10-c1-sf1-20260825/`. Claim = **Remote E2E (maintainer)** only.

## R10-D — Cross-platform matrix (`PRG-3`)

| ID | Work | Acceptance |
| --- | --- | --- |
| `R10-D1` | XP-2: Windows host + remote client SF1 | Evidence runId |
| `R10-D2` | XP-3: Linux host + remote client SF1 | Evidence runId |
| `R10-D3` | Optional XP-4 Android pin | Device-gated |
| `R10-D4` | Document known OS quirks | Short notes in evidence or runbook |

**R10-D1 pass (2026-08-25):** XP-2 covered by `PRG-2` RT-B run on Windows host (`target/r10-evidence/r10-c1-sf1-20260825/`).

**R10-D2 pass (2026-08-25):** XP-3 Linux host (Debian 12 Docker `vectis-node:r10-xp3`) + Windows client SF1 via `http://192.168.1.4:7879`. Evidence: `target/r10-evidence/r10-d2-xp3-20260825/`.

**`PRG-3` PASS (2026-08-25):** XP-2 + XP-3 green.

## R10-E — Tooling and docs (`PRG-4`)

| ID | Work | Acceptance |
| --- | --- | --- |
| `R10-E1` | `pnpm r10:remote:health` (or equiv.) | Script + README usage |
| `R10-E2` | `pnpm r10:remote:e2e-sf1` semi-automated | Deterministic against remote URL |
| `R10-E3` | Operator “production for invite” runbook page | Single entry from `docs/index.md` |
| `R10-E4` | Stability pack still green | `pnpm stability:pack:quick` |

**`PRG-4` PASS (2026-08-25):** `r10:remote:health` + `r10:remote:e2e-sf1` shipped; runbook [../runbooks/r10-production-for-invite-runbook.md](../runbooks/r10-production-for-invite-runbook.md); stability pack green. Repeatable remote proof without rediscovering steps.

## R10-F — Invite / counterparty (`PRG-5`)

| ID | Work | Acceptance |
| --- | --- | --- |
| `R10-F1` | Publish bounded reciprocal-help invite (out of band) | Post exists; scoped ask |
| `R10-F2` | Complete exchange with human **or** mark deferred | Evidence or explicit defer note |
| `R10-F3` | Align with R6-PD if community lane proof desired | Separate claim |

**`PRG-5` DEFERRED (2026-08-25):** maintainer has no available human counterparty. Explicitly **not** a hold on the project. Production-for-invite (maintainer) stands on `PRG-1`..`PRG-4` + locked FR-01..FR-10. Resume R10-F / R6-PD only when a real other person is available; until then do **not** claim “human counterparty field proof” or “community proven.”

`PRG-5` is **people-gated** and **optional** for invite.

## Gates summary

| Gate | Meaning |
| --- | --- |
| `PRG-1` | Remote health + pin |
| `PRG-2` | Remote full SF1 exchange |
| `PRG-3` | Win + Linux host matrix |
| `PRG-4` | Repeatable tooling + docs |
| `PRG-5` | Human counterparty (optional) |

## Standing verification (any R10 session)

```bash
pnpm stability:pack:quick
# after remote work:
# archive target/r10-evidence/<runId>/
```

## Sequencing vs other backlog

| Item | Relation to R10 |
| --- | --- |
| R6-PD field proof | Subsumed / allied under R10-F |
| ZC-2 field checklist | Feeds R10-B |
| R5 federation polish | Optional RT-D after PRG-2 |
| R7-M1 iOS | Remains deferred (no macOS host) |
| NFC device smoke | Remains hardware-parked |
| Aperio redesign | Out of band |

## Next atomic step

**R10 maintainer band closed for invite bar.** `PRG-5` / human field proof is **deferred** (no counterparty) — not a pause. Next work should be outside R10 people-gates (e.g. product polish, deferred backlog items, or resume R10-F when a human is available). Do not claim community/human field proof.
