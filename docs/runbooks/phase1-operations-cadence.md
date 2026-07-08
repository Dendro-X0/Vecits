# Phase 1 Operations Cadence

Purpose: define a repeatable closed-alpha operations rhythm after Phase 0 gate closure.

Last updated: April 8, 2026

## Daily/Per-change checks

- `npm run v1:preflight`
- `npm run v1:readiness` when SDK/Web changes or onboarding/discovery behavior changes
- `npm run v1:lane-fixtures` when lane fixtures, discovery links, lane-bundle launchers, or compute-job template behavior changes
- `cargo test -p node --test api` for node API behavior changes
- review latest `target/tmp/preflight-<timestamp>/preflight-summary.json` for gate status and failures
- review web shell `Phase 1 Operations` panel history/triage output against latest summary artifacts
- review web shell `Evidence Exports` subsection for manifest/prune-plan status and command outputs
- review `lane fixtures` status in `Evidence Exports` and rerun `npm run v1:lane-fixtures` when lane-bundle coverage changed or shows a failed/stale targeted run
- review latest lane-fixture run list in `Recent Run History` when investigating lane-bundle regressions or stale targeted coverage
- treat stale-but-passing lane-fixture coverage as `attention` in the readiness checklist; rerun `npm run v1:lane-fixtures` before treating lane coverage as current again
- use the dedicated `Lane Fixture Stale Rollup` command block when lane-fixture coverage is stale; it now centralizes rerun and summary-inspection commands in the checklist area
- use `Recent Run History` anchors (`preflight`, `GA6`, `lane fixtures`) to jump directly to the relevant run subsection during triage instead of scanning the mixed list manually
- use the `history focus` filter in `Recent Run History` when you want to isolate only lane-fixture runs (or only preflight / GA6 runs) during targeted review
- use `history_focus=lane-fixtures` for targeted lane-bundle review during larger sessions instead of scanning the mixed run list
- use the collapsible lane-fixture subsection in `Recent Run History` for day-to-day scans, and switch to `history_focus=lane-fixtures` when you want the dedicated focused view
- use each lane-fixture row's `Actions` block for run-specific follow-up (`Inspect this summary`, rerun checks, or run the readiness variant) without leaving the subsection
- use the same row-level `Actions` pattern in preflight and GA6 history when you need to inspect a specific run summary or rerun only that workflow from the history section
- if Evidence Exports shows stale-refresh warnings, regenerate exports before recording weekly evidence (`npm run v1:evidence-manifest`, `npm run v1:artifact-prune-plan`)
- regenerate export-audit cleanup plan (`npm run v1:export-audit-log-plan`) before weekly evidence review
- run `npm run v1:export-audit-log-plan:smoke` when retention-policy or planner apply-mode behavior changes
- use Evidence Exports `Run Now` controls for allowlisted export refresh commands when operating from the web shell
- use the same allowlisted `Run Now` flow for `npm run v1:lane-fixtures` when lane-fixture status needs a fresh targeted rerun from the operations panel
- use in-panel refresh workflow controls after export regeneration to reload current artifact status before recording evidence
- review Evidence Exports `Export Execution Audit` rows after each in-panel run and capture failures with artifact-path hints in incident notes
- read the `Allowlisted Execution Audit` section as covering both export refreshes and lane-fixture reruns launched from the panel
- when lane-fixture runs are launched from the panel, use the audit row artifact hints to jump directly to the latest `lane-fixture-check-summary.json` path
- use the `lane fixture audit` summary line inside `Allowlisted Execution Audit` as the fastest scan for recent panel-triggered lane-fixture activity before reading the full audit row list
- in the allowlisted audit summary, prefer the compact `latest artifacts` hint first; it now shows the primary path and collapses any extra paths into a `(+N more)` suffix
- use the compact path display in the operations panel for quick scanning, and hover or inspect the underlying artifact/run path only when exact absolute paths are needed
- for long single-line commands in operations command blocks, rely on the compact preview for scanning and use copy/run actions when you need the full command text verbatim
- use the per-block `Show Full Commands` toggle when a command group needs full inline inspection; switch back to `Compact Commands` to restore the denser review view
- expect some of the densest operations blocks to start collapsed by default; open them only when you actually need those command sets during triage
- review `Export Execution Audit` per-action rollups and resolve any latest-failure alert before weekly evidence recording
- review `Export Audit Log Cleanup Plan` summary and apply cleanup only after confirming archive and policy settings
- review `Closed-Alpha UX Readiness Focus` checklist in panel and resolve non-pass onboarding/discovery/evidence signals before weekly review
- use checklist-row targeted triage commands for non-pass `Closed-Alpha UX Readiness Focus` items before falling back to generic triage list
- use checklist-row deep links for non-pass items to jump directly to onboarding/discovery/execution surfaces (`#onboarding-wizard`, `/explorer/discovery`, `#ops-evidence-exports`, `#ops-failure-triage`)
- use checklist-row command-tool blocks to copy commands (and run allowlisted actions where available) directly from non-pass rows
- use checklist-row age badges (`<=24h`, `>24h`, `>7d`, `unknown`) to prioritize stale-but-passing rows before weekly evidence capture
- use checklist quick filters (`all`, `non-pass only`, `stale only`, `stale + non-pass`, `critical stale only`) to narrow review scope during incident triage windows
- use checklist row shortcuts after applying a filter; shortcut links now preserve active `focus_filter` context for repeatable triage navigation
- use checklist `why stale` hints to distinguish run-age staleness from export-artifact staleness before rerunning commands
- use evidence-freshness row severity rollup (`ok`/`watch`/`critical`) to prioritize export regeneration urgency
- use runbook preset triage links (`non-pass`, `stale`, `stale + non-pass`, `critical stale`) for direct entry into focused checklist views
- use checklist view-link copy controls to share exact filtered triage URLs during async handoff
- use stale-impact status counters (`pass/attention/fail`) to prioritize stale failures before stale passes
- when `critical stale only` is active, use the urgent triage command rollup block before row-by-row command execution
- review critical-stale rollup impact summary (`unique commands`, `runnable actions`) to scope remediation effort before execution
- execute critical-stale rollup commands in listed order (runnable actions first, then alphabetical copy commands)
- use rollup row-origin labels (`[from: ...]`) to map each urgent command back to contributing checklist rows during incident notes
- execute grouped critical-stale command sections in order: `Runnable` first, then `Copy-Only`
- in incident mode, use `copy-only group: hide` toggle to reduce noise while executing runnable urgent commands
- for async incident handoff, use critical-stale shared links that include `critical_copy=hide` to preserve runnable-only view
- capture the `copy-only visibility: shown/hidden` badge state in screenshots when sharing critical-stale triage context
- treat the critical-stale no-non-pass warning as a stale-evidence reminder; refresh exports before marking incident state clear
- use the `Critical Stale Urgent Sequence` command block in order: refresh exports -> rerun readiness -> verify GA6 parity
- use the inline `share this incident view` link in critical-stale mode when handing off the exact current incident context
- use `Critical Stale Incident Share Links` to copy the current or hidden-copy incident URL directly from the urgent section
- prefer the inline incident-share entry marked with the active `critical_copy` mode when handing off the current live view
- use the alternate inline incident-share entry only as an explicit fallback preset; it now maps to the opposite `critical_copy` mode
- include the inline `incident mode` summary line in screenshots so filter and copy-only state are visible together
- use the inline incident-share copy labels/title when pasting links into handoff notes, since they now embed current mode context
- prefer the visible `recommended handoff link` in critical-stale mode when sharing the current live incident view
- use the dedicated `Recommended Handoff Link` control to copy the preferred current incident URL without scanning the broader share-control block
- treat the `Recommended Handoff Link` line/control marked `active` as the preferred current-share handoff path; use the broader incident-share block only for alternate presets
- treat `Critical Stale Incident Share Links` and `share this incident view` entries marked `fallback` as alternate presets, not the default handoff path
- include the handoff hierarchy line in screenshots or async notes when clarifying which critical-stale link is preferred versus fallback
- rely on the `Critical Stale Incident Share Links` title text when screenshots crop out the separate hierarchy line; it now repeats the active-vs-fallback handoff structure
- rely on the `Recommended Handoff Link` title text when the preferred-share block is viewed in isolation; it now repeats that this control is the active recommended current-share path
- follow the helper line beneath `Recommended Handoff Link`: use the fallback share block only when an alternate preset is intentionally required
- follow the helper line beside the fallback share block: those links are alternate presets and should not replace the default current-share handoff path unless intentionally selected
- rely on the shared-note line when only one side of the handoff area is visible; it confirms the recommended-side and fallback-side guidance are intentionally aligned
- use the `[recommended]` and `[fallback]` title tokens as the fastest scan cue when helper lines are hidden, collapsed, or cropped out
- use the same `[recommended]` and `[fallback]` tokens on the visible URL paragraphs when the command blocks themselves are not in view
- use the inline legend key when handing off screenshots or notes to operators who may not know the share-area token meanings yet
- rely on the copied-link note when pasting links into tickets or chat; copy labels preserve the token meanings outside the page
- rely on the alignment note when comparing visible URLs with copy controls; both paths intentionally use the same `[recommended]` and `[fallback]` semantics
- rely on the current-context note when choosing between recommended and fallback links; they target the same incident state and differ only in handoff framing
- use the fallback-preference note when you intentionally need alternate sharing semantics, such as the copy-only-hidden incident preset
- use the recommended-preference note when no alternate preset is needed; the default handoff should remain on the recommended current-share path
- review stale/pinned/prune indicators in web shell `Phase 1 Operations` panel and pin any audit-relevant runs before cleanup
- add optional incident note/tag markers (`OPERATIONS_NOTE.txt`, `INCIDENT_TAGS.txt`) for non-routine runs before archival or cleanup
- update `docs/roadmap/working-context-log.md` with command results and artifact paths

