# Economic Controls Track (Execution Spec)

This document converts `economic-protocol-v1.md` into implementation-ready slices.

Goal: add anti-financial and P2H-oriented economic controls without breaking deterministic replay, local-first operation, or adminless protocol semantics.

## Track principles

- Changes are **Rust-first** and replay-deterministic.
- All controls are protocol-visible and auditable through state/read APIs.
- No human moderation or operator override paths.
- Roll out as additive slices with backward-compatible migrations.

## EC-1 — Economic Telemetry Baseline

Status: Implemented in current Rust node runtime.

### Objective

Expose measurable economics health signals from current event/state model.

### Implementation

- Add derived metrics output in node replay/state views:
  - completion rate per service lane
  - dispute rate
  - average dispute-resolution duration
  - active-credit concentration (`top_n_share`)
  - issuance vs expiry ratio
  - invalid-event rate by reason code
- Add read endpoint:
  - `GET /state/economics/metrics?as_of=<rfc3339_optional>`
- Add CLI:
  - `node economics metrics --data-dir <path> [--as-of <rfc3339>]`

### Tests

- Unit: metric math determinism, lane grouping, zero-data edge cases.
- Integration: same log + same `as_of` => identical metrics hash.
- API: metadata (`as_of`, `source`, `snapshot_id`) remains consistent.

### Acceptance

- Metrics are reproducible via replay and snapshot-plus-delta.
- No existing endpoint contracts break.

## EC-2 — Issuance Throughput Controls (Policy-Executable)

Status: Implemented in current Rust replay runtime and policy timeline.

### Objective

Limit high-rate scripted issuance without introducing non-determinism.

### Implementation

- Extend policy timeline with deterministic issuance controls:
  - max issuance events per identity per rolling window
  - max issuance per lane per rolling window
  - minimum counterparty diversity threshold for issuance eligibility
- Enforce during replay for issuance-relevant events only.
- EC-2 scope decision: enforce on contribution mints and provider reward issuance paths; buyer refund issuance is not gated in this slice.
- Add stable invalid reason codes for rate/diversity violations.

### Tests

- Unit: rolling window boundaries, lane-specific controls, diversity checks.
- Integration: policy-update boundary behavior before/after `effectiveAt`.
- Regression: older logs replay unchanged when controls are disabled/default.

### Acceptance

- Controls are forward-only via `PolicyUpdate`.
- Violations are deterministic and audit-friendly.

## EC-3 — P2H Risk Scoring (Informational, Non-Blocking)

Status: Implemented in current Rust node read-runtime.

### Objective

Add anti-automation risk scoring as observability first (no hard gating yet).

### Implementation

- Add deterministic `p2h_risk` derived state per identity:
  - repeated bilateral loop intensity
  - counterparty diversity weakness
  - short-cycle dispute/settlement anomalies
  - synchronized attestation clustering indicators
- Add endpoints:
  - `GET /state/economics/p2h/:id`
  - `GET /state/economics/p2h/:id/history`
- Add CLI:
  - `node economics p2h --data-dir <path> --identity <pubkey>`

### Tests

- Unit: each risk component and score composition.
- Integration: known loop-farming fixture produces elevated risk.
- Snapshot equivalence: risk state stable across replay sources.

### Acceptance

- No event validity changes in this slice.
- Risk outputs are deterministic and explainable from public data.

## EC-4 — Optional Soft Gating from P2H + Reputation

Status: Implemented in current Rust replay runtime and policy timeline.

### Objective

Enable policy-controlled soft gating for issuance-sensitive actions.

### Implementation

- Add policy fields for minimum economic eligibility:
  - minimum reputation score bands (global/lane)
  - maximum allowed `p2h_risk` band
- Apply only to mint/settlement issuance paths defined in policy.
- Keep rejects deterministic with dedicated reason code `ERR_ECONOMIC_ELIGIBILITY_VIOLATION`.

### Tests

- Unit: boundary behavior around threshold crossings.
- Integration: same event set with different policy versions yields expected eligibility changes.
- Regression: when thresholds are unset, behavior matches previous phase.

### Acceptance

- Gating is policy-driven and reversible via forward policy updates.
- No manual exception paths.

## EC-5 — Offline/Local Exchange Lane Templates (Constrained)

Status: In progress (Slices 1-65 implemented in current Rust replay/node runtime).

### Objective

Support offline/community exchanges with objective protocol templates.

### Implementation

- Add constrained lane templates with explicit evidence schema:
  - local resource exchange
  - physical handoff acknowledgment with signed dual confirmation
- Keep deterministic timeout and settlement semantics.
- Add lane-specific telemetry in economics metrics.

### Slice 1 implemented scope

- Added template-constrained service lanes:
  - `local-resource-exchange` → requires `deliveryMode=local-community` and `allowedEvidenceFormats=[local-resource-receipt-v1]`
  - `physical-handoff` → requires `deliveryMode=in-person` and `allowedEvidenceFormats=[physical-handoff-ack-dual-v1]`
- Added deterministic evidence checks:
  - `local-resource-receipt-v1` delivery requires at least one artifact hash
  - `physical-handoff-ack-dual-v1` delivery requires at least two artifact hashes
- Added lane-specific offline telemetry to `GET /state/economics/metrics`:
  - `offline_lane_templates[]` with counts by lane/template (`offers`, `orders`, `delivered`, `accepted`, `disputed`, `settled`, `auto_refunded`).

