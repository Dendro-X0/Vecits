# Docs Sync Checklist

Purpose: keep implementation and documentation synchronized at every merged behavior change.

**Current state doc:** [../project-status.md](../project-status.md) — update when completion status or deferred items change.

## Required updates per behavior change

- [ ] Update [../client/client-capabilities.md](../client/client-capabilities.md) when user-visible client behavior changes
- [ ] Update [../client/ui-contract.md](../client/ui-contract.md) when UI rules change
- [ ] Update [../project-status.md](../project-status.md) when a layer moves shipped / deferred / next
- [ ] Append to [../roadmap/progress.md](../roadmap/progress.md) with evidence paths
- [ ] Update [../roadmap/working-context-log.md](../roadmap/working-context-log.md) with next atomic step
- [ ] Update [../index.md](../index.md) only when introducing a new top-level canonical doc

### Protocol / kernel changes (additional)

- [ ] Update fixture mapping ([../v0/v0-scenario-fixture-matrix.md](../v0/v0-scenario-fixture-matrix.md), [../v0/v0-abuse-gaming-test-matrix.md](../v0/v0-abuse-gaming-test-matrix.md))
- [ ] Update protocol contracts ([../architecture/v0-spec-outline.md](../architecture/v0-spec-outline.md), locked specs under [../specs/](../specs/README.md))
- [ ] Update [../specs/protocol-priority-backlog.md](../specs/protocol-priority-backlog.md) when stack rank changes

### Do not update for routine work

- Archived execution plans under [../archive/roadmap/](../archive/roadmap/README.md) — historical only
- [../archive/roadmap/working-context-log-historical.md](../archive/roadmap/working-context-log-historical.md)

## Required evidence in PR or change log

- [ ] test file paths updated
- [ ] fixture paths under `fixtures/` if changed
- [ ] verification commands (`cargo test`, `fixtures run`, `pnpm stability:pack:quick`, client smokes)
- [ ] migration or compatibility note when replay/snapshot format changes

## Quality gates

- [ ] no status statement conflicts with [../project-status.md](../project-status.md)
- [ ] no open work item marked complete without evidence path
- [ ] docs dates use explicit month/year for status statements
- [ ] operable claims: `pnpm stability:pack:quick` green or intentional skip noted — [../runbooks/stability-regression-pack.md](../runbooks/stability-regression-pack.md)

← [Meta index](README.md) · [Documentation audit 2026-08-26](documentation-audit-2026-08-26.md)