## Weekly checks

- `npm run v1:ga6-drill` (runbook automation wrapper)
- `npm run v1:lane-fixtures` after batching non-software lane fixture or launcher changes
- `npm run v1:evidence-manifest` (deterministic operations evidence snapshot)
- `npm run v1:artifact-prune-plan` (policy-bounded cleanup candidate planning; no deletion)
- `npm run v1:export-audit-log-plan` (policy-bounded audit-log retention/rotation planning)
- review latest `target/tmp/runbook-dryrun-<timestamp>/ga6-drill-summary.json`
- review latest `target/tmp/operations-evidence-manifest.json`
- review latest `target/tmp/operations-artifact-prune-plan.json`
- confirm lane-fixture prune counts/commands in the artifact prune plan now that lane-fixture runs participate in cleanup planning
- review latest `target/tmp/operations-export-audit-log-plan.json`
- `cargo test -p node --test sync`
- `cargo test -p state-engine`
- refresh roadmap/progress/status docs if gates or evidence mappings changed

## Cadence record requirements

For each weekly cycle, record:

- run date and operator
- `v1:preflight` / `v1:readiness` outcomes and latest preflight summary path
- `v1:lane-fixtures` outcome and latest lane-fixture summary path when lane-fixture coverage was exercised that cycle
- GA6 drill summary artifact path
- evidence manifest artifact path
- artifact prune plan path
- export-audit cleanup plan artifact path
- any gate regressions or flaky behavior
- follow-up fix references (tests/docs/commits)