### Slice 2 implemented scope

- Strengthened physical handoff dual-confirmation schema:
  - `physical-handoff-ack-dual-v1` now requires **exactly two distinct** artifact hashes.
  - `notesHash` is required and non-empty.
  - `urls` must be omitted/empty for this offline template.
  - physical-handoff `ServiceAccept.acceptedAt` must not be earlier than delivery time.
- Expanded offline lane telemetry for dispute/abuse observability:
  - per-lane fields now include `unresolved_dispute_count`, `dispute_rate_bps`, `auto_refund_rate_bps`.
  - per-lane invalid-event counters added: total invalids, policy violations, invalid payloads.
  - all available via existing `GET /state/economics/metrics` surface.

### Slice 3 implemented scope

- Hardened offline evidence schemas further:
  - `local-resource-receipt-v1` now requires non-empty `notesHash`.
  - `local-resource-receipt-v1` now requires unique `artifactHashes` values.
  - physical handoff dual-ack rules from Slice 2 remain enforced and covered by reducer-side checks.
- Added deterministic offline lane alert derivation in economics metrics:
  - `OFFLINE_UNRESOLVED_DISPUTES` (warn) when unresolved disputes exist.
  - `OFFLINE_HIGH_AUTO_REFUND_RATE` (warn) on sustained high auto-refund rate.
  - `OFFLINE_INVALID_PAYLOAD_SPIKE` / `OFFLINE_POLICY_VIOLATION_SPIKE` (critical) on repeated invalid attempts.
  - alerts are emitted via `offline_lane_alerts[]` in `GET /state/economics/metrics`.

### Slice 4 implemented scope

- Added policy-tunable offline alert thresholds (via `PolicyUpdate` full snapshots):
  - `offlineAlertUnresolvedDisputeCountThreshold`
  - `offlineAlertAutoRefundRateBpsThreshold`
  - `offlineAlertAutoRefundMinDisputes`
  - `offlineAlertInvalidPayloadCountThreshold`
  - `offlineAlertPolicyViolationCountThreshold`
- Node economics alert generation now uses the **effective policy at `as_of`** instead of fixed constants.
- Added validation guardrails:
  - `offlineAlertAutoRefundRateBpsThreshold` must be in `0..=10000`.
  - threshold value `0` disables the corresponding alert path deterministically.

### Slice 5 implemented scope

- Added lane-specific offline alert policy overrides in `PolicyUpdate` snapshots:
  - `offlineAlertLaneOverrides[]` keyed by `serviceType`
  - optional per-lane overrides for thresholds, minimum disputes, and severities
- Deterministic alert resolution now applies:
  1. effective policy at `as_of`
  2. global offline alert settings
  3. lane override merge for matching `serviceType`
- Added validation guardrails for lane overrides:
  - `offlineAlertLaneOverrides` must be non-empty when provided
  - `serviceType` must be non-empty, offline-template lane, and unique in override list
  - lane `autoRefundRateBpsThreshold` must be in `0..=10000` when provided
- Existing offline alert output contract remains unchanged (`offline_lane_alerts[]`), but values now support per-lane policy tuning without changing reducer semantics.

### Slice 6 implemented scope

- Added policy-tunable offline dispute-rate alert controls:
  - `offlineAlertDisputeRateBpsThreshold`
  - `offlineAlertDisputeRateMinOrders`
  - `offlineAlertDisputeRateSeverity`
- Added lane override support for dispute-rate controls in `offlineAlertLaneOverrides[]`:
  - `disputeRateBpsThreshold`
  - `disputeRateMinOrders`
  - `disputeRateSeverity`
- Added deterministic alert emission:
  - `OFFLINE_HIGH_DISPUTE_RATE` is emitted when lane `dispute_rate_bps` is above threshold and `order_count` meets `minOrders`.
  - threshold `0` disables the dispute-rate alert path.
- Added validation guardrails:
  - global and lane-level dispute-rate thresholds must be in `0..=10000`.

### Slice 7 implemented scope

- Added deterministic offline alert rollup output in economics metrics:
  - `offline_lane_alert_rollup.total_alert_count`
  - `offline_lane_alert_rollup.highest_severity`
  - `offline_lane_alert_rollup.by_severity[]`
  - `offline_lane_alert_rollup.by_code[]`
  - `offline_lane_alert_rollup.affected_service_types[]`
- Rollup semantics are deterministic and replay-safe:
  - `highest_severity` uses strict severity rank (`critical > warn > info`)
  - `by_severity` sorted by severity rank descending
  - `by_code` sorted lexicographically by alert code
  - `affected_service_types` is sorted and deduplicated
- Existing `offline_lane_alerts[]` remains unchanged; rollup is additive for operator visibility and machine-readable alert summarization.

### Slice 8 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic operator/action fields:
  - `action_required` (true when highest severity is `warn` or `critical`)
  - `top_alert_code` (highest-count alert code, deterministic tie-break by code)
  - `service_summaries[]` (per-service alert count, highest severity, and per-code breakdown)
- Deterministic ordering rules:
  - `service_summaries` sorted by `service_type`
  - each summary `by_code` sorted lexicographically
  - `top_alert_code` tie-break is stable (lexicographic)
- Changes are additive read-model upgrades only; no event validity/reducer semantics changed.

