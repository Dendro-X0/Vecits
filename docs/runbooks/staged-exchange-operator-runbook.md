# Staged exchange operator runbook

Purpose: run **Profile A** (staged digital/virtual) and **Profile B** (offline one-shot) deals per [../specs/staged-exchange-practice-design.md](../specs/staged-exchange-practice-design.md).

Status: `active`

Last updated: July 2026

## Choose a profile

| If the deal is… | Use |
| --- | --- |
| Compute batches, API grants, code drops, doc packages | **Profile A — staged digital** |
| One meet, one good, one local favor | **Profile B — offline one-shot** |

Credits move only when a milestone accepts (or settles/times out). They are coordination fuel — not savings.

## Profile A — Staged digital

1. Pin a node (zero-capital desktop/LAN is fine).
2. Provider publishes an offer on the matching lane (`compute-job`, `software-fixes`, `feature-work`, `documentation`, …).
3. Buyer places an order with **two or more milestones**, each with:
   - its own credit amount
   - evidence format allowed by the offer
   - acceptance criteria that name **this phase only**
4. For each milestone in order:
   - Buyer funds escrow for **that** milestone only
   - Provider delivers lane-valid evidence
   - Buyer accepts (or dispute path)
5. Do not treat leftover external API quota or running code as Vectis credit balance. Next phase = next milestone.

### Maintainer proof (SX-S5)

Two-milestone `software-fixes` happy path (m1 spec hash → m2 implementation hash), each phase escrow → delivery → accept; order closes only after both accepts:

```bash
pnpm sx:s5          # build release if needed
pnpm sx:s5:quick    # --no-build
```

Events land under `target/tmp/sx-s5-<runId>/`. Claim: maintainer protocol proof of SX-D1 — not a human field proof.

### Examples

**Compute**

- m1: sample `job-receipt-v1` (smoke)
- m2: full batch receipt
- Tools: `pnpm v2:compute-receipt -- …` · [compute-job-lane-runbook.md](compute-job-lane-runbook.md)

**Proprietary code**

- m1: spec/design artifact hash
- m2: implementation artifact hash
- m3: optional transfer acknowledgment notes hash
- Maintainer drill (m1+m2): `pnpm sx:s5`

**API access grant**

- m1: credential issuance receipt (hash of grant doc + smoke proof)
- m2+: quota tranche receipts  
  External keys stay L3; Vectis only records evidenced grants.

## Profile B — Offline one-shot

1. Prefer a single milestone.
2. Use `physical-handoff` (dual ack) or `local-resource-exchange` (local receipt).
3. Meet with honesty: experimental procedure evidence — not quality court.
4. Carriers: QR/NFC/LAN pin as needed ([zero-capital-operator-runbook.md](zero-capital-operator-runbook.md), R8/R9).
5. If you meet again later, open a **new order** — do not fake stages on one handoff.

```bash
pnpm r6:offline-lanes:smoke
```

Runbook: [offline-lane-experimental-runbook.md](offline-lane-experimental-runbook.md)

## Anti-patterns

| Do not | Why |
| --- | --- |
| One giant milestone for a month of API access with no interim evidence | Removes stage discipline; raises scam surface |
| Mint credits from uptime/usage counters | Passive yield — forbidden (VL-D5) |
| Call off-platform “activation fees” a Vectis payment | SOC-01 |
| Multi-phase a single box handoff to farm accepts | Abuses L2 |

## Help

In-app: `/help/staged-exchanges` · `/help/deal-flow` · `/help/credits-path`
