# Documentation Audit — August 2026

**Purpose:** Comprehensive audit of `/docs`, consolidation of completed roadmap/implementation specs, and alignment with shipped behavior.

**Outcome:** [project-status.md](../project-status.md) is now the canonical current-state doc. Completed R-track execution plans moved to [archive/roadmap/](../archive/roadmap/README.md).

---

## Findings

### Strengths

- **Kernel truth is well documented** — fixtures, abuse matrix, lane specs, and gap audit are accurate and cross-linked.
- **Client capabilities doc matches shipped behavior** — deal loop, workspace, trust bootstrap, transport tiers.
- **Runbooks are operable** — operator quickstart, zero-capital, R10 remote E2E, stability pack.
- **Foundation docs** — thesis, market operating model, limitations — remain the right long-lived references.

### Problems addressed in this pass

| Issue | Action |
| --- | --- |
| **Scattered “what’s done”** across `restart-roadmap.md`, `progress.md`, R7–R10 execution plans, and `index.md` | Created [project-status.md](../project-status.md) |
| **Completed execution plans** still in active `roadmap/` folder | Moved to [archive/roadmap/](../archive/roadmap/README.md) |
| **`restart-roadmap.md` too long** for orientation | Archived full version; slim pointer remains at [roadmap/restart-roadmap.md](../roadmap/restart-roadmap.md) |
| **Frontend specs at docs root** (`frontend-spec*.md`) | Moved to [client/](../client/README.md) with `implemented` status |
| **Design audit at docs root** | Moved to [meta/design-audit-2026-08-26.md](design-audit-2026-08-26.md) |
| **`index.md` overload** — R-track paths dominate navigation | Rewritten to lead with project status and role-based paths |
| **`working-context-log.md` bloated** (~2700 lines of stale checklists) | Archived; replaced with current snapshot |
| **Client docs missing recent UX** | Updated [client-capabilities.md](../client/client-capabilities.md) (global search, marketplace polish) |
| **Sync checklist referenced obsolete paths** | Updated [docs-sync-checklist.md](docs-sync-checklist.md) |

### Remaining doc debt (not blocking)

| Item | Notes |
| --- | --- |
| **`progress.md` length** | Kept as historical changelog; current state in `project-status.md` |
| **`v0/v0-roadmap.md` + phase0 plan** | v0 era; still referenced by sync checklist for protocol changes only |
| **Exploration docs** (`platform-vision-exploration.md`, open questions) | Correctly marked exploration — not consolidated |
| **R5/R6 specs** without execution plans in archive | Federation/lane expansion ongoing; no false “complete” claim |
| **Barter compensation UI vs kernel** | Documented in project-status; needs protocol spec if pursued |
| **Per-route document titles, skip link** | Design audit P2 items — tracked in meta design audit |

---

## Canonical doc hierarchy (post-audit)

```text
docs/
  index.md              ← orientation (read first)
  project-status.md     ← current state (read second)
  foundation/           ← thesis, economics, doctrine (stable)
  architecture/         ← lanes, bridges, system shape
  specs/                ← locked contracts + protocol backlog
  client/               ← UI contract, capabilities, dev/testing, implemented frontend specs
  runbooks/             ← operator procedures
  v0/                   ← fixtures, abuse matrix, v0 evidence
  roadmap/              ← progress changelog + session handoff only
  archive/              ← historical plans (roadmap execution, frontend phases, legacy)
  meta/                 ← audits, sync checklist
```

### Normative vs historical

| Normative | Historical |
| --- | --- |
| `specs/*` (status: locked) | `archive/roadmap/*` |
| `client/ui-contract.md` | `archive/frontend-phases/*` |
| `client/client-capabilities.md` | `archive/roadmap/restart-roadmap-full.md` |
| `foundation/market-operating-model.md` | `v0/v0-phase0-execution-plan.md` |
| `project-status.md` | `roadmap/progress.md` (changelog) |

---

## Sync rules (summary)

When behavior changes:

1. Update [client/client-capabilities.md](../client/client-capabilities.md) if user-visible client behavior changed.
2. Update [client/ui-contract.md](../client/ui-contract.md) if UI rules changed.
3. Update [project-status.md](../project-status.md) if completion status or deferred items changed.
4. Append to [roadmap/progress.md](../roadmap/progress.md) with evidence paths.
5. Update [roadmap/working-context-log.md](../roadmap/working-context-log.md) next atomic step.
6. Update [index.md](../index.md) only when adding a new top-level canonical doc.

Full checklist: [docs-sync-checklist.md](docs-sync-checklist.md).

---

## Code ↔ doc alignment verified

| Area | Doc | Code anchor |
| --- | --- | --- |
| Deal loop | client-capabilities | `marketplace-event-builder.tsx`, smoke script |
| Global search | client-capabilities | `components/search/global-search.tsx`, `lib/search/global-search-items.ts` |
| Settings deep links | client-capabilities | `?category=` in `dashboard-settings-panel.tsx` |
| Mutual aid shelf | project-status | `/marketplace/mutual-aid`, `project-maintenance` lane |
| Trust bootstrap | trust-bootstrap spec | `trust-bootstrap-panel.tsx` |
| Barter UI-only | project-status | `offer-publish-editor.tsx` vs kernel `ServiceOffer` |

---

## Related

- [meta/design-audit-2026-08-26.md](design-audit-2026-08-26.md) — frontend UX audit
- [client/frontend-spec-guided-offer-publish.md](../client/frontend-spec-guided-offer-publish.md) — implemented
- [client/frontend-spec-marketplace-landing.md](../client/frontend-spec-marketplace-landing.md) — partially implemented (see design audit)

← [Docs index](../index.md)