### Slice 9 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic machine-coordination fields:
  - `action_level` (`none | watch | intervene`) derived from highest severity rank
  - `deterministic_fingerprint` (SHA-256 over canonical rollup summary rows)
  - `critical_service_types[]` (sorted unique lanes currently carrying critical alerts)
- Deterministic action mapping:
  - `critical` highest severity → `intervene`
  - `warn` highest severity → `watch`
  - `info` or no alerts → `none`
- Fingerprint semantics are replay-safe:
  - computed from stable sorted rollup components
  - same event set + same `as_of` yields identical fingerprint across replay sources.

### Slice 10 implemented scope

- Extended `offline_lane_alert_rollup.service_summaries[]` with deterministic triage fields:
  - `action_required`
  - `action_level` (`none | watch | intervene`)
  - `top_alert_code`
  - `deterministic_fingerprint`
- Added deterministic per-service action mapping:
  - critical service-highest severity → `intervene`
  - warn service-highest severity → `watch`
  - info/no service alerts → `none`
- Added per-service fingerprint semantics:
  - fingerprint derived from service summary stable rows (`service`, `count`, `action`, `highest`, `top`, sorted code counts)
  - same replay input and `as_of` yields same per-service fingerprints across replay sources.

### Slice 11 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic service-distribution fields:
  - `by_action_level[]` (counts of service summaries at `intervene/watch/none`)
  - `top_service_type` (highest alert-count service, deterministic tie-break)
- Deterministic ordering/selection rules:
  - `by_action_level` sorted by action rank (`intervene > watch > none`)
  - `top_service_type` selected by max `alert_count`, tie-broken lexicographically
- Rollup fingerprint now includes action-level distribution and top-service selection, preserving replay-stable monitoring hashes.

### Slice 12 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic service-priority queue output:
  - `prioritized_services[]` entries with `rank`, `service_type`, `alert_count`, `action_level`, `highest_severity`, `top_alert_code`
- Deterministic priority ordering:
  - primary: action level rank (`intervene > watch > none`)
  - secondary: `alert_count` descending
  - tie-break: `service_type` lexicographically
- Added explicit rank assignment (`1..N`) and included priority queue rows in rollup fingerprint input for replay-stable queue contracts.

### Slice 13 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-head metadata:
  - `priority_head_service_type`
  - `priority_head_action_level`
  - `priority_queue_fingerprint`
- Queue-head semantics are deterministic:
  - head derives from the first entry of `prioritized_services[]`
  - empty queue yields `null` head fields
- Added dedicated queue fingerprint semantics:
  - fingerprint is SHA-256 over stable ranked queue rows
  - same replay input + same `as_of` yields identical queue fingerprint across replay sources.

### Slice 14 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-health counters:
  - `priority_queue_size`
  - `priority_queue_health` (`empty | stable | attention | critical`)
  - `priority_queue_intervene_count`
  - `priority_queue_watch_count`
  - `priority_queue_none_count`
- Queue-health semantics are deterministic:
  - `empty` when queue size is `0`
  - `critical` when any prioritized entry is `intervene`
  - `attention` when no `intervene` entries but at least one `watch`
  - `stable` otherwise
- Rollup fingerprint now includes queue-health counters and status for replay-stable health monitoring.

### Slice 15 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-pressure indicators:
  - `priority_queue_actionable_bps`
  - `priority_queue_critical_bps`
  - `priority_queue_load_level` (`idle | light | medium | heavy`)
- Deterministic pressure semantics:
  - `actionable_bps = (intervene + watch) / queue_size`
  - `critical_bps = intervene / queue_size`
  - load level by queue size bands (`0`, `1..2`, `3..5`, `6+`)
- Rollup fingerprint now includes pressure ratios and load-level classification for replay-stable queue-pressure monitoring.

### Slice 16 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-change fingerprint family:
  - `priority_queue_membership_fingerprint`
  - `priority_queue_order_fingerprint`
  - `priority_queue_pressure_fingerprint`
- Deterministic fingerprint semantics:
  - membership fingerprint hashes sorted queue service identities (set-level change detection)
  - order fingerprint hashes ranked service/action rows (ordering change detection)
  - pressure fingerprint hashes queue health/size/counts/ratios/load fields (capacity-pressure change detection)
- Rollup fingerprint now includes all queue-change fingerprints for replay-stable machine diffing across pull cycles and `as_of` views.

### Slice 17 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-dominance and concentration fields:
  - `priority_tail_service_type`
  - `priority_queue_dominant_action_level`
  - `priority_queue_dominant_action_bps`
  - `priority_queue_top_service_alert_share_bps`
- Deterministic dominance semantics:
  - dominant action level resolves from queue action counts (`intervene`, `watch`, `none`) using strict tie-break by action rank
  - empty queue emits `priority_queue_dominant_action_level=empty` and zero bps values
  - top-service share uses `prioritized_services[0].alert_count / total_alert_count`
- Rollup fingerprint now includes dominance/concentration fields so queue pressure and queue concentration changes are both machine-diffable and replay-stable.

### Slice 18 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue concentration metrics:
  - `priority_queue_top2_service_alert_share_bps`
  - `priority_queue_service_concentration_hhi_bps`
  - `priority_queue_concentration_level` (`none | diffuse | balanced | concentrated`)
