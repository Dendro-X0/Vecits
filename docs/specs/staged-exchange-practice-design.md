# Staged exchange practice design

Purpose: put value-layers doctrine into **operable deal shapes** — staged digital resource exchanges vs distinct offline one-shot patterns — **without new kernel event kinds**.

Status: `locked`

Last updated: July 2026

Prerequisite: [value-layers-design.md](value-layers-design.md)  
Operator steps: [../runbooks/staged-exchange-operator-runbook.md](../runbooks/staged-exchange-operator-runbook.md)  
Lanes: [../architecture/lane-template-catalog.md](../architecture/lane-template-catalog.md)

## 1) Locked decisions

| ID | Decision |
| --- | --- |
| **SX-D1** | **Digital / virtual resource deals default to multi-milestone staging.** Each phase has its own escrow → evidence → accept. Credits move only at phase completion (VL-D6). |
| **SX-D2** | **Offline / in-person deals default to one-shot** (single milestone) unless parties explicitly stage. Dual-ack / receipt evidence remains experimental honesty (R6-L3). |
| **SX-D3** | No new protocol events for “API tokens” or “code escrow.” Map resources onto existing lanes + milestone evidence formats. |
| **SX-D4** | A closed milestone issues/settles L1 lots per existing rules; it does **not** create lasting claim on future API quota, compute, or IP beyond what the L3 artifact already is. |
| **SX-D5** | Further phases after acceptance require **new milestones** (same order) or a **new order** — never automatic drip. |

## 2) Core loop (every stage)

```text
Fund escrow (L1) → Deliver lane-valid evidence (L3 proof) → Accept/settle
        → provider reward / refund lots (L1, expiring)
        → reputation/history update (L2)
```

Partial progress **without** accept does not unlock durable credits. That is the anti-speculation property in practice.

## 3) Profile A — Staged digital / virtual resources

Use when the resource is divisible or reviewable in phases: compute batches, API access grants, proprietary code drops, dataset slices.

### 3.1 Recommended stage templates

| Resource | Suggested stages (examples) | Lane / evidence |
| --- | --- | --- |
| **Compute power** | (1) sample job receipt → (2) full batch receipt → (3) optional rerun/verify | `compute-job` / `job-receipt-v1` |
| **API access / quota** | (1) credentials+smoke call receipt → (2) quota tranche A → (3) tranche B… | Prefer `compute-job` or artifact lane with receipt/notes hashes of grant docs — **not** a transferable in-protocol API balance |
| **Proprietary code** | (1) design/spec hash → (2) implementation artifact hash → (3) transfer/license ack hash | `software-fixes` / `feature-work` / `artifactHash` |
| **Docs / research packages** | outline → draft → final package | `documentation` / `research` |

### 3.2 Staging rules

1. Order `milestones[]` lists phases in intended sequence; fund **one active milestone at a time** (kernel already scopes escrow per milestone).
2. Each milestone amount is the L1 fuel for **that** phase only.
3. Acceptance criteria hashes must name the phase deliverable (no vague “whole project”).
4. After accept, remaining usefulness of the artifact is L3; more fuel requires the next milestone.

### 3.3 What “API tokens” means here

External API keys or quota are **L3 access objects**. Vectis records that a grant was evidenced and accepted. It does **not** become a hoardable Vectis credit balance representing leftover API calls. Unused external quota is outside the ledger; unused Vectis credits still demurrage/expire.

## 4) Profile B — Offline / one-shot

Use when the exchange is a single physical handoff or local mutual aid meet: goods, tools, in-person service burst.

| Pattern | Default | Lane / evidence |
| --- | --- | --- |
| Physical good / meet | **One milestone**, dual acknowledgment | `physical-handoff` / `physical-handoff-ack-dual-v1` |
| Local community resource | **One milestone**, local receipt | `local-resource-exchange` / `local-resource-receipt-v1` |

### 4.1 Distinct approach (vs digital staging)

| Concern | Offline one-shot | Staged digital |
| --- | --- | --- |
| Milestone count | Prefer 1 | Prefer ≥2 when divisible |
| Evidence | Dual-ack / local receipt; procedure only | Artifact or job receipts; still format-not-worth |
| Partition / meet | QR/NFC/LAN (R8/R9) to move pin or bundle | Usually online pinned node |
| Claim language | Experimental; not production fairness guarantee | Artifact lanes are community-deployable |
| Staging later | New **order** if parties meet again | Next **milestone** on same order |

Do not stretch a single physical handoff across fake “phases” to farm reputation. If the meet is truly one act, use one milestone.

## 5) Client practice requirements

| Surface | Behavior |
| --- | --- |
| Milestone schedule editor | Explain staged digital vs offline one-shot |
| Help | Article `staged-exchanges` |
| Lane picker / catalog | Point operators at Profile A vs B |
| Trust / credits copy | Value at phase accept — not continuous accrual |

## 6) Implementation band

| ID | Work | Status |
| --- | --- | --- |
| `SX-S1` | This design + value-layers design locked | **done** |
| `SX-S2` | Operator runbook | **done** |
| `SX-S3` | Help article + milestone editor guidance | **done** with this band |
| `SX-S4` | Catalog cross-links | **done** with this band |
| `SX-S5` | Optional fixture/drill: multi-milestone compute or software-fixes happy path documentation | **done** — `pnpm sx:s5` · [../runbooks/staged-exchange-operator-runbook.md](../runbooks/staged-exchange-operator-runbook.md) |

**Kernel:** no new event kinds in SX-S\*.

## 7) Proof (standing)

```bash
# Profile A multi-milestone (software-fixes m1+m2 escrow→deliver→accept)
pnpm sx:s5
pnpm sx:s5:quick

# Offline one-shot lanes still fixture-proven
pnpm r6:offline-lanes:smoke

# Compute receipt tooling
pnpm v2:compute-receipt:smoke

# Artifact lane exchanges
pnpm r6:lane-templates:smoke -- --fixtures-only
```

Multi-milestone client path: Publish & transact → milestone schedule (Phase 3 complete).

## 8) Claim discipline

| Allowed | Forbidden |
| --- | --- |
| “Credits release per accepted milestone” | “You earn passive points while the API runs” |
| “API grant evidenced in phase 2” | “Vectis balance = remaining API calls” |
| “Physical handoff: one-shot experimental lane” | “Staged offline phases guarantee goods quality” |
