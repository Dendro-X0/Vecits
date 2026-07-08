# Collaboration Value Doctrine

Purpose: define how **subjective human value** relates to **protocol verifiable exchange**, articulate the **techno-anarchy** stance, and clarify that Vectis is **transaction assurance** — not a replacement legal system.

Status: `exploration`

Last updated: July 2026

## Summary

**Value is subjective.** Two people exchanging views, emotional support, or advice may experience real mutual benefit — effective collaboration in human terms — without any GDP line item or artifact hash.

**Vectis does not judge subjective worth.** It provides **transaction assurance** for exchanges that parties choose to structure as signed economic contracts on the log: escrow, evidence, milestones, deterministic close.

Discovery (Aperio) is **goal-agnostic**; settlement (Vectis) is **spec-rigid**. Together they support a marketplace for collaborative value without becoming a new court or ideology.

## Two layers of “value”

| Layer | Who decides | Vectis role |
| --- | --- | --- |
| **Experiential value** | The parties (“we both felt heard / helped”) | **None required** — may happen entirely off-log |
| **Structured exchange value** | Protocol + policy at `as_of` | **Full** — escrow, evidence gates, dispute clocks |

```text
Experiential collaboration     →  human, subjective, unlimited forms
        ↓ (optional)
Structured Vectis contract     →  spec-bound, replayable, portable reputation
```

Participants may gain profound subjective value from a conversation **without** ingesting events. They use Vectis when they want **more than verbal promise** — inspectable commitment, bounded risk, portable history.

### Implication for lanes

Kernel lanes verify **objective evidence shapes** (hashes, receipts, templates) — not whether advice was wise or support was heartfelt (SOC-05, design principle 9).

Consultation or peer-support lanes, if added, must bind to **deliverable anchors** (session summary hash, mutual acknowledgment event pair) rather than “quality of feelings.” Subjective satisfaction stays **off-protocol** or **informational** in client UX — never settlement authority.

## Techno-anarchy (defined)

**Techno-anarchy** here means:

- **No centralized arbitration** inside the kernel (D9)
- **No inequitable override power** — no admin refund button, no governance multisig on marketplace truth
- **Rules are technical specifications** — replay reducers, policy parameters, reason codes
- **Fairness claim** = deterministic application of precommitted rules, not moral or political adjudication

It does **not** mean:

- absence of all hierarchy in the physical world
- immunity from law enforcement or courts
- that subjective disputes inside structured contracts get human reinterpretation in-kernel

Vectis is **anti-human-intervention in the rules engine**, not anti-society. It is neither capitalist nor communist in branding — it is **non-monetary coordination** with explicit limits ([economic-protocol-v1.md](economic-protocol-v1.md)).

Legitimacy comes from **inspectability** (replay, fixtures, AB matrix) and **exit rights** (stop using the protocol), not from replacing states or courts.

## Exit to legal systems

When a dispute is intractable under protocol rules, parties may:

1. Complete whatever deterministic outcome the policy clock allows (timeout, settle handshake, auto-refund), **or**
2. **Leave the platform** and pursue resolution elsewhere (courts, mediation, informal repair)

Vectis is **not** an experimental legal framework. It does not issue binding judgments across jurisdictions. It is a **marketplace for structured collaborative exchange** and a **protocol for transaction assurance** within its own event model.

Operators and clients should say so plainly in onboarding. See [limitations-and-disclaimers.md](limitations-and-disclaimers.md) and [market-operating-model.md](market-operating-model.md) (Mutual amendment and user autonomy).

## Relationship to Aperio

### Division of labor

| System | Question it answers | Scope |
| --- | --- | --- |
| **Aperio** | *What signals appeared that might be worth engaging with?* | Discovery, ranking, pursuit workflow — **goal-agnostic** |
| **Vectis** | *How do we commit, deliver, and close this exchange fairly on-log?* | Settlement, reputation, credits — **spec-bound** |

Aperio canonical docs: `E:\Web Projects\aperio\docs` (see [vision.md](file:///E:/Web%20Projects/aperio/docs/vision.md) — payment and settlement live **outside** Aperio).

### Origin: Freelancing 2.0 → broader clue engine

Aperio began as exploration of **Freelancing 2.0** — better B2B opportunity and lead discovery without gig-wall spam. The engine evolved into a **highly customizable clue indexer** applicable across sectors where communities maintain web presence:

- open-source maintenance (primary Vectis bridge today)
- B2B scoped work and leads
- automotive, real estate, pet adoption, or any vertical **with indexable public signals**

Sector customization happens in **Aperio profiles, streams, connectors, and ranking** — not by changing Vectis settlement semantics for every vertical.

### Bridge contract (Vectis repo)

When a clue should become a **structured Vectis offer**, the discovery bridge ([../specs/discovery-bridge-spec.md](../specs/discovery-bridge-spec.md)) maps signals → lane templates → `ServiceOffer` drafts. Many Aperio outcomes (forum reply, visibility, archived clue) **never** touch Vectis — by design.

```text
Aperio (any sector, any goal mode)
    →  qualified clue / pursuit
    →  [optional] Vectis offer draft + operator review
    →  in-protocol marketplace loop
    →  reputation portable across nodes
```

### Official client stack

The **official Vectis marketplace client** (web → desktop → mobile, self-hosted) consumes:

- **Aperio exports** for discovery and opportunity intake
- **Vectis node API** for authoritative state

Aperio’s own dashboard/desktop ([aperio/docs/app/desktop.md](file:///E:/Web%20Projects/aperio/docs/app/desktop.md)) remains a **discovery observability** surface; Vectis clients focus on **commitment and settlement**.

## Product copy guardrails

| Say | Avoid |
| --- | --- |
| “Structure exchange when you want assurance beyond promise” | “Vectis measures true value of your advice” |
| “Rules enforced by replay, not admins” | “No government can affect your deals” |
| “Leave anytime for legal resolution” | “Vectis replaces courts” |
| “Credits are coordination fuel, not money” | “Token” without qualification |
| “Discovery finds clues; protocol settles contracts” | “Aperio guarantees fair pay” |

## Related docs

- [platform-vision-exploration.md](platform-vision-exploration.md) — marketplace client, mutual aid, apps
- [market-operating-model.md](market-operating-model.md) — transaction specs over identity
- [project-thesis.md](project-thesis.md) — mutual aid, anti-financial thesis
- [../architecture/discovery-engine-bridge.md](../architecture/discovery-engine-bridge.md) — Vectis-side bridge (exploratory)
- [../specs/discovery-bridge-spec.md](../specs/discovery-bridge-spec.md) — normative bridge
- External: [Aperio documentation](file:///E:/Web%20Projects/aperio/docs/README.md)