- Deterministic concentration semantics:
  - top-2 share uses `(top two queue services alert_count sum) / total_alert_count`
  - HHI uses `sum(service_alert_count^2) / total_alert_count^2`, scaled to bps
  - concentration level derives from HHI thresholds with stable boundaries
- Rollup fingerprint now includes concentration fields to keep queue concentration changes replay-stable and machine-diffable.

### Slice 19 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic leader/runner concentration metrics:
  - `priority_queue_leader_alert_share_bps`
  - `priority_queue_runner_up_alert_share_bps`
  - `priority_queue_leader_gap_bps`
- Deterministic concentration semantics:
  - leader/runner ranks are computed by alert count with stable tie-break (`service_type` lexicographic)
  - share values are computed against total alert count at `as_of`
  - leader-gap uses `leader_share - runner_up_share` with deterministic floor at `0`
- Rollup fingerprint now includes leader/runner concentration fields for replay-stable queue concentration diffing.

### Slice 20 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic concentration-diversity fields:
  - `priority_queue_long_tail_alert_share_bps`
  - `priority_queue_effective_service_count_milli`
  - `priority_queue_leader_dominance_level` (`none | balanced | tilted | dominant`)
- Deterministic concentration-diversity semantics:
  - long-tail share uses `10000 - top2_service_alert_share_bps`
  - effective service count uses inverse concentration (`N2`) as `total_alert_count^2 / sum(alert_count^2)`, scaled by `1000`
  - leader dominance level derives from leader-gap thresholds with explicit empty-queue default
- Rollup fingerprint now includes concentration-diversity fields for replay-stable machine comparisons of queue breadth vs concentration.

### Slice 21 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-coverage fields:
  - `priority_queue_coverage_50_count`
  - `priority_queue_coverage_80_count`
  - `priority_queue_coverage_95_count`
  - `priority_queue_coverage_profile` (`none | single | top-heavy | mixed | broad`)
- Deterministic coverage semantics:
  - coverage counts represent minimum ranked service count required to reach each cumulative share target
  - ranked order uses alert-count descending with stable lexicographic tie-break
  - coverage profile derives from the `50/80` coverage counts with explicit empty-queue default
- Rollup fingerprint now includes queue-coverage fields for replay-stable concentration/coverage diffing.

### Slice 22 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic queue-risk orchestration fields:
  - `priority_queue_risk_score_bps`
  - `priority_queue_risk_band` (`none | low | elevated | high | extreme`)
  - `priority_queue_response_sla_seconds`
- Deterministic risk semantics:
  - risk score is a weighted combination of actionable pressure, critical pressure, concentration HHI, and leader gap
  - risk band derives from stable score thresholds with explicit empty-queue behavior
  - response SLA is a deterministic band-to-seconds mapping for automation-friendly triage contracts
- Rollup fingerprint now includes queue-risk fields for replay-stable machine scheduling/alerting diff checks.

### Slice 23 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic distribution-shape fields:
  - `priority_queue_inequality_gini_bps`
  - `priority_queue_evenness_milli`
  - `priority_queue_distribution_profile` (`none | single | balanced | mixed | skewed | polarized`)
- Deterministic distribution semantics:
  - Gini inequality uses pairwise absolute count differences over ranked service alert-counts
  - evenness derives from effective-service-count vs queue size
  - distribution profile derives from queue size + inequality/evenness thresholds with explicit empty/single defaults
- Rollup fingerprint now includes distribution fields for replay-stable queue-shape diffing and automation heuristics.

### Slice 24 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic actionable-mix escalation fields:
  - `priority_queue_actionable_count`
  - `priority_queue_intervene_within_actionable_bps`
  - `priority_queue_watch_within_actionable_bps`
  - `priority_queue_action_escalation_profile` (`idle | watch-led | balanced | intervene-led`)
- Deterministic escalation semantics:
  - actionable count is `intervene_count + watch_count`
  - within-actionable shares are computed only over actionable services (stable zero-default on empty)
  - escalation profile uses strict intervene/watch comparison with explicit idle fallback
- Rollup fingerprint now includes actionable-mix fields for replay-stable escalation-mode diffing.

### Slice 25 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic SLA-pressure adaptation fields:
  - `priority_queue_sla_multiplier_bps`
  - `priority_queue_effective_response_sla_seconds`
  - `priority_queue_sla_slippage_bps`
  - `priority_queue_sla_pressure_profile` (`idle | on-target | stretched | degraded | critical`)
- Deterministic SLA-pressure semantics:
  - SLA multiplier derives from queue load level (`idle/light/medium/heavy`)
  - effective response SLA applies load multiplier to baseline SLA
  - slippage is measured as effective-vs-baseline SLA delta in bps
  - pressure profile derives from actionable presence plus deterministic slippage thresholds
- Rollup fingerprint now includes SLA-pressure fields for replay-stable response-capacity diffing.

### Slice 26 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic weighted-action throughput fields:
  - `priority_queue_action_weighted_units`
  - `priority_queue_action_weighted_pressure_bps`
  - `priority_queue_action_weighted_per_service_milli`
  - `priority_queue_action_weighted_profile` (`idle | passive | steady | active | urgent`)
