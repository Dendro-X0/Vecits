# Docs Sync Checklist

Purpose: keep implementation and documentation synchronized at every merged behavior change.

## Required updates per behavior change

- [ ] Update status summary in `docs/roadmap/restart-roadmap.md` (restart era) or `docs/archive/roadmap.md` (long-term historical) when track or phase status changes.
- [ ] Update implementation milestones in `docs/roadmap/progress.md`.
- [ ] Update `docs/v0/v0-roadmap.md` if scope, acceptance checks, or sequencing changed.
- [ ] Update `docs/v0/v0-phase0-execution-plan.md` checklist status when Phase 0 workstreams move.
- [ ] Update protocol contract docs (`docs/architecture/v0-spec-outline.md`, `docs/architecture/v0-architecture.md`) when API/envelope/validation contracts change.
- [ ] Update economics docs (`docs/foundation/economic-controls-track.md`, `docs/foundation/economic-protocol-v1.md`) for economics-control behavior changes.
- [ ] Update fixture mapping docs (`docs/v0/v0-scenario-fixture-matrix.md`, `docs/v0/v0-abuse-gaming-test-matrix.md`) when fixtures/tests are added or removed.
- [ ] Update docs index (`docs/index.md`) if a new canonical document is introduced.
- [ ] Update `docs/roadmap/working-context-log.md` with current status/files/verification/next actions.

## Required evidence links in PR or change log

- [ ] test file paths updated (for example `crates/state-engine/tests/*`, `crates/node/tests/*`)
- [ ] fixture paths added/changed under `fixtures/`
- [ ] commands used for verification (`cargo test`, `cargo run --bin cli -- fixtures run`, node API checks)
- [ ] any migration or compatibility note (snapshot format, policy field changes, replay metadata changes)

## Quality gates

- [ ] no roadmap status statement conflicts with `docs/roadmap/progress.md`
- [ ] no open work item marked complete without evidence path
- [ ] docs dates use explicit month/year for status statements
- [ ] deterministic reason codes remain listed when new reject paths are introduced