- Deterministic weighted-throughput semantics:
  - weighted units apply fixed action weights per service (`intervene=3`, `watch=2`, `none=1`)
  - weighted pressure normalizes weighted units against queue-size maximum capacity
  - per-service weighted throughput uses deterministic milli scaling
  - profile derives from queue/actionability context and weighted-pressure thresholds
- Rollup fingerprint now includes weighted-throughput fields for replay-stable operational load-shape diffing.

### Slice 27 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic action-polarization fields:
  - `priority_queue_action_polarization_bps`
  - `priority_queue_action_balance_score_bps`
  - `priority_queue_action_polarization_profile` (`idle | balanced | tilted | polarized`)
- Deterministic polarization semantics:
  - polarization is the absolute `intervene` vs `watch` gap over actionable services
  - balance score is `10000 - polarization` when actionable work exists, otherwise `0`
  - profile derives from stable polarization thresholds with explicit idle behavior
- Rollup fingerprint now includes polarization fields for replay-stable intervention-balance diffing.

### Slice 28 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic SLA-adjusted risk posture fields:
  - `priority_queue_sla_adjusted_risk_bps`
  - `priority_queue_sla_risk_delta_bps`
  - `priority_queue_operational_posture` (`none | nominal | heightened | strained | critical`)
- Deterministic posture semantics:
  - SLA-adjusted risk applies queue load SLA multiplier to base risk score
  - risk delta captures the uplift introduced by SLA pressure
  - operational posture derives from actionable presence plus adjusted-risk thresholds
- Rollup fingerprint now includes posture fields for replay-stable risk-to-operations diffing.

### Slice 29 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic attention-index fields:
  - `priority_queue_attention_index_bps`
  - `priority_queue_attention_delta_bps`
  - `priority_queue_attention_profile` (`idle | calm | engaged | strained | overloaded`)
- Deterministic attention semantics:
  - attention index combines SLA-adjusted risk and weighted-action pressure into one replay-stable bps signal
  - attention delta tracks index divergence from base risk score
  - attention profile derives from actionable presence and index thresholds
- Rollup fingerprint now includes attention fields for replay-stable triage-focus diffing.

### Slice 30 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic readiness fields:
  - `priority_queue_readiness_score_bps`
  - `priority_queue_readiness_delta_bps`
  - `priority_queue_readiness_profile` (`idle | ready | watch | strained | critical`)
- Deterministic readiness semantics:
  - readiness score inversely tracks blended burden from attention index and weighted-action pressure
  - readiness delta captures divergence between readiness score and action balance
  - readiness profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes readiness fields for replay-stable execution-readiness diffing.

### Slice 31 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic stability fields:
  - `priority_queue_stability_index_bps`
  - `priority_queue_stability_delta_bps`
  - `priority_queue_stability_profile` (`idle | stable | monitor | volatile | critical`)
- Deterministic stability semantics:
  - stability index applies a deterministic dampening from readiness by half of attention delta
  - stability delta captures divergence between readiness and stability indices
  - stability profile derives from actionable presence and stable threshold bands
- Rollup fingerprint now includes stability fields for replay-stable execution-stability diffing.

### Slice 32 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic resilience fields:
  - `priority_queue_resilience_score_bps`
  - `priority_queue_resilience_delta_bps`
  - `priority_queue_resilience_profile` (`idle | fragile | recovering | resilient | robust`)
- Deterministic resilience semantics:
  - resilience score blends stability index, action-balance score, and inverse inequality
  - resilience delta captures divergence between resilience and stability indices
  - resilience profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes resilience fields for replay-stable recovery-capacity diffing.

### Slice 33 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic coherence fields:
  - `priority_queue_coherence_score_bps`
  - `priority_queue_coherence_delta_bps`
  - `priority_queue_coherence_profile` (`idle | fragmented | converging | coherent | synchronized`)
- Deterministic coherence semantics:
  - coherence score blends resilience, stability, and readiness into one replay-stable bps signal
  - coherence delta tracks max-spread divergence across the resilience/stability/readiness trio
  - coherence profile derives from actionable presence and stable score/spread thresholds
- Rollup fingerprint now includes coherence fields for replay-stable alignment-capacity diffing.

### Slice 34 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic adaptability fields:
  - `priority_queue_adaptability_score_bps`
  - `priority_queue_adaptability_delta_bps`
  - `priority_queue_adaptability_profile` (`idle | rigid | constrained | adaptive | fluid`)
- Deterministic adaptability semantics:
  - adaptability score blends coherence, evenness-derived diversity signal, and inverse critical-pressure signal
  - adaptability delta captures divergence between adaptability and coherence indices
  - adaptability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes adaptability fields for replay-stable flexibility-capacity diffing.

### Slice 35 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic sustainability fields:
  - `priority_queue_sustainability_score_bps`
  - `priority_queue_sustainability_delta_bps`
  - `priority_queue_sustainability_profile` (`idle | brittle | stressed | steady | enduring`)
- Deterministic sustainability semantics:
  - sustainability score blends adaptability, inverse coherence-spread, and inverse attention-load signals
  - sustainability delta captures divergence between sustainability and adaptability indices
  - sustainability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes sustainability fields for replay-stable endurance-capacity diffing.

### Slice 36 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic continuity fields:
  - `priority_queue_continuity_score_bps`
  - `priority_queue_continuity_delta_bps`
  - `priority_queue_continuity_profile` (`idle | fragile | holding | durable | seamless`)
- Deterministic continuity semantics:
  - continuity score blends sustainability, inverse SLA-slippage, and inverse leader-gap concentration signals
  - continuity delta captures divergence between continuity and sustainability indices
  - continuity profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes continuity fields for replay-stable service-continuity diffing.

### Slice 37 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic recoverability fields:
  - `priority_queue_recoverability_score_bps`
  - `priority_queue_recoverability_delta_bps`
  - `priority_queue_recoverability_profile` (`idle | depleted | repairing | recoverable | elastic`)
- Deterministic recoverability semantics:
  - recoverability score blends continuity, action-balance, and inverse attention-load signals
  - recoverability delta captures divergence between recoverability and continuity indices
  - recoverability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes recoverability fields for replay-stable repair-capacity diffing.

### Slice 38 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic regeneration fields:
  - `priority_queue_regeneration_score_bps`
  - `priority_queue_regeneration_delta_bps`
  - `priority_queue_regeneration_profile` (`idle | exhausted | rebuilding | renewing | regenerative`)
- Deterministic regeneration semantics:
  - regeneration score blends recoverability, sustainability, and inverse critical-pressure signals
  - regeneration delta captures divergence between regeneration and recoverability indices
  - regeneration profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes regeneration fields for replay-stable renewal-capacity diffing.

### Slice 39 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic restoration fields:
  - `priority_queue_restoration_score_bps`
  - `priority_queue_restoration_delta_bps`
  - `priority_queue_restoration_profile` (`idle | drained | repairing | restoring | restored`)
- Deterministic restoration semantics:
  - restoration score blends regeneration, continuity, and inverse weighted-action-pressure signals
  - restoration delta captures divergence between restoration and regeneration indices
  - restoration profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes restoration fields for replay-stable restoration-capacity diffing.

### Slice 40 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic stewardship fields:
  - `priority_queue_stewardship_score_bps`
  - `priority_queue_stewardship_delta_bps`
  - `priority_queue_stewardship_profile` (`idle | neglected | guarded | stewarding | custodial`)
- Deterministic stewardship semantics:
  - stewardship score blends restoration, recoverability, and inverse SLA-adjusted-risk signals
  - stewardship delta captures divergence between stewardship and restoration indices
  - stewardship profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes stewardship fields for replay-stable governance-capacity diffing.

### Slice 41 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic guardianship fields:
  - `priority_queue_guardianship_score_bps`
  - `priority_queue_guardianship_delta_bps`
  - `priority_queue_guardianship_profile` (`idle | exposed | watchful | protective | hardened`)
- Deterministic guardianship semantics:
  - guardianship score blends stewardship, restoration, and inverse leader-gap concentration signals
  - guardianship delta captures divergence between guardianship and stewardship indices
  - guardianship profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes guardianship fields for replay-stable protection-capacity diffing.

### Slice 42 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic assurance fields:
  - `priority_queue_assurance_score_bps`
  - `priority_queue_assurance_delta_bps`
  - `priority_queue_assurance_profile` (`idle | fragile | stabilizing | assured | fortified`)
- Deterministic assurance semantics:
  - assurance score blends guardianship, stewardship, and inverse SLA-risk-delta signals
  - assurance delta captures divergence between assurance and guardianship indices
  - assurance profile derives from actionable presence plus stable score/delta thresholds
- Rollup fingerprint now includes assurance fields for replay-stable confidence-capacity diffing.

### Slice 43 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic vigilance fields:
  - `priority_queue_vigilance_score_bps`
  - `priority_queue_vigilance_delta_bps`
  - `priority_queue_vigilance_profile` (`idle | lapse | monitoring | vigilant | sentinel`)
- Deterministic vigilance semantics:
  - vigilance score blends assurance, guardianship, and inverse action-polarization signals
  - vigilance delta captures divergence between vigilance and assurance indices
  - vigilance profile derives from actionable presence plus stable score/delta thresholds
- Rollup fingerprint now includes vigilance fields for replay-stable vigilance-capacity diffing.

### Slice 44 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic oversight fields:
  - `priority_queue_oversight_score_bps`
  - `priority_queue_oversight_delta_bps`
  - `priority_queue_oversight_profile` (`idle | narrow | partial | attentive | comprehensive`)
- Deterministic oversight semantics:
  - oversight score blends vigilance, assurance, and inverse concentration (HHI) signals
  - oversight delta captures divergence between oversight and vigilance indices
  - oversight profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes oversight fields for replay-stable oversight-capacity diffing.

### Slice 45 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic accountability fields:
  - `priority_queue_accountability_score_bps`
  - `priority_queue_accountability_delta_bps`
  - `priority_queue_accountability_profile` (`idle | opaque | emerging | answerable | auditable`)
- Deterministic accountability semantics:
  - accountability score blends vigilance, assurance, and inverse concentration (HHI) signals
  - accountability delta captures divergence between accountability and vigilance indices
  - accountability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes accountability fields for replay-stable accountability-capacity diffing.

### Slice 46 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic verifiability fields:
  - `priority_queue_verifiability_score_bps`
  - `priority_queue_verifiability_delta_bps`
  - `priority_queue_verifiability_profile` (`idle | uncertain | reviewable | traceable | provable`)
- Deterministic verifiability semantics:
  - verifiability score blends accountability, oversight, and inverse SLA-risk-delta signals
  - verifiability delta captures divergence between verifiability and accountability indices
  - verifiability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes verifiability fields for replay-stable verifiability-capacity diffing.

### Slice 47 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic auditability fields:
  - `priority_queue_auditability_score_bps`
  - `priority_queue_auditability_delta_bps`
  - `priority_queue_auditability_profile` (`idle | opaque | inspectable | auditable | forensic`)
- Deterministic auditability semantics:
  - auditability score blends verifiability, accountability, and inverse coherence-spread signals
  - auditability delta captures divergence between auditability and verifiability indices
  - auditability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes auditability fields for replay-stable auditability-capacity diffing.

### Slice 48 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic transparency fields:
  - `priority_queue_transparency_score_bps`
  - `priority_queue_transparency_delta_bps`
  - `priority_queue_transparency_profile` (`idle | obscured | visible | transparent | glassbox`)
- Deterministic transparency semantics:
  - transparency score blends auditability, verifiability, and inverse inequality (gini) signals
  - transparency delta captures divergence between transparency and auditability indices
  - transparency profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes transparency fields for replay-stable transparency-capacity diffing.

### Slice 49 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic legibility fields:
  - `priority_queue_legibility_score_bps`
  - `priority_queue_legibility_delta_bps`
  - `priority_queue_legibility_profile` (`idle | murky | readable | legible | crystal`)
- Deterministic legibility semantics:
  - legibility score blends transparency, auditability, and evenness-derived signal
  - legibility delta captures divergence between legibility and transparency indices
  - legibility profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes legibility fields for replay-stable legibility-capacity diffing.

### Slice 50 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic navigability fields:
  - `priority_queue_navigability_score_bps`
  - `priority_queue_navigability_delta_bps`
  - `priority_queue_navigability_profile` (`idle | labyrinth | guided | navigable | frictionless`)
- Deterministic navigability semantics:
  - navigability score blends legibility, readiness, and inverse leader-gap signals
  - navigability delta captures divergence between navigability and legibility indices
  - navigability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes navigability fields for replay-stable navigability-capacity diffing.

### Slice 51 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic interpretability fields:
  - `priority_queue_interpretability_score_bps`
  - `priority_queue_interpretability_delta_bps`
  - `priority_queue_interpretability_profile` (`idle | opaque | decodable | interpretable | self-evident`)
- Deterministic interpretability semantics:
  - interpretability score blends navigability, transparency, and inverse coherence-spread signals
  - interpretability delta captures divergence between interpretability and navigability indices
  - interpretability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes interpretability fields for replay-stable interpretability-capacity diffing.

### Slice 52 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic explainability fields:
  - `priority_queue_explainability_score_bps`
  - `priority_queue_explainability_delta_bps`
  - `priority_queue_explainability_profile` (`idle | opaque | decipherable | explainable | lucid`)
- Deterministic explainability semantics:
  - explainability score blends interpretability, legibility, and inverse action-polarization signals
  - explainability delta captures divergence between explainability and interpretability indices
  - explainability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes explainability fields for replay-stable explainability-capacity diffing.

### Slice 53 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic clarity fields:
  - `priority_queue_clarity_score_bps`
  - `priority_queue_clarity_delta_bps`
  - `priority_queue_clarity_profile` (`idle | blurred | readable | clear | crystalline`)
- Deterministic clarity semantics:
  - clarity score blends explainability, interpretability, and inverse coherence-spread signals
  - clarity delta captures divergence between clarity and explainability indices
  - clarity profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes clarity fields for replay-stable clarity-capacity diffing.

### Slice 54 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic comprehensibility fields:
  - `priority_queue_comprehensibility_score_bps`
  - `priority_queue_comprehensibility_delta_bps`
  - `priority_queue_comprehensibility_profile` (`idle | obscure | digestible | comprehensible | intuitive`)
- Deterministic comprehensibility semantics:
  - comprehensibility score blends clarity, explainability, and inverse attention-delta signals
  - comprehensibility delta captures divergence between comprehensibility and clarity indices
  - comprehensibility profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes comprehensibility fields for replay-stable comprehensibility-capacity diffing.

### Slice 55 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic intelligibility fields:
  - `priority_queue_intelligibility_score_bps`
  - `priority_queue_intelligibility_delta_bps`
  - `priority_queue_intelligibility_profile` (`idle | cryptic | understandable | intelligible | self-describing`)
- Deterministic intelligibility semantics:
  - intelligibility score blends comprehensibility, clarity, and inverse attention-index signals
  - intelligibility delta captures divergence between intelligibility and comprehensibility indices
  - intelligibility profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes intelligibility fields for replay-stable intelligibility-capacity diffing.

### Slice 56 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic communicability fields:
  - `priority_queue_communicability_score_bps`
  - `priority_queue_communicability_delta_bps`
  - `priority_queue_communicability_profile` (`idle | garbled | conveyable | communicative | broadcast`)
- Deterministic communicability semantics:
  - communicability score blends intelligibility, comprehensibility, and inverse SLA-risk-delta signals
  - communicability delta captures divergence between communicability and intelligibility indices
  - communicability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes communicability fields for replay-stable communicability-capacity diffing.

### Slice 57 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic articulability fields:
  - `priority_queue_articulability_score_bps`
  - `priority_queue_articulability_delta_bps`
  - `priority_queue_articulability_profile` (`idle | muffled | expressible | articulate | resonant`)
- Deterministic articulability semantics:
  - articulability score blends communicability, intelligibility, and inverse action-polarization signals
  - articulability delta captures divergence between articulability and communicability indices
  - articulability profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes articulability fields for replay-stable articulability-capacity diffing.

### Slice 58 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic expressivity fields:
  - `priority_queue_expressivity_score_bps`
  - `priority_queue_expressivity_delta_bps`
  - `priority_queue_expressivity_profile` (`idle | muted | expressible | expressive | vivid`)
- Deterministic expressivity semantics:
  - expressivity score blends articulability, communicability, and inverse inequality (gini) signals
  - expressivity delta captures divergence between expressivity and articulability indices
  - expressivity profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes expressivity fields for replay-stable expressivity-capacity diffing.

### Slice 59 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic eloquence fields:
  - `priority_queue_eloquence_score_bps`
  - `priority_queue_eloquence_delta_bps`
  - `priority_queue_eloquence_profile` (`idle | tangled | coherent | fluent | eloquent`)
- Deterministic eloquence semantics:
  - eloquence score blends expressivity, articulability, and inverse attention-delta signals
  - eloquence delta captures divergence between eloquence and expressivity indices
  - eloquence profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes eloquence fields for replay-stable eloquence-capacity diffing.

### Slice 60 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic lucidity fields:
  - `priority_queue_lucidity_score_bps`
  - `priority_queue_lucidity_delta_bps`
  - `priority_queue_lucidity_profile` (`idle | hazy | legible | lucid | radiant`)
- Deterministic lucidity semantics:
  - lucidity score blends eloquence, intelligibility, and inverse action-polarization signals
  - lucidity delta captures divergence between lucidity and eloquence indices
  - lucidity profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes lucidity fields for replay-stable lucidity-capacity diffing.

### Slice 61 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic illumination fields:
  - `priority_queue_illumination_score_bps`
  - `priority_queue_illumination_delta_bps`
  - `priority_queue_illumination_profile` (`idle | dim | visible | bright | brilliant`)
- Deterministic illumination semantics:
  - illumination score blends lucidity, transparency, and inverse attention-index signals
  - illumination delta captures divergence between illumination and lucidity indices
  - illumination profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes illumination fields for replay-stable illumination-capacity diffing.

### Slice 62 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic clarion fields:
  - `priority_queue_clarion_score_bps`
  - `priority_queue_clarion_delta_bps`
  - `priority_queue_clarion_profile` (`idle | faint | audible | glowing | beacon`)
- Deterministic clarion semantics:
  - clarion score blends illumination, eloquence, and inverse attention-delta signals
  - clarion delta captures divergence between clarion and illumination indices
  - clarion profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes clarion fields for replay-stable clarion-capacity diffing.

### Slice 63 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic resonance fields:
  - `priority_queue_resonance_score_bps`
  - `priority_queue_resonance_delta_bps`
  - `priority_queue_resonance_profile` (`idle | muffled | audible | resonant | sonorous`)
- Deterministic resonance semantics:
  - resonance score blends clarion, communicability, and inverse SLA-risk-delta signals
  - resonance delta captures divergence between resonance and clarion indices
  - resonance profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes resonance fields for replay-stable resonance-capacity diffing.

### Slice 64 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic cadence fields:
  - `priority_queue_cadence_score_bps`
  - `priority_queue_cadence_delta_bps`
  - `priority_queue_cadence_profile` (`idle | flat | rhythmic | cadenced | orchestral`)
- Deterministic cadence semantics:
  - cadence score blends resonance, eloquence, and inverse attention-delta signals
  - cadence delta captures divergence between cadence and resonance indices
  - cadence profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes cadence fields for replay-stable cadence-capacity diffing.

### Slice 65 implemented scope

- Extended `offline_lane_alert_rollup` with deterministic harmony fields:
  - `priority_queue_harmony_score_bps`
  - `priority_queue_harmony_delta_bps`
  - `priority_queue_harmony_profile` (`idle | discordant | aligned | harmonic | symphonic`)
- Deterministic harmony semantics:
  - harmony score blends cadence, resonance, and communicability signals
  - harmony delta captures divergence between harmony and cadence indices
  - harmony profile derives from actionable presence and stable score thresholds
- Rollup fingerprint now includes harmony fields for replay-stable harmony-capacity diffing.

### Tests

- Unit: template payload validation.
- Integration: happy path + timeout path + mismatch rejection.
- Security regression: no bypass of non-transferability/decay constraints.

### Acceptance

- Offline lanes remain protocol-auditable.
- No introduction of human arbitration dependencies.

## Cross-cutting implementation rules

- Keep credits non-transferable, non-inheritable, and decaying.
- Preserve existing replay metadata contract.
- Prefer additive migrations and backward-compatible defaults.
- Every new reject path must have stable invalid reason code coverage.

## Recommended execution order

1. EC-1 (metrics baseline)
2. EC-2 (issuance throughput controls)
3. EC-3 (P2H risk observability)
4. EC-4 (optional soft gating)
5. EC-5 (offline lane templates)

This order gives visibility first, then enforcement, then expansion.

