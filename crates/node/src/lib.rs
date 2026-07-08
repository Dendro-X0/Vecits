mod event_log_chain;
mod ingest_rate_limit;
mod server;
mod storage;

pub use ingest_rate_limit::{IngestRateLimitConfig, IngestRateLimitView};

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::sync::Semaphore;
use url::Url;

use policy::{Policy, default_policy};
use protocol_core::{
    EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1, EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1,
    InvalidReasonCode, PROTOCOL_VERSION, SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE,
    SERVICE_TYPE_PHYSICAL_HANDOFF, canonicalize_value, is_node_ingest_supported_kind_name,
    is_replay_supported_kind_name, offline_template_for_service_type,
    reason_code_for_protocol_error, parse_raw_envelope_loose_str, parse_timestamp,
    verify_envelope_signature, verify_event,
};
use state_engine::{
    OrderState, PolicyState, PolicyUpdateState, ReplayCheckpoint, ReplayInputLine, ReplayOutput,
    ReplayRunOutput, ReputationHistoryEntry, ReputationState, replay_jsonl_as_of,
    replay_jsonl_resume_as_of,
};
use storage::{DbInspectStats, EventListQuery, EventRow, PeerSyncStateRow, SnapshotRow};

pub use server::{build_router, serve};
pub use storage::DbInspectStats as NodeDbInspectStats;

pub const NODE_MANIFEST_SCHEMA_VERSION: &str = "node-manifest-v1";
pub const CURRENT_SNAPSHOT_FORMAT_VERSION: i64 = 5;
pub const REPLAY_ENGINE_NAME: &str = "state-engine";

const DISCOVERY_ALPHA_INITIAL_SERVICE_TYPES: &[&str] = &[
    "software-fixes",
    "feature-work",
    "documentation",
    "translation",
    "testing",
    "research",
    "project-maintenance",
];

fn default_snapshot_format_version() -> i64 {
    1
}

fn default_sync_limit() -> usize {
    200
}

fn default_sync_max_pages() -> usize {
    100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestResult {
    pub accepted: bool,
    #[serde(default)]
    pub already_present: bool,
    pub event_id: Option<String>,
    pub code: Option<InvalidReasonCode>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchIngestResult {
    pub accepted_count: usize,
    pub rejected_count: usize,
    pub results: Vec<IngestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NodeManifest {
    pub schema_version: String,
    pub created_at: String,
    pub kernel: KernelVersionInfo,
    #[serde(default)]
    pub event_log_hash_chain_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KernelVersionInfo {
    pub node_version: String,
    pub protocol_version: String,
    pub replay_engine: String,
    pub replay_engine_version: String,
    pub sqlite_schema_version: String,
    pub snapshot_format_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HealthResponse {
    pub status: String,
    pub kernel: KernelVersionInfo,
    pub data_dir: DataDirHealth,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DataDirHealth {
    pub path: String,
    pub events_log_exists: bool,
    pub database_exists: bool,
    pub manifest_exists: bool,
    pub event_count: i64,
    pub invalid_event_count: i64,
    pub snapshot_count: i64,
    pub latest_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NodeInitResult {
    pub initialized: bool,
    pub already_initialized: bool,
    pub data_dir: String,
    pub manifest: NodeManifest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMeta {
    pub snapshot_id: String,
    pub as_of: String,
    pub event_seq: i64,
    pub state_hash: String,
    pub created_at: String,
    #[serde(default = "default_snapshot_format_version")]
    pub format_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotDocument {
    pub meta: SnapshotMeta,
    pub state: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub checkpoint: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventsPage {
    pub events: Vec<EventRow>,
    pub next_cursor: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: ReplayOutput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyTimelinePage {
    pub updates: Vec<PolicyUpdateState>,
    pub next_cursor: Option<usize>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyStateView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: PolicyState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyTimelineView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: PolicyTimelinePage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationStateView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<ReputationState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationHistoryPage {
    pub entries: Vec<ReputationHistoryEntry>,
    pub next_cursor: Option<usize>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationHistoryView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: ReputationHistoryPage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryOfferRow {
    pub offer_id: String,
    pub provider_pub_key: String,
    pub service_type: String,
    pub status: String,
    pub price_per_unit_credits: u64,
    pub offer_expires_at: String,
    pub global_score: i64,
    pub lane_score: i64,
    pub discovery_score: i64,
    pub created_event_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryPage {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lane_filter: Option<String>,
    pub effective_lane_filter: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_score_filter: Option<i64>,
    pub alpha_defaults_enabled: bool,
    pub alpha_initial_service_types: Vec<String>,
    pub policy_effective_version: String,
    pub policy_allowed_service_types: Vec<String>,
    pub ranking_formula: String,
    pub offers: Vec<DiscoveryOfferRow>,
    pub next_cursor: Option<usize>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: DiscoveryPage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParticipantOrderRole {
    Any,
    Buyer,
    Provider,
}

impl ParticipantOrderRole {
    fn as_str(self) -> &'static str {
        match self {
            Self::Any => "any",
            Self::Buyer => "buyer",
            Self::Provider => "provider",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantOrderRow {
    pub order_id: String,
    pub offer_id: String,
    pub provider_pub_key: String,
    pub buyer_pub_key: String,
    pub order_expires_at: String,
    pub milestone_ids: Vec<String>,
    pub status: String,
    pub created_event_id: String,
    pub service_type: String,
    pub participant_role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantOrdersPage {
    pub participant_pub_key: String,
    pub role_filter: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status_filter: Option<String>,
    pub orders: Vec<ParticipantOrderRow>,
    pub next_cursor: Option<usize>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantOrdersView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: ParticipantOrdersPage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaneEconomicsMetric {
    pub service_type: String,
    pub milestone_count: u64,
    pub terminal_count: u64,
    pub completed_count: u64,
    pub completion_rate_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneTelemetryMetric {
    pub service_type: String,
    pub template: String,
    pub offer_count: u64,
    pub order_count: u64,
    pub delivered_count: u64,
    pub accepted_count: u64,
    pub disputed_count: u64,
    pub settled_count: u64,
    pub auto_refunded_count: u64,
    pub unresolved_dispute_count: u64,
    pub dispute_rate_bps: u64,
    pub auto_refund_rate_bps: u64,
    pub invalid_event_count: u64,
    pub invalid_policy_violation_count: u64,
    pub invalid_payload_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlert {
    pub service_type: String,
    pub template: String,
    pub alert_code: String,
    pub severity: String,
    pub value: u64,
    pub threshold: u64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlertSeverityCount {
    pub severity: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlertCodeCount {
    pub alert_code: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlertActionLevelCount {
    pub action_level: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlertServiceSummary {
    pub service_type: String,
    pub alert_count: u64,
    pub action_required: bool,
    pub action_level: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub highest_severity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_alert_code: Option<String>,
    pub deterministic_fingerprint: String,
    pub by_code: Vec<OfflineLaneAlertCodeCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlertPriorityEntry {
    pub rank: u64,
    pub service_type: String,
    pub alert_count: u64,
    pub action_level: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub highest_severity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_alert_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineLaneAlertRollup {
    pub total_alert_count: u64,
    pub action_required: bool,
    pub action_level: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub highest_severity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_alert_code: Option<String>,
    pub deterministic_fingerprint: String,
    pub priority_queue_fingerprint: String,
    pub priority_queue_membership_fingerprint: String,
    pub priority_queue_order_fingerprint: String,
    pub priority_queue_pressure_fingerprint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority_head_service_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority_head_action_level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority_tail_service_type: Option<String>,
    pub priority_queue_size: u64,
    pub priority_queue_health: String,
    pub priority_queue_intervene_count: u64,
    pub priority_queue_watch_count: u64,
    pub priority_queue_none_count: u64,
    pub priority_queue_actionable_count: u64,
    pub priority_queue_intervene_within_actionable_bps: u64,
    pub priority_queue_watch_within_actionable_bps: u64,
    pub priority_queue_action_escalation_profile: String,
    pub priority_queue_action_weighted_units: u64,
    pub priority_queue_action_weighted_pressure_bps: u64,
    pub priority_queue_action_weighted_per_service_milli: u64,
    pub priority_queue_action_weighted_profile: String,
    pub priority_queue_action_polarization_bps: u64,
    pub priority_queue_action_balance_score_bps: u64,
    pub priority_queue_action_polarization_profile: String,
    pub priority_queue_dominant_action_level: String,
    pub priority_queue_dominant_action_bps: u64,
    pub priority_queue_top_service_alert_share_bps: u64,
    pub priority_queue_leader_alert_share_bps: u64,
    pub priority_queue_runner_up_alert_share_bps: u64,
    pub priority_queue_leader_gap_bps: u64,
    pub priority_queue_top2_service_alert_share_bps: u64,
    pub priority_queue_service_concentration_hhi_bps: u64,
    pub priority_queue_concentration_level: String,
    pub priority_queue_long_tail_alert_share_bps: u64,
    pub priority_queue_effective_service_count_milli: u64,
    pub priority_queue_leader_dominance_level: String,
    pub priority_queue_coverage_50_count: u64,
    pub priority_queue_coverage_80_count: u64,
    pub priority_queue_coverage_95_count: u64,
    pub priority_queue_coverage_profile: String,
    pub priority_queue_risk_score_bps: u64,
    pub priority_queue_risk_band: String,
    pub priority_queue_response_sla_seconds: u64,
    pub priority_queue_sla_multiplier_bps: u64,
    pub priority_queue_effective_response_sla_seconds: u64,
    pub priority_queue_sla_slippage_bps: u64,
    pub priority_queue_sla_pressure_profile: String,
    pub priority_queue_sla_adjusted_risk_bps: u64,
    pub priority_queue_sla_risk_delta_bps: u64,
    pub priority_queue_operational_posture: String,
    pub priority_queue_attention_index_bps: u64,
    pub priority_queue_attention_delta_bps: u64,
    pub priority_queue_attention_profile: String,
    pub priority_queue_readiness_score_bps: u64,
    pub priority_queue_readiness_delta_bps: u64,
    pub priority_queue_readiness_profile: String,
    pub priority_queue_stability_index_bps: u64,
    pub priority_queue_stability_delta_bps: u64,
    pub priority_queue_stability_profile: String,
    pub priority_queue_resilience_score_bps: u64,
    pub priority_queue_resilience_delta_bps: u64,
    pub priority_queue_resilience_profile: String,
    pub priority_queue_coherence_score_bps: u64,
    pub priority_queue_coherence_delta_bps: u64,
    pub priority_queue_coherence_profile: String,
    pub priority_queue_adaptability_score_bps: u64,
    pub priority_queue_adaptability_delta_bps: u64,
    pub priority_queue_adaptability_profile: String,
    pub priority_queue_sustainability_score_bps: u64,
    pub priority_queue_sustainability_delta_bps: u64,
    pub priority_queue_sustainability_profile: String,
    pub priority_queue_continuity_score_bps: u64,
    pub priority_queue_continuity_delta_bps: u64,
    pub priority_queue_continuity_profile: String,
    pub priority_queue_recoverability_score_bps: u64,
    pub priority_queue_recoverability_delta_bps: u64,
    pub priority_queue_recoverability_profile: String,
    pub priority_queue_regeneration_score_bps: u64,
    pub priority_queue_regeneration_delta_bps: u64,
    pub priority_queue_regeneration_profile: String,
    pub priority_queue_restoration_score_bps: u64,
    pub priority_queue_restoration_delta_bps: u64,
    pub priority_queue_restoration_profile: String,
    pub priority_queue_stewardship_score_bps: u64,
    pub priority_queue_stewardship_delta_bps: u64,
    pub priority_queue_stewardship_profile: String,
    pub priority_queue_guardianship_score_bps: u64,
    pub priority_queue_guardianship_delta_bps: u64,
    pub priority_queue_guardianship_profile: String,
    pub priority_queue_assurance_score_bps: u64,
    pub priority_queue_assurance_delta_bps: u64,
    pub priority_queue_assurance_profile: String,
    pub priority_queue_vigilance_score_bps: u64,
    pub priority_queue_vigilance_delta_bps: u64,
    pub priority_queue_vigilance_profile: String,
    pub priority_queue_oversight_score_bps: u64,
    pub priority_queue_oversight_delta_bps: u64,
    pub priority_queue_oversight_profile: String,
    pub priority_queue_accountability_score_bps: u64,
    pub priority_queue_accountability_delta_bps: u64,
    pub priority_queue_accountability_profile: String,
    pub priority_queue_verifiability_score_bps: u64,
    pub priority_queue_verifiability_delta_bps: u64,
    pub priority_queue_verifiability_profile: String,
    pub priority_queue_auditability_score_bps: u64,
    pub priority_queue_auditability_delta_bps: u64,
    pub priority_queue_auditability_profile: String,
    pub priority_queue_transparency_score_bps: u64,
    pub priority_queue_transparency_delta_bps: u64,
    pub priority_queue_transparency_profile: String,
    pub priority_queue_legibility_score_bps: u64,
    pub priority_queue_legibility_delta_bps: u64,
    pub priority_queue_legibility_profile: String,
    pub priority_queue_navigability_score_bps: u64,
    pub priority_queue_navigability_delta_bps: u64,
    pub priority_queue_navigability_profile: String,
    pub priority_queue_interpretability_score_bps: u64,
    pub priority_queue_interpretability_delta_bps: u64,
    pub priority_queue_interpretability_profile: String,
    pub priority_queue_explainability_score_bps: u64,
    pub priority_queue_explainability_delta_bps: u64,
    pub priority_queue_explainability_profile: String,
    pub priority_queue_clarity_score_bps: u64,
    pub priority_queue_clarity_delta_bps: u64,
    pub priority_queue_clarity_profile: String,
    pub priority_queue_comprehensibility_score_bps: u64,
    pub priority_queue_comprehensibility_delta_bps: u64,
    pub priority_queue_comprehensibility_profile: String,
    pub priority_queue_intelligibility_score_bps: u64,
    pub priority_queue_intelligibility_delta_bps: u64,
    pub priority_queue_intelligibility_profile: String,
    pub priority_queue_communicability_score_bps: u64,
    pub priority_queue_communicability_delta_bps: u64,
    pub priority_queue_communicability_profile: String,
    pub priority_queue_articulability_score_bps: u64,
    pub priority_queue_articulability_delta_bps: u64,
    pub priority_queue_articulability_profile: String,
    pub priority_queue_expressivity_score_bps: u64,
    pub priority_queue_expressivity_delta_bps: u64,
    pub priority_queue_expressivity_profile: String,
    pub priority_queue_eloquence_score_bps: u64,
    pub priority_queue_eloquence_delta_bps: u64,
    pub priority_queue_eloquence_profile: String,
    pub priority_queue_lucidity_score_bps: u64,
    pub priority_queue_lucidity_delta_bps: u64,
    pub priority_queue_lucidity_profile: String,
    pub priority_queue_illumination_score_bps: u64,
    pub priority_queue_illumination_delta_bps: u64,
    pub priority_queue_illumination_profile: String,
    pub priority_queue_clarion_score_bps: u64,
    pub priority_queue_clarion_delta_bps: u64,
    pub priority_queue_clarion_profile: String,
    pub priority_queue_resonance_score_bps: u64,
    pub priority_queue_resonance_delta_bps: u64,
    pub priority_queue_resonance_profile: String,
    pub priority_queue_cadence_score_bps: u64,
    pub priority_queue_cadence_delta_bps: u64,
    pub priority_queue_cadence_profile: String,
    pub priority_queue_harmony_score_bps: u64,
    pub priority_queue_harmony_delta_bps: u64,
    pub priority_queue_harmony_profile: String,
    pub priority_queue_inequality_gini_bps: u64,
    pub priority_queue_evenness_milli: u64,
    pub priority_queue_distribution_profile: String,
    pub priority_queue_actionable_bps: u64,
    pub priority_queue_critical_bps: u64,
    pub priority_queue_load_level: String,
    pub by_severity: Vec<OfflineLaneAlertSeverityCount>,
    pub by_action_level: Vec<OfflineLaneAlertActionLevelCount>,
    pub by_code: Vec<OfflineLaneAlertCodeCount>,
    pub affected_service_types: Vec<String>,
    pub critical_service_types: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_service_type: Option<String>,
    pub service_summaries: Vec<OfflineLaneAlertServiceSummary>,
    pub prioritized_services: Vec<OfflineLaneAlertPriorityEntry>,
}

#[derive(Debug, Clone, Copy)]
struct ResolvedOfflineLaneAlertPolicy {
    unresolved_dispute_count_threshold: u64,
    dispute_rate_bps_threshold: u64,
    dispute_rate_min_orders: u64,
    auto_refund_rate_bps_threshold: u64,
    auto_refund_min_disputes: u64,
    invalid_payload_count_threshold: u64,
    policy_violation_count_threshold: u64,
    unresolved_disputes_severity: protocol_core::AlertSeverity,
    dispute_rate_severity: protocol_core::AlertSeverity,
    auto_refund_rate_severity: protocol_core::AlertSeverity,
    invalid_payload_spike_severity: protocol_core::AlertSeverity,
    policy_violation_spike_severity: protocol_core::AlertSeverity,
}

#[derive(Debug, Clone, Default)]
struct OfflineLaneTelemetryAgg {
    template: String,
    offer_count: u64,
    order_count: u64,
    delivered_count: u64,
    accepted_count: u64,
    disputed_count: u64,
    settled_count: u64,
    auto_refunded_count: u64,
    unresolved_dispute_count: u64,
    invalid_event_count: u64,
    invalid_policy_violation_count: u64,
    invalid_payload_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeMetrics {
    pub disputed_count: u64,
    pub delivered_flow_count: u64,
    pub dispute_rate_bps: u64,
    pub resolved_count: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub average_resolution_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditConcentrationMetrics {
    pub top_n: usize,
    pub identity_count: usize,
    pub total_active_balance: u64,
    pub top_n_balance: u64,
    pub top_n_share_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuanceExpiryMetrics {
    pub issued_credits: u64,
    pub scheduled_expired_credits: u64,
    pub expiry_pressure_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidReasonRate {
    pub count: u64,
    pub rate_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidEventRateMetrics {
    pub total_processed_events: u64,
    pub total_invalid_events: u64,
    pub total_invalid_rate_bps: u64,
    pub by_code: BTreeMap<String, InvalidReasonRate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomicsMetricsData {
    pub lane_completion: Vec<LaneEconomicsMetric>,
    pub offline_lane_templates: Vec<OfflineLaneTelemetryMetric>,
    pub offline_lane_alerts: Vec<OfflineLaneAlert>,
    pub offline_lane_alert_rollup: OfflineLaneAlertRollup,
    pub dispute: DisputeMetrics,
    pub credit_concentration: CreditConcentrationMetrics,
    pub issuance_expiry: IssuanceExpiryMetrics,
    pub invalid_event_rates: InvalidEventRateMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomicsMetricsView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: EconomicsMetricsData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskComponents {
    pub repeated_bilateral_loop: i64,
    pub counterparty_diversity_weakness: i64,
    pub dispute_settlement_anomaly: i64,
    pub attestation_clustering: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskCounters {
    pub interaction_count: u64,
    pub unique_counterparties: u64,
    pub issuance_event_count: u64,
    pub short_cycle_dispute_count: u64,
    pub clustered_attestation_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskState {
    pub identity_pub_key: String,
    pub score: i64,
    pub band: String,
    pub components: P2HRiskComponents,
    pub counters: P2HRiskCounters,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskHistoryEntry {
    pub event_id: String,
    pub created_at: String,
    pub component: String,
    pub reason: String,
    pub delta: i64,
    pub score_after: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskHistoryPage {
    pub entries: Vec<P2HRiskHistoryEntry>,
    pub next_cursor: Option<usize>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskStateView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<P2HRiskState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2HRiskHistoryView {
    pub as_of: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
    pub data: P2HRiskHistoryPage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfigFile {
    pub version: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read_token: Option<String>,
    #[serde(default)]
    pub peers: Vec<PeerConfigEntryFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfigEntryFile {
    pub id: String,
    pub base_url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bearer_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read_token: Option<String>,
    pub peers: Vec<PeerConfigEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfigEntry {
    pub id: String,
    pub base_url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bearer_token: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPullRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub peer_id: Option<String>,
    #[serde(default)]
    pub all: bool,
    #[serde(default = "default_sync_limit")]
    pub limit: usize,
    #[serde(default = "default_sync_max_pages")]
    pub max_pages: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPeerResult {
    pub peer_id: String,
    pub pulled_count: usize,
    pub accepted_count: usize,
    pub already_present_count: usize,
    pub rejected_count: usize,
    pub last_remote_cursor: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPullResult {
    pub peers: Vec<SyncPeerResult>,
    pub pulled_count: usize,
    pub accepted_count: usize,
    pub already_present_count: usize,
    pub rejected_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncBootstrapResult {
    pub peer_id: String,
    pub snapshot_id: String,
    pub snapshot_as_of: String,
    pub state_hash: String,
    pub cursor_before: i64,
    pub cursor_seeded_to: i64,
    pub pulled_count: usize,
    pub accepted_count: usize,
    pub already_present_count: usize,
    pub rejected_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatusPeer {
    pub peer_id: String,
    pub base_url: String,
    pub enabled: bool,
    pub last_remote_cursor: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_synced_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatusResult {
    pub peers: Vec<SyncStatusPeer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResetResult {
    pub reset_count: usize,
    pub peers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRuntimeConfig {
    pub enabled: bool,
    pub interval_seconds: u64,
    pub max_parallel_peers: usize,
    pub limit: usize,
    pub max_pages: usize,
}

impl Default for SyncRuntimeConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_seconds: 30,
            max_parallel_peers: 4,
            limit: default_sync_limit(),
            max_pages: default_sync_max_pages(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SyncRuntimeState {
    started_at: Option<String>,
    last_cycle_started_at: Option<String>,
    last_cycle_finished_at: Option<String>,
    in_flight_peers: BTreeSet<String>,
    config_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRuntimeStatusView {
    pub enabled: bool,
    pub interval_seconds: u64,
    pub max_parallel_peers: usize,
    pub started_at: Option<String>,
    pub last_cycle_started_at: Option<String>,
    pub last_cycle_finished_at: Option<String>,
    pub in_flight_peers: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub config_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPeerStatusView {
    pub peer_id: String,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    pub last_remote_cursor: i64,
    pub consecutive_failures: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_attempt_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_synced_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_cycle_started_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_cycle_finished_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_result: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPeersView {
    pub peers: Vec<SyncPeerStatusView>,
}

#[derive(Debug, Deserialize)]
struct RemoteEventsPage {
    events: Vec<RemoteEventRow>,
}

#[derive(Debug, Deserialize)]
struct RemoteEventRow {
    seq: i64,
    raw_json: Value,
}

#[derive(Debug)]
struct ReplayExecution {
    as_of: DateTime<Utc>,
    source: String,
    snapshot_id: Option<String>,
    run: ReplayRunOutput,
}

#[derive(Debug, Clone)]
struct P2HRiskDelta {
    event_id: String,
    created_at: DateTime<Utc>,
    component: String,
    reason: String,
    delta: i64,
}

#[derive(Debug, Clone)]
struct P2HComputationOutput {
    components: P2HRiskComponents,
    counters: P2HRiskCounters,
    history: Vec<P2HRiskHistoryEntry>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NodeInitOptions {
    pub event_log_hash_chain_enabled: bool,
}

#[derive(Debug, Clone)]
pub struct LocalNode {
    data_dir: PathBuf,
    events_log_path: PathBuf,
    events_chain_path: PathBuf,
    db_path: PathBuf,
    policy: Policy,
    event_log_hash_chain_enabled: bool,
    ingest_lock: Arc<Mutex<()>>,
    ingest_rate_limiter: Arc<ingest_rate_limit::IngestRateLimiter>,
    sync_runtime_config: Arc<Mutex<SyncRuntimeConfig>>,
    sync_runtime_state: Arc<Mutex<SyncRuntimeState>>,
}

fn ensure_data_dir_manifest(data_dir: &Path, event_log_hash_chain_enabled: bool) -> Result<()> {
    let path = data_dir.join("manifest.json");
    if path.exists() {
        return Ok(());
    }
    let manifest = NodeManifest {
        schema_version: NODE_MANIFEST_SCHEMA_VERSION.into(),
        created_at: Utc::now().to_rfc3339(),
        kernel: LocalNode::kernel_version_info(),
        event_log_hash_chain_enabled,
    };
    let content = serde_json::to_string_pretty(&manifest).context("serializing node manifest")?;
    fs::write(&path, format!("{content}\n"))
        .with_context(|| format!("writing manifest {}", path.display()))?;
    Ok(())
}

impl LocalNode {
    pub fn new(data_dir: impl AsRef<Path>) -> Result<Self> {
        Self::with_policy(data_dir, default_policy().clone())
    }

    pub fn initialize(data_dir: impl AsRef<Path>) -> Result<NodeInitResult> {
        Self::initialize_with_options(data_dir, NodeInitOptions::default())
    }

    pub fn initialize_with_options(
        data_dir: impl AsRef<Path>,
        options: NodeInitOptions,
    ) -> Result<NodeInitResult> {
        let data_dir = data_dir.as_ref();
        let already_initialized = data_dir.join("manifest.json").exists()
            && data_dir.join("node.db").exists();
        let node = Self::with_policy_and_init_options(data_dir, default_policy().clone(), options)?;
        let manifest = node
            .read_manifest()?
            .context("manifest missing after initialize")?;
        Ok(NodeInitResult {
            initialized: true,
            already_initialized,
            data_dir: node.data_dir().display().to_string(),
            manifest,
        })
    }

    pub fn with_policy(data_dir: impl AsRef<Path>, policy: Policy) -> Result<Self> {
        Self::with_policy_and_init_options(data_dir, policy, NodeInitOptions::default())
    }

    fn with_policy_and_init_options(
        data_dir: impl AsRef<Path>,
        policy: Policy,
        options: NodeInitOptions,
    ) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        fs::create_dir_all(&data_dir)
            .with_context(|| format!("creating data dir {}", data_dir.display()))?;
        let events_log_path = data_dir.join("events.log");
        let events_chain_path = data_dir.join("events.chain.jsonl");
        if !events_log_path.exists() {
            fs::write(&events_log_path, "").with_context(|| {
                format!("initializing events log {}", events_log_path.display())
            })?;
        }
        let db_path = data_dir.join("node.db");
        storage::init_database(&db_path)?;
        ensure_data_dir_manifest(&data_dir, options.event_log_hash_chain_enabled)?;
        let manifest = fs::read_to_string(data_dir.join("manifest.json"))
            .ok()
            .and_then(|content| serde_json::from_str::<NodeManifest>(&content).ok());
        let event_log_hash_chain_enabled = manifest
            .as_ref()
            .map(|entry| entry.event_log_hash_chain_enabled)
            .unwrap_or(false);
        validate_events_log_for_startup(
            &events_log_path,
            event_log_hash_chain_enabled,
            Some(&events_chain_path),
        )?;

        Ok(Self {
            data_dir,
            events_log_path,
            events_chain_path,
            db_path,
            policy,
            event_log_hash_chain_enabled,
            ingest_lock: Arc::new(Mutex::new(())),
            ingest_rate_limiter: Arc::new(ingest_rate_limit::IngestRateLimiter::new(
                IngestRateLimitConfig::default(),
            )),
            sync_runtime_config: Arc::new(Mutex::new(SyncRuntimeConfig::default())),
            sync_runtime_state: Arc::new(Mutex::new(SyncRuntimeState::default())),
        })
    }

    pub fn verify_event_log_hash_chain(&self) -> Result<String> {
        if !self.event_log_hash_chain_enabled {
            bail!("event log hash chain is not enabled for this data dir");
        }
        event_log_chain::verify_chain_against_log(&self.events_log_path, &self.events_chain_path)
    }

    pub fn event_log_hash_chain_enabled(&self) -> bool {
        self.event_log_hash_chain_enabled
    }

    pub fn set_ingest_rate_limit_config(&self, config: IngestRateLimitConfig) {
        self.ingest_rate_limiter.set_config(config);
    }

    pub fn ingest_rate_limit_view(&self) -> IngestRateLimitView {
        self.ingest_rate_limiter.view()
    }

    pub fn check_ingest_rate_limit(
        &self,
        client_key: &str,
    ) -> ingest_rate_limit::IngestRateLimitDecision {
        self.ingest_rate_limiter.check(client_key)
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn events_log_path(&self) -> &Path {
        &self.events_log_path
    }

    pub fn peers_config_path(&self) -> PathBuf {
        self.data_dir.join("peers.json")
    }

    pub fn set_sync_runtime_config(&self, config: SyncRuntimeConfig) {
        let mut guard = self
            .sync_runtime_config
            .lock()
            .expect("sync runtime config lock poisoned");
        *guard = SyncRuntimeConfig {
            enabled: config.enabled,
            interval_seconds: config.interval_seconds.max(1),
            max_parallel_peers: config.max_parallel_peers.max(1),
            limit: config.limit.max(1).min(200),
            max_pages: config.max_pages.max(1),
        };
    }

    pub fn sync_runtime_config(&self) -> SyncRuntimeConfig {
        self.sync_runtime_config
            .lock()
            .expect("sync runtime config lock poisoned")
            .clone()
    }

    pub fn sync_runtime_status_view(&self) -> SyncRuntimeStatusView {
        let config = self.sync_runtime_config();
        let state = self
            .sync_runtime_state
            .lock()
            .expect("sync runtime state lock poisoned")
            .clone();
        SyncRuntimeStatusView {
            enabled: config.enabled,
            interval_seconds: config.interval_seconds,
            max_parallel_peers: config.max_parallel_peers,
            started_at: state.started_at,
            last_cycle_started_at: state.last_cycle_started_at,
            last_cycle_finished_at: state.last_cycle_finished_at,
            in_flight_peers: state.in_flight_peers.len(),
            config_error: state.config_error,
        }
    }

    pub fn sync_peers_view(&self, peer_id: Option<&str>) -> Result<SyncPeersView> {
        let config = self.load_peer_config();
        let state_rows = storage::list_peer_sync_states(&self.db_path)?;
        let mut state_map = state_rows
            .into_iter()
            .map(|row| (row.peer_id.clone(), row))
            .collect::<BTreeMap<_, _>>();
        let mut config_peers = BTreeMap::new();

        match config {
            Ok(value) => {
                for peer in value.peers {
                    config_peers.insert(peer.id.clone(), peer);
                }
            }
            Err(error) => {
                let mut runtime = self
                    .sync_runtime_state
                    .lock()
                    .expect("sync runtime state lock poisoned");
                runtime.config_error = Some(error.to_string());
            }
        }

        let mut keys = config_peers.keys().cloned().collect::<BTreeSet<_>>();
        keys.extend(state_map.keys().cloned());

        let mut peers = Vec::new();
        for key in keys {
            if let Some(expected) = peer_id {
                if key != expected {
                    continue;
                }
            }
            let config_peer = config_peers.get(&key);
            let state = state_map.remove(&key).unwrap_or(PeerSyncStateRow {
                peer_id: key.clone(),
                last_remote_cursor: 0,
                last_synced_at: None,
                last_error: None,
                consecutive_failures: 0,
                next_attempt_at: None,
                last_cycle_started_at: None,
                last_cycle_finished_at: None,
                last_result_json: None,
            });
            peers.push(SyncPeerStatusView {
                peer_id: key,
                enabled: config_peer.map_or(false, |peer| peer.enabled),
                base_url: config_peer.map(|peer| peer.base_url.clone()),
                last_remote_cursor: state.last_remote_cursor,
                consecutive_failures: state.consecutive_failures,
                next_attempt_at: state.next_attempt_at,
                last_synced_at: state.last_synced_at,
                last_error: state.last_error,
                last_cycle_started_at: state.last_cycle_started_at,
                last_cycle_finished_at: state.last_cycle_finished_at,
                last_result: state.last_result_json,
            });
        }
        peers.sort_by(|left, right| left.peer_id.cmp(&right.peer_id));
        Ok(SyncPeersView { peers })
    }

    pub fn ingest_event(&self, raw_envelope_json: &str) -> IngestResult {
        let parsed = match parse_raw_envelope_loose_str(raw_envelope_json) {
            Ok(parsed) => parsed,
            Err(error) => {
                let message = error.to_string();
                let _ = storage::insert_invalid_event(
                    &self.db_path,
                    None,
                    InvalidReasonCode::InvalidJson,
                    &message,
                    None,
                    Some(raw_envelope_json),
                );
                return IngestResult {
                    accepted: false,
                    already_present: false,
                    event_id: None,
                    code: Some(InvalidReasonCode::InvalidJson),
                    message: Some(message),
                };
            }
        };

        let event_id = Some(parsed.event_id.clone());
        if !is_node_ingest_supported_kind_name(&parsed.kind) {
            let message = format!("unsupported event kind `{}`", parsed.kind);
            let _ = storage::insert_invalid_event(
                &self.db_path,
                event_id.as_deref(),
                InvalidReasonCode::UnsupportedKind,
                &message,
                None,
                Some(raw_envelope_json),
            );
            return IngestResult {
                accepted: false,
                already_present: false,
                event_id,
                code: Some(InvalidReasonCode::UnsupportedKind),
                message: Some(message),
            };
        }

        if let Err(error) = verify_envelope_signature(&parsed) {
            let code = reason_code_for_protocol_error(&error);
            let message = error.to_string();
            let _ = storage::insert_invalid_event(
                &self.db_path,
                event_id.as_deref(),
                code.clone(),
                &message,
                None,
                Some(raw_envelope_json),
            );
            return IngestResult {
                accepted: false,
                already_present: false,
                event_id,
                code: Some(code),
                message: Some(message),
            };
        }

        if is_replay_supported_kind_name(&parsed.kind) {
            let typed = match parsed.clone().into_typed_raw() {
                Ok(raw) => raw,
                Err(error) => {
                    let code = reason_code_for_protocol_error(&error);
                    let message = error.to_string();
                    let _ = storage::insert_invalid_event(
                        &self.db_path,
                        event_id.as_deref(),
                        code.clone(),
                        &message,
                        None,
                        Some(raw_envelope_json),
                    );
                    return IngestResult {
                        accepted: false,
                        already_present: false,
                        event_id,
                        code: Some(code),
                        message: Some(message),
                    };
                }
            };

            let event = match typed.into_event() {
                Ok(event) => event,
                Err(error) => {
                    let code = reason_code_for_protocol_error(&error);
                    let message = error.to_string();
                    let _ = storage::insert_invalid_event(
                        &self.db_path,
                        event_id.as_deref(),
                        code.clone(),
                        &message,
                        None,
                        Some(raw_envelope_json),
                    );
                    return IngestResult {
                        accepted: false,
                        already_present: false,
                        event_id,
                        code: Some(code),
                        message: Some(message),
                    };
                }
            };

            if let Err(error) = verify_event(&event) {
                let code = reason_code_for_protocol_error(&error);
                let message = error.to_string();
                let _ = storage::insert_invalid_event(
                    &self.db_path,
                    event_id.as_deref(),
                    code.clone(),
                    &message,
                    None,
                    Some(raw_envelope_json),
                );
                return IngestResult {
                    accepted: false,
                    already_present: false,
                    event_id,
                    code: Some(code),
                    message: Some(message),
                };
            }
        }

        let raw_json =
            serde_json::to_string(&parsed).unwrap_or_else(|_| raw_envelope_json.to_string());
        let _guard = self.ingest_lock.lock().expect("ingest lock poisoned");
        match storage::event_exists(&self.db_path, &parsed.event_id) {
            Ok(true) => {
                return IngestResult {
                    accepted: true,
                    already_present: true,
                    event_id,
                    code: None,
                    message: None,
                };
            }
            Ok(false) => {}
            Err(error) => {
                return IngestResult {
                    accepted: false,
                    already_present: false,
                    event_id,
                    code: Some(InvalidReasonCode::InvalidStateTransition),
                    message: Some(error.to_string()),
                };
            }
        }
        if let Err(error) = append_event_line(&self.events_log_path, &raw_json) {
            let message = error.to_string();
            let _ = storage::insert_invalid_event(
                &self.db_path,
                event_id.as_deref(),
                InvalidReasonCode::PolicyViolation,
                &message,
                None,
                Some(&raw_json),
            );
            return IngestResult {
                accepted: false,
                already_present: false,
                event_id,
                code: Some(InvalidReasonCode::PolicyViolation),
                message: Some(message),
            };
        }
        if self.event_log_hash_chain_enabled {
            let seq = event_log_chain::read_log_lines(&self.events_log_path)
                .map(|lines| lines.len() as u64)
                .unwrap_or(0);
            let prev_chain_hash =
                event_log_chain::chain_head_hash(&self.events_chain_path).unwrap_or_else(|_| {
                    event_log_chain::genesis_chain_hash()
                });
            if let Err(error) = event_log_chain::append_chain_entry(
                &self.events_chain_path,
                seq,
                parsed.event_id.as_str(),
                &raw_json,
                &prev_chain_hash,
            ) {
                let message = error.to_string();
                let _ = storage::insert_invalid_event(
                    &self.db_path,
                    event_id.as_deref(),
                    InvalidReasonCode::PolicyViolation,
                    &message,
                    None,
                    Some(&raw_json),
                );
                return IngestResult {
                    accepted: false,
                    already_present: false,
                    event_id,
                    code: Some(InvalidReasonCode::PolicyViolation),
                    message: Some(message),
                };
            }
        }

        if let Err(error) = storage::insert_event(&self.db_path, &parsed, &raw_json) {
            let message = error.to_string();
            let _ = storage::insert_invalid_event(
                &self.db_path,
                event_id.as_deref(),
                InvalidReasonCode::InvalidStateTransition,
                &message,
                None,
                Some(&raw_json),
            );
            return IngestResult {
                accepted: false,
                already_present: false,
                event_id,
                code: Some(InvalidReasonCode::InvalidStateTransition),
                message: Some(message),
            };
        }

        IngestResult {
            accepted: true,
            already_present: false,
            event_id,
            code: None,
            message: None,
        }
    }

    pub fn ingest_batch(&self, raw_event_json: &[String]) -> BatchIngestResult {
        let mut results = Vec::with_capacity(raw_event_json.len());
        let mut accepted_count = 0usize;

        for raw in raw_event_json {
            let result = self.ingest_event(raw);
            if result.accepted {
                accepted_count += 1;
            }
            results.push(result);
        }

        BatchIngestResult {
            accepted_count,
            rejected_count: raw_event_json.len().saturating_sub(accepted_count),
            results,
        }
    }

    pub fn load_peer_config(&self) -> Result<PeerConfig> {
        let path = self.peers_config_path();
        if !path.exists() {
            return Ok(PeerConfig {
                read_token: None,
                peers: Vec::new(),
            });
        }

        let raw = fs::read_to_string(&path)
            .with_context(|| format!("reading peer config {}", path.display()))?;
        let parsed: PeerConfigFile = serde_json::from_str(&raw)
            .with_context(|| format!("parsing peer config {}", path.display()))?;
        validate_peer_config(parsed)
    }

    pub fn get_events_read_token(&self) -> Result<Option<String>> {
        Ok(normalize_optional_non_empty(
            self.load_peer_config()?.read_token,
        ))
    }

    pub fn sync_status(&self) -> Result<SyncStatusResult> {
        let config = self.load_peer_config()?;
        let state_rows = storage::list_peer_sync_states(&self.db_path)?;
        let state_map = state_rows
            .into_iter()
            .map(|row| (row.peer_id.clone(), row))
            .collect::<std::collections::HashMap<_, _>>();

        let mut peers = Vec::with_capacity(config.peers.len());
        for peer in config.peers {
            let state = state_map.get(&peer.id);
            peers.push(SyncStatusPeer {
                peer_id: peer.id,
                base_url: peer.base_url,
                enabled: peer.enabled,
                last_remote_cursor: state.map_or(0, |value| value.last_remote_cursor),
                last_synced_at: state.and_then(|value| value.last_synced_at.clone()),
                last_error: state.and_then(|value| value.last_error.clone()),
            });
        }
        peers.sort_by(|left, right| left.peer_id.cmp(&right.peer_id));

        Ok(SyncStatusResult { peers })
    }

    pub fn sync_reset(&self, peer_id: Option<&str>, all: bool) -> Result<SyncResetResult> {
        let config = self.load_peer_config()?;
        if let Some(peer_id) = peer_id {
            if !config.peers.iter().any(|peer| peer.id == peer_id) {
                bail!("peer `{peer_id}` not found in peers config");
            }
            let reset = storage::reset_peer_sync_state(&self.db_path, peer_id)?;
            return Ok(SyncResetResult {
                reset_count: usize::from(reset),
                peers: vec![peer_id.to_string()],
            });
        }

        if all {
            let reset_count = storage::reset_all_peer_sync_state(&self.db_path)?;
            let mut peers = config
                .peers
                .into_iter()
                .map(|entry| entry.id)
                .collect::<Vec<_>>();
            peers.sort();
            return Ok(SyncResetResult { reset_count, peers });
        }

        let mut reset_count = 0usize;
        let mut peers = Vec::new();
        for peer in config.peers.into_iter().filter(|entry| entry.enabled) {
            if storage::reset_peer_sync_state(&self.db_path, &peer.id)? {
                reset_count += 1;
            }
            peers.push(peer.id);
        }
        peers.sort();
        Ok(SyncResetResult { reset_count, peers })
    }

    pub async fn sync_pull(&self, request: SyncPullRequest) -> Result<SyncPullResult> {
        let config = self.load_peer_config()?;
        let mut peers = select_sync_peers(&config, &request)?;
        peers.sort_by(|left, right| left.id.cmp(&right.id));

        let client = Client::new();
        let mut results = Vec::with_capacity(peers.len());
        let mut total_pulled = 0usize;
        let mut total_accepted = 0usize;
        let mut total_already_present = 0usize;
        let mut total_rejected = 0usize;
        let interval_seconds = self.sync_runtime_config().interval_seconds;

        for peer in peers {
            let result = self
                .sync_peer_pull_once(
                    &client,
                    &peer,
                    request.limit,
                    request.max_pages,
                    false,
                    false,
                    interval_seconds,
                )
                .await?;

            total_pulled += result.pulled_count;
            total_accepted += result.accepted_count;
            total_already_present += result.already_present_count;
            total_rejected += result.rejected_count;
            results.push(result);
        }

        Ok(SyncPullResult {
            peers: results,
            pulled_count: total_pulled,
            accepted_count: total_accepted,
            already_present_count: total_already_present,
            rejected_count: total_rejected,
        })
    }

    pub async fn sync_bootstrap_from_peer(
        &self,
        peer_id: &str,
        snapshot_id_opt: Option<&str>,
        limit: usize,
        max_pages: usize,
    ) -> Result<SyncBootstrapResult> {
        let config = self.load_peer_config()?;
        let peer = config
            .peers
            .iter()
            .find(|entry| entry.id == peer_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("peer `{peer_id}` not found"))?;
        let client = Client::new();

        let resolved_snapshot_id = match snapshot_id_opt {
            Some(value) => value.to_string(),
            None => {
                let latest = fetch_remote_snapshot_latest_meta(&client, &peer, None).await?;
                latest
                    .ok_or_else(|| anyhow::anyhow!("remote peer `{peer_id}` has no snapshot"))?
                    .snapshot_id
            }
        };

        let remote_snapshot =
            fetch_remote_snapshot_document(&client, &peer, &resolved_snapshot_id).await?;
        self.validate_imported_snapshot(&remote_snapshot)?;

        if remote_snapshot.meta.snapshot_id != resolved_snapshot_id {
            bail!(
                "remote snapshot id mismatch: requested `{resolved_snapshot_id}` got `{}`",
                remote_snapshot.meta.snapshot_id
            );
        }

        let existing = storage::get_snapshot(&self.db_path, &remote_snapshot.meta.snapshot_id)?;
        if let Some(existing) = existing {
            if existing.meta.state_hash != remote_snapshot.meta.state_hash {
                bail!(
                    "snapshot id conflict for `{}`: local hash {} != remote hash {}",
                    remote_snapshot.meta.snapshot_id,
                    existing.meta.state_hash,
                    remote_snapshot.meta.state_hash
                );
            }
        } else {
            storage::insert_snapshot(
                &self.db_path,
                &SnapshotRow {
                    meta: remote_snapshot.meta.clone(),
                    state_json: remote_snapshot.state.clone(),
                    checkpoint_json: remote_snapshot.checkpoint.clone(),
                    imported_from_peer_id: Some(peer.id.clone()),
                    imported_at: Some(Utc::now().to_rfc3339()),
                    integrity_verified: true,
                },
            )?;
        }

        let mut peer_state = storage::get_peer_sync_state(&self.db_path, &peer.id)?
            .unwrap_or_else(|| default_peer_sync_state(&peer.id));
        let cursor_before = peer_state.last_remote_cursor;
        peer_state.last_remote_cursor = peer_state
            .last_remote_cursor
            .max(remote_snapshot.meta.event_seq);
        peer_state.last_error = None;
        peer_state.consecutive_failures = 0;
        peer_state.next_attempt_at = None;
        storage::upsert_peer_sync_state(&self.db_path, &peer_state)?;
        storage::ensure_event_order_sequence_at_least(
            &self.db_path,
            peer_state.last_remote_cursor,
        )?;

        let pull_result = self
            .sync_peer_pull_once(
                &client,
                &peer,
                limit,
                max_pages,
                false,
                false,
                self.sync_runtime_config().interval_seconds,
            )
            .await?;

        Ok(SyncBootstrapResult {
            peer_id: peer.id,
            snapshot_id: remote_snapshot.meta.snapshot_id,
            snapshot_as_of: remote_snapshot.meta.as_of,
            state_hash: remote_snapshot.meta.state_hash,
            cursor_before,
            cursor_seeded_to: peer_state.last_remote_cursor,
            pulled_count: pull_result.pulled_count,
            accepted_count: pull_result.accepted_count,
            already_present_count: pull_result.already_present_count,
            rejected_count: pull_result.rejected_count,
            error: pull_result.error,
        })
    }

    pub fn spawn_sync_supervisor(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run_sync_supervisor_loop().await;
        })
    }

    async fn run_sync_supervisor_loop(self: Arc<Self>) {
        self.set_sync_runtime_started(Utc::now().to_rfc3339());
        loop {
            let config = self.sync_runtime_config();
            if config.enabled {
                Arc::clone(&self).run_sync_cycle(config.clone()).await;
            }
            tokio::time::sleep(Duration::from_secs(config.interval_seconds.max(1))).await;
        }
    }

    async fn run_sync_cycle(self: Arc<Self>, config: SyncRuntimeConfig) {
        self.set_sync_runtime_cycle_started(Utc::now().to_rfc3339());
        self.set_sync_runtime_config_error(None);

        let peer_config = match self.load_peer_config() {
            Ok(config_file) => config_file,
            Err(error) => {
                self.set_sync_runtime_config_error(Some(error.to_string()));
                self.set_sync_runtime_cycle_finished(Utc::now().to_rfc3339());
                return;
            }
        };

        let now = Utc::now();
        let mut due_peers = Vec::new();
        for peer in peer_config.peers.into_iter().filter(|entry| entry.enabled) {
            let state = storage::get_peer_sync_state(&self.db_path, &peer.id)
                .ok()
                .flatten()
                .unwrap_or_else(|| default_peer_sync_state(&peer.id));
            if should_attempt_peer(state.next_attempt_at.as_deref(), now) {
                due_peers.push(peer);
            }
        }

        let semaphore = Arc::new(Semaphore::new(config.max_parallel_peers.max(1)));
        let client = Client::new();
        let mut tasks = Vec::with_capacity(due_peers.len());
        for peer in due_peers {
            let Ok(permit) = semaphore.clone().acquire_owned().await else {
                break;
            };
            let node = Arc::clone(&self);
            let client = client.clone();
            let peer_id = peer.id.clone();
            let limit = config.limit;
            let max_pages = config.max_pages;
            let interval_seconds = config.interval_seconds;
            self.set_sync_runtime_peer_in_flight(&peer_id, true);
            tasks.push(tokio::spawn(async move {
                let _permit = permit;
                let result = node
                    .sync_peer_pull_once(
                        &client,
                        &peer,
                        limit,
                        max_pages,
                        true,
                        true,
                        interval_seconds,
                    )
                    .await;
                node.set_sync_runtime_peer_in_flight(&peer_id, false);
                result
            }));
        }

        for task in tasks {
            let _ = task.await;
        }

        self.set_sync_runtime_cycle_finished(Utc::now().to_rfc3339());
    }

    async fn sync_peer_pull_once(
        &self,
        client: &Client,
        peer: &PeerConfigEntry,
        limit: usize,
        max_pages: usize,
        apply_backoff: bool,
        respect_next_attempt: bool,
        interval_seconds: u64,
    ) -> Result<SyncPeerResult> {
        let mut state = storage::get_peer_sync_state(&self.db_path, &peer.id)?
            .unwrap_or_else(|| default_peer_sync_state(&peer.id));
        let attempt_started = Utc::now();
        if respect_next_attempt
            && !should_attempt_peer(state.next_attempt_at.as_deref(), attempt_started)
        {
            return Ok(SyncPeerResult {
                peer_id: peer.id.clone(),
                pulled_count: 0,
                accepted_count: 0,
                already_present_count: 0,
                rejected_count: 0,
                last_remote_cursor: state.last_remote_cursor,
                error: None,
            });
        }

        state.last_cycle_started_at = Some(attempt_started.to_rfc3339());
        let mut result = SyncPeerResult {
            peer_id: peer.id.clone(),
            pulled_count: 0,
            accepted_count: 0,
            already_present_count: 0,
            rejected_count: 0,
            last_remote_cursor: state.last_remote_cursor,
            error: None,
        };

        let pull_limit = limit.max(1).min(200);
        let mut pages_fetched = 0usize;
        while pages_fetched < max_pages.max(1) {
            let fetch =
                fetch_remote_events_page(client, peer, result.last_remote_cursor, pull_limit).await;
            let page = match fetch {
                Ok(page) => page,
                Err(error) => {
                    result.error = Some(error.to_string());
                    break;
                }
            };

            if page.events.is_empty() {
                break;
            }

            let page_event_count = page.events.len();
            let mut page_last_seq = result.last_remote_cursor;
            for event in page.events {
                page_last_seq = page_last_seq.max(event.seq);
                result.pulled_count += 1;
                let raw_json = event.raw_json.to_string();
                let ingest = self.ingest_event(&raw_json);
                if ingest.accepted {
                    if ingest.already_present {
                        result.already_present_count += 1;
                    } else {
                        result.accepted_count += 1;
                    }
                } else {
                    result.rejected_count += 1;
                }
            }

            result.last_remote_cursor = page_last_seq;
            pages_fetched += 1;
            if page_event_count < pull_limit {
                break;
            }
        }

        let attempt_finished = Utc::now();
        state.last_remote_cursor = result.last_remote_cursor;
        state.last_cycle_finished_at = Some(attempt_finished.to_rfc3339());
        if result.error.is_none() {
            state.last_synced_at = Some(attempt_finished.to_rfc3339());
            state.last_error = None;
            state.consecutive_failures = 0;
            state.next_attempt_at = None;
        } else {
            state.last_error = result.error.clone();
            if apply_backoff {
                state.consecutive_failures = state.consecutive_failures.saturating_add(1);
                let next_delay = compute_backoff_delay_seconds(
                    interval_seconds,
                    state.consecutive_failures as u32,
                ) as i64;
                state.next_attempt_at =
                    Some((attempt_finished + chrono::Duration::seconds(next_delay)).to_rfc3339());
            }
        }

        state.last_result_json = Some(serde_json::json!({
            "pulled_count": result.pulled_count,
            "accepted_count": result.accepted_count,
            "already_present_count": result.already_present_count,
            "rejected_count": result.rejected_count,
            "last_remote_cursor": result.last_remote_cursor,
            "error": result.error.clone(),
        }));
        storage::upsert_peer_sync_state(&self.db_path, &state)?;
        Ok(result)
    }

    fn validate_imported_snapshot(&self, snapshot: &SnapshotDocument) -> Result<()> {
        if snapshot.meta.format_version < 5 {
            bail!(
                "snapshot `{}` format_version {} is not checkpoint-capable",
                snapshot.meta.snapshot_id,
                snapshot.meta.format_version
            );
        }
        let checkpoint_value = snapshot
            .checkpoint
            .clone()
            .ok_or_else(|| anyhow::anyhow!("snapshot checkpoint is missing"))?;
        let checkpoint: ReplayCheckpoint =
            serde_json::from_value(checkpoint_value).context("parsing snapshot checkpoint")?;
        let computed_state_hash = hash_value(&snapshot.state)?;
        if computed_state_hash != snapshot.meta.state_hash {
            bail!(
                "snapshot state hash mismatch: expected {} got {}",
                snapshot.meta.state_hash,
                computed_state_hash
            );
        }

        let snapshot_as_of = parse_timestamp(&snapshot.meta.as_of)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let run =
            replay_jsonl_resume_as_of(&[], &self.policy, Some(snapshot_as_of), Some(checkpoint));
        let replay_hash = hash_value(&serde_json::to_value(&run.replay)?)?;
        if replay_hash != snapshot.meta.state_hash {
            bail!(
                "snapshot checkpoint self-consistency failed: expected {} got {}",
                snapshot.meta.state_hash,
                replay_hash
            );
        }
        Ok(())
    }

    fn set_sync_runtime_started(&self, started_at: String) {
        let mut state = self
            .sync_runtime_state
            .lock()
            .expect("sync runtime state lock poisoned");
        if state.started_at.is_none() {
            state.started_at = Some(started_at);
        }
    }

    fn set_sync_runtime_cycle_started(&self, started_at: String) {
        let mut state = self
            .sync_runtime_state
            .lock()
            .expect("sync runtime state lock poisoned");
        state.last_cycle_started_at = Some(started_at);
    }

    fn set_sync_runtime_cycle_finished(&self, finished_at: String) {
        let mut state = self
            .sync_runtime_state
            .lock()
            .expect("sync runtime state lock poisoned");
        state.last_cycle_finished_at = Some(finished_at);
    }

    fn set_sync_runtime_config_error(&self, error: Option<String>) {
        let mut state = self
            .sync_runtime_state
            .lock()
            .expect("sync runtime state lock poisoned");
        state.config_error = error;
    }

    fn set_sync_runtime_peer_in_flight(&self, peer_id: &str, in_flight: bool) {
        let mut state = self
            .sync_runtime_state
            .lock()
            .expect("sync runtime state lock poisoned");
        if in_flight {
            state.in_flight_peers.insert(peer_id.to_string());
        } else {
            state.in_flight_peers.remove(peer_id);
        }
    }

    pub fn replay(&self, as_of: Option<DateTime<Utc>>) -> Result<ReplayOutput> {
        Ok(self.replay_execution(as_of)?.run.replay)
    }

    pub fn replay_view(&self, as_of: Option<DateTime<Utc>>) -> Result<ReplayView> {
        let execution = self.replay_execution(as_of)?;
        Ok(ReplayView {
            as_of: execution.as_of.to_rfc3339(),
            source: execution.source,
            snapshot_id: execution.snapshot_id,
            data: execution.run.replay,
        })
    }

    pub fn list_events(
        &self,
        cursor: Option<i64>,
        limit: usize,
        kind: Option<&str>,
        author_pub_key: Option<&str>,
    ) -> Result<EventsPage> {
        let rows = storage::list_events(
            &self.db_path,
            EventListQuery {
                cursor,
                limit: limit.max(1).min(200),
                kind,
                author_pub_key,
            },
        )?;
        let next_cursor = rows.last().map(|row| row.seq);
        Ok(EventsPage {
            events: rows,
            next_cursor,
        })
    }

    pub fn create_snapshot(&self, as_of: Option<DateTime<Utc>>) -> Result<SnapshotMeta> {
        let effective_as_of = as_of.unwrap_or_else(Utc::now);
        let execution = self.replay_execution(Some(effective_as_of))?;
        let replay = execution.run.replay;
        let checkpoint = execution.run.checkpoint;
        let state = serde_json::to_value(&replay)?;
        let checkpoint_json = Some(serde_json::to_value(&checkpoint)?);
        let state_hash = hash_value(&state)?;
        let event_seq =
            storage::latest_replay_event_seq_at_or_before(&self.db_path, effective_as_of)?;
        let created_at = Utc::now();
        let snapshot_id = format!(
            "snap-{}-{}",
            created_at.timestamp_millis(),
            &state_hash.chars().take(12).collect::<String>()
        );
        let meta = SnapshotMeta {
            snapshot_id,
            as_of: effective_as_of.to_rfc3339(),
            event_seq,
            state_hash: state_hash.clone(),
            created_at: created_at.to_rfc3339(),
            format_version: 5,
        };

        storage::insert_snapshot(
            &self.db_path,
            &SnapshotRow {
                meta: meta.clone(),
                state_json: state,
                checkpoint_json,
                imported_from_peer_id: None,
                imported_at: None,
                integrity_verified: true,
            },
        )?;
        Ok(meta)
    }

    pub fn create_snapshot_document(
        &self,
        as_of: Option<DateTime<Utc>>,
    ) -> Result<SnapshotDocument> {
        let meta = self.create_snapshot(as_of)?;
        self.get_snapshot(&meta.snapshot_id)?
            .ok_or_else(|| anyhow::anyhow!("snapshot not found after creation"))
    }

    pub fn get_snapshot(&self, snapshot_id: &str) -> Result<Option<SnapshotDocument>> {
        let row = storage::get_snapshot(&self.db_path, snapshot_id)?;
        Ok(row.map(|row| SnapshotDocument {
            meta: row.meta,
            state: row.state_json,
            checkpoint: row.checkpoint_json,
        }))
    }

    pub fn latest_snapshot_meta(
        &self,
        as_of: Option<DateTime<Utc>>,
    ) -> Result<Option<SnapshotMeta>> {
        let effective_as_of = as_of.unwrap_or_else(Utc::now);
        storage::find_latest_snapshot_meta_at_or_before(&self.db_path, effective_as_of)
    }

    pub fn db_inspect(&self) -> Result<DbInspectStats> {
        storage::db_inspect(&self.db_path)
    }

    pub fn manifest_path(&self) -> PathBuf {
        self.data_dir.join("manifest.json")
    }

    pub fn kernel_version_info() -> KernelVersionInfo {
        KernelVersionInfo {
            node_version: env!("CARGO_PKG_VERSION").into(),
            protocol_version: PROTOCOL_VERSION.into(),
            replay_engine: REPLAY_ENGINE_NAME.into(),
            replay_engine_version: env!("CARGO_PKG_VERSION").into(),
            sqlite_schema_version: storage::sqlite_schema_version().into(),
            snapshot_format_version: CURRENT_SNAPSHOT_FORMAT_VERSION,
        }
    }

    pub fn read_manifest(&self) -> Result<Option<NodeManifest>> {
        let path = self.manifest_path();
        if !path.exists() {
            return Ok(None);
        }
        let content = fs::read_to_string(&path)
            .with_context(|| format!("reading manifest {}", path.display()))?;
        let manifest = serde_json::from_str(&content)
            .with_context(|| format!("parsing manifest {}", path.display()))?;
        Ok(Some(manifest))
    }

    pub fn health(&self) -> Result<HealthResponse> {
        let stats = self.db_inspect()?;
        Ok(HealthResponse {
            status: "ok".into(),
            kernel: Self::kernel_version_info(),
            data_dir: DataDirHealth {
                path: self.data_dir.display().to_string(),
                events_log_exists: self.events_log_path.exists(),
                database_exists: self.db_path.exists(),
                manifest_exists: self.manifest_path().exists(),
                event_count: stats.event_count,
                invalid_event_count: stats.invalid_event_count,
                snapshot_count: stats.snapshot_count,
                latest_seq: stats.latest_seq,
            },
        })
    }

    pub fn policy_current_view(&self, as_of: Option<DateTime<Utc>>) -> Result<PolicyStateView> {
        let replay = self.replay_view(as_of)?;
        Ok(PolicyStateView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data: replay.data.state.policy,
        })
    }

    pub fn policy_timeline_view(
        &self,
        as_of: Option<DateTime<Utc>>,
        cursor: Option<usize>,
        limit: usize,
    ) -> Result<PolicyTimelineView> {
        let replay = self.replay_view(as_of)?;
        let data = paginate_policy_updates(&replay.data.state.policy_updates, cursor, limit);
        Ok(PolicyTimelineView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data,
        })
    }

    pub fn reputation_current_view(
        &self,
        identity: &str,
        as_of: Option<DateTime<Utc>>,
    ) -> Result<ReputationStateView> {
        let replay = self.replay_view(as_of)?;
        let root = resolve_identity_root(&replay.data, identity);
        let data = root
            .as_ref()
            .and_then(|resolved| replay.data.state.reputations.get(resolved).cloned());
        Ok(ReputationStateView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data,
        })
    }

    pub fn reputation_history_view(
        &self,
        identity: &str,
        as_of: Option<DateTime<Utc>>,
        cursor: Option<usize>,
        limit: usize,
        lane: Option<&str>,
    ) -> Result<ReputationHistoryView> {
        let replay = self.replay_view(as_of)?;
        let root = resolve_identity_root(&replay.data, identity);
        let filtered = root
            .as_ref()
            .map(|resolved| {
                replay
                    .data
                    .state
                    .reputation_history
                    .iter()
                    .filter(|entry| entry.identity_pub_key == *resolved)
                    .filter(|entry| lane.map_or(true, |value| entry.lane.as_deref() == Some(value)))
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let data = paginate_reputation_history(&filtered, cursor, limit);
        Ok(ReputationHistoryView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data,
        })
    }

    pub fn discovery_view(
        &self,
        as_of: Option<DateTime<Utc>>,
        lane_filter: Option<&str>,
        min_score: Option<i64>,
        cursor: Option<usize>,
        limit: usize,
        alpha_defaults: bool,
    ) -> Result<DiscoveryView> {
        let replay = self.replay_view(as_of)?;
        let policy = &replay.data.state.policy.policy;
        let policy_allowed_service_types =
            unique_sorted_strings(policy.allowed_service_types.iter().cloned().collect());
        let alpha_initial_service_types = DISCOVERY_ALPHA_INITIAL_SERVICE_TYPES
            .iter()
            .map(|value| (*value).to_string())
            .collect::<Vec<_>>();
        let alpha_lane_filter = alpha_initial_service_types
            .iter()
            .filter(|value| policy_allowed_service_types.contains(*value))
            .cloned()
            .collect::<Vec<_>>();

        let normalized_lane_filter = lane_filter
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let effective_lane_filter = if let Some(lane) = &normalized_lane_filter {
            if policy_allowed_service_types.contains(lane) {
                vec![lane.clone()]
            } else {
                Vec::new()
            }
        } else if alpha_defaults {
            alpha_lane_filter
        } else {
            policy_allowed_service_types.clone()
        };
        let effective_lane_filter_set = effective_lane_filter
            .iter()
            .cloned()
            .collect::<BTreeSet<_>>();

        let mut offers = replay
            .data
            .state
            .offers
            .values()
            .filter(|offer| offer.status == "active")
            .filter(|offer| effective_lane_filter_set.contains(&offer.service_type))
            .map(|offer| {
                let reputation = replay.data.state.reputations.get(&offer.provider_pub_key);
                let global_score = reputation.map_or(0, |entry| entry.global_score);
                let lane_score = reputation
                    .and_then(|entry| entry.lanes.get(&offer.service_type))
                    .map_or(0, |entry| entry.score);
                let discovery_score = global_score + lane_score;
                DiscoveryOfferRow {
                    offer_id: offer.offer_id.clone(),
                    provider_pub_key: offer.provider_pub_key.clone(),
                    service_type: offer.service_type.clone(),
                    status: offer.status.clone(),
                    price_per_unit_credits: offer.price_per_unit_credits,
                    offer_expires_at: offer.offer_expires_at.clone(),
                    global_score,
                    lane_score,
                    discovery_score,
                    created_event_id: offer.created_event_id.clone(),
                }
            })
            .filter(|offer| min_score.map_or(true, |threshold| offer.discovery_score >= threshold))
            .collect::<Vec<_>>();

        offers.sort_by(|left, right| {
            right
                .discovery_score
                .cmp(&left.discovery_score)
                .then_with(|| right.global_score.cmp(&left.global_score))
                .then_with(|| right.lane_score.cmp(&left.lane_score))
                .then_with(|| left.offer_id.cmp(&right.offer_id))
                .then_with(|| left.provider_pub_key.cmp(&right.provider_pub_key))
        });

        let page = paginate_discovery_offers(&offers, cursor, limit);
        Ok(DiscoveryView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data: DiscoveryPage {
                lane_filter: normalized_lane_filter,
                effective_lane_filter,
                min_score_filter: min_score,
                alpha_defaults_enabled: alpha_defaults,
                alpha_initial_service_types,
                policy_effective_version: replay.data.state.policy.effective_version.clone(),
                policy_allowed_service_types,
                ranking_formula:
                    "discovery_score DESC, global_score DESC, lane_score DESC, offer_id ASC, provider_pub_key ASC"
                        .to_string(),
                offers: page.offers,
                next_cursor: page.next_cursor,
                total: page.total,
            },
        })
    }

    pub fn participant_orders_view(
        &self,
        as_of: Option<DateTime<Utc>>,
        participant_pub_key: &str,
        role: ParticipantOrderRole,
        status_filter: Option<&str>,
        cursor: Option<usize>,
        limit: usize,
    ) -> Result<ParticipantOrdersView> {
        let participant_pub_key = normalize_participant_pub_key(participant_pub_key)
            .map_err(|error| anyhow::anyhow!(error))?;
        let status_filter = status_filter
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let replay = self.replay_view(as_of)?;

        let mut orders = replay
            .data
            .state
            .orders
            .values()
            .filter_map(|order| {
                let participant_role = match role {
                    ParticipantOrderRole::Buyer => {
                        pubkey_matches(&order.buyer_pub_key, &participant_pub_key)
                            .then_some("buyer")
                    }
                    ParticipantOrderRole::Provider => {
                        pubkey_matches(&order.provider_pub_key, &participant_pub_key)
                            .then_some("provider")
                    }
                    ParticipantOrderRole::Any => {
                        if pubkey_matches(&order.buyer_pub_key, &participant_pub_key) {
                            Some("buyer")
                        } else if pubkey_matches(&order.provider_pub_key, &participant_pub_key) {
                            Some("provider")
                        } else {
                            None
                        }
                    }
                }?;
                if status_filter
                    .as_deref()
                    .is_some_and(|status| order.status != status)
                {
                    return None;
                }
                let service_type = replay
                    .data
                    .state
                    .offers
                    .get(&order.offer_id)
                    .map(|offer| offer.service_type.clone())
                    .unwrap_or_else(|| "unknown".to_string());
                Some(participant_order_row(order, participant_role, service_type))
            })
            .collect::<Vec<_>>();

        orders.sort_by(|left, right| {
            right
                .order_id
                .cmp(&left.order_id)
                .then_with(|| left.offer_id.cmp(&right.offer_id))
                .then_with(|| left.participant_role.cmp(&right.participant_role))
        });

        let page = paginate_participant_orders(&orders, cursor, limit);
        Ok(ParticipantOrdersView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data: ParticipantOrdersPage {
                participant_pub_key,
                role_filter: role.as_str().to_string(),
                status_filter,
                orders: page.orders,
                next_cursor: page.next_cursor,
                total: page.total,
            },
        })
    }

    pub fn economics_metrics_view(
        &self,
        as_of: Option<DateTime<Utc>>,
    ) -> Result<EconomicsMetricsView> {
        let replay = self.replay_view(as_of)?;
        let effective_as_of =
            parse_timestamp(&replay.as_of).map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let applied_event_ids = replay
            .data
            .applied_event_ids
            .iter()
            .cloned()
            .collect::<BTreeSet<_>>();

        let dispute_events = self.collect_events_for_metrics("ServiceDispute", effective_as_of)?;
        let settle_events = self.collect_events_for_metrics("ServiceSettle", effective_as_of)?;
        let mint_events = self.collect_events_for_metrics("MintCredits", effective_as_of)?;

        let mut dispute_opened_at = BTreeMap::new();
        for event in dispute_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let opened_at = event
                .payload_json
                .get("disputedAt")
                .and_then(Value::as_str)
                .and_then(|value| parse_timestamp(value).ok())
                .or_else(|| parse_timestamp(&event.created_at).ok());
            if let Some(opened_at) = opened_at {
                dispute_opened_at.insert(event.event_id, opened_at);
            }
        }

        let mut settlement_at = BTreeMap::new();
        for event in settle_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let settled_at = event
                .payload_json
                .get("settledAt")
                .and_then(Value::as_str)
                .and_then(|value| parse_timestamp(value).ok())
                .or_else(|| parse_timestamp(&event.created_at).ok());
            if let Some(settled_at) = settled_at {
                settlement_at.insert(event.event_id, settled_at);
            }
        }

        let mut issued_credits = 0_u64;
        let mut scheduled_expired_credits = 0_u64;
        for event in mint_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let amount = event
                .payload_json
                .get("amount")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let expires_at = event
                .payload_json
                .get("expiresAt")
                .and_then(Value::as_str)
                .and_then(|value| parse_timestamp(value).ok());
            issued_credits = issued_credits.saturating_add(amount);
            if expires_at.is_some_and(|value| value <= effective_as_of) {
                scheduled_expired_credits = scheduled_expired_credits.saturating_add(amount);
            }
        }

        let mut lane_agg = BTreeMap::<String, (u64, u64, u64)>::new();
        let mut offline_agg = BTreeMap::<String, OfflineLaneTelemetryAgg>::new();
        for offer in replay.data.state.offers.values() {
            if let Some(template) = offline_template_for_service_type(&offer.service_type) {
                let entry = offline_agg.entry(offer.service_type.clone()).or_default();
                if entry.template.is_empty() {
                    entry.template = template.to_string();
                }
                entry.offer_count = entry.offer_count.saturating_add(1);
            }
        }
        for order in replay.data.state.orders.values() {
            let service_type = replay
                .data
                .state
                .offers
                .get(&order.offer_id)
                .map(|offer| offer.service_type.clone());
            let Some(service_type) = service_type else {
                continue;
            };
            if let Some(template) = offline_template_for_service_type(&service_type) {
                let entry = offline_agg.entry(service_type).or_default();
                if entry.template.is_empty() {
                    entry.template = template.to_string();
                }
                entry.order_count = entry.order_count.saturating_add(1);
            }
        }
        for invalid in &replay.data.invalid_events {
            let Some(kind) = invalid.kind.as_deref() else {
                continue;
            };
            if !matches!(kind, "ServiceOffer" | "ServiceOrder" | "ServiceDelivery") {
                continue;
            }
            let service_type = if invalid
                .message
                .contains(SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE)
                || invalid
                    .message
                    .contains(EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1)
            {
                Some(SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE)
            } else if invalid.message.contains(SERVICE_TYPE_PHYSICAL_HANDOFF)
                || invalid
                    .message
                    .contains(EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1)
            {
                Some(SERVICE_TYPE_PHYSICAL_HANDOFF)
            } else {
                None
            };
            let Some(service_type) = service_type else {
                continue;
            };
            let template = offline_template_for_service_type(service_type)
                .unwrap_or("offline_template_unknown");
            let entry = offline_agg.entry(service_type.to_string()).or_default();
            if entry.template.is_empty() {
                entry.template = template.to_string();
            }
            entry.invalid_event_count = entry.invalid_event_count.saturating_add(1);
            if invalid.code == InvalidReasonCode::PolicyViolation {
                entry.invalid_policy_violation_count =
                    entry.invalid_policy_violation_count.saturating_add(1);
            }
            if invalid.code == InvalidReasonCode::InvalidPayload {
                entry.invalid_payload_count = entry.invalid_payload_count.saturating_add(1);
            }
        }
        let mut disputed_count = 0_u64;
        let mut delivered_flow_count = 0_u64;
        let mut resolved_count = 0_u64;
        let mut total_resolution_seconds = 0_u64;

        for milestone in replay.data.state.milestones.values() {
            let service_type = replay
                .data
                .state
                .orders
                .get(&milestone.order_id)
                .and_then(|order| replay.data.state.offers.get(&order.offer_id))
                .map(|offer| offer.service_type.clone())
                .unwrap_or_else(|| "unknown".to_string());

            let entry = lane_agg.entry(service_type.clone()).or_insert((0, 0, 0));
            entry.0 = entry.0.saturating_add(1);

            let is_terminal = matches!(
                milestone.status.as_str(),
                "Accepted" | "Settled" | "AutoRefunded"
            );
            if is_terminal {
                entry.1 = entry.1.saturating_add(1);
            }

            let is_completed = milestone.status == "Accepted"
                || (milestone.status == "Settled"
                    && milestone.provider_reward_credits.unwrap_or(0) > 0);
            if is_completed {
                entry.2 = entry.2.saturating_add(1);
            }

            if milestone.delivery_event_id.is_some() {
                delivered_flow_count = delivered_flow_count.saturating_add(1);
            }
            if let Some(template) = offline_template_for_service_type(&service_type) {
                let offline_entry = offline_agg.entry(service_type.clone()).or_default();
                if offline_entry.template.is_empty() {
                    offline_entry.template = template.to_string();
                }
                if milestone.delivery_event_id.is_some() {
                    offline_entry.delivered_count = offline_entry.delivered_count.saturating_add(1);
                }
                if milestone.dispute_event_id.is_some() {
                    offline_entry.disputed_count = offline_entry.disputed_count.saturating_add(1);
                }
                match milestone.status.as_str() {
                    "Accepted" => {
                        offline_entry.accepted_count =
                            offline_entry.accepted_count.saturating_add(1);
                    }
                    "Settled" => {
                        offline_entry.settled_count = offline_entry.settled_count.saturating_add(1);
                    }
                    "AutoRefunded" => {
                        offline_entry.auto_refunded_count =
                            offline_entry.auto_refunded_count.saturating_add(1);
                    }
                    "Disputed" | "SettlementPending" => {
                        offline_entry.unresolved_dispute_count =
                            offline_entry.unresolved_dispute_count.saturating_add(1);
                    }
                    _ => {}
                }
            }

            if let Some(dispute_event_id) = &milestone.dispute_event_id {
                disputed_count = disputed_count.saturating_add(1);
                let Some(started_at) = dispute_opened_at.get(dispute_event_id) else {
                    continue;
                };

                let resolved_at = if milestone.status == "Settled" {
                    milestone
                        .settlement_event_id
                        .as_ref()
                        .and_then(|event_id| settlement_at.get(event_id))
                        .cloned()
                } else if milestone.status == "AutoRefunded" {
                    milestone
                        .dispute_timeout_at
                        .as_deref()
                        .and_then(|value| parse_timestamp(value).ok())
                } else {
                    None
                };

                if let Some(resolved_at) = resolved_at {
                    if resolved_at >= *started_at {
                        resolved_count = resolved_count.saturating_add(1);
                        total_resolution_seconds =
                            total_resolution_seconds.saturating_add(
                                (resolved_at - *started_at).num_seconds().max(0) as u64,
                            );
                    }
                }
            }
        }

        let lane_completion = lane_agg
            .into_iter()
            .map(
                |(service_type, (milestone_count, terminal_count, completed_count))| {
                    LaneEconomicsMetric {
                        service_type,
                        milestone_count,
                        terminal_count,
                        completed_count,
                        completion_rate_bps: ratio_bps(completed_count, terminal_count),
                    }
                },
            )
            .collect::<Vec<_>>();
        let offline_lane_templates = offline_agg
            .into_iter()
            .map(|(service_type, agg)| OfflineLaneTelemetryMetric {
                service_type,
                template: agg.template,
                offer_count: agg.offer_count,
                order_count: agg.order_count,
                delivered_count: agg.delivered_count,
                accepted_count: agg.accepted_count,
                disputed_count: agg.disputed_count,
                settled_count: agg.settled_count,
                auto_refunded_count: agg.auto_refunded_count,
                unresolved_dispute_count: agg.unresolved_dispute_count,
                dispute_rate_bps: ratio_bps(agg.disputed_count, agg.delivered_count),
                auto_refund_rate_bps: ratio_bps(agg.auto_refunded_count, agg.disputed_count),
                invalid_event_count: agg.invalid_event_count,
                invalid_policy_violation_count: agg.invalid_policy_violation_count,
                invalid_payload_count: agg.invalid_payload_count,
            })
            .collect::<Vec<_>>();
        let effective_policy = &replay.data.state.policy.policy;
        let offline_lane_alerts = offline_lane_templates
            .iter()
            .flat_map(|lane| offline_lane_alerts_for_metric(lane, effective_policy))
            .collect::<Vec<_>>();
        let offline_lane_alert_rollup = offline_lane_alert_rollup(&offline_lane_alerts);

        let average_resolution_seconds = if resolved_count > 0 {
            Some(total_resolution_seconds / resolved_count)
        } else {
            None
        };

        let mut balances = replay
            .data
            .state
            .balances
            .values()
            .map(|balance| balance.effective_balance)
            .collect::<Vec<_>>();
        balances.sort_unstable_by(|left, right| right.cmp(left));
        let total_active_balance = balances.iter().copied().sum::<u64>();
        let top_n = 5_usize;
        let top_n_balance = balances.iter().copied().take(top_n).sum::<u64>();

        let mut invalid_by_code_counts = BTreeMap::<String, u64>::new();
        for event in &replay.data.invalid_events {
            let key = event.code.to_string();
            *invalid_by_code_counts.entry(key).or_insert(0) += 1;
        }
        let total_processed_events =
            (replay.data.applied_event_ids.len() + replay.data.invalid_events.len()) as u64;
        let total_invalid_events = replay.data.invalid_events.len() as u64;
        let invalid_by_code = invalid_by_code_counts
            .into_iter()
            .map(|(code, count)| {
                let rate = InvalidReasonRate {
                    count,
                    rate_bps: ratio_bps(count, total_processed_events),
                };
                (code, rate)
            })
            .collect::<BTreeMap<_, _>>();

        Ok(EconomicsMetricsView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data: EconomicsMetricsData {
                lane_completion,
                offline_lane_templates,
                offline_lane_alerts,
                offline_lane_alert_rollup,
                dispute: DisputeMetrics {
                    disputed_count,
                    delivered_flow_count,
                    dispute_rate_bps: ratio_bps(disputed_count, delivered_flow_count),
                    resolved_count,
                    average_resolution_seconds,
                },
                credit_concentration: CreditConcentrationMetrics {
                    top_n,
                    identity_count: balances.len(),
                    total_active_balance,
                    top_n_balance,
                    top_n_share_bps: ratio_bps(top_n_balance, total_active_balance),
                },
                issuance_expiry: IssuanceExpiryMetrics {
                    issued_credits,
                    scheduled_expired_credits,
                    expiry_pressure_bps: ratio_bps(scheduled_expired_credits, issued_credits),
                },
                invalid_event_rates: InvalidEventRateMetrics {
                    total_processed_events,
                    total_invalid_events,
                    total_invalid_rate_bps: ratio_bps(total_invalid_events, total_processed_events),
                    by_code: invalid_by_code,
                },
            },
        })
    }

    pub fn p2h_risk_view(
        &self,
        identity: &str,
        as_of: Option<DateTime<Utc>>,
    ) -> Result<P2HRiskStateView> {
        let replay = self.replay_view(as_of)?;
        let effective_as_of =
            parse_timestamp(&replay.as_of).map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let root = resolve_identity_root(&replay.data, identity);
        let data = root
            .as_ref()
            .map(|resolved| self.compute_p2h_for_identity(&replay.data, resolved, effective_as_of))
            .transpose()?
            .map(|output| {
                let score = output.history.last().map_or(0, |entry| entry.score_after);
                P2HRiskState {
                    identity_pub_key: root.clone().unwrap_or_default(),
                    score,
                    band: p2h_risk_band(score),
                    components: output.components,
                    counters: output.counters,
                }
            });

        Ok(P2HRiskStateView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data,
        })
    }

    pub fn p2h_risk_history_view(
        &self,
        identity: &str,
        as_of: Option<DateTime<Utc>>,
        cursor: Option<usize>,
        limit: usize,
    ) -> Result<P2HRiskHistoryView> {
        let replay = self.replay_view(as_of)?;
        let effective_as_of =
            parse_timestamp(&replay.as_of).map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let root = resolve_identity_root(&replay.data, identity);
        let history = root
            .as_ref()
            .map(|resolved| self.compute_p2h_for_identity(&replay.data, resolved, effective_as_of))
            .transpose()?
            .map(|output| output.history)
            .unwrap_or_default();
        let data = paginate_p2h_history(&history, cursor, limit);
        Ok(P2HRiskHistoryView {
            as_of: replay.as_of,
            source: replay.source,
            snapshot_id: replay.snapshot_id,
            data,
        })
    }

    fn compute_p2h_for_identity(
        &self,
        replay: &ReplayOutput,
        identity_root: &str,
        as_of: DateTime<Utc>,
    ) -> Result<P2HComputationOutput> {
        let applied_event_ids = replay
            .applied_event_ids
            .iter()
            .cloned()
            .collect::<BTreeSet<_>>();

        let claim_events = self.collect_events_for_metrics("ContributionClaim", as_of)?;
        let attest_events = self.collect_events_for_metrics("ContributionAttest", as_of)?;
        let mint_events = self.collect_events_for_metrics("MintCredits", as_of)?;
        let dispute_events = self.collect_events_for_metrics("ServiceDispute", as_of)?;
        let settle_events = self.collect_events_for_metrics("ServiceSettle", as_of)?;
        let accept_events = self.collect_events_for_metrics("ServiceAccept", as_of)?;

        let mut event_time_by_id = BTreeMap::<String, DateTime<Utc>>::new();
        for event in [
            claim_events.as_slice(),
            attest_events.as_slice(),
            mint_events.as_slice(),
            dispute_events.as_slice(),
            settle_events.as_slice(),
            accept_events.as_slice(),
        ]
        .into_iter()
        .flatten()
        {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            if let Ok(created_at) = parse_timestamp(&event.created_at) {
                event_time_by_id.insert(event.event_id.clone(), created_at);
            }
        }

        let mut claim_created_at = BTreeMap::<String, DateTime<Utc>>::new();
        for event in claim_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let Some(claim_id) = event.payload_json.get("claimId").and_then(Value::as_str) else {
                continue;
            };
            let Ok(created_at) = parse_timestamp(&event.created_at) else {
                continue;
            };
            claim_created_at.insert(claim_id.to_string(), created_at);
        }

        let mut dispute_opened_at = BTreeMap::<String, DateTime<Utc>>::new();
        for event in dispute_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let opened_at = event
                .payload_json
                .get("disputedAt")
                .and_then(Value::as_str)
                .and_then(|value| parse_timestamp(value).ok())
                .or_else(|| parse_timestamp(&event.created_at).ok());
            if let Some(opened_at) = opened_at {
                dispute_opened_at.insert(event.event_id, opened_at);
            }
        }

        let mut settled_by_dispute = BTreeMap::<String, (String, DateTime<Utc>)>::new();
        for event in settle_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let Some(dispute_ref) = event
                .references_json
                .as_ref()
                .and_then(|value| value.get("dispute"))
                .and_then(Value::as_str)
            else {
                continue;
            };
            let settled_at = event
                .payload_json
                .get("settledAt")
                .and_then(Value::as_str)
                .and_then(|value| parse_timestamp(value).ok())
                .or_else(|| parse_timestamp(&event.created_at).ok());
            let Some(settled_at) = settled_at else {
                continue;
            };
            settled_by_dispute
                .entry(dispute_ref.to_string())
                .and_modify(|current| {
                    if settled_at < current.1 {
                        *current = (event.event_id.clone(), settled_at);
                    }
                })
                .or_insert((event.event_id, settled_at));
        }

        let mut attests_by_claim = BTreeMap::<String, Vec<(String, DateTime<Utc>, String)>>::new();
        for event in attest_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let Some(claim_id) = event.payload_json.get("claimId").and_then(Value::as_str) else {
                continue;
            };
            let Some(created_at) = event_time_by_id.get(&event.event_id).cloned() else {
                continue;
            };
            let attestor_root = resolve_identity_root(replay, &event.author_pub_key)
                .unwrap_or(event.author_pub_key);
            attests_by_claim
                .entry(claim_id.to_string())
                .or_default()
                .push((attestor_root, created_at, event.event_id));
        }
        for entries in attests_by_claim.values_mut() {
            entries.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.2.cmp(&right.2)));
        }

        let mut deltas = Vec::<P2HRiskDelta>::new();
        let mut interaction_counts = BTreeMap::<String, u64>::new();
        let mut global_counterparties = BTreeSet::<String>::new();

        for milestone in replay.state.milestones.values() {
            let Some(order) = replay.state.orders.get(&milestone.order_id) else {
                continue;
            };
            let Some(close_time_event_id) = (match milestone.status.as_str() {
                "Accepted" | "Settled" => {
                    milestone.settlement_event_id.as_ref().and_then(|event_id| {
                        event_time_by_id
                            .get(event_id)
                            .map(|time| (event_id.clone(), *time))
                    })
                }
                "AutoRefunded" => milestone
                    .dispute_timeout_at
                    .as_deref()
                    .and_then(|value| parse_timestamp(value).ok())
                    .map(|time| {
                        (
                            format!(
                                "auto-refund:{}:{}",
                                milestone.order_id, milestone.milestone_id
                            ),
                            time,
                        )
                    }),
                _ => None,
            }) else {
                continue;
            };

            let identity_involved =
                order.provider_pub_key == identity_root || order.buyer_pub_key == identity_root;
            if !identity_involved {
                continue;
            }
            let counterparty = if order.provider_pub_key == identity_root {
                order.buyer_pub_key.clone()
            } else {
                order.provider_pub_key.clone()
            };
            if counterparty == identity_root {
                continue;
            }
            global_counterparties.insert(counterparty.clone());
            let count = interaction_counts.entry(counterparty).or_insert(0);
            *count = count.saturating_add(1);
            if *count > 1 {
                deltas.push(P2HRiskDelta {
                    event_id: close_time_event_id.0,
                    created_at: close_time_event_id.1,
                    component: "repeated_bilateral_loop".to_string(),
                    reason: "repeat marketplace interaction with same counterparty".to_string(),
                    delta: 12,
                });
            }
        }

        let mut issuance_events = Vec::<(String, DateTime<Utc>, Vec<String>)>::new();
        for event in mint_events {
            if !applied_event_ids.contains(&event.event_id) {
                continue;
            }
            let Some(beneficiary_pub_key) = event
                .payload_json
                .get("beneficiaryPubKey")
                .and_then(Value::as_str)
            else {
                continue;
            };
            let beneficiary_root = resolve_identity_root(replay, beneficiary_pub_key)
                .unwrap_or(beneficiary_pub_key.to_string());
            if beneficiary_root != identity_root {
                continue;
            }
            let Some(created_at) = event_time_by_id.get(&event.event_id).cloned() else {
                continue;
            };
            let source_claim_id = event
                .payload_json
                .get("sourceClaimId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let counterparties = replay
                .state
                .claims
                .values()
                .find(|claim| {
                    claim.claimant_pub_key == identity_root && claim.claim_id == source_claim_id
                })
                .map(|claim| claim.approvals.iter().cloned().collect::<Vec<_>>())
                .unwrap_or_default();
            issuance_events.push((event.event_id, created_at, counterparties));
        }

        for milestone in replay.state.milestones.values() {
            if milestone.provider_reward_credits.unwrap_or(0) == 0 {
                continue;
            }
            let Some(order) = replay.state.orders.get(&milestone.order_id) else {
                continue;
            };
            if order.provider_pub_key != identity_root {
                continue;
            }
            let Some(event_id) = milestone.settlement_event_id.as_ref() else {
                continue;
            };
            let Some(created_at) = event_time_by_id.get(event_id).cloned() else {
                continue;
            };
            issuance_events.push((
                event_id.clone(),
                created_at,
                vec![order.buyer_pub_key.clone()],
            ));
        }
        issuance_events
            .sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));

        let mut seen_issuance_counterparties = BTreeSet::<String>::new();
        for (event_id, created_at, counterparties) in &issuance_events {
            let filtered = counterparties
                .iter()
                .filter(|counterparty| *counterparty != identity_root)
                .cloned()
                .collect::<Vec<_>>();
            if !filtered.is_empty() {
                let has_new = filtered
                    .iter()
                    .any(|counterparty| !seen_issuance_counterparties.contains(counterparty));
                if !has_new {
                    deltas.push(P2HRiskDelta {
                        event_id: event_id.clone(),
                        created_at: *created_at,
                        component: "counterparty_diversity_weakness".to_string(),
                        reason: "issuance reused existing counterparties only".to_string(),
                        delta: 8,
                    });
                }
                for counterparty in filtered {
                    seen_issuance_counterparties.insert(counterparty.clone());
                    global_counterparties.insert(counterparty);
                }
            }
        }

        let mut short_cycle_dispute_count = 0_u64;
        for milestone in replay.state.milestones.values() {
            let Some(dispute_event_id) = milestone.dispute_event_id.as_deref() else {
                continue;
            };
            let Some(order) = replay.state.orders.get(&milestone.order_id) else {
                continue;
            };
            if order.provider_pub_key != identity_root && order.buyer_pub_key != identity_root {
                continue;
            }
            let Some(disputed_at) = dispute_opened_at.get(dispute_event_id).cloned() else {
                continue;
            };
            let Some((settlement_event_id, settled_at)) =
                settled_by_dispute.get(dispute_event_id).cloned()
            else {
                continue;
            };
            let elapsed_seconds = (settled_at - disputed_at).num_seconds();
            if (0..=900).contains(&elapsed_seconds) {
                short_cycle_dispute_count = short_cycle_dispute_count.saturating_add(1);
                deltas.push(P2HRiskDelta {
                    event_id: settlement_event_id,
                    created_at: settled_at,
                    component: "dispute_settlement_anomaly".to_string(),
                    reason: "dispute settled within short-cycle threshold".to_string(),
                    delta: 15,
                });
            }
        }

        let mut claim_rows = replay
            .state
            .claims
            .values()
            .filter(|claim| claim.claimant_pub_key == identity_root)
            .map(|claim| {
                (
                    claim.claim_id.clone(),
                    claim_created_at
                        .get(&claim.claim_id)
                        .cloned()
                        .unwrap_or(as_of),
                )
            })
            .collect::<Vec<_>>();
        claim_rows.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));

        let mut seen_attestor_sets = BTreeSet::<String>::new();
        let mut clustered_attestation_count = 0_u64;
        for (claim_id, _) in claim_rows {
            let Some(entries) = attests_by_claim.get(&claim_id).cloned() else {
                continue;
            };
            if entries.len() >= 2 {
                let first = entries.first().map(|item| item.1).unwrap_or(as_of);
                let last = entries.last().map(|item| item.1).unwrap_or(as_of);
                if (last - first).num_seconds() <= 300 {
                    clustered_attestation_count = clustered_attestation_count.saturating_add(1);
                    deltas.push(P2HRiskDelta {
                        event_id: entries
                            .last()
                            .map(|item| item.2.clone())
                            .unwrap_or_else(|| format!("attest-cluster:{claim_id}")),
                        created_at: last,
                        component: "attestation_clustering".to_string(),
                        reason: "attestations arrived in a synchronized short window".to_string(),
                        delta: 7,
                    });
                }
            }

            let attestor_set_key = entries
                .iter()
                .map(|item| item.0.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect::<Vec<_>>()
                .join("|");
            if !attestor_set_key.is_empty() {
                if seen_attestor_sets.contains(&attestor_set_key) {
                    let tail = entries.last().cloned();
                    deltas.push(P2HRiskDelta {
                        event_id: tail
                            .as_ref()
                            .map(|item| item.2.clone())
                            .unwrap_or_else(|| format!("attest-repeat:{claim_id}")),
                        created_at: tail.as_ref().map(|item| item.1).unwrap_or(as_of),
                        component: "attestation_clustering".to_string(),
                        reason: "same attestor cohort repeated across claims".to_string(),
                        delta: 9,
                    });
                }
                seen_attestor_sets.insert(attestor_set_key);
            }
        }

        deltas.sort_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.event_id.cmp(&right.event_id))
                .then_with(|| left.component.cmp(&right.component))
                .then_with(|| left.reason.cmp(&right.reason))
                .then_with(|| left.delta.cmp(&right.delta))
        });

        let mut components = P2HRiskComponents {
            repeated_bilateral_loop: 0,
            counterparty_diversity_weakness: 0,
            dispute_settlement_anomaly: 0,
            attestation_clustering: 0,
        };
        let mut score = 0_i64;
        let mut history = Vec::new();
        for delta in deltas {
            score = score.saturating_add(delta.delta);
            match delta.component.as_str() {
                "repeated_bilateral_loop" => {
                    components.repeated_bilateral_loop = components
                        .repeated_bilateral_loop
                        .saturating_add(delta.delta);
                }
                "counterparty_diversity_weakness" => {
                    components.counterparty_diversity_weakness = components
                        .counterparty_diversity_weakness
                        .saturating_add(delta.delta);
                }
                "dispute_settlement_anomaly" => {
                    components.dispute_settlement_anomaly = components
                        .dispute_settlement_anomaly
                        .saturating_add(delta.delta);
                }
                "attestation_clustering" => {
                    components.attestation_clustering = components
                        .attestation_clustering
                        .saturating_add(delta.delta);
                }
                _ => {}
            }
            history.push(P2HRiskHistoryEntry {
                event_id: delta.event_id,
                created_at: delta.created_at.to_rfc3339(),
                component: delta.component,
                reason: delta.reason,
                delta: delta.delta,
                score_after: score,
            });
        }

        Ok(P2HComputationOutput {
            components,
            counters: P2HRiskCounters {
                interaction_count: interaction_counts.values().copied().sum::<u64>(),
                unique_counterparties: global_counterparties.len() as u64,
                issuance_event_count: issuance_events.len() as u64,
                short_cycle_dispute_count,
                clustered_attestation_count,
            },
            history,
        })
    }

    fn replay_execution(&self, as_of: Option<DateTime<Utc>>) -> Result<ReplayExecution> {
        let effective_as_of = as_of.unwrap_or_else(Utc::now);
        if let Some(snapshot) =
            storage::find_latest_snapshot_at_or_before(&self.db_path, effective_as_of)?
        {
            let snapshot_as_of = parse_timestamp(&snapshot.meta.as_of)
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            let is_checkpoint_eligible =
                snapshot.meta.format_version >= 5 && snapshot.checkpoint_json.is_some();
            if is_checkpoint_eligible {
                let has_backfill = storage::has_replay_backfill_since_seq(
                    &self.db_path,
                    snapshot.meta.event_seq,
                    snapshot_as_of,
                )?;
                if !has_backfill {
                    let checkpoint_value = snapshot
                        .checkpoint_json
                        .ok_or_else(|| anyhow::anyhow!("snapshot checkpoint is missing"))?;
                    let checkpoint: ReplayCheckpoint = serde_json::from_value(checkpoint_value)
                        .context("parsing snapshot checkpoint")?;
                    let delta_lines = self.read_replay_lines(
                        Some(effective_as_of),
                        Some(snapshot_as_of),
                        Some(snapshot.meta.event_seq),
                    )?;
                    let run = replay_jsonl_resume_as_of(
                        &delta_lines,
                        &self.policy,
                        Some(effective_as_of),
                        Some(checkpoint),
                    );
                    return Ok(ReplayExecution {
                        as_of: effective_as_of,
                        source: "snapshot_plus_delta".to_string(),
                        snapshot_id: Some(snapshot.meta.snapshot_id),
                        run,
                    });
                }
            }
        }

        let lines = self.read_replay_lines(Some(effective_as_of), None, None)?;
        let run = replay_jsonl_resume_as_of(&lines, &self.policy, Some(effective_as_of), None);
        Ok(ReplayExecution {
            as_of: effective_as_of,
            source: "genesis_replay".to_string(),
            snapshot_id: None,
            run,
        })
    }

    fn read_replay_lines(
        &self,
        as_of: Option<DateTime<Utc>>,
        created_after: Option<DateTime<Utc>>,
        after_seq: Option<i64>,
    ) -> Result<Vec<ReplayInputLine>> {
        let rows =
            storage::list_replay_event_lines(&self.db_path, as_of, created_after, after_seq)?;
        Ok(rows
            .into_iter()
            .map(|row| ReplayInputLine {
                line: row.seq as usize,
                raw_json: row.raw_json,
            })
            .collect())
    }

    fn collect_events_for_metrics(
        &self,
        kind: &str,
        as_of: DateTime<Utc>,
    ) -> Result<Vec<EventRow>> {
        let mut cursor = None;
        let mut events = Vec::new();

        loop {
            let page = self.list_events(cursor, 200, Some(kind), None)?;
            for event in page.events {
                let created_at = match parse_timestamp(&event.created_at) {
                    Ok(value) => value,
                    Err(_) => continue,
                };
                if created_at <= as_of {
                    events.push(event);
                }
            }
            if let Some(next_cursor) = page.next_cursor {
                cursor = Some(next_cursor);
            } else {
                break;
            }
        }

        Ok(events)
    }
}

fn paginate_policy_updates(
    updates: &[PolicyUpdateState],
    cursor: Option<usize>,
    limit: usize,
) -> PolicyTimelinePage {
    let total = updates.len();
    let start = cursor.unwrap_or(0).min(total);
    let page_size = limit.max(1).min(200);
    let end = (start + page_size).min(total);
    let items = updates[start..end].to_vec();
    let next_cursor = (end < total).then_some(end);
    PolicyTimelinePage {
        updates: items,
        next_cursor,
        total,
    }
}

fn paginate_reputation_history(
    entries: &[ReputationHistoryEntry],
    cursor: Option<usize>,
    limit: usize,
) -> ReputationHistoryPage {
    let total = entries.len();
    let start = cursor.unwrap_or(0).min(total);
    let page_size = limit.max(1).min(200);
    let end = (start + page_size).min(total);
    let items = entries[start..end].to_vec();
    let next_cursor = (end < total).then_some(end);
    ReputationHistoryPage {
        entries: items,
        next_cursor,
        total,
    }
}

struct DiscoveryOffersPage {
    offers: Vec<DiscoveryOfferRow>,
    next_cursor: Option<usize>,
    total: usize,
}

fn paginate_discovery_offers(
    offers: &[DiscoveryOfferRow],
    cursor: Option<usize>,
    limit: usize,
) -> DiscoveryOffersPage {
    let total = offers.len();
    let start = cursor.unwrap_or(0).min(total);
    let page_size = limit.max(1).min(200);
    let end = (start + page_size).min(total);
    let items = offers[start..end].to_vec();
    let next_cursor = (end < total).then_some(end);
    DiscoveryOffersPage {
        offers: items,
        next_cursor,
        total,
    }
}

struct ParticipantOrdersSlicePage {
    orders: Vec<ParticipantOrderRow>,
    next_cursor: Option<usize>,
    total: usize,
}

fn paginate_participant_orders(
    orders: &[ParticipantOrderRow],
    cursor: Option<usize>,
    limit: usize,
) -> ParticipantOrdersSlicePage {
    let total = orders.len();
    let start = cursor.unwrap_or(0).min(total);
    let page_size = limit.max(1).min(200);
    let end = (start + page_size).min(total);
    let items = orders[start..end].to_vec();
    let next_cursor = (end < total).then_some(end);
    ParticipantOrdersSlicePage {
        orders: items,
        next_cursor,
        total,
    }
}

fn participant_order_row(
    order: &OrderState,
    participant_role: &str,
    service_type: String,
) -> ParticipantOrderRow {
    ParticipantOrderRow {
        order_id: order.order_id.clone(),
        offer_id: order.offer_id.clone(),
        provider_pub_key: order.provider_pub_key.clone(),
        buyer_pub_key: order.buyer_pub_key.clone(),
        order_expires_at: order.order_expires_at.clone(),
        milestone_ids: order.milestone_ids.clone(),
        status: order.status.clone(),
        created_event_id: order.created_event_id.clone(),
        service_type,
        participant_role: participant_role.to_string(),
    }
}

fn normalize_participant_pub_key(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.len() != 64 || !trimmed.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err("participant must be a 64-character hex public key".to_string());
    }
    Ok(trimmed.to_ascii_lowercase())
}

pub fn parse_participant_order_role(value: Option<&str>) -> Result<ParticipantOrderRole, String> {
    match value.map(str::trim).filter(|item| !item.is_empty()) {
        None | Some("any") => Ok(ParticipantOrderRole::Any),
        Some("buyer") => Ok(ParticipantOrderRole::Buyer),
        Some("provider") => Ok(ParticipantOrderRole::Provider),
        Some(other) => Err(format!("invalid role: {other}")),
    }
}

fn pubkey_matches(candidate: &str, participant: &str) -> bool {
    candidate.trim().eq_ignore_ascii_case(participant)
}

fn paginate_p2h_history(
    entries: &[P2HRiskHistoryEntry],
    cursor: Option<usize>,
    limit: usize,
) -> P2HRiskHistoryPage {
    let total = entries.len();
    let start = cursor.unwrap_or(0).min(total);
    let page_size = limit.max(1).min(200);
    let end = (start + page_size).min(total);
    let items = entries[start..end].to_vec();
    let next_cursor = (end < total).then_some(end);
    P2HRiskHistoryPage {
        entries: items,
        next_cursor,
        total,
    }
}

fn resolve_identity_root(replay: &ReplayOutput, identity: &str) -> Option<String> {
    if replay.state.identities.contains_key(identity) {
        return Some(identity.to_string());
    }
    replay
        .state
        .identities
        .iter()
        .find_map(|(root, record)| (record.active_pub_key == identity).then(|| root.clone()))
}

fn unique_sorted_strings(values: Vec<String>) -> Vec<String> {
    let mut out = values
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    out.sort();
    out.dedup();
    out
}

fn ratio_bps(numerator: u64, denominator: u64) -> u64 {
    if denominator == 0 {
        0
    } else {
        ((numerator as u128) * 10_000 / denominator as u128) as u64
    }
}

fn offline_lane_alerts_for_metric(
    metric: &OfflineLaneTelemetryMetric,
    policy: &Policy,
) -> Vec<OfflineLaneAlert> {
    let Some(lane_policy) = resolve_offline_lane_alert_policy(policy, &metric.service_type) else {
        return Vec::new();
    };

    let mut alerts = Vec::new();
    if lane_policy.unresolved_dispute_count_threshold > 0
        && metric.unresolved_dispute_count >= lane_policy.unresolved_dispute_count_threshold
    {
        alerts.push(OfflineLaneAlert {
            service_type: metric.service_type.clone(),
            template: metric.template.clone(),
            alert_code: "OFFLINE_UNRESOLVED_DISPUTES".to_string(),
            severity: alert_severity_label(lane_policy.unresolved_disputes_severity).to_string(),
            value: metric.unresolved_dispute_count,
            threshold: lane_policy.unresolved_dispute_count_threshold,
            reason: "offline lane has unresolved disputed milestones".to_string(),
        });
    }
    if lane_policy.dispute_rate_bps_threshold > 0
        && metric.dispute_rate_bps >= lane_policy.dispute_rate_bps_threshold
        && metric.order_count >= lane_policy.dispute_rate_min_orders
    {
        alerts.push(OfflineLaneAlert {
            service_type: metric.service_type.clone(),
            template: metric.template.clone(),
            alert_code: "OFFLINE_HIGH_DISPUTE_RATE".to_string(),
            severity: alert_severity_label(lane_policy.dispute_rate_severity).to_string(),
            value: metric.dispute_rate_bps,
            threshold: lane_policy.dispute_rate_bps_threshold,
            reason: "offline lane dispute rate exceeds configured threshold".to_string(),
        });
    }
    if lane_policy.auto_refund_rate_bps_threshold > 0
        && metric.auto_refund_rate_bps >= lane_policy.auto_refund_rate_bps_threshold
        && metric.disputed_count >= lane_policy.auto_refund_min_disputes
    {
        alerts.push(OfflineLaneAlert {
            service_type: metric.service_type.clone(),
            template: metric.template.clone(),
            alert_code: "OFFLINE_HIGH_AUTO_REFUND_RATE".to_string(),
            severity: alert_severity_label(lane_policy.auto_refund_rate_severity).to_string(),
            value: metric.auto_refund_rate_bps,
            threshold: lane_policy.auto_refund_rate_bps_threshold,
            reason: "offline disputes are resolving to auto-refund too frequently".to_string(),
        });
    }
    if lane_policy.invalid_payload_count_threshold > 0
        && metric.invalid_payload_count >= lane_policy.invalid_payload_count_threshold
    {
        alerts.push(OfflineLaneAlert {
            service_type: metric.service_type.clone(),
            template: metric.template.clone(),
            alert_code: "OFFLINE_INVALID_PAYLOAD_SPIKE".to_string(),
            severity: alert_severity_label(lane_policy.invalid_payload_spike_severity).to_string(),
            value: metric.invalid_payload_count,
            threshold: lane_policy.invalid_payload_count_threshold,
            reason: "offline lane has repeated invalid payload evidence".to_string(),
        });
    }
    if lane_policy.policy_violation_count_threshold > 0
        && metric.invalid_policy_violation_count >= lane_policy.policy_violation_count_threshold
    {
        alerts.push(OfflineLaneAlert {
            service_type: metric.service_type.clone(),
            template: metric.template.clone(),
            alert_code: "OFFLINE_POLICY_VIOLATION_SPIKE".to_string(),
            severity: alert_severity_label(lane_policy.policy_violation_spike_severity).to_string(),
            value: metric.invalid_policy_violation_count,
            threshold: lane_policy.policy_violation_count_threshold,
            reason: "offline lane has repeated policy-violation attempts".to_string(),
        });
    }

    alerts.sort_by(|left, right| {
        left.service_type
            .cmp(&right.service_type)
            .then_with(|| left.alert_code.cmp(&right.alert_code))
            .then_with(|| left.severity.cmp(&right.severity))
            .then_with(|| left.value.cmp(&right.value))
            .then_with(|| left.threshold.cmp(&right.threshold))
            .then_with(|| left.reason.cmp(&right.reason))
    });
    alerts
}

fn offline_lane_alert_rollup(alerts: &[OfflineLaneAlert]) -> OfflineLaneAlertRollup {
    let total_alert_count = alerts.len() as u64;
    let mut by_severity = BTreeMap::<String, u64>::new();
    let mut by_code = BTreeMap::<String, u64>::new();
    let mut affected_service_types = BTreeSet::new();
    let mut critical_service_types = BTreeSet::new();
    let mut by_service_alert_count = BTreeMap::<String, u64>::new();
    let mut by_service_code = BTreeMap::<String, BTreeMap<String, u64>>::new();
    let mut by_service_highest = BTreeMap::<String, String>::new();
    let mut highest_severity: Option<String> = None;
    let mut highest_rank = 0_u8;

    for alert in alerts {
        *by_severity.entry(alert.severity.clone()).or_insert(0) += 1;
        *by_code.entry(alert.alert_code.clone()).or_insert(0) += 1;
        affected_service_types.insert(alert.service_type.clone());
        if alert.severity == "critical" {
            critical_service_types.insert(alert.service_type.clone());
        }
        *by_service_alert_count
            .entry(alert.service_type.clone())
            .or_insert(0) += 1;
        *by_service_code
            .entry(alert.service_type.clone())
            .or_default()
            .entry(alert.alert_code.clone())
            .or_insert(0) += 1;
        let service_severity = by_service_highest
            .entry(alert.service_type.clone())
            .or_insert_with(|| alert.severity.clone());
        if alert_severity_rank(&alert.severity) > alert_severity_rank(service_severity) {
            *service_severity = alert.severity.clone();
        }

        let rank = alert_severity_rank(&alert.severity);
        if rank > highest_rank || highest_severity.is_none() {
            highest_rank = rank;
            highest_severity = Some(alert.severity.clone());
        }
    }

    let mut by_severity = by_severity
        .into_iter()
        .map(|(severity, count)| OfflineLaneAlertSeverityCount { severity, count })
        .collect::<Vec<_>>();
    by_severity.sort_by(|left, right| {
        alert_severity_rank(&right.severity)
            .cmp(&alert_severity_rank(&left.severity))
            .then_with(|| left.severity.cmp(&right.severity))
    });

    let by_code = by_code
        .into_iter()
        .map(|(alert_code, count)| OfflineLaneAlertCodeCount { alert_code, count })
        .collect::<Vec<_>>();
    let top_alert_code = by_code
        .iter()
        .max_by(|left, right| {
            left.count
                .cmp(&right.count)
                .then_with(|| right.alert_code.cmp(&left.alert_code))
        })
        .map(|value| value.alert_code.clone());
    let service_summaries = by_service_alert_count
        .into_iter()
        .map(|(service_type, alert_count)| {
            let mut by_code_rows = by_service_code
                .get(&service_type)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|(alert_code, count)| OfflineLaneAlertCodeCount { alert_code, count })
                .collect::<Vec<_>>();
            by_code_rows.sort_by(|left, right| left.alert_code.cmp(&right.alert_code));
            let top_alert_code = by_code_rows
                .iter()
                .max_by(|left, right| {
                    left.count
                        .cmp(&right.count)
                        .then_with(|| right.alert_code.cmp(&left.alert_code))
                })
                .map(|value| value.alert_code.clone());
            let highest_severity = by_service_highest.get(&service_type).cloned();
            let highest_rank = highest_severity
                .as_deref()
                .map(alert_severity_rank)
                .unwrap_or(0);
            let action_required = highest_rank >= 2;
            let action_level = alert_action_level_for_rank(highest_rank).to_string();
            let deterministic_fingerprint = offline_lane_service_summary_fingerprint(
                &service_type,
                alert_count,
                action_level.as_str(),
                highest_severity.as_deref(),
                top_alert_code.as_deref(),
                &by_code_rows,
            );
            OfflineLaneAlertServiceSummary {
                service_type: service_type.clone(),
                alert_count,
                action_required,
                action_level,
                highest_severity,
                top_alert_code,
                deterministic_fingerprint,
                by_code: by_code_rows,
            }
        })
        .collect::<Vec<_>>();
    let mut by_action_level = BTreeMap::<String, u64>::new();
    for summary in &service_summaries {
        *by_action_level
            .entry(summary.action_level.clone())
            .or_insert(0) += 1;
    }
    let mut by_action_level = by_action_level
        .into_iter()
        .map(|(action_level, count)| OfflineLaneAlertActionLevelCount {
            action_level,
            count,
        })
        .collect::<Vec<_>>();
    by_action_level.sort_by(|left, right| {
        alert_action_rank(&right.action_level)
            .cmp(&alert_action_rank(&left.action_level))
            .then_with(|| left.action_level.cmp(&right.action_level))
    });
    let top_service_type = service_summaries
        .iter()
        .max_by(|left, right| {
            left.alert_count
                .cmp(&right.alert_count)
                .then_with(|| right.service_type.cmp(&left.service_type))
        })
        .map(|value| value.service_type.clone());
    let mut prioritized_services = service_summaries
        .iter()
        .map(|summary| OfflineLaneAlertPriorityEntry {
            rank: 0,
            service_type: summary.service_type.clone(),
            alert_count: summary.alert_count,
            action_level: summary.action_level.clone(),
            highest_severity: summary.highest_severity.clone(),
            top_alert_code: summary.top_alert_code.clone(),
        })
        .collect::<Vec<_>>();
    prioritized_services.sort_by(|left, right| {
        alert_action_rank(&right.action_level)
            .cmp(&alert_action_rank(&left.action_level))
            .then_with(|| right.alert_count.cmp(&left.alert_count))
            .then_with(|| left.service_type.cmp(&right.service_type))
    });
    for (index, entry) in prioritized_services.iter_mut().enumerate() {
        entry.rank = (index + 1) as u64;
    }
    let priority_head_service_type = prioritized_services
        .first()
        .map(|entry| entry.service_type.clone());
    let priority_head_action_level = prioritized_services
        .first()
        .map(|entry| entry.action_level.clone());
    let priority_tail_service_type = prioritized_services
        .last()
        .map(|entry| entry.service_type.clone());
    let priority_queue_size = prioritized_services.len() as u64;
    let priority_queue_intervene_count = prioritized_services
        .iter()
        .filter(|entry| entry.action_level == "intervene")
        .count() as u64;
    let priority_queue_watch_count = prioritized_services
        .iter()
        .filter(|entry| entry.action_level == "watch")
        .count() as u64;
    let priority_queue_none_count = prioritized_services
        .iter()
        .filter(|entry| entry.action_level == "none")
        .count() as u64;
    let priority_queue_actionable_count =
        priority_queue_intervene_count.saturating_add(priority_queue_watch_count);
    let priority_queue_intervene_within_actionable_bps = ratio_bps(
        priority_queue_intervene_count,
        priority_queue_actionable_count,
    );
    let priority_queue_watch_within_actionable_bps =
        ratio_bps(priority_queue_watch_count, priority_queue_actionable_count);
    let priority_queue_action_escalation_profile = priority_queue_action_escalation_profile(
        priority_queue_intervene_count,
        priority_queue_watch_count,
        priority_queue_actionable_count,
    )
    .to_string();
    let priority_queue_action_polarization_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let gap = priority_queue_intervene_count.abs_diff(priority_queue_watch_count);
        ratio_bps(gap, priority_queue_actionable_count)
    };
    let priority_queue_action_balance_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        10_000_u64.saturating_sub(priority_queue_action_polarization_bps)
    };
    let priority_queue_action_polarization_profile = priority_queue_action_polarization_profile(
        priority_queue_actionable_count,
        priority_queue_action_polarization_bps,
    )
    .to_string();
    let priority_queue_action_weighted_units = priority_queue_intervene_count
        .saturating_mul(3)
        .saturating_add(priority_queue_watch_count.saturating_mul(2))
        .saturating_add(priority_queue_none_count);
    let priority_queue_action_weighted_pressure_bps = if priority_queue_size == 0 {
        0
    } else {
        ((u128::from(priority_queue_action_weighted_units) * 10_000)
            / (u128::from(priority_queue_size) * 3)) as u64
    };
    let priority_queue_action_weighted_per_service_milli = if priority_queue_size == 0 {
        0
    } else {
        ((u128::from(priority_queue_action_weighted_units) * 1_000)
            / u128::from(priority_queue_size)) as u64
    };
    let priority_queue_action_weighted_profile = priority_queue_action_weighted_profile(
        priority_queue_size,
        priority_queue_actionable_count,
        priority_queue_action_weighted_pressure_bps,
    )
    .to_string();
    let priority_queue_actionable_bps =
        ratio_bps(priority_queue_actionable_count, priority_queue_size);
    let priority_queue_critical_bps =
        ratio_bps(priority_queue_intervene_count, priority_queue_size);
    let (priority_queue_dominant_action_level, priority_queue_dominant_action_count) =
        if priority_queue_size == 0 {
            ("empty".to_string(), 0_u64)
        } else {
            let counts = [
                ("intervene", priority_queue_intervene_count),
                ("watch", priority_queue_watch_count),
                ("none", priority_queue_none_count),
            ];
            let (action_level, count) = counts
                .iter()
                .copied()
                .max_by(|left, right| {
                    left.1
                        .cmp(&right.1)
                        .then_with(|| alert_action_rank(left.0).cmp(&alert_action_rank(right.0)))
                })
                .expect("action counts must be non-empty");
            (action_level.to_string(), count)
        };
    let priority_queue_dominant_action_bps =
        ratio_bps(priority_queue_dominant_action_count, priority_queue_size);
    let priority_queue_top_service_alert_share_bps = prioritized_services
        .first()
        .map(|entry| ratio_bps(entry.alert_count, total_alert_count))
        .unwrap_or(0);
    let mut concentration_ranked_services = service_summaries
        .iter()
        .map(|summary| (summary.service_type.as_str(), summary.alert_count))
        .collect::<Vec<_>>();
    concentration_ranked_services
        .sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(right.0)));
    let priority_queue_leader_alert_share_bps = concentration_ranked_services
        .first()
        .map(|value| ratio_bps(value.1, total_alert_count))
        .unwrap_or(0);
    let priority_queue_runner_up_alert_share_bps = concentration_ranked_services
        .get(1)
        .map(|value| ratio_bps(value.1, total_alert_count))
        .unwrap_or(0);
    let priority_queue_leader_gap_bps = priority_queue_leader_alert_share_bps
        .saturating_sub(priority_queue_runner_up_alert_share_bps);
    let priority_queue_top2_service_alert_count = prioritized_services
        .iter()
        .take(2)
        .map(|entry| entry.alert_count)
        .sum::<u64>();
    let priority_queue_top2_service_alert_share_bps =
        ratio_bps(priority_queue_top2_service_alert_count, total_alert_count);
    let (sum_squared_alert_counts, priority_queue_service_concentration_hhi_bps) =
        if total_alert_count == 0 {
            (0_u128, 0_u64)
        } else {
            let sum_squared = prioritized_services
                .iter()
                .map(|entry| {
                    let value = u128::from(entry.alert_count);
                    value * value
                })
                .sum::<u128>();
            let total = u128::from(total_alert_count);
            let hhi_bps = ((sum_squared * 10_000) / (total * total)) as u64;
            (sum_squared, hhi_bps)
        };
    let priority_queue_long_tail_alert_share_bps = if total_alert_count == 0 {
        0
    } else {
        10_000_u64.saturating_sub(priority_queue_top2_service_alert_share_bps)
    };
    let priority_queue_effective_service_count_milli =
        if total_alert_count == 0 || sum_squared_alert_counts == 0 {
            0
        } else {
            let total = u128::from(total_alert_count);
            ((total * total * 1_000) / sum_squared_alert_counts) as u64
        };
    let priority_queue_leader_dominance_level = if total_alert_count == 0 {
        "none".to_string()
    } else if priority_queue_leader_gap_bps >= 4_000 {
        "dominant".to_string()
    } else if priority_queue_leader_gap_bps >= 2_000 {
        "tilted".to_string()
    } else {
        "balanced".to_string()
    };
    let priority_queue_coverage_50_count =
        priority_queue_coverage_count(&concentration_ranked_services, total_alert_count, 5_000);
    let priority_queue_coverage_80_count =
        priority_queue_coverage_count(&concentration_ranked_services, total_alert_count, 8_000);
    let priority_queue_coverage_95_count =
        priority_queue_coverage_count(&concentration_ranked_services, total_alert_count, 9_500);
    let priority_queue_coverage_profile = priority_queue_coverage_profile(
        total_alert_count,
        priority_queue_coverage_50_count,
        priority_queue_coverage_80_count,
    )
    .to_string();
    let priority_queue_risk_score_bps = priority_queue_risk_score_bps(
        priority_queue_actionable_bps,
        priority_queue_critical_bps,
        priority_queue_service_concentration_hhi_bps,
        priority_queue_leader_gap_bps,
        priority_queue_size,
    );
    let priority_queue_risk_band =
        priority_queue_risk_band(priority_queue_risk_score_bps, priority_queue_size).to_string();
    let priority_queue_response_sla_seconds =
        priority_queue_response_sla_seconds(&priority_queue_risk_band);
    let concentration_counts = concentration_ranked_services
        .iter()
        .map(|(_, count)| *count)
        .collect::<Vec<_>>();
    let priority_queue_inequality_gini_bps =
        priority_queue_inequality_gini_bps(&concentration_counts, total_alert_count);
    let priority_queue_evenness_milli = if priority_queue_size == 0 {
        0
    } else {
        priority_queue_effective_service_count_milli / priority_queue_size
    };
    let priority_queue_distribution_profile = priority_queue_distribution_profile(
        priority_queue_size,
        priority_queue_inequality_gini_bps,
        priority_queue_evenness_milli,
    )
    .to_string();
    let priority_queue_concentration_level = priority_queue_concentration_level(
        total_alert_count,
        priority_queue_service_concentration_hhi_bps,
    )
    .to_string();
    let priority_queue_load_level = priority_queue_load_level(priority_queue_size).to_string();
    let priority_queue_sla_multiplier_bps =
        priority_queue_sla_multiplier_bps(priority_queue_load_level.as_str());
    let priority_queue_effective_response_sla_seconds = if priority_queue_response_sla_seconds == 0
    {
        0
    } else {
        ((u128::from(priority_queue_response_sla_seconds)
            * u128::from(priority_queue_sla_multiplier_bps)
            + 9_999)
            / 10_000) as u64
    };
    let priority_queue_sla_slippage_bps = if priority_queue_response_sla_seconds == 0 {
        0
    } else {
        ratio_bps(
            priority_queue_effective_response_sla_seconds
                .saturating_sub(priority_queue_response_sla_seconds),
            priority_queue_response_sla_seconds,
        )
    };
    let priority_queue_sla_pressure_profile = priority_queue_sla_pressure_profile(
        priority_queue_actionable_count,
        priority_queue_response_sla_seconds,
        priority_queue_sla_slippage_bps,
    )
    .to_string();
    let priority_queue_sla_adjusted_risk_bps = ((u128::from(priority_queue_risk_score_bps)
        * u128::from(priority_queue_sla_multiplier_bps))
        / 10_000) as u64;
    let priority_queue_sla_risk_delta_bps =
        priority_queue_sla_adjusted_risk_bps.saturating_sub(priority_queue_risk_score_bps);
    let priority_queue_operational_posture = priority_queue_operational_posture(
        priority_queue_actionable_count,
        priority_queue_sla_adjusted_risk_bps,
    )
    .to_string();
    let priority_queue_attention_index_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        ((u128::from(priority_queue_sla_adjusted_risk_bps)
            + u128::from(priority_queue_action_weighted_pressure_bps))
            / 2) as u64
    };
    let priority_queue_attention_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_attention_index_bps.abs_diff(priority_queue_risk_score_bps)
    };
    let priority_queue_attention_profile = priority_queue_attention_profile(
        priority_queue_actionable_count,
        priority_queue_attention_index_bps,
    )
    .to_string();
    let priority_queue_readiness_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let load_burden_bps = ((u128::from(priority_queue_attention_index_bps)
            + u128::from(priority_queue_action_weighted_pressure_bps))
            / 2) as u64;
        10_000_u64.saturating_sub(load_burden_bps)
    };
    let priority_queue_readiness_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_readiness_score_bps.abs_diff(priority_queue_action_balance_score_bps)
    };
    let priority_queue_readiness_profile = priority_queue_readiness_profile(
        priority_queue_actionable_count,
        priority_queue_readiness_score_bps,
    )
    .to_string();
    let priority_queue_stability_index_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_readiness_score_bps.saturating_sub(priority_queue_attention_delta_bps / 2)
    };
    let priority_queue_stability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_stability_index_bps.abs_diff(priority_queue_readiness_score_bps)
    };
    let priority_queue_stability_profile = priority_queue_stability_profile(
        priority_queue_actionable_count,
        priority_queue_stability_index_bps,
    )
    .to_string();
    let priority_queue_resilience_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let inequality_inverse_bps = 10_000_u64.saturating_sub(priority_queue_inequality_gini_bps);
        ((u128::from(priority_queue_stability_index_bps)
            + u128::from(priority_queue_action_balance_score_bps)
            + u128::from(inequality_inverse_bps))
            / 3) as u64
    };
    let priority_queue_resilience_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_resilience_score_bps.abs_diff(priority_queue_stability_index_bps)
    };
    let priority_queue_resilience_profile = priority_queue_resilience_profile(
        priority_queue_actionable_count,
        priority_queue_resilience_score_bps,
    )
    .to_string();
    let priority_queue_coherence_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        ((u128::from(priority_queue_resilience_score_bps)
            + u128::from(priority_queue_stability_index_bps)
            + u128::from(priority_queue_readiness_score_bps))
            / 3) as u64
    };
    let priority_queue_coherence_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let trio = [
            priority_queue_resilience_score_bps,
            priority_queue_stability_index_bps,
            priority_queue_readiness_score_bps,
        ];
        let max_value = trio.iter().copied().max().unwrap_or(0);
        let min_value = trio.iter().copied().min().unwrap_or(0);
        max_value.saturating_sub(min_value)
    };
    let priority_queue_coherence_profile = priority_queue_coherence_profile(
        priority_queue_actionable_count,
        priority_queue_coherence_score_bps,
        priority_queue_coherence_delta_bps,
    )
    .to_string();
    let priority_queue_adaptability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let diversity_signal_bps = priority_queue_evenness_milli.saturating_mul(10).min(10_000);
        let non_critical_signal_bps = 10_000_u64.saturating_sub(priority_queue_critical_bps);
        ((u128::from(priority_queue_coherence_score_bps)
            + u128::from(diversity_signal_bps)
            + u128::from(non_critical_signal_bps))
            / 3) as u64
    };
    let priority_queue_adaptability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_adaptability_score_bps.abs_diff(priority_queue_coherence_score_bps)
    };
    let priority_queue_adaptability_profile = priority_queue_adaptability_profile(
        priority_queue_actionable_count,
        priority_queue_adaptability_score_bps,
    )
    .to_string();
    let priority_queue_sustainability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let coherence_spread_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_coherence_delta_bps);
        let attention_inverse_bps = 10_000_u64.saturating_sub(priority_queue_attention_index_bps);
        ((u128::from(priority_queue_adaptability_score_bps)
            + u128::from(coherence_spread_inverse_bps)
            + u128::from(attention_inverse_bps))
            / 3) as u64
    };
    let priority_queue_sustainability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_sustainability_score_bps.abs_diff(priority_queue_adaptability_score_bps)
    };
    let priority_queue_sustainability_profile = priority_queue_sustainability_profile(
        priority_queue_actionable_count,
        priority_queue_sustainability_score_bps,
    )
    .to_string();
    let priority_queue_continuity_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let sla_slippage_inverse_bps = 10_000_u64.saturating_sub(priority_queue_sla_slippage_bps);
        let leader_gap_inverse_bps = 10_000_u64.saturating_sub(priority_queue_leader_gap_bps);
        ((u128::from(priority_queue_sustainability_score_bps)
            + u128::from(sla_slippage_inverse_bps)
            + u128::from(leader_gap_inverse_bps))
            / 3) as u64
    };
    let priority_queue_continuity_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_continuity_score_bps.abs_diff(priority_queue_sustainability_score_bps)
    };
    let priority_queue_continuity_profile = priority_queue_continuity_profile(
        priority_queue_actionable_count,
        priority_queue_continuity_score_bps,
    )
    .to_string();
    let priority_queue_recoverability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_inverse_bps = 10_000_u64.saturating_sub(priority_queue_attention_index_bps);
        ((u128::from(priority_queue_continuity_score_bps)
            + u128::from(priority_queue_action_balance_score_bps)
            + u128::from(attention_inverse_bps))
            / 3) as u64
    };
    let priority_queue_recoverability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_recoverability_score_bps.abs_diff(priority_queue_continuity_score_bps)
    };
    let priority_queue_recoverability_profile = priority_queue_recoverability_profile(
        priority_queue_actionable_count,
        priority_queue_recoverability_score_bps,
    )
    .to_string();
    let priority_queue_regeneration_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let critical_inverse_bps = 10_000_u64.saturating_sub(priority_queue_critical_bps);
        ((u128::from(priority_queue_recoverability_score_bps)
            + u128::from(priority_queue_sustainability_score_bps)
            + u128::from(critical_inverse_bps))
            / 3) as u64
    };
    let priority_queue_regeneration_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_regeneration_score_bps.abs_diff(priority_queue_recoverability_score_bps)
    };
    let priority_queue_regeneration_profile = priority_queue_regeneration_profile(
        priority_queue_actionable_count,
        priority_queue_regeneration_score_bps,
    )
    .to_string();
    let priority_queue_restoration_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let action_weighted_pressure_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_action_weighted_pressure_bps);
        ((u128::from(priority_queue_regeneration_score_bps)
            + u128::from(priority_queue_continuity_score_bps)
            + u128::from(action_weighted_pressure_inverse_bps))
            / 3) as u64
    };
    let priority_queue_restoration_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_restoration_score_bps.abs_diff(priority_queue_regeneration_score_bps)
    };
    let priority_queue_restoration_profile = priority_queue_restoration_profile(
        priority_queue_actionable_count,
        priority_queue_restoration_score_bps,
    )
    .to_string();
    let priority_queue_stewardship_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let risk_inverse_bps = 10_000_u64.saturating_sub(priority_queue_sla_adjusted_risk_bps);
        ((u128::from(priority_queue_restoration_score_bps)
            + u128::from(priority_queue_recoverability_score_bps)
            + u128::from(risk_inverse_bps))
            / 3) as u64
    };
    let priority_queue_stewardship_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_stewardship_score_bps.abs_diff(priority_queue_restoration_score_bps)
    };
    let priority_queue_stewardship_profile = priority_queue_stewardship_profile(
        priority_queue_actionable_count,
        priority_queue_stewardship_score_bps,
    )
    .to_string();
    let priority_queue_guardianship_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let leader_gap_inverse_bps = 10_000_u64.saturating_sub(priority_queue_leader_gap_bps);
        ((u128::from(priority_queue_stewardship_score_bps)
            + u128::from(priority_queue_restoration_score_bps)
            + u128::from(leader_gap_inverse_bps))
            / 3) as u64
    };
    let priority_queue_guardianship_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_guardianship_score_bps.abs_diff(priority_queue_stewardship_score_bps)
    };
    let priority_queue_guardianship_profile = priority_queue_guardianship_profile(
        priority_queue_actionable_count,
        priority_queue_guardianship_score_bps,
    )
    .to_string();
    let priority_queue_assurance_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let sla_risk_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_sla_risk_delta_bps);
        ((u128::from(priority_queue_guardianship_score_bps)
            + u128::from(priority_queue_stewardship_score_bps)
            + u128::from(sla_risk_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_assurance_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_assurance_score_bps.abs_diff(priority_queue_guardianship_score_bps)
    };
    let priority_queue_assurance_profile = priority_queue_assurance_profile(
        priority_queue_actionable_count,
        priority_queue_assurance_score_bps,
        priority_queue_assurance_delta_bps,
    )
    .to_string();
    let priority_queue_vigilance_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let action_polarization_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_action_polarization_bps);
        ((u128::from(priority_queue_assurance_score_bps)
            + u128::from(priority_queue_guardianship_score_bps)
            + u128::from(action_polarization_inverse_bps))
            / 3) as u64
    };
    let priority_queue_vigilance_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_vigilance_score_bps.abs_diff(priority_queue_assurance_score_bps)
    };
    let priority_queue_vigilance_profile = priority_queue_vigilance_profile(
        priority_queue_actionable_count,
        priority_queue_vigilance_score_bps,
        priority_queue_vigilance_delta_bps,
    )
    .to_string();
    let priority_queue_oversight_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let concentration_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_service_concentration_hhi_bps);
        ((u128::from(priority_queue_vigilance_score_bps)
            + u128::from(priority_queue_assurance_score_bps)
            + u128::from(concentration_inverse_bps))
            / 3) as u64
    };
    let priority_queue_oversight_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_oversight_score_bps.abs_diff(priority_queue_vigilance_score_bps)
    };
    let priority_queue_oversight_profile = priority_queue_oversight_profile(
        priority_queue_actionable_count,
        priority_queue_oversight_score_bps,
    )
    .to_string();
    let priority_queue_accountability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let concentration_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_service_concentration_hhi_bps);
        ((u128::from(priority_queue_vigilance_score_bps)
            + u128::from(priority_queue_assurance_score_bps)
            + u128::from(concentration_inverse_bps))
            / 3) as u64
    };
    let priority_queue_accountability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_accountability_score_bps.abs_diff(priority_queue_vigilance_score_bps)
    };
    let priority_queue_accountability_profile = priority_queue_accountability_profile(
        priority_queue_actionable_count,
        priority_queue_accountability_score_bps,
    )
    .to_string();
    let priority_queue_verifiability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let sla_risk_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_sla_risk_delta_bps);
        ((u128::from(priority_queue_accountability_score_bps)
            + u128::from(priority_queue_oversight_score_bps)
            + u128::from(sla_risk_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_verifiability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_verifiability_score_bps.abs_diff(priority_queue_accountability_score_bps)
    };
    let priority_queue_verifiability_profile = priority_queue_verifiability_profile(
        priority_queue_actionable_count,
        priority_queue_verifiability_score_bps,
    )
    .to_string();
    let priority_queue_auditability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let coherence_spread_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_coherence_delta_bps);
        ((u128::from(priority_queue_verifiability_score_bps)
            + u128::from(priority_queue_accountability_score_bps)
            + u128::from(coherence_spread_inverse_bps))
            / 3) as u64
    };
    let priority_queue_auditability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_auditability_score_bps.abs_diff(priority_queue_verifiability_score_bps)
    };
    let priority_queue_auditability_profile = priority_queue_auditability_profile(
        priority_queue_actionable_count,
        priority_queue_auditability_score_bps,
    )
    .to_string();
    let priority_queue_transparency_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let inequality_inverse_bps = 10_000_u64.saturating_sub(priority_queue_inequality_gini_bps);
        ((u128::from(priority_queue_auditability_score_bps)
            + u128::from(priority_queue_verifiability_score_bps)
            + u128::from(inequality_inverse_bps))
            / 3) as u64
    };
    let priority_queue_transparency_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_transparency_score_bps.abs_diff(priority_queue_auditability_score_bps)
    };
    let priority_queue_transparency_profile = priority_queue_transparency_profile(
        priority_queue_actionable_count,
        priority_queue_transparency_score_bps,
    )
    .to_string();
    let priority_queue_legibility_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let evenness_signal_bps = priority_queue_evenness_milli.saturating_mul(10).min(10_000);
        ((u128::from(priority_queue_transparency_score_bps)
            + u128::from(priority_queue_auditability_score_bps)
            + u128::from(evenness_signal_bps))
            / 3) as u64
    };
    let priority_queue_legibility_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_legibility_score_bps.abs_diff(priority_queue_transparency_score_bps)
    };
    let priority_queue_legibility_profile = priority_queue_legibility_profile(
        priority_queue_actionable_count,
        priority_queue_legibility_score_bps,
    )
    .to_string();
    let priority_queue_navigability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let leader_gap_inverse_bps = 10_000_u64.saturating_sub(priority_queue_leader_gap_bps);
        ((u128::from(priority_queue_legibility_score_bps)
            + u128::from(priority_queue_readiness_score_bps)
            + u128::from(leader_gap_inverse_bps))
            / 3) as u64
    };
    let priority_queue_navigability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_navigability_score_bps.abs_diff(priority_queue_legibility_score_bps)
    };
    let priority_queue_navigability_profile = priority_queue_navigability_profile(
        priority_queue_actionable_count,
        priority_queue_navigability_score_bps,
    )
    .to_string();
    let priority_queue_interpretability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let coherence_spread_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_coherence_delta_bps);
        ((u128::from(priority_queue_navigability_score_bps)
            + u128::from(priority_queue_transparency_score_bps)
            + u128::from(coherence_spread_inverse_bps))
            / 3) as u64
    };
    let priority_queue_interpretability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_interpretability_score_bps.abs_diff(priority_queue_navigability_score_bps)
    };
    let priority_queue_interpretability_profile = priority_queue_interpretability_profile(
        priority_queue_actionable_count,
        priority_queue_interpretability_score_bps,
    )
    .to_string();
    let priority_queue_explainability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let action_polarization_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_action_polarization_bps);
        ((u128::from(priority_queue_interpretability_score_bps)
            + u128::from(priority_queue_legibility_score_bps)
            + u128::from(action_polarization_inverse_bps))
            / 3) as u64
    };
    let priority_queue_explainability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_explainability_score_bps.abs_diff(priority_queue_interpretability_score_bps)
    };
    let priority_queue_explainability_profile = priority_queue_explainability_profile(
        priority_queue_actionable_count,
        priority_queue_explainability_score_bps,
    )
    .to_string();
    let priority_queue_clarity_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let coherence_spread_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_coherence_delta_bps);
        ((u128::from(priority_queue_explainability_score_bps)
            + u128::from(priority_queue_interpretability_score_bps)
            + u128::from(coherence_spread_inverse_bps))
            / 3) as u64
    };
    let priority_queue_clarity_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_clarity_score_bps.abs_diff(priority_queue_explainability_score_bps)
    };
    let priority_queue_clarity_profile = priority_queue_clarity_profile(
        priority_queue_actionable_count,
        priority_queue_clarity_score_bps,
    )
    .to_string();
    let priority_queue_comprehensibility_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_attention_delta_bps);
        ((u128::from(priority_queue_clarity_score_bps)
            + u128::from(priority_queue_explainability_score_bps)
            + u128::from(attention_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_comprehensibility_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_comprehensibility_score_bps.abs_diff(priority_queue_clarity_score_bps)
    };
    let priority_queue_comprehensibility_profile = priority_queue_comprehensibility_profile(
        priority_queue_actionable_count,
        priority_queue_comprehensibility_score_bps,
    )
    .to_string();
    let priority_queue_intelligibility_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_inverse_bps = 10_000_u64.saturating_sub(priority_queue_attention_index_bps);
        ((u128::from(priority_queue_comprehensibility_score_bps)
            + u128::from(priority_queue_clarity_score_bps)
            + u128::from(attention_inverse_bps))
            / 3) as u64
    };
    let priority_queue_intelligibility_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_intelligibility_score_bps
            .abs_diff(priority_queue_comprehensibility_score_bps)
    };
    let priority_queue_intelligibility_profile = priority_queue_intelligibility_profile(
        priority_queue_actionable_count,
        priority_queue_intelligibility_score_bps,
    )
    .to_string();
    let priority_queue_communicability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let sla_risk_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_sla_risk_delta_bps);
        ((u128::from(priority_queue_intelligibility_score_bps)
            + u128::from(priority_queue_comprehensibility_score_bps)
            + u128::from(sla_risk_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_communicability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_communicability_score_bps.abs_diff(priority_queue_intelligibility_score_bps)
    };
    let priority_queue_communicability_profile = priority_queue_communicability_profile(
        priority_queue_actionable_count,
        priority_queue_communicability_score_bps,
    )
    .to_string();
    let priority_queue_articulability_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let action_polarization_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_action_polarization_bps);
        ((u128::from(priority_queue_communicability_score_bps)
            + u128::from(priority_queue_intelligibility_score_bps)
            + u128::from(action_polarization_inverse_bps))
            / 3) as u64
    };
    let priority_queue_articulability_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_articulability_score_bps.abs_diff(priority_queue_communicability_score_bps)
    };
    let priority_queue_articulability_profile = priority_queue_articulability_profile(
        priority_queue_actionable_count,
        priority_queue_articulability_score_bps,
    )
    .to_string();
    let priority_queue_expressivity_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let inequality_inverse_bps = 10_000_u64.saturating_sub(priority_queue_inequality_gini_bps);
        ((u128::from(priority_queue_articulability_score_bps)
            + u128::from(priority_queue_communicability_score_bps)
            + u128::from(inequality_inverse_bps))
            / 3) as u64
    };
    let priority_queue_expressivity_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_expressivity_score_bps.abs_diff(priority_queue_articulability_score_bps)
    };
    let priority_queue_expressivity_profile = priority_queue_expressivity_profile(
        priority_queue_actionable_count,
        priority_queue_expressivity_score_bps,
    )
    .to_string();
    let priority_queue_eloquence_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_attention_delta_bps);
        ((u128::from(priority_queue_expressivity_score_bps)
            + u128::from(priority_queue_articulability_score_bps)
            + u128::from(attention_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_eloquence_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_eloquence_score_bps.abs_diff(priority_queue_expressivity_score_bps)
    };
    let priority_queue_eloquence_profile = priority_queue_eloquence_profile(
        priority_queue_actionable_count,
        priority_queue_eloquence_score_bps,
    )
    .to_string();
    let priority_queue_lucidity_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let action_polarization_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_action_polarization_bps);
        ((u128::from(priority_queue_eloquence_score_bps)
            + u128::from(priority_queue_intelligibility_score_bps)
            + u128::from(action_polarization_inverse_bps))
            / 3) as u64
    };
    let priority_queue_lucidity_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_lucidity_score_bps.abs_diff(priority_queue_eloquence_score_bps)
    };
    let priority_queue_lucidity_profile = priority_queue_lucidity_profile(
        priority_queue_actionable_count,
        priority_queue_lucidity_score_bps,
    )
    .to_string();
    let priority_queue_illumination_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_inverse_bps = 10_000_u64.saturating_sub(priority_queue_attention_index_bps);
        ((u128::from(priority_queue_lucidity_score_bps)
            + u128::from(priority_queue_transparency_score_bps)
            + u128::from(attention_inverse_bps))
            / 3) as u64
    };
    let priority_queue_illumination_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_illumination_score_bps.abs_diff(priority_queue_lucidity_score_bps)
    };
    let priority_queue_illumination_profile = priority_queue_illumination_profile(
        priority_queue_actionable_count,
        priority_queue_illumination_score_bps,
    )
    .to_string();
    let priority_queue_clarion_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_attention_delta_bps);
        ((u128::from(priority_queue_illumination_score_bps)
            + u128::from(priority_queue_eloquence_score_bps)
            + u128::from(attention_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_clarion_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_clarion_score_bps.abs_diff(priority_queue_illumination_score_bps)
    };
    let priority_queue_clarion_profile = priority_queue_clarion_profile(
        priority_queue_actionable_count,
        priority_queue_clarion_score_bps,
    )
    .to_string();
    let priority_queue_resonance_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let sla_risk_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_sla_risk_delta_bps);
        ((u128::from(priority_queue_clarion_score_bps)
            + u128::from(priority_queue_communicability_score_bps)
            + u128::from(sla_risk_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_resonance_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_resonance_score_bps.abs_diff(priority_queue_clarion_score_bps)
    };
    let priority_queue_resonance_profile = priority_queue_resonance_profile(
        priority_queue_actionable_count,
        priority_queue_resonance_score_bps,
    )
    .to_string();
    let priority_queue_cadence_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        let attention_delta_inverse_bps =
            10_000_u64.saturating_sub(priority_queue_attention_delta_bps);
        ((u128::from(priority_queue_resonance_score_bps)
            + u128::from(priority_queue_eloquence_score_bps)
            + u128::from(attention_delta_inverse_bps))
            / 3) as u64
    };
    let priority_queue_cadence_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_cadence_score_bps.abs_diff(priority_queue_resonance_score_bps)
    };
    let priority_queue_cadence_profile = priority_queue_cadence_profile(
        priority_queue_actionable_count,
        priority_queue_cadence_score_bps,
    )
    .to_string();
    let priority_queue_harmony_score_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        ((u128::from(priority_queue_cadence_score_bps)
            + u128::from(priority_queue_resonance_score_bps)
            + u128::from(priority_queue_communicability_score_bps))
            / 3) as u64
    };
    let priority_queue_harmony_delta_bps = if priority_queue_actionable_count == 0 {
        0
    } else {
        priority_queue_harmony_score_bps.abs_diff(priority_queue_cadence_score_bps)
    };
    let priority_queue_harmony_profile = priority_queue_harmony_profile(
        priority_queue_actionable_count,
        priority_queue_harmony_score_bps,
    )
    .to_string();
    let priority_queue_health = if priority_queue_size == 0 {
        "empty".to_string()
    } else if priority_queue_intervene_count > 0 {
        "critical".to_string()
    } else if priority_queue_watch_count > 0 {
        "attention".to_string()
    } else {
        "stable".to_string()
    };
    let priority_queue_fingerprint = offline_lane_priority_queue_fingerprint(&prioritized_services);
    let priority_queue_membership_fingerprint =
        offline_lane_priority_queue_membership_fingerprint(&prioritized_services);
    let priority_queue_order_fingerprint =
        offline_lane_priority_queue_order_fingerprint(&prioritized_services);
    let priority_queue_pressure_fingerprint = offline_lane_priority_queue_pressure_fingerprint(
        priority_queue_size,
        &priority_queue_health,
        priority_queue_intervene_count,
        priority_queue_watch_count,
        priority_queue_none_count,
        priority_queue_actionable_bps,
        priority_queue_critical_bps,
        &priority_queue_load_level,
    );
    let action_required = highest_rank >= 2;
    let action_level = alert_action_level_for_rank(highest_rank).to_string();
    let affected_service_types = affected_service_types.into_iter().collect::<Vec<_>>();
    let critical_service_types = critical_service_types.into_iter().collect::<Vec<_>>();
    let deterministic_fingerprint = offline_lane_alert_rollup_fingerprint(
        alerts.len() as u64,
        &action_level,
        highest_severity.as_deref(),
        top_alert_code.as_deref(),
        &by_severity,
        &by_action_level,
        &by_code,
        &affected_service_types,
        &critical_service_types,
        top_service_type.as_deref(),
        &service_summaries,
        &prioritized_services,
        priority_head_service_type.as_deref(),
        priority_head_action_level.as_deref(),
        priority_tail_service_type.as_deref(),
        priority_queue_size,
        &priority_queue_health,
        priority_queue_intervene_count,
        priority_queue_watch_count,
        priority_queue_none_count,
        priority_queue_actionable_count,
        priority_queue_intervene_within_actionable_bps,
        priority_queue_watch_within_actionable_bps,
        &priority_queue_action_escalation_profile,
        priority_queue_action_weighted_units,
        priority_queue_action_weighted_pressure_bps,
        priority_queue_action_weighted_per_service_milli,
        &priority_queue_action_weighted_profile,
        priority_queue_action_polarization_bps,
        priority_queue_action_balance_score_bps,
        &priority_queue_action_polarization_profile,
        &priority_queue_dominant_action_level,
        priority_queue_dominant_action_bps,
        priority_queue_top_service_alert_share_bps,
        priority_queue_leader_alert_share_bps,
        priority_queue_runner_up_alert_share_bps,
        priority_queue_leader_gap_bps,
        priority_queue_top2_service_alert_share_bps,
        priority_queue_service_concentration_hhi_bps,
        &priority_queue_concentration_level,
        priority_queue_long_tail_alert_share_bps,
        priority_queue_effective_service_count_milli,
        &priority_queue_leader_dominance_level,
        priority_queue_coverage_50_count,
        priority_queue_coverage_80_count,
        priority_queue_coverage_95_count,
        &priority_queue_coverage_profile,
        priority_queue_risk_score_bps,
        &priority_queue_risk_band,
        priority_queue_response_sla_seconds,
        priority_queue_sla_multiplier_bps,
        priority_queue_effective_response_sla_seconds,
        priority_queue_sla_slippage_bps,
        &priority_queue_sla_pressure_profile,
        priority_queue_sla_adjusted_risk_bps,
        priority_queue_sla_risk_delta_bps,
        &priority_queue_operational_posture,
        priority_queue_attention_index_bps,
        priority_queue_attention_delta_bps,
        &priority_queue_attention_profile,
        priority_queue_readiness_score_bps,
        priority_queue_readiness_delta_bps,
        &priority_queue_readiness_profile,
        priority_queue_stability_index_bps,
        priority_queue_stability_delta_bps,
        &priority_queue_stability_profile,
        priority_queue_resilience_score_bps,
        priority_queue_resilience_delta_bps,
        &priority_queue_resilience_profile,
        priority_queue_coherence_score_bps,
        priority_queue_coherence_delta_bps,
        &priority_queue_coherence_profile,
        priority_queue_adaptability_score_bps,
        priority_queue_adaptability_delta_bps,
        &priority_queue_adaptability_profile,
        priority_queue_sustainability_score_bps,
        priority_queue_sustainability_delta_bps,
        &priority_queue_sustainability_profile,
        priority_queue_continuity_score_bps,
        priority_queue_continuity_delta_bps,
        &priority_queue_continuity_profile,
        priority_queue_recoverability_score_bps,
        priority_queue_recoverability_delta_bps,
        &priority_queue_recoverability_profile,
        priority_queue_regeneration_score_bps,
        priority_queue_regeneration_delta_bps,
        &priority_queue_regeneration_profile,
        priority_queue_restoration_score_bps,
        priority_queue_restoration_delta_bps,
        &priority_queue_restoration_profile,
        priority_queue_stewardship_score_bps,
        priority_queue_stewardship_delta_bps,
        &priority_queue_stewardship_profile,
        priority_queue_guardianship_score_bps,
        priority_queue_guardianship_delta_bps,
        &priority_queue_guardianship_profile,
        priority_queue_assurance_score_bps,
        priority_queue_assurance_delta_bps,
        &priority_queue_assurance_profile,
        priority_queue_vigilance_score_bps,
        priority_queue_vigilance_delta_bps,
        &priority_queue_vigilance_profile,
        priority_queue_oversight_score_bps,
        priority_queue_oversight_delta_bps,
        &priority_queue_oversight_profile,
        priority_queue_accountability_score_bps,
        priority_queue_accountability_delta_bps,
        &priority_queue_accountability_profile,
        priority_queue_verifiability_score_bps,
        priority_queue_verifiability_delta_bps,
        &priority_queue_verifiability_profile,
        priority_queue_auditability_score_bps,
        priority_queue_auditability_delta_bps,
        &priority_queue_auditability_profile,
        priority_queue_transparency_score_bps,
        priority_queue_transparency_delta_bps,
        &priority_queue_transparency_profile,
        priority_queue_legibility_score_bps,
        priority_queue_legibility_delta_bps,
        &priority_queue_legibility_profile,
        priority_queue_navigability_score_bps,
        priority_queue_navigability_delta_bps,
        &priority_queue_navigability_profile,
        priority_queue_interpretability_score_bps,
        priority_queue_interpretability_delta_bps,
        &priority_queue_interpretability_profile,
        priority_queue_explainability_score_bps,
        priority_queue_explainability_delta_bps,
        &priority_queue_explainability_profile,
        priority_queue_clarity_score_bps,
        priority_queue_clarity_delta_bps,
        &priority_queue_clarity_profile,
        priority_queue_comprehensibility_score_bps,
        priority_queue_comprehensibility_delta_bps,
        &priority_queue_comprehensibility_profile,
        priority_queue_intelligibility_score_bps,
        priority_queue_intelligibility_delta_bps,
        &priority_queue_intelligibility_profile,
        priority_queue_communicability_score_bps,
        priority_queue_communicability_delta_bps,
        &priority_queue_communicability_profile,
        priority_queue_articulability_score_bps,
        priority_queue_articulability_delta_bps,
        &priority_queue_articulability_profile,
        priority_queue_expressivity_score_bps,
        priority_queue_expressivity_delta_bps,
        &priority_queue_expressivity_profile,
        priority_queue_eloquence_score_bps,
        priority_queue_eloquence_delta_bps,
        &priority_queue_eloquence_profile,
        priority_queue_lucidity_score_bps,
        priority_queue_lucidity_delta_bps,
        &priority_queue_lucidity_profile,
        priority_queue_illumination_score_bps,
        priority_queue_illumination_delta_bps,
        &priority_queue_illumination_profile,
        priority_queue_clarion_score_bps,
        priority_queue_clarion_delta_bps,
        &priority_queue_clarion_profile,
        priority_queue_resonance_score_bps,
        priority_queue_resonance_delta_bps,
        &priority_queue_resonance_profile,
        priority_queue_cadence_score_bps,
        priority_queue_cadence_delta_bps,
        &priority_queue_cadence_profile,
        priority_queue_harmony_score_bps,
        priority_queue_harmony_delta_bps,
        &priority_queue_harmony_profile,
        priority_queue_inequality_gini_bps,
        priority_queue_evenness_milli,
        &priority_queue_distribution_profile,
        priority_queue_actionable_bps,
        priority_queue_critical_bps,
        &priority_queue_load_level,
        &priority_queue_fingerprint,
        &priority_queue_membership_fingerprint,
        &priority_queue_order_fingerprint,
        &priority_queue_pressure_fingerprint,
    );

    OfflineLaneAlertRollup {
        total_alert_count: alerts.len() as u64,
        action_required,
        action_level,
        highest_severity,
        top_alert_code,
        deterministic_fingerprint,
        priority_queue_fingerprint,
        priority_queue_membership_fingerprint,
        priority_queue_order_fingerprint,
        priority_queue_pressure_fingerprint,
        priority_head_service_type,
        priority_head_action_level,
        priority_tail_service_type,
        priority_queue_size,
        priority_queue_health,
        priority_queue_intervene_count,
        priority_queue_watch_count,
        priority_queue_none_count,
        priority_queue_actionable_count,
        priority_queue_intervene_within_actionable_bps,
        priority_queue_watch_within_actionable_bps,
        priority_queue_action_escalation_profile,
        priority_queue_action_weighted_units,
        priority_queue_action_weighted_pressure_bps,
        priority_queue_action_weighted_per_service_milli,
        priority_queue_action_weighted_profile,
        priority_queue_action_polarization_bps,
        priority_queue_action_balance_score_bps,
        priority_queue_action_polarization_profile,
        priority_queue_dominant_action_level,
        priority_queue_dominant_action_bps,
        priority_queue_top_service_alert_share_bps,
        priority_queue_leader_alert_share_bps,
        priority_queue_runner_up_alert_share_bps,
        priority_queue_leader_gap_bps,
        priority_queue_top2_service_alert_share_bps,
        priority_queue_service_concentration_hhi_bps,
        priority_queue_concentration_level,
        priority_queue_long_tail_alert_share_bps,
        priority_queue_effective_service_count_milli,
        priority_queue_leader_dominance_level,
        priority_queue_coverage_50_count,
        priority_queue_coverage_80_count,
        priority_queue_coverage_95_count,
        priority_queue_coverage_profile,
        priority_queue_risk_score_bps,
        priority_queue_risk_band,
        priority_queue_response_sla_seconds,
        priority_queue_sla_multiplier_bps,
        priority_queue_effective_response_sla_seconds,
        priority_queue_sla_slippage_bps,
        priority_queue_sla_pressure_profile,
        priority_queue_sla_adjusted_risk_bps,
        priority_queue_sla_risk_delta_bps,
        priority_queue_operational_posture,
        priority_queue_attention_index_bps,
        priority_queue_attention_delta_bps,
        priority_queue_attention_profile,
        priority_queue_readiness_score_bps,
        priority_queue_readiness_delta_bps,
        priority_queue_readiness_profile,
        priority_queue_stability_index_bps,
        priority_queue_stability_delta_bps,
        priority_queue_stability_profile,
        priority_queue_resilience_score_bps,
        priority_queue_resilience_delta_bps,
        priority_queue_resilience_profile,
        priority_queue_coherence_score_bps,
        priority_queue_coherence_delta_bps,
        priority_queue_coherence_profile,
        priority_queue_adaptability_score_bps,
        priority_queue_adaptability_delta_bps,
        priority_queue_adaptability_profile,
        priority_queue_sustainability_score_bps,
        priority_queue_sustainability_delta_bps,
        priority_queue_sustainability_profile,
        priority_queue_continuity_score_bps,
        priority_queue_continuity_delta_bps,
        priority_queue_continuity_profile,
        priority_queue_recoverability_score_bps,
        priority_queue_recoverability_delta_bps,
        priority_queue_recoverability_profile,
        priority_queue_regeneration_score_bps,
        priority_queue_regeneration_delta_bps,
        priority_queue_regeneration_profile,
        priority_queue_restoration_score_bps,
        priority_queue_restoration_delta_bps,
        priority_queue_restoration_profile,
        priority_queue_stewardship_score_bps,
        priority_queue_stewardship_delta_bps,
        priority_queue_stewardship_profile,
        priority_queue_guardianship_score_bps,
        priority_queue_guardianship_delta_bps,
        priority_queue_guardianship_profile,
        priority_queue_assurance_score_bps,
        priority_queue_assurance_delta_bps,
        priority_queue_assurance_profile,
        priority_queue_vigilance_score_bps,
        priority_queue_vigilance_delta_bps,
        priority_queue_vigilance_profile,
        priority_queue_oversight_score_bps,
        priority_queue_oversight_delta_bps,
        priority_queue_oversight_profile,
        priority_queue_accountability_score_bps,
        priority_queue_accountability_delta_bps,
        priority_queue_accountability_profile,
        priority_queue_verifiability_score_bps,
        priority_queue_verifiability_delta_bps,
        priority_queue_verifiability_profile,
        priority_queue_auditability_score_bps,
        priority_queue_auditability_delta_bps,
        priority_queue_auditability_profile,
        priority_queue_transparency_score_bps,
        priority_queue_transparency_delta_bps,
        priority_queue_transparency_profile,
        priority_queue_legibility_score_bps,
        priority_queue_legibility_delta_bps,
        priority_queue_legibility_profile,
        priority_queue_navigability_score_bps,
        priority_queue_navigability_delta_bps,
        priority_queue_navigability_profile,
        priority_queue_interpretability_score_bps,
        priority_queue_interpretability_delta_bps,
        priority_queue_interpretability_profile,
        priority_queue_explainability_score_bps,
        priority_queue_explainability_delta_bps,
        priority_queue_explainability_profile,
        priority_queue_clarity_score_bps,
        priority_queue_clarity_delta_bps,
        priority_queue_clarity_profile,
        priority_queue_comprehensibility_score_bps,
        priority_queue_comprehensibility_delta_bps,
        priority_queue_comprehensibility_profile,
        priority_queue_intelligibility_score_bps,
        priority_queue_intelligibility_delta_bps,
        priority_queue_intelligibility_profile,
        priority_queue_communicability_score_bps,
        priority_queue_communicability_delta_bps,
        priority_queue_communicability_profile,
        priority_queue_articulability_score_bps,
        priority_queue_articulability_delta_bps,
        priority_queue_articulability_profile,
        priority_queue_expressivity_score_bps,
        priority_queue_expressivity_delta_bps,
        priority_queue_expressivity_profile,
        priority_queue_eloquence_score_bps,
        priority_queue_eloquence_delta_bps,
        priority_queue_eloquence_profile,
        priority_queue_lucidity_score_bps,
        priority_queue_lucidity_delta_bps,
        priority_queue_lucidity_profile,
        priority_queue_illumination_score_bps,
        priority_queue_illumination_delta_bps,
        priority_queue_illumination_profile,
        priority_queue_clarion_score_bps,
        priority_queue_clarion_delta_bps,
        priority_queue_clarion_profile,
        priority_queue_resonance_score_bps,
        priority_queue_resonance_delta_bps,
        priority_queue_resonance_profile,
        priority_queue_cadence_score_bps,
        priority_queue_cadence_delta_bps,
        priority_queue_cadence_profile,
        priority_queue_harmony_score_bps,
        priority_queue_harmony_delta_bps,
        priority_queue_harmony_profile,
        priority_queue_inequality_gini_bps,
        priority_queue_evenness_milli,
        priority_queue_distribution_profile,
        priority_queue_actionable_bps,
        priority_queue_critical_bps,
        priority_queue_load_level,
        by_severity,
        by_action_level,
        by_code,
        affected_service_types,
        critical_service_types,
        top_service_type,
        service_summaries,
        prioritized_services,
    }
}

fn offline_lane_alert_rollup_fingerprint(
    total_alert_count: u64,
    action_level: &str,
    highest_severity: Option<&str>,
    top_alert_code: Option<&str>,
    by_severity: &[OfflineLaneAlertSeverityCount],
    by_action_level: &[OfflineLaneAlertActionLevelCount],
    by_code: &[OfflineLaneAlertCodeCount],
    affected_service_types: &[String],
    critical_service_types: &[String],
    top_service_type: Option<&str>,
    service_summaries: &[OfflineLaneAlertServiceSummary],
    prioritized_services: &[OfflineLaneAlertPriorityEntry],
    priority_head_service_type: Option<&str>,
    priority_head_action_level: Option<&str>,
    priority_tail_service_type: Option<&str>,
    priority_queue_size: u64,
    priority_queue_health: &str,
    priority_queue_intervene_count: u64,
    priority_queue_watch_count: u64,
    priority_queue_none_count: u64,
    priority_queue_actionable_count: u64,
    priority_queue_intervene_within_actionable_bps: u64,
    priority_queue_watch_within_actionable_bps: u64,
    priority_queue_action_escalation_profile: &str,
    priority_queue_action_weighted_units: u64,
    priority_queue_action_weighted_pressure_bps: u64,
    priority_queue_action_weighted_per_service_milli: u64,
    priority_queue_action_weighted_profile: &str,
    priority_queue_action_polarization_bps: u64,
    priority_queue_action_balance_score_bps: u64,
    priority_queue_action_polarization_profile: &str,
    priority_queue_dominant_action_level: &str,
    priority_queue_dominant_action_bps: u64,
    priority_queue_top_service_alert_share_bps: u64,
    priority_queue_leader_alert_share_bps: u64,
    priority_queue_runner_up_alert_share_bps: u64,
    priority_queue_leader_gap_bps: u64,
    priority_queue_top2_service_alert_share_bps: u64,
    priority_queue_service_concentration_hhi_bps: u64,
    priority_queue_concentration_level: &str,
    priority_queue_long_tail_alert_share_bps: u64,
    priority_queue_effective_service_count_milli: u64,
    priority_queue_leader_dominance_level: &str,
    priority_queue_coverage_50_count: u64,
    priority_queue_coverage_80_count: u64,
    priority_queue_coverage_95_count: u64,
    priority_queue_coverage_profile: &str,
    priority_queue_risk_score_bps: u64,
    priority_queue_risk_band: &str,
    priority_queue_response_sla_seconds: u64,
    priority_queue_sla_multiplier_bps: u64,
    priority_queue_effective_response_sla_seconds: u64,
    priority_queue_sla_slippage_bps: u64,
    priority_queue_sla_pressure_profile: &str,
    priority_queue_sla_adjusted_risk_bps: u64,
    priority_queue_sla_risk_delta_bps: u64,
    priority_queue_operational_posture: &str,
    priority_queue_attention_index_bps: u64,
    priority_queue_attention_delta_bps: u64,
    priority_queue_attention_profile: &str,
    priority_queue_readiness_score_bps: u64,
    priority_queue_readiness_delta_bps: u64,
    priority_queue_readiness_profile: &str,
    priority_queue_stability_index_bps: u64,
    priority_queue_stability_delta_bps: u64,
    priority_queue_stability_profile: &str,
    priority_queue_resilience_score_bps: u64,
    priority_queue_resilience_delta_bps: u64,
    priority_queue_resilience_profile: &str,
    priority_queue_coherence_score_bps: u64,
    priority_queue_coherence_delta_bps: u64,
    priority_queue_coherence_profile: &str,
    priority_queue_adaptability_score_bps: u64,
    priority_queue_adaptability_delta_bps: u64,
    priority_queue_adaptability_profile: &str,
    priority_queue_sustainability_score_bps: u64,
    priority_queue_sustainability_delta_bps: u64,
    priority_queue_sustainability_profile: &str,
    priority_queue_continuity_score_bps: u64,
    priority_queue_continuity_delta_bps: u64,
    priority_queue_continuity_profile: &str,
    priority_queue_recoverability_score_bps: u64,
    priority_queue_recoverability_delta_bps: u64,
    priority_queue_recoverability_profile: &str,
    priority_queue_regeneration_score_bps: u64,
    priority_queue_regeneration_delta_bps: u64,
    priority_queue_regeneration_profile: &str,
    priority_queue_restoration_score_bps: u64,
    priority_queue_restoration_delta_bps: u64,
    priority_queue_restoration_profile: &str,
    priority_queue_stewardship_score_bps: u64,
    priority_queue_stewardship_delta_bps: u64,
    priority_queue_stewardship_profile: &str,
    priority_queue_guardianship_score_bps: u64,
    priority_queue_guardianship_delta_bps: u64,
    priority_queue_guardianship_profile: &str,
    priority_queue_assurance_score_bps: u64,
    priority_queue_assurance_delta_bps: u64,
    priority_queue_assurance_profile: &str,
    priority_queue_vigilance_score_bps: u64,
    priority_queue_vigilance_delta_bps: u64,
    priority_queue_vigilance_profile: &str,
    priority_queue_oversight_score_bps: u64,
    priority_queue_oversight_delta_bps: u64,
    priority_queue_oversight_profile: &str,
    priority_queue_accountability_score_bps: u64,
    priority_queue_accountability_delta_bps: u64,
    priority_queue_accountability_profile: &str,
    priority_queue_verifiability_score_bps: u64,
    priority_queue_verifiability_delta_bps: u64,
    priority_queue_verifiability_profile: &str,
    priority_queue_auditability_score_bps: u64,
    priority_queue_auditability_delta_bps: u64,
    priority_queue_auditability_profile: &str,
    priority_queue_transparency_score_bps: u64,
    priority_queue_transparency_delta_bps: u64,
    priority_queue_transparency_profile: &str,
    priority_queue_legibility_score_bps: u64,
    priority_queue_legibility_delta_bps: u64,
    priority_queue_legibility_profile: &str,
    priority_queue_navigability_score_bps: u64,
    priority_queue_navigability_delta_bps: u64,
    priority_queue_navigability_profile: &str,
    priority_queue_interpretability_score_bps: u64,
    priority_queue_interpretability_delta_bps: u64,
    priority_queue_interpretability_profile: &str,
    priority_queue_explainability_score_bps: u64,
    priority_queue_explainability_delta_bps: u64,
    priority_queue_explainability_profile: &str,
    priority_queue_clarity_score_bps: u64,
    priority_queue_clarity_delta_bps: u64,
    priority_queue_clarity_profile: &str,
    priority_queue_comprehensibility_score_bps: u64,
    priority_queue_comprehensibility_delta_bps: u64,
    priority_queue_comprehensibility_profile: &str,
    priority_queue_intelligibility_score_bps: u64,
    priority_queue_intelligibility_delta_bps: u64,
    priority_queue_intelligibility_profile: &str,
    priority_queue_communicability_score_bps: u64,
    priority_queue_communicability_delta_bps: u64,
    priority_queue_communicability_profile: &str,
    priority_queue_articulability_score_bps: u64,
    priority_queue_articulability_delta_bps: u64,
    priority_queue_articulability_profile: &str,
    priority_queue_expressivity_score_bps: u64,
    priority_queue_expressivity_delta_bps: u64,
    priority_queue_expressivity_profile: &str,
    priority_queue_eloquence_score_bps: u64,
    priority_queue_eloquence_delta_bps: u64,
    priority_queue_eloquence_profile: &str,
    priority_queue_lucidity_score_bps: u64,
    priority_queue_lucidity_delta_bps: u64,
    priority_queue_lucidity_profile: &str,
    priority_queue_illumination_score_bps: u64,
    priority_queue_illumination_delta_bps: u64,
    priority_queue_illumination_profile: &str,
    priority_queue_clarion_score_bps: u64,
    priority_queue_clarion_delta_bps: u64,
    priority_queue_clarion_profile: &str,
    priority_queue_resonance_score_bps: u64,
    priority_queue_resonance_delta_bps: u64,
    priority_queue_resonance_profile: &str,
    priority_queue_cadence_score_bps: u64,
    priority_queue_cadence_delta_bps: u64,
    priority_queue_cadence_profile: &str,
    priority_queue_harmony_score_bps: u64,
    priority_queue_harmony_delta_bps: u64,
    priority_queue_harmony_profile: &str,
    priority_queue_inequality_gini_bps: u64,
    priority_queue_evenness_milli: u64,
    priority_queue_distribution_profile: &str,
    priority_queue_actionable_bps: u64,
    priority_queue_critical_bps: u64,
    priority_queue_load_level: &str,
    priority_queue_fingerprint: &str,
    priority_queue_membership_fingerprint: &str,
    priority_queue_order_fingerprint: &str,
    priority_queue_pressure_fingerprint: &str,
) -> String {
    let mut lines = Vec::new();
    lines.push(format!("total={total_alert_count}"));
    lines.push(format!("action={action_level}"));
    lines.push(format!("highest={}", highest_severity.unwrap_or("none")));
    lines.push(format!("top={}", top_alert_code.unwrap_or("none")));
    lines.push(format!(
        "sev={}",
        by_severity
            .iter()
            .map(|value| format!("{}:{}", value.severity, value.count))
            .collect::<Vec<_>>()
            .join(",")
    ));
    lines.push(format!(
        "action_levels={}",
        by_action_level
            .iter()
            .map(|value| format!("{}:{}", value.action_level, value.count))
            .collect::<Vec<_>>()
            .join(",")
    ));
    lines.push(format!(
        "code={}",
        by_code
            .iter()
            .map(|value| format!("{}:{}", value.alert_code, value.count))
            .collect::<Vec<_>>()
            .join(",")
    ));
    lines.push(format!("svc={}", affected_service_types.join(",")));
    lines.push(format!("critical={}", critical_service_types.join(",")));
    lines.push(format!(
        "top_service={}",
        top_service_type.unwrap_or("none")
    ));
    lines.push(format!(
        "svc_sum={}",
        service_summaries
            .iter()
            .map(|summary| {
                format!(
                    "{}:{}:{}:{}:{}:{}:{}",
                    summary.service_type,
                    summary.alert_count,
                    summary.action_level,
                    summary.highest_severity.as_deref().unwrap_or("none"),
                    summary.top_alert_code.as_deref().unwrap_or("none"),
                    summary.deterministic_fingerprint,
                    summary
                        .by_code
                        .iter()
                        .map(|value| format!("{}:{}", value.alert_code, value.count))
                        .collect::<Vec<_>>()
                        .join("|")
                )
            })
            .collect::<Vec<_>>()
            .join(",")
    ));
    lines.push(format!(
        "prioritized={}",
        prioritized_services
            .iter()
            .map(|entry| {
                format!(
                    "{}:{}:{}:{}:{}:{}",
                    entry.rank,
                    entry.service_type,
                    entry.alert_count,
                    entry.action_level,
                    entry.highest_severity.as_deref().unwrap_or("none"),
                    entry.top_alert_code.as_deref().unwrap_or("none")
                )
            })
            .collect::<Vec<_>>()
            .join(",")
    ));
    lines.push(format!(
        "priority_head_service={}",
        priority_head_service_type.unwrap_or("none")
    ));
    lines.push(format!(
        "priority_head_action={}",
        priority_head_action_level.unwrap_or("none")
    ));
    lines.push(format!(
        "priority_tail_service={}",
        priority_tail_service_type.unwrap_or("none")
    ));
    lines.push(format!("priority_size={priority_queue_size}"));
    lines.push(format!("priority_health={priority_queue_health}"));
    lines.push(format!(
        "priority_counts={}#{}#{}",
        priority_queue_intervene_count, priority_queue_watch_count, priority_queue_none_count
    ));
    lines.push(format!(
        "priority_actionable_count={priority_queue_actionable_count}"
    ));
    lines.push(format!(
        "priority_action_mix={priority_queue_intervene_within_actionable_bps}#{}",
        priority_queue_watch_within_actionable_bps
    ));
    lines.push(format!(
        "priority_action_profile={priority_queue_action_escalation_profile}"
    ));
    lines.push(format!(
        "priority_action_weighted_units={priority_queue_action_weighted_units}"
    ));
    lines.push(format!(
        "priority_action_weighted_pressure={priority_queue_action_weighted_pressure_bps}"
    ));
    lines.push(format!(
        "priority_action_weighted_per_service={priority_queue_action_weighted_per_service_milli}"
    ));
    lines.push(format!(
        "priority_action_weighted_profile={priority_queue_action_weighted_profile}"
    ));
    lines.push(format!(
        "priority_action_polarization={priority_queue_action_polarization_bps}"
    ));
    lines.push(format!(
        "priority_action_balance={priority_queue_action_balance_score_bps}"
    ));
    lines.push(format!(
        "priority_action_polarization_profile={priority_queue_action_polarization_profile}"
    ));
    lines.push(format!(
        "priority_dominant={}#{}",
        priority_queue_dominant_action_level, priority_queue_dominant_action_bps
    ));
    lines.push(format!(
        "priority_top_share={priority_queue_top_service_alert_share_bps}"
    ));
    lines.push(format!(
        "priority_leader_share={priority_queue_leader_alert_share_bps}"
    ));
    lines.push(format!(
        "priority_runner_share={priority_queue_runner_up_alert_share_bps}"
    ));
    lines.push(format!(
        "priority_leader_gap={priority_queue_leader_gap_bps}"
    ));
    lines.push(format!(
        "priority_top2_share={priority_queue_top2_service_alert_share_bps}"
    ));
    lines.push(format!(
        "priority_hhi_bps={priority_queue_service_concentration_hhi_bps}"
    ));
    lines.push(format!(
        "priority_concentration={priority_queue_concentration_level}"
    ));
    lines.push(format!(
        "priority_long_tail={priority_queue_long_tail_alert_share_bps}"
    ));
    lines.push(format!(
        "priority_effective_services={priority_queue_effective_service_count_milli}"
    ));
    lines.push(format!(
        "priority_leader_dominance={priority_queue_leader_dominance_level}"
    ));
    lines.push(format!(
        "priority_coverage={priority_queue_coverage_50_count}#{}#{}",
        priority_queue_coverage_80_count, priority_queue_coverage_95_count
    ));
    lines.push(format!(
        "priority_coverage_profile={priority_queue_coverage_profile}"
    ));
    lines.push(format!(
        "priority_risk_score={priority_queue_risk_score_bps}"
    ));
    lines.push(format!("priority_risk_band={priority_queue_risk_band}"));
    lines.push(format!(
        "priority_response_sla={priority_queue_response_sla_seconds}"
    ));
    lines.push(format!(
        "priority_sla_multiplier={priority_queue_sla_multiplier_bps}"
    ));
    lines.push(format!(
        "priority_sla_effective={priority_queue_effective_response_sla_seconds}"
    ));
    lines.push(format!(
        "priority_sla_slippage={priority_queue_sla_slippage_bps}"
    ));
    lines.push(format!(
        "priority_sla_profile={priority_queue_sla_pressure_profile}"
    ));
    lines.push(format!(
        "priority_sla_adjusted_risk={priority_queue_sla_adjusted_risk_bps}"
    ));
    lines.push(format!(
        "priority_sla_risk_delta={priority_queue_sla_risk_delta_bps}"
    ));
    lines.push(format!(
        "priority_operational_posture={priority_queue_operational_posture}"
    ));
    lines.push(format!(
        "priority_attention_index={priority_queue_attention_index_bps}"
    ));
    lines.push(format!(
        "priority_attention_delta={priority_queue_attention_delta_bps}"
    ));
    lines.push(format!(
        "priority_attention_profile={priority_queue_attention_profile}"
    ));
    lines.push(format!(
        "priority_readiness_score={priority_queue_readiness_score_bps}"
    ));
    lines.push(format!(
        "priority_readiness_delta={priority_queue_readiness_delta_bps}"
    ));
    lines.push(format!(
        "priority_readiness_profile={priority_queue_readiness_profile}"
    ));
    lines.push(format!(
        "priority_stability_index={priority_queue_stability_index_bps}"
    ));
    lines.push(format!(
        "priority_stability_delta={priority_queue_stability_delta_bps}"
    ));
    lines.push(format!(
        "priority_stability_profile={priority_queue_stability_profile}"
    ));
    lines.push(format!(
        "priority_resilience_score={priority_queue_resilience_score_bps}"
    ));
    lines.push(format!(
        "priority_resilience_delta={priority_queue_resilience_delta_bps}"
    ));
    lines.push(format!(
        "priority_resilience_profile={priority_queue_resilience_profile}"
    ));
    lines.push(format!(
        "priority_coherence_score={priority_queue_coherence_score_bps}"
    ));
    lines.push(format!(
        "priority_coherence_delta={priority_queue_coherence_delta_bps}"
    ));
    lines.push(format!(
        "priority_coherence_profile={priority_queue_coherence_profile}"
    ));
    lines.push(format!(
        "priority_adaptability_score={priority_queue_adaptability_score_bps}"
    ));
    lines.push(format!(
        "priority_adaptability_delta={priority_queue_adaptability_delta_bps}"
    ));
    lines.push(format!(
        "priority_adaptability_profile={priority_queue_adaptability_profile}"
    ));
    lines.push(format!(
        "priority_sustainability_score={priority_queue_sustainability_score_bps}"
    ));
    lines.push(format!(
        "priority_sustainability_delta={priority_queue_sustainability_delta_bps}"
    ));
    lines.push(format!(
        "priority_sustainability_profile={priority_queue_sustainability_profile}"
    ));
    lines.push(format!(
        "priority_continuity_score={priority_queue_continuity_score_bps}"
    ));
    lines.push(format!(
        "priority_continuity_delta={priority_queue_continuity_delta_bps}"
    ));
    lines.push(format!(
        "priority_continuity_profile={priority_queue_continuity_profile}"
    ));
    lines.push(format!(
        "priority_recoverability_score={priority_queue_recoverability_score_bps}"
    ));
    lines.push(format!(
        "priority_recoverability_delta={priority_queue_recoverability_delta_bps}"
    ));
    lines.push(format!(
        "priority_recoverability_profile={priority_queue_recoverability_profile}"
    ));
    lines.push(format!(
        "priority_regeneration_score={priority_queue_regeneration_score_bps}"
    ));
    lines.push(format!(
        "priority_regeneration_delta={priority_queue_regeneration_delta_bps}"
    ));
    lines.push(format!(
        "priority_regeneration_profile={priority_queue_regeneration_profile}"
    ));
    lines.push(format!(
        "priority_restoration_score={priority_queue_restoration_score_bps}"
    ));
    lines.push(format!(
        "priority_restoration_delta={priority_queue_restoration_delta_bps}"
    ));
    lines.push(format!(
        "priority_restoration_profile={priority_queue_restoration_profile}"
    ));
    lines.push(format!(
        "priority_stewardship_score={priority_queue_stewardship_score_bps}"
    ));
    lines.push(format!(
        "priority_stewardship_delta={priority_queue_stewardship_delta_bps}"
    ));
    lines.push(format!(
        "priority_stewardship_profile={priority_queue_stewardship_profile}"
    ));
    lines.push(format!(
        "priority_guardianship_score={priority_queue_guardianship_score_bps}"
    ));
    lines.push(format!(
        "priority_guardianship_delta={priority_queue_guardianship_delta_bps}"
    ));
    lines.push(format!(
        "priority_guardianship_profile={priority_queue_guardianship_profile}"
    ));
    lines.push(format!(
        "priority_assurance_score={priority_queue_assurance_score_bps}"
    ));
    lines.push(format!(
        "priority_assurance_delta={priority_queue_assurance_delta_bps}"
    ));
    lines.push(format!(
        "priority_assurance_profile={priority_queue_assurance_profile}"
    ));
    lines.push(format!(
        "priority_vigilance_score={priority_queue_vigilance_score_bps}"
    ));
    lines.push(format!(
        "priority_vigilance_delta={priority_queue_vigilance_delta_bps}"
    ));
    lines.push(format!(
        "priority_vigilance_profile={priority_queue_vigilance_profile}"
    ));
    lines.push(format!(
        "priority_oversight_score={priority_queue_oversight_score_bps}"
    ));
    lines.push(format!(
        "priority_oversight_delta={priority_queue_oversight_delta_bps}"
    ));
    lines.push(format!(
        "priority_oversight_profile={priority_queue_oversight_profile}"
    ));
    lines.push(format!(
        "priority_accountability_score={priority_queue_accountability_score_bps}"
    ));
    lines.push(format!(
        "priority_accountability_delta={priority_queue_accountability_delta_bps}"
    ));
    lines.push(format!(
        "priority_accountability_profile={priority_queue_accountability_profile}"
    ));
    lines.push(format!(
        "priority_verifiability_score={priority_queue_verifiability_score_bps}"
    ));
    lines.push(format!(
        "priority_verifiability_delta={priority_queue_verifiability_delta_bps}"
    ));
    lines.push(format!(
        "priority_verifiability_profile={priority_queue_verifiability_profile}"
    ));
    lines.push(format!(
        "priority_auditability_score={priority_queue_auditability_score_bps}"
    ));
    lines.push(format!(
        "priority_auditability_delta={priority_queue_auditability_delta_bps}"
    ));
    lines.push(format!(
        "priority_auditability_profile={priority_queue_auditability_profile}"
    ));
    lines.push(format!(
        "priority_transparency_score={priority_queue_transparency_score_bps}"
    ));
    lines.push(format!(
        "priority_transparency_delta={priority_queue_transparency_delta_bps}"
    ));
    lines.push(format!(
        "priority_transparency_profile={priority_queue_transparency_profile}"
    ));
    lines.push(format!(
        "priority_legibility_score={priority_queue_legibility_score_bps}"
    ));
    lines.push(format!(
        "priority_legibility_delta={priority_queue_legibility_delta_bps}"
    ));
    lines.push(format!(
        "priority_legibility_profile={priority_queue_legibility_profile}"
    ));
    lines.push(format!(
        "priority_navigability_score={priority_queue_navigability_score_bps}"
    ));
    lines.push(format!(
        "priority_navigability_delta={priority_queue_navigability_delta_bps}"
    ));
    lines.push(format!(
        "priority_navigability_profile={priority_queue_navigability_profile}"
    ));
    lines.push(format!(
        "priority_interpretability_score={priority_queue_interpretability_score_bps}"
    ));
    lines.push(format!(
        "priority_interpretability_delta={priority_queue_interpretability_delta_bps}"
    ));
    lines.push(format!(
        "priority_interpretability_profile={priority_queue_interpretability_profile}"
    ));
    lines.push(format!(
        "priority_explainability_score={priority_queue_explainability_score_bps}"
    ));
    lines.push(format!(
        "priority_explainability_delta={priority_queue_explainability_delta_bps}"
    ));
    lines.push(format!(
        "priority_explainability_profile={priority_queue_explainability_profile}"
    ));
    lines.push(format!(
        "priority_clarity_score={priority_queue_clarity_score_bps}"
    ));
    lines.push(format!(
        "priority_clarity_delta={priority_queue_clarity_delta_bps}"
    ));
    lines.push(format!(
        "priority_clarity_profile={priority_queue_clarity_profile}"
    ));
    lines.push(format!(
        "priority_comprehensibility_score={priority_queue_comprehensibility_score_bps}"
    ));
    lines.push(format!(
        "priority_comprehensibility_delta={priority_queue_comprehensibility_delta_bps}"
    ));
    lines.push(format!(
        "priority_comprehensibility_profile={priority_queue_comprehensibility_profile}"
    ));
    lines.push(format!(
        "priority_intelligibility_score={priority_queue_intelligibility_score_bps}"
    ));
    lines.push(format!(
        "priority_intelligibility_delta={priority_queue_intelligibility_delta_bps}"
    ));
    lines.push(format!(
        "priority_intelligibility_profile={priority_queue_intelligibility_profile}"
    ));
    lines.push(format!(
        "priority_communicability_score={priority_queue_communicability_score_bps}"
    ));
    lines.push(format!(
        "priority_communicability_delta={priority_queue_communicability_delta_bps}"
    ));
    lines.push(format!(
        "priority_communicability_profile={priority_queue_communicability_profile}"
    ));
    lines.push(format!(
        "priority_articulability_score={priority_queue_articulability_score_bps}"
    ));
    lines.push(format!(
        "priority_articulability_delta={priority_queue_articulability_delta_bps}"
    ));
    lines.push(format!(
        "priority_articulability_profile={priority_queue_articulability_profile}"
    ));
    lines.push(format!(
        "priority_expressivity_score={priority_queue_expressivity_score_bps}"
    ));
    lines.push(format!(
        "priority_expressivity_delta={priority_queue_expressivity_delta_bps}"
    ));
    lines.push(format!(
        "priority_expressivity_profile={priority_queue_expressivity_profile}"
    ));
    lines.push(format!(
        "priority_eloquence_score={priority_queue_eloquence_score_bps}"
    ));
    lines.push(format!(
        "priority_eloquence_delta={priority_queue_eloquence_delta_bps}"
    ));
    lines.push(format!(
        "priority_eloquence_profile={priority_queue_eloquence_profile}"
    ));
    lines.push(format!(
        "priority_lucidity_score={priority_queue_lucidity_score_bps}"
    ));
    lines.push(format!(
        "priority_lucidity_delta={priority_queue_lucidity_delta_bps}"
    ));
    lines.push(format!(
        "priority_lucidity_profile={priority_queue_lucidity_profile}"
    ));
    lines.push(format!(
        "priority_illumination_score={priority_queue_illumination_score_bps}"
    ));
    lines.push(format!(
        "priority_illumination_delta={priority_queue_illumination_delta_bps}"
    ));
    lines.push(format!(
        "priority_illumination_profile={priority_queue_illumination_profile}"
    ));
    lines.push(format!(
        "priority_clarion_score={priority_queue_clarion_score_bps}"
    ));
    lines.push(format!(
        "priority_clarion_delta={priority_queue_clarion_delta_bps}"
    ));
    lines.push(format!(
        "priority_clarion_profile={priority_queue_clarion_profile}"
    ));
    lines.push(format!(
        "priority_resonance_score={priority_queue_resonance_score_bps}"
    ));
    lines.push(format!(
        "priority_resonance_delta={priority_queue_resonance_delta_bps}"
    ));
    lines.push(format!(
        "priority_resonance_profile={priority_queue_resonance_profile}"
    ));
    lines.push(format!(
        "priority_cadence_score={priority_queue_cadence_score_bps}"
    ));
    lines.push(format!(
        "priority_cadence_delta={priority_queue_cadence_delta_bps}"
    ));
    lines.push(format!(
        "priority_cadence_profile={priority_queue_cadence_profile}"
    ));
    lines.push(format!(
        "priority_harmony_score={priority_queue_harmony_score_bps}"
    ));
    lines.push(format!(
        "priority_harmony_delta={priority_queue_harmony_delta_bps}"
    ));
    lines.push(format!(
        "priority_harmony_profile={priority_queue_harmony_profile}"
    ));
    lines.push(format!(
        "priority_gini={priority_queue_inequality_gini_bps}"
    ));
    lines.push(format!("priority_evenness={priority_queue_evenness_milli}"));
    lines.push(format!(
        "priority_distribution={priority_queue_distribution_profile}"
    ));
    lines.push(format!(
        "priority_actionable_bps={priority_queue_actionable_bps}"
    ));
    lines.push(format!(
        "priority_critical_bps={priority_queue_critical_bps}"
    ));
    lines.push(format!("priority_load={priority_queue_load_level}"));
    lines.push(format!("priority_queue={priority_queue_fingerprint}"));
    lines.push(format!(
        "priority_membership={priority_queue_membership_fingerprint}"
    ));
    lines.push(format!("priority_order={priority_queue_order_fingerprint}"));
    lines.push(format!(
        "priority_pressure={priority_queue_pressure_fingerprint}"
    ));
    let digest = Sha256::digest(lines.join("\n").as_bytes());
    hex::encode(digest)
}

fn offline_lane_priority_queue_fingerprint(
    prioritized_services: &[OfflineLaneAlertPriorityEntry],
) -> String {
    let rows = prioritized_services
        .iter()
        .map(|entry| {
            format!(
                "{}:{}:{}:{}:{}:{}",
                entry.rank,
                entry.service_type,
                entry.alert_count,
                entry.action_level,
                entry.highest_severity.as_deref().unwrap_or("none"),
                entry.top_alert_code.as_deref().unwrap_or("none")
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let digest = Sha256::digest(rows.as_bytes());
    hex::encode(digest)
}

fn offline_lane_priority_queue_membership_fingerprint(
    prioritized_services: &[OfflineLaneAlertPriorityEntry],
) -> String {
    let mut service_types = prioritized_services
        .iter()
        .map(|entry| entry.service_type.clone())
        .collect::<Vec<_>>();
    service_types.sort();
    let digest = Sha256::digest(service_types.join("\n").as_bytes());
    hex::encode(digest)
}

fn offline_lane_priority_queue_order_fingerprint(
    prioritized_services: &[OfflineLaneAlertPriorityEntry],
) -> String {
    let rows = prioritized_services
        .iter()
        .map(|entry| {
            format!(
                "{}:{}:{}",
                entry.rank, entry.service_type, entry.action_level
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let digest = Sha256::digest(rows.as_bytes());
    hex::encode(digest)
}

fn offline_lane_priority_queue_pressure_fingerprint(
    priority_queue_size: u64,
    priority_queue_health: &str,
    priority_queue_intervene_count: u64,
    priority_queue_watch_count: u64,
    priority_queue_none_count: u64,
    priority_queue_actionable_bps: u64,
    priority_queue_critical_bps: u64,
    priority_queue_load_level: &str,
) -> String {
    let rows = [
        format!("size={priority_queue_size}"),
        format!("health={priority_queue_health}"),
        format!(
            "counts={}#{}#{}",
            priority_queue_intervene_count, priority_queue_watch_count, priority_queue_none_count
        ),
        format!("actionable_bps={priority_queue_actionable_bps}"),
        format!("critical_bps={priority_queue_critical_bps}"),
        format!("load={priority_queue_load_level}"),
    ]
    .join("\n");
    let digest = Sha256::digest(rows.as_bytes());
    hex::encode(digest)
}

fn offline_lane_service_summary_fingerprint(
    service_type: &str,
    alert_count: u64,
    action_level: &str,
    highest_severity: Option<&str>,
    top_alert_code: Option<&str>,
    by_code: &[OfflineLaneAlertCodeCount],
) -> String {
    let mut lines = Vec::new();
    lines.push(format!("svc={service_type}"));
    lines.push(format!("count={alert_count}"));
    lines.push(format!("action={action_level}"));
    lines.push(format!("highest={}", highest_severity.unwrap_or("none")));
    lines.push(format!("top={}", top_alert_code.unwrap_or("none")));
    lines.push(format!(
        "code={}",
        by_code
            .iter()
            .map(|value| format!("{}:{}", value.alert_code, value.count))
            .collect::<Vec<_>>()
            .join(",")
    ));
    let digest = Sha256::digest(lines.join("\n").as_bytes());
    hex::encode(digest)
}

fn resolve_offline_lane_alert_policy(
    policy: &Policy,
    service_type: &str,
) -> Option<ResolvedOfflineLaneAlertPolicy> {
    if !policy
        .offline_alert_enabled_service_types
        .iter()
        .any(|lane| lane == service_type)
    {
        return None;
    }
    let lane_override = policy.offline_alert_lane_override(service_type);
    Some(ResolvedOfflineLaneAlertPolicy {
        unresolved_dispute_count_threshold: lane_override
            .and_then(|value| value.unresolved_dispute_count_threshold)
            .unwrap_or(policy.offline_alert_unresolved_dispute_count_threshold),
        dispute_rate_bps_threshold: lane_override
            .and_then(|value| value.dispute_rate_bps_threshold)
            .unwrap_or(policy.offline_alert_dispute_rate_bps_threshold),
        dispute_rate_min_orders: lane_override
            .and_then(|value| value.dispute_rate_min_orders)
            .unwrap_or(policy.offline_alert_dispute_rate_min_orders),
        auto_refund_rate_bps_threshold: lane_override
            .and_then(|value| value.auto_refund_rate_bps_threshold)
            .unwrap_or(policy.offline_alert_auto_refund_rate_bps_threshold),
        auto_refund_min_disputes: lane_override
            .and_then(|value| value.auto_refund_min_disputes)
            .unwrap_or(policy.offline_alert_auto_refund_min_disputes),
        invalid_payload_count_threshold: lane_override
            .and_then(|value| value.invalid_payload_count_threshold)
            .unwrap_or(policy.offline_alert_invalid_payload_count_threshold),
        policy_violation_count_threshold: lane_override
            .and_then(|value| value.policy_violation_count_threshold)
            .unwrap_or(policy.offline_alert_policy_violation_count_threshold),
        unresolved_disputes_severity: lane_override
            .and_then(|value| value.unresolved_disputes_severity)
            .unwrap_or(policy.offline_alert_unresolved_disputes_severity),
        dispute_rate_severity: lane_override
            .and_then(|value| value.dispute_rate_severity)
            .unwrap_or(policy.offline_alert_dispute_rate_severity),
        auto_refund_rate_severity: lane_override
            .and_then(|value| value.auto_refund_rate_severity)
            .unwrap_or(policy.offline_alert_auto_refund_rate_severity),
        invalid_payload_spike_severity: lane_override
            .and_then(|value| value.invalid_payload_spike_severity)
            .unwrap_or(policy.offline_alert_invalid_payload_spike_severity),
        policy_violation_spike_severity: lane_override
            .and_then(|value| value.policy_violation_spike_severity)
            .unwrap_or(policy.offline_alert_policy_violation_spike_severity),
    })
}

fn alert_severity_label(severity: protocol_core::AlertSeverity) -> &'static str {
    match severity {
        protocol_core::AlertSeverity::Info => "info",
        protocol_core::AlertSeverity::Warn => "warn",
        protocol_core::AlertSeverity::Critical => "critical",
    }
}

fn alert_severity_rank(severity: &str) -> u8 {
    match severity {
        "critical" => 3,
        "warn" => 2,
        "info" => 1,
        _ => 0,
    }
}

fn alert_action_level_for_rank(rank: u8) -> &'static str {
    match rank {
        3.. => "intervene",
        2 => "watch",
        _ => "none",
    }
}

fn alert_action_rank(level: &str) -> u8 {
    match level {
        "intervene" => 3,
        "watch" => 2,
        "none" => 1,
        _ => 0,
    }
}

fn priority_queue_load_level(size: u64) -> &'static str {
    match size {
        0 => "idle",
        1..=2 => "light",
        3..=5 => "medium",
        _ => "heavy",
    }
}

fn priority_queue_sla_multiplier_bps(priority_queue_load_level: &str) -> u64 {
    match priority_queue_load_level {
        "idle" => 0,
        "light" => 10_000,
        "medium" => 12_500,
        "heavy" => 15_000,
        _ => 0,
    }
}

fn priority_queue_sla_pressure_profile(
    priority_queue_actionable_count: u64,
    priority_queue_response_sla_seconds: u64,
    priority_queue_sla_slippage_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_response_sla_seconds == 0 {
        "idle"
    } else if priority_queue_sla_slippage_bps == 0 {
        "on-target"
    } else if priority_queue_sla_slippage_bps <= 2_500 {
        "stretched"
    } else if priority_queue_sla_slippage_bps <= 5_000 {
        "degraded"
    } else {
        "critical"
    }
}

fn priority_queue_operational_posture(
    priority_queue_actionable_count: u64,
    priority_queue_sla_adjusted_risk_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_sla_adjusted_risk_bps == 0 {
        "none"
    } else if priority_queue_sla_adjusted_risk_bps >= 8_500 {
        "critical"
    } else if priority_queue_sla_adjusted_risk_bps >= 6_500 {
        "strained"
    } else if priority_queue_sla_adjusted_risk_bps >= 4_000 {
        "heightened"
    } else {
        "nominal"
    }
}

fn priority_queue_attention_profile(
    priority_queue_actionable_count: u64,
    priority_queue_attention_index_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_attention_index_bps == 0 {
        "idle"
    } else if priority_queue_attention_index_bps >= 8_000 {
        "overloaded"
    } else if priority_queue_attention_index_bps >= 6_000 {
        "strained"
    } else if priority_queue_attention_index_bps >= 3_500 {
        "engaged"
    } else {
        "calm"
    }
}

fn priority_queue_readiness_profile(
    priority_queue_actionable_count: u64,
    priority_queue_readiness_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_readiness_score_bps == 0 {
        "idle"
    } else if priority_queue_readiness_score_bps >= 7_000 {
        "ready"
    } else if priority_queue_readiness_score_bps >= 5_000 {
        "watch"
    } else if priority_queue_readiness_score_bps >= 2_500 {
        "strained"
    } else {
        "critical"
    }
}

fn priority_queue_stability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_stability_index_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_stability_index_bps == 0 {
        "idle"
    } else if priority_queue_stability_index_bps >= 7_000 {
        "stable"
    } else if priority_queue_stability_index_bps >= 5_000 {
        "monitor"
    } else if priority_queue_stability_index_bps >= 2_500 {
        "volatile"
    } else {
        "critical"
    }
}

fn priority_queue_resilience_profile(
    priority_queue_actionable_count: u64,
    priority_queue_resilience_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_resilience_score_bps == 0 {
        "idle"
    } else if priority_queue_resilience_score_bps >= 8_000 {
        "robust"
    } else if priority_queue_resilience_score_bps >= 6_000 {
        "resilient"
    } else if priority_queue_resilience_score_bps >= 3_500 {
        "recovering"
    } else {
        "fragile"
    }
}

fn priority_queue_coherence_profile(
    priority_queue_actionable_count: u64,
    priority_queue_coherence_score_bps: u64,
    priority_queue_coherence_delta_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_coherence_score_bps == 0 {
        "idle"
    } else if priority_queue_coherence_score_bps >= 7_500
        && priority_queue_coherence_delta_bps <= 1_000
    {
        "synchronized"
    } else if priority_queue_coherence_score_bps >= 6_000
        && priority_queue_coherence_delta_bps <= 2_500
    {
        "coherent"
    } else if priority_queue_coherence_score_bps >= 3_500 {
        "converging"
    } else {
        "fragmented"
    }
}

fn priority_queue_adaptability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_adaptability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_adaptability_score_bps == 0 {
        "idle"
    } else if priority_queue_adaptability_score_bps >= 8_000 {
        "fluid"
    } else if priority_queue_adaptability_score_bps >= 6_000 {
        "adaptive"
    } else if priority_queue_adaptability_score_bps >= 3_500 {
        "constrained"
    } else {
        "rigid"
    }
}

fn priority_queue_sustainability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_sustainability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_sustainability_score_bps == 0 {
        "idle"
    } else if priority_queue_sustainability_score_bps >= 8_000 {
        "enduring"
    } else if priority_queue_sustainability_score_bps >= 6_000 {
        "steady"
    } else if priority_queue_sustainability_score_bps >= 3_500 {
        "stressed"
    } else {
        "brittle"
    }
}

fn priority_queue_action_escalation_profile(
    priority_queue_intervene_count: u64,
    priority_queue_watch_count: u64,
    priority_queue_actionable_count: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 {
        "idle"
    } else if priority_queue_intervene_count > priority_queue_watch_count {
        "intervene-led"
    } else if priority_queue_watch_count > priority_queue_intervene_count {
        "watch-led"
    } else {
        "balanced"
    }
}

fn priority_queue_action_weighted_profile(
    priority_queue_size: u64,
    priority_queue_actionable_count: u64,
    priority_queue_action_weighted_pressure_bps: u64,
) -> &'static str {
    if priority_queue_size == 0 {
        "idle"
    } else if priority_queue_actionable_count == 0 {
        "passive"
    } else if priority_queue_action_weighted_pressure_bps >= 7_500 {
        "urgent"
    } else if priority_queue_action_weighted_pressure_bps >= 4_000 {
        "active"
    } else {
        "steady"
    }
}

fn priority_queue_action_polarization_profile(
    priority_queue_actionable_count: u64,
    priority_queue_action_polarization_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 {
        "idle"
    } else if priority_queue_action_polarization_bps >= 7_000 {
        "polarized"
    } else if priority_queue_action_polarization_bps >= 3_000 {
        "tilted"
    } else {
        "balanced"
    }
}

fn priority_queue_concentration_level(total_alert_count: u64, hhi_bps: u64) -> &'static str {
    if total_alert_count == 0 {
        "none"
    } else if hhi_bps >= 5_000 {
        "concentrated"
    } else if hhi_bps >= 2_500 {
        "balanced"
    } else {
        "diffuse"
    }
}

fn priority_queue_coverage_count(
    ranked_services: &[(&str, u64)],
    total_alert_count: u64,
    target_bps: u64,
) -> u64 {
    if total_alert_count == 0 || ranked_services.is_empty() {
        return 0;
    }
    let mut cumulative = 0_u64;
    for (index, (_, count)) in ranked_services.iter().enumerate() {
        cumulative = cumulative.saturating_add(*count);
        if ratio_bps(cumulative, total_alert_count) >= target_bps {
            return (index + 1) as u64;
        }
    }
    ranked_services.len() as u64
}

fn priority_queue_coverage_profile(
    total_alert_count: u64,
    coverage_50_count: u64,
    coverage_80_count: u64,
) -> &'static str {
    if total_alert_count == 0 {
        "none"
    } else if coverage_50_count == 1 && coverage_80_count == 1 {
        "single"
    } else if coverage_80_count <= 2 {
        "top-heavy"
    } else if coverage_80_count <= 4 {
        "mixed"
    } else {
        "broad"
    }
}

fn priority_queue_risk_score_bps(
    priority_queue_actionable_bps: u64,
    priority_queue_critical_bps: u64,
    priority_queue_service_concentration_hhi_bps: u64,
    priority_queue_leader_gap_bps: u64,
    priority_queue_size: u64,
) -> u64 {
    if priority_queue_size == 0 {
        return 0;
    }
    let weighted_total = priority_queue_actionable_bps
        .saturating_mul(40)
        .saturating_add(priority_queue_critical_bps.saturating_mul(40))
        .saturating_add(priority_queue_service_concentration_hhi_bps.saturating_mul(10))
        .saturating_add(priority_queue_leader_gap_bps.saturating_mul(10));
    weighted_total / 100
}

fn priority_queue_risk_band(
    priority_queue_risk_score_bps: u64,
    priority_queue_size: u64,
) -> &'static str {
    if priority_queue_size == 0 || priority_queue_risk_score_bps == 0 {
        "none"
    } else if priority_queue_risk_score_bps >= 7_500 {
        "extreme"
    } else if priority_queue_risk_score_bps >= 5_000 {
        "high"
    } else if priority_queue_risk_score_bps >= 2_500 {
        "elevated"
    } else {
        "low"
    }
}

fn priority_queue_response_sla_seconds(priority_queue_risk_band: &str) -> u64 {
    match priority_queue_risk_band {
        "extreme" => 1_800,
        "high" => 7_200,
        "elevated" => 21_600,
        "low" => 86_400,
        _ => 0,
    }
}

fn priority_queue_continuity_profile(
    priority_queue_actionable_count: u64,
    priority_queue_continuity_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_continuity_score_bps == 0 {
        "idle"
    } else if priority_queue_continuity_score_bps >= 8_000 {
        "seamless"
    } else if priority_queue_continuity_score_bps >= 6_000 {
        "durable"
    } else if priority_queue_continuity_score_bps >= 3_500 {
        "holding"
    } else {
        "fragile"
    }
}

fn priority_queue_recoverability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_recoverability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_recoverability_score_bps == 0 {
        "idle"
    } else if priority_queue_recoverability_score_bps >= 8_000 {
        "elastic"
    } else if priority_queue_recoverability_score_bps >= 6_000 {
        "recoverable"
    } else if priority_queue_recoverability_score_bps >= 3_500 {
        "repairing"
    } else {
        "depleted"
    }
}

fn priority_queue_regeneration_profile(
    priority_queue_actionable_count: u64,
    priority_queue_regeneration_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_regeneration_score_bps == 0 {
        "idle"
    } else if priority_queue_regeneration_score_bps >= 8_000 {
        "regenerative"
    } else if priority_queue_regeneration_score_bps >= 6_000 {
        "renewing"
    } else if priority_queue_regeneration_score_bps >= 3_500 {
        "rebuilding"
    } else {
        "exhausted"
    }
}

fn priority_queue_restoration_profile(
    priority_queue_actionable_count: u64,
    priority_queue_restoration_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_restoration_score_bps == 0 {
        "idle"
    } else if priority_queue_restoration_score_bps >= 8_000 {
        "restored"
    } else if priority_queue_restoration_score_bps >= 6_000 {
        "restoring"
    } else if priority_queue_restoration_score_bps >= 3_500 {
        "repairing"
    } else {
        "drained"
    }
}

fn priority_queue_stewardship_profile(
    priority_queue_actionable_count: u64,
    priority_queue_stewardship_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_stewardship_score_bps == 0 {
        "idle"
    } else if priority_queue_stewardship_score_bps >= 8_000 {
        "custodial"
    } else if priority_queue_stewardship_score_bps >= 6_000 {
        "stewarding"
    } else if priority_queue_stewardship_score_bps >= 3_500 {
        "guarded"
    } else {
        "neglected"
    }
}

fn priority_queue_guardianship_profile(
    priority_queue_actionable_count: u64,
    priority_queue_guardianship_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_guardianship_score_bps == 0 {
        "idle"
    } else if priority_queue_guardianship_score_bps >= 8_000 {
        "hardened"
    } else if priority_queue_guardianship_score_bps >= 6_000 {
        "protective"
    } else if priority_queue_guardianship_score_bps >= 3_500 {
        "watchful"
    } else {
        "exposed"
    }
}

fn priority_queue_assurance_profile(
    priority_queue_actionable_count: u64,
    priority_queue_assurance_score_bps: u64,
    priority_queue_assurance_delta_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_assurance_score_bps == 0 {
        "idle"
    } else if priority_queue_assurance_score_bps >= 8_000
        && priority_queue_assurance_delta_bps <= 1_000
    {
        "fortified"
    } else if priority_queue_assurance_score_bps >= 6_000 {
        "assured"
    } else if priority_queue_assurance_score_bps >= 3_500 {
        "stabilizing"
    } else {
        "fragile"
    }
}

fn priority_queue_vigilance_profile(
    priority_queue_actionable_count: u64,
    priority_queue_vigilance_score_bps: u64,
    priority_queue_vigilance_delta_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_vigilance_score_bps == 0 {
        "idle"
    } else if priority_queue_vigilance_score_bps >= 8_000
        && priority_queue_vigilance_delta_bps <= 1_000
    {
        "sentinel"
    } else if priority_queue_vigilance_score_bps >= 6_000 {
        "vigilant"
    } else if priority_queue_vigilance_score_bps >= 3_500 {
        "monitoring"
    } else {
        "lapse"
    }
}

fn priority_queue_oversight_profile(
    priority_queue_actionable_count: u64,
    priority_queue_oversight_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_oversight_score_bps == 0 {
        "idle"
    } else if priority_queue_oversight_score_bps >= 8_000 {
        "comprehensive"
    } else if priority_queue_oversight_score_bps >= 6_000 {
        "attentive"
    } else if priority_queue_oversight_score_bps >= 3_500 {
        "partial"
    } else {
        "narrow"
    }
}

fn priority_queue_accountability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_accountability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_accountability_score_bps == 0 {
        "idle"
    } else if priority_queue_accountability_score_bps >= 8_000 {
        "auditable"
    } else if priority_queue_accountability_score_bps >= 6_000 {
        "answerable"
    } else if priority_queue_accountability_score_bps >= 3_500 {
        "emerging"
    } else {
        "opaque"
    }
}

fn priority_queue_verifiability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_verifiability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_verifiability_score_bps == 0 {
        "idle"
    } else if priority_queue_verifiability_score_bps >= 8_000 {
        "provable"
    } else if priority_queue_verifiability_score_bps >= 6_000 {
        "traceable"
    } else if priority_queue_verifiability_score_bps >= 3_500 {
        "reviewable"
    } else {
        "uncertain"
    }
}

fn priority_queue_auditability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_auditability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_auditability_score_bps == 0 {
        "idle"
    } else if priority_queue_auditability_score_bps >= 8_000 {
        "forensic"
    } else if priority_queue_auditability_score_bps >= 6_000 {
        "auditable"
    } else if priority_queue_auditability_score_bps >= 3_500 {
        "inspectable"
    } else {
        "opaque"
    }
}

fn priority_queue_transparency_profile(
    priority_queue_actionable_count: u64,
    priority_queue_transparency_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_transparency_score_bps == 0 {
        "idle"
    } else if priority_queue_transparency_score_bps >= 8_000 {
        "glassbox"
    } else if priority_queue_transparency_score_bps >= 6_000 {
        "transparent"
    } else if priority_queue_transparency_score_bps >= 3_500 {
        "visible"
    } else {
        "obscured"
    }
}

fn priority_queue_legibility_profile(
    priority_queue_actionable_count: u64,
    priority_queue_legibility_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_legibility_score_bps == 0 {
        "idle"
    } else if priority_queue_legibility_score_bps >= 8_000 {
        "crystal"
    } else if priority_queue_legibility_score_bps >= 6_000 {
        "legible"
    } else if priority_queue_legibility_score_bps >= 3_500 {
        "readable"
    } else {
        "murky"
    }
}

fn priority_queue_navigability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_navigability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_navigability_score_bps == 0 {
        "idle"
    } else if priority_queue_navigability_score_bps >= 8_000 {
        "frictionless"
    } else if priority_queue_navigability_score_bps >= 6_000 {
        "navigable"
    } else if priority_queue_navigability_score_bps >= 3_500 {
        "guided"
    } else {
        "labyrinth"
    }
}

fn priority_queue_interpretability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_interpretability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_interpretability_score_bps == 0 {
        "idle"
    } else if priority_queue_interpretability_score_bps >= 8_000 {
        "self-evident"
    } else if priority_queue_interpretability_score_bps >= 6_000 {
        "interpretable"
    } else if priority_queue_interpretability_score_bps >= 3_500 {
        "decodable"
    } else {
        "opaque"
    }
}

fn priority_queue_explainability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_explainability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_explainability_score_bps == 0 {
        "idle"
    } else if priority_queue_explainability_score_bps >= 8_000 {
        "lucid"
    } else if priority_queue_explainability_score_bps >= 6_000 {
        "explainable"
    } else if priority_queue_explainability_score_bps >= 3_500 {
        "decipherable"
    } else {
        "opaque"
    }
}

fn priority_queue_clarity_profile(
    priority_queue_actionable_count: u64,
    priority_queue_clarity_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_clarity_score_bps == 0 {
        "idle"
    } else if priority_queue_clarity_score_bps >= 8_000 {
        "crystalline"
    } else if priority_queue_clarity_score_bps >= 6_000 {
        "clear"
    } else if priority_queue_clarity_score_bps >= 3_500 {
        "readable"
    } else {
        "blurred"
    }
}

fn priority_queue_comprehensibility_profile(
    priority_queue_actionable_count: u64,
    priority_queue_comprehensibility_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_comprehensibility_score_bps == 0 {
        "idle"
    } else if priority_queue_comprehensibility_score_bps >= 8_000 {
        "intuitive"
    } else if priority_queue_comprehensibility_score_bps >= 6_000 {
        "comprehensible"
    } else if priority_queue_comprehensibility_score_bps >= 3_500 {
        "digestible"
    } else {
        "obscure"
    }
}

fn priority_queue_intelligibility_profile(
    priority_queue_actionable_count: u64,
    priority_queue_intelligibility_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_intelligibility_score_bps == 0 {
        "idle"
    } else if priority_queue_intelligibility_score_bps >= 8_000 {
        "self-describing"
    } else if priority_queue_intelligibility_score_bps >= 6_000 {
        "intelligible"
    } else if priority_queue_intelligibility_score_bps >= 3_500 {
        "understandable"
    } else {
        "cryptic"
    }
}

fn priority_queue_communicability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_communicability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_communicability_score_bps == 0 {
        "idle"
    } else if priority_queue_communicability_score_bps >= 8_000 {
        "broadcast"
    } else if priority_queue_communicability_score_bps >= 6_000 {
        "communicative"
    } else if priority_queue_communicability_score_bps >= 3_500 {
        "conveyable"
    } else {
        "garbled"
    }
}

fn priority_queue_articulability_profile(
    priority_queue_actionable_count: u64,
    priority_queue_articulability_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_articulability_score_bps == 0 {
        "idle"
    } else if priority_queue_articulability_score_bps >= 8_000 {
        "resonant"
    } else if priority_queue_articulability_score_bps >= 6_000 {
        "articulate"
    } else if priority_queue_articulability_score_bps >= 3_500 {
        "expressible"
    } else {
        "muffled"
    }
}

fn priority_queue_expressivity_profile(
    priority_queue_actionable_count: u64,
    priority_queue_expressivity_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_expressivity_score_bps == 0 {
        "idle"
    } else if priority_queue_expressivity_score_bps >= 8_000 {
        "vivid"
    } else if priority_queue_expressivity_score_bps >= 6_000 {
        "expressive"
    } else if priority_queue_expressivity_score_bps >= 3_500 {
        "expressible"
    } else {
        "muted"
    }
}

fn priority_queue_eloquence_profile(
    priority_queue_actionable_count: u64,
    priority_queue_eloquence_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_eloquence_score_bps == 0 {
        "idle"
    } else if priority_queue_eloquence_score_bps >= 8_000 {
        "eloquent"
    } else if priority_queue_eloquence_score_bps >= 6_000 {
        "fluent"
    } else if priority_queue_eloquence_score_bps >= 3_500 {
        "coherent"
    } else {
        "tangled"
    }
}

fn priority_queue_lucidity_profile(
    priority_queue_actionable_count: u64,
    priority_queue_lucidity_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_lucidity_score_bps == 0 {
        "idle"
    } else if priority_queue_lucidity_score_bps >= 8_000 {
        "radiant"
    } else if priority_queue_lucidity_score_bps >= 6_000 {
        "lucid"
    } else if priority_queue_lucidity_score_bps >= 3_500 {
        "legible"
    } else {
        "hazy"
    }
}

fn priority_queue_illumination_profile(
    priority_queue_actionable_count: u64,
    priority_queue_illumination_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_illumination_score_bps == 0 {
        "idle"
    } else if priority_queue_illumination_score_bps >= 8_000 {
        "brilliant"
    } else if priority_queue_illumination_score_bps >= 6_000 {
        "bright"
    } else if priority_queue_illumination_score_bps >= 3_500 {
        "visible"
    } else {
        "dim"
    }
}

fn priority_queue_clarion_profile(
    priority_queue_actionable_count: u64,
    priority_queue_clarion_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_clarion_score_bps == 0 {
        "idle"
    } else if priority_queue_clarion_score_bps >= 8_000 {
        "beacon"
    } else if priority_queue_clarion_score_bps >= 6_000 {
        "glowing"
    } else if priority_queue_clarion_score_bps >= 3_500 {
        "audible"
    } else {
        "faint"
    }
}

fn priority_queue_resonance_profile(
    priority_queue_actionable_count: u64,
    priority_queue_resonance_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_resonance_score_bps == 0 {
        "idle"
    } else if priority_queue_resonance_score_bps >= 8_000 {
        "sonorous"
    } else if priority_queue_resonance_score_bps >= 6_000 {
        "resonant"
    } else if priority_queue_resonance_score_bps >= 3_500 {
        "audible"
    } else {
        "muffled"
    }
}

fn priority_queue_cadence_profile(
    priority_queue_actionable_count: u64,
    priority_queue_cadence_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_cadence_score_bps == 0 {
        "idle"
    } else if priority_queue_cadence_score_bps >= 8_000 {
        "orchestral"
    } else if priority_queue_cadence_score_bps >= 6_000 {
        "cadenced"
    } else if priority_queue_cadence_score_bps >= 3_500 {
        "rhythmic"
    } else {
        "flat"
    }
}

fn priority_queue_harmony_profile(
    priority_queue_actionable_count: u64,
    priority_queue_harmony_score_bps: u64,
) -> &'static str {
    if priority_queue_actionable_count == 0 || priority_queue_harmony_score_bps == 0 {
        "idle"
    } else if priority_queue_harmony_score_bps >= 8_000 {
        "symphonic"
    } else if priority_queue_harmony_score_bps >= 6_000 {
        "harmonic"
    } else if priority_queue_harmony_score_bps >= 3_500 {
        "aligned"
    } else {
        "discordant"
    }
}

fn priority_queue_inequality_gini_bps(counts: &[u64], total_alert_count: u64) -> u64 {
    if counts.len() <= 1 || total_alert_count == 0 {
        return 0;
    }
    let mut pairwise_abs_sum = 0_u128;
    for left in counts {
        for right in counts {
            let diff = if left >= right {
                left - right
            } else {
                right - left
            };
            pairwise_abs_sum = pairwise_abs_sum.saturating_add(u128::from(diff));
        }
    }
    let n = counts.len() as u128;
    let denom = 2_u128
        .saturating_mul(n)
        .saturating_mul(u128::from(total_alert_count));
    if denom == 0 {
        0
    } else {
        ((pairwise_abs_sum.saturating_mul(10_000)) / denom) as u64
    }
}

fn priority_queue_distribution_profile(
    priority_queue_size: u64,
    priority_queue_inequality_gini_bps: u64,
    priority_queue_evenness_milli: u64,
) -> &'static str {
    if priority_queue_size == 0 {
        "none"
    } else if priority_queue_size == 1 {
        "single"
    } else if priority_queue_inequality_gini_bps >= 5_000 {
        "polarized"
    } else if priority_queue_inequality_gini_bps >= 2_500 {
        "skewed"
    } else if priority_queue_evenness_milli >= 800 {
        "balanced"
    } else {
        "mixed"
    }
}

fn p2h_risk_band(score: i64) -> String {
    if score < 20 {
        "low".to_string()
    } else if score < 50 {
        "medium".to_string()
    } else {
        "high".to_string()
    }
}

pub fn replay_phase1_from_jsonl(input: &str, as_of: Option<DateTime<Utc>>) -> ReplayOutput {
    let mut filtered = Vec::new();
    for line in input.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(raw) = parse_raw_envelope_loose_str(trimmed) {
            if !is_replay_supported_kind_name(&raw.kind) {
                continue;
            }
            if let Some(as_of) = as_of {
                if let Ok(created_at) = parse_timestamp(&raw.created_at) {
                    if created_at > as_of {
                        continue;
                    }
                }
            }
        }
        filtered.push(trimmed.to_string());
    }
    replay_jsonl_as_of(&filtered.join("\n"), default_policy(), as_of)
}

pub fn hash_value(value: &Value) -> Result<String> {
    let canonical = canonicalize_value(value)?;
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(hex::encode(digest))
}

pub fn parse_as_of(input: Option<&str>) -> Result<Option<DateTime<Utc>>> {
    input
        .map(parse_timestamp)
        .transpose()
        .map_err(|error| anyhow::anyhow!(error.to_string()))
}

pub async fn serve_node(node: Arc<LocalNode>, bind: SocketAddr) -> Result<()> {
    serve_node_with_sync_config(node, bind, SyncRuntimeConfig::default()).await
}

pub async fn serve_node_with_sync_config(
    node: Arc<LocalNode>,
    bind: SocketAddr,
    config: SyncRuntimeConfig,
) -> Result<()> {
    node.set_sync_runtime_config(config);
    let runtime_config = node.sync_runtime_config();
    let worker = runtime_config
        .enabled
        .then(|| Arc::clone(&node).spawn_sync_supervisor());
    let served = serve(node, bind).await;
    if let Some(worker) = worker {
        worker.abort();
        let _ = worker.await;
    }
    served
}

async fn fetch_remote_events_page(
    client: &Client,
    peer: &PeerConfigEntry,
    cursor: i64,
    limit: usize,
) -> Result<RemoteEventsPage> {
    let endpoint = format!(
        "{}/events?cursor={cursor}&limit={}",
        peer.base_url,
        limit.max(1).min(200)
    );
    let mut request = client.get(endpoint);
    if let Some(token) = normalize_optional_non_empty(peer.bearer_token.clone()) {
        request = request.bearer_auth(token);
    }

    let response = request.send().await.context("requesting remote events")?;
    if response.status() == StatusCode::UNAUTHORIZED {
        bail!("remote events request unauthorized for peer `{}`", peer.id);
    }
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        bail!("remote events request failed: status {status}, body: {body}");
    }

    let page = response
        .json::<RemoteEventsPage>()
        .await
        .context("decoding remote events page")?;
    Ok(page)
}

async fn fetch_remote_snapshot_latest_meta(
    client: &Client,
    peer: &PeerConfigEntry,
    as_of: Option<DateTime<Utc>>,
) -> Result<Option<SnapshotMeta>> {
    let endpoint = match as_of {
        Some(timestamp) => format!(
            "{}/snapshots/latest?as_of={}",
            peer.base_url,
            timestamp.to_rfc3339()
        ),
        None => format!("{}/snapshots/latest", peer.base_url),
    };
    let mut request = client.get(endpoint);
    if let Some(token) = normalize_optional_non_empty(peer.bearer_token.clone()) {
        request = request.bearer_auth(token);
    }

    let response = request
        .send()
        .await
        .context("requesting remote latest snapshot")?;
    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if response.status() == StatusCode::UNAUTHORIZED {
        bail!(
            "remote latest snapshot request unauthorized for peer `{}`",
            peer.id
        );
    }
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        bail!("remote latest snapshot request failed: status {status}, body: {body}");
    }

    let meta = response
        .json::<SnapshotMeta>()
        .await
        .context("decoding remote latest snapshot metadata")?;
    Ok(Some(meta))
}

async fn fetch_remote_snapshot_document(
    client: &Client,
    peer: &PeerConfigEntry,
    snapshot_id: &str,
) -> Result<SnapshotDocument> {
    let endpoint = format!("{}/snapshots/{snapshot_id}", peer.base_url);
    let mut request = client.get(endpoint);
    if let Some(token) = normalize_optional_non_empty(peer.bearer_token.clone()) {
        request = request.bearer_auth(token);
    }

    let response = request
        .send()
        .await
        .context("requesting remote snapshot document")?;
    if response.status() == StatusCode::UNAUTHORIZED {
        bail!(
            "remote snapshot document request unauthorized for peer `{}`",
            peer.id
        );
    }
    if response.status() == StatusCode::NOT_FOUND {
        bail!("snapshot `{snapshot_id}` not found on peer `{}`", peer.id);
    }
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        bail!("remote snapshot document request failed: status {status}, body: {body}");
    }

    response
        .json::<SnapshotDocument>()
        .await
        .context("decoding remote snapshot document")
}

fn select_sync_peers(
    config: &PeerConfig,
    request: &SyncPullRequest,
) -> Result<Vec<PeerConfigEntry>> {
    if let Some(peer_id) = request.peer_id.as_deref() {
        let peer = config
            .peers
            .iter()
            .find(|entry| entry.id == peer_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("peer `{peer_id}` not found"))?;
        return Ok(vec![peer]);
    }

    if request.all {
        return Ok(config.peers.clone());
    }

    Ok(config
        .peers
        .iter()
        .filter(|entry| entry.enabled)
        .cloned()
        .collect())
}

fn validate_peer_config(file: PeerConfigFile) -> Result<PeerConfig> {
    if file.version != 1 {
        bail!("unsupported peers config version `{}`", file.version);
    }

    let mut peers = Vec::with_capacity(file.peers.len());
    let mut ids = std::collections::BTreeSet::new();
    for entry in file.peers {
        let id = entry.id.trim().to_string();
        if id.is_empty() {
            bail!("peer id cannot be empty");
        }
        if !ids.insert(id.clone()) {
            bail!("duplicate peer id `{id}`");
        }

        let url = Url::parse(entry.base_url.trim())
            .with_context(|| format!("invalid peer base_url for `{id}`"))?;
        if url.scheme() != "http" && url.scheme() != "https" {
            bail!("peer `{id}` base_url must use http or https");
        }
        let mut normalized = url.to_string();
        while normalized.ends_with('/') {
            normalized.pop();
        }

        peers.push(PeerConfigEntry {
            id,
            base_url: normalized,
            bearer_token: normalize_optional_non_empty(entry.bearer_token),
            enabled: entry.enabled.unwrap_or(true),
        });
    }

    Ok(PeerConfig {
        read_token: normalize_optional_non_empty(file.read_token),
        peers,
    })
}

fn normalize_optional_non_empty(value: Option<String>) -> Option<String> {
    value.and_then(|inner| {
        let trimmed = inner.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn default_peer_sync_state(peer_id: &str) -> PeerSyncStateRow {
    PeerSyncStateRow {
        peer_id: peer_id.to_string(),
        last_remote_cursor: 0,
        last_synced_at: None,
        last_error: None,
        consecutive_failures: 0,
        next_attempt_at: None,
        last_cycle_started_at: None,
        last_cycle_finished_at: None,
        last_result_json: None,
    }
}

fn should_attempt_peer(next_attempt_at: Option<&str>, now: DateTime<Utc>) -> bool {
    match next_attempt_at {
        Some(value) => parse_timestamp(value).map_or(true, |timestamp| now >= timestamp),
        None => true,
    }
}

fn compute_backoff_delay_seconds(interval_seconds: u64, consecutive_failures: u32) -> u64 {
    let multiplier = 1u64
        .checked_shl(consecutive_failures.min(20))
        .unwrap_or(u64::MAX);
    interval_seconds.max(1).saturating_mul(multiplier).min(300)
}

fn validate_events_log_for_startup(
    path: &Path,
    hash_chain_enabled: bool,
    chain_path: Option<&Path>,
) -> Result<()> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("reading events log {}", path.display()))?;
    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let line_number = index + 1;
        serde_json::from_str::<Value>(trimmed).with_context(|| {
            format!(
                "events.log fails closed on restart: line {line_number} is malformed JSON"
            )
        })?;
    }
    if hash_chain_enabled {
        let chain_path = chain_path.context("chain path required when hash chain enabled")?;
        event_log_chain::verify_chain_against_log(path, chain_path).with_context(|| {
            "events.log hash chain verification failed on restart".to_string()
        })?;
    }
    Ok(())
}

fn append_event_line(path: &Path, raw_json: &str) -> Result<()> {
    let mut file = OpenOptions::new()
        .append(true)
        .create(true)
        .open(path)
        .with_context(|| format!("opening event log {}", path.display()))?;
    writeln!(file, "{raw_json}")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        LocalNode, OfflineLaneAlert, OfflineLaneTelemetryMetric, compute_backoff_delay_seconds,
        offline_lane_alert_rollup, offline_lane_alerts_for_metric, should_attempt_peer,
    };
    use chrono::{Duration, Utc};
    use policy::{OfflineAlertLanePolicy, default_policy};
    use protocol_core::AlertSeverity;
    use std::fs;
    use std::path::PathBuf;

    fn workspace_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
    }

    fn temp_data_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("unix epoch")
            .as_nanos();
        let path = workspace_root()
            .join("target")
            .join("tmp")
            .join(format!("node-lib-{label}-{nanos}"));
        fs::create_dir_all(&path).expect("create temp path");
        path
    }

    #[test]
    fn backoff_delay_caps_at_five_minutes() {
        assert_eq!(compute_backoff_delay_seconds(30, 1), 60);
        assert_eq!(compute_backoff_delay_seconds(30, 2), 120);
        assert_eq!(compute_backoff_delay_seconds(30, 3), 240);
        assert_eq!(compute_backoff_delay_seconds(30, 4), 300);
        assert_eq!(compute_backoff_delay_seconds(30, 8), 300);
    }

    #[test]
    fn peer_attempt_eligibility_obeys_next_attempt_at() {
        let now = Utc::now();
        let future = (now + Duration::seconds(10)).to_rfc3339();
        let past = (now - Duration::seconds(10)).to_rfc3339();
        assert!(!should_attempt_peer(Some(&future), now));
        assert!(should_attempt_peer(Some(&past), now));
        assert!(should_attempt_peer(None, now));
        assert!(should_attempt_peer(Some("not-a-timestamp"), now));
    }

    #[test]
    fn imported_snapshot_validation_rejects_missing_checkpoint() {
        let node = LocalNode::new(temp_data_dir("missing-checkpoint")).expect("node");
        let mut snapshot = node
            .create_snapshot_document(Some(Utc::now()))
            .expect("snapshot document");
        snapshot.checkpoint = None;
        let result = node.validate_imported_snapshot(&snapshot);
        assert!(result.is_err());
    }

    #[test]
    fn imported_snapshot_validation_rejects_state_hash_mismatch() {
        let node = LocalNode::new(temp_data_dir("bad-hash")).expect("node");
        let mut snapshot = node
            .create_snapshot_document(Some(Utc::now()))
            .expect("snapshot document");
        snapshot.meta.state_hash = "deadbeef".to_string();
        let result = node.validate_imported_snapshot(&snapshot);
        assert!(result.is_err());
    }

    #[test]
    fn offline_alerts_follow_policy_thresholds() {
        let metric = OfflineLaneTelemetryMetric {
            service_type: "local-resource-exchange".to_string(),
            template: "local_resource_exchange_v1".to_string(),
            offer_count: 1,
            order_count: 1,
            delivered_count: 2,
            accepted_count: 0,
            disputed_count: 2,
            settled_count: 0,
            auto_refunded_count: 1,
            unresolved_dispute_count: 1,
            dispute_rate_bps: 10_000,
            auto_refund_rate_bps: 5_000,
            invalid_event_count: 4,
            invalid_policy_violation_count: 2,
            invalid_payload_count: 2,
        };

        let default_alerts = offline_lane_alerts_for_metric(&metric, default_policy());
        assert_eq!(default_alerts.len(), 4);
        assert_eq!(default_alerts[0].severity, "warn");

        let mut custom_policy = default_policy().clone();
        custom_policy.offline_alert_unresolved_dispute_count_threshold = 2;
        custom_policy.offline_alert_auto_refund_rate_bps_threshold = 7_000;
        custom_policy.offline_alert_invalid_payload_count_threshold = 3;
        custom_policy.offline_alert_policy_violation_count_threshold = 3;

        let custom_alerts = offline_lane_alerts_for_metric(&metric, &custom_policy);
        assert!(custom_alerts.is_empty());

        let mut severity_policy = default_policy().clone();
        severity_policy.offline_alert_unresolved_disputes_severity = AlertSeverity::Info;
        severity_policy.offline_alert_dispute_rate_bps_threshold = 1_000;
        severity_policy.offline_alert_dispute_rate_min_orders = 1;
        severity_policy.offline_alert_dispute_rate_severity = AlertSeverity::Critical;
        let severity_alerts = offline_lane_alerts_for_metric(&metric, &severity_policy);
        let unresolved = severity_alerts
            .iter()
            .find(|alert| alert.alert_code == "OFFLINE_UNRESOLVED_DISPUTES")
            .expect("unresolved alert");
        assert_eq!(unresolved.severity, "info");
        let dispute_rate = severity_alerts
            .iter()
            .find(|alert| alert.alert_code == "OFFLINE_HIGH_DISPUTE_RATE")
            .expect("dispute rate alert");
        assert_eq!(dispute_rate.severity, "critical");

        let mut disabled_lane_policy = default_policy().clone();
        disabled_lane_policy.offline_alert_enabled_service_types = vec!["physical-handoff".into()];
        let disabled_alerts = offline_lane_alerts_for_metric(&metric, &disabled_lane_policy);
        assert!(disabled_alerts.is_empty());

        let mut lane_override_policy = default_policy().clone();
        lane_override_policy.offline_alert_lane_overrides = vec![OfflineAlertLanePolicy {
            service_type: "local-resource-exchange".to_string(),
            dispute_rate_bps_threshold: Some(10_000),
            dispute_rate_min_orders: Some(10),
            unresolved_dispute_count_threshold: Some(2),
            auto_refund_rate_bps_threshold: Some(8_000),
            auto_refund_min_disputes: Some(3),
            invalid_payload_count_threshold: Some(3),
            policy_violation_count_threshold: Some(3),
            unresolved_disputes_severity: Some(AlertSeverity::Info),
            dispute_rate_severity: Some(AlertSeverity::Info),
            auto_refund_rate_severity: Some(AlertSeverity::Info),
            invalid_payload_spike_severity: Some(AlertSeverity::Warn),
            policy_violation_spike_severity: Some(AlertSeverity::Warn),
        }];
        let lane_override_alerts = offline_lane_alerts_for_metric(&metric, &lane_override_policy);
        assert!(lane_override_alerts.is_empty());

        let mut lane_override_fire_policy = default_policy().clone();
        lane_override_fire_policy.offline_alert_lane_overrides = vec![OfflineAlertLanePolicy {
            service_type: "local-resource-exchange".to_string(),
            dispute_rate_bps_threshold: Some(9_000),
            dispute_rate_min_orders: Some(1),
            unresolved_dispute_count_threshold: Some(1),
            auto_refund_rate_bps_threshold: Some(5_000),
            auto_refund_min_disputes: Some(2),
            invalid_payload_count_threshold: Some(2),
            policy_violation_count_threshold: Some(2),
            unresolved_disputes_severity: Some(AlertSeverity::Info),
            dispute_rate_severity: Some(AlertSeverity::Warn),
            auto_refund_rate_severity: Some(AlertSeverity::Warn),
            invalid_payload_spike_severity: Some(AlertSeverity::Critical),
            policy_violation_spike_severity: Some(AlertSeverity::Warn),
        }];
        let lane_override_fire_alerts =
            offline_lane_alerts_for_metric(&metric, &lane_override_fire_policy);
        let unresolved = lane_override_fire_alerts
            .iter()
            .find(|alert| alert.alert_code == "OFFLINE_UNRESOLVED_DISPUTES")
            .expect("override unresolved alert");
        assert_eq!(unresolved.severity, "info");
        let dispute_rate = lane_override_fire_alerts
            .iter()
            .find(|alert| alert.alert_code == "OFFLINE_HIGH_DISPUTE_RATE")
            .expect("override dispute-rate alert");
        assert_eq!(dispute_rate.severity, "warn");
    }

    #[test]
    fn offline_alert_rollup_is_deterministic() {
        let alerts = vec![
            OfflineLaneAlert {
                service_type: "local-resource-exchange".to_string(),
                template: "local_resource_exchange_v1".to_string(),
                alert_code: "OFFLINE_UNRESOLVED_DISPUTES".to_string(),
                severity: "warn".to_string(),
                value: 2,
                threshold: 1,
                reason: "unresolved".to_string(),
            },
            OfflineLaneAlert {
                service_type: "physical-handoff".to_string(),
                template: "physical_handoff_dual_ack_v1".to_string(),
                alert_code: "OFFLINE_POLICY_VIOLATION_SPIKE".to_string(),
                severity: "critical".to_string(),
                value: 3,
                threshold: 2,
                reason: "policy".to_string(),
            },
            OfflineLaneAlert {
                service_type: "local-resource-exchange".to_string(),
                template: "local_resource_exchange_v1".to_string(),
                alert_code: "OFFLINE_UNRESOLVED_DISPUTES".to_string(),
                severity: "warn".to_string(),
                value: 1,
                threshold: 1,
                reason: "unresolved".to_string(),
            },
        ];

        let rollup = offline_lane_alert_rollup(&alerts);
        let rollup_again = offline_lane_alert_rollup(&alerts);
        assert_eq!(rollup.total_alert_count, 3);
        assert!(rollup.action_required);
        assert_eq!(rollup.action_level, "intervene");
        assert_eq!(rollup.highest_severity.as_deref(), Some("critical"));
        assert_eq!(
            rollup.top_alert_code.as_deref(),
            Some("OFFLINE_UNRESOLVED_DISPUTES")
        );
        assert_eq!(
            rollup.deterministic_fingerprint,
            rollup_again.deterministic_fingerprint
        );
        assert!(!rollup.deterministic_fingerprint.is_empty());
        assert_eq!(
            rollup.priority_queue_fingerprint,
            rollup_again.priority_queue_fingerprint
        );
        assert!(!rollup.priority_queue_fingerprint.is_empty());
        assert_eq!(
            rollup.priority_queue_membership_fingerprint,
            rollup_again.priority_queue_membership_fingerprint
        );
        assert!(!rollup.priority_queue_membership_fingerprint.is_empty());
        assert_eq!(
            rollup.priority_queue_order_fingerprint,
            rollup_again.priority_queue_order_fingerprint
        );
        assert!(!rollup.priority_queue_order_fingerprint.is_empty());
        assert_eq!(
            rollup.priority_queue_pressure_fingerprint,
            rollup_again.priority_queue_pressure_fingerprint
        );
        assert!(!rollup.priority_queue_pressure_fingerprint.is_empty());
        assert_eq!(
            rollup.priority_head_service_type.as_deref(),
            Some("physical-handoff")
        );
        assert_eq!(
            rollup.priority_head_action_level.as_deref(),
            Some("intervene")
        );
        assert_eq!(
            rollup.priority_tail_service_type.as_deref(),
            Some("local-resource-exchange")
        );
        assert_eq!(rollup.priority_queue_size, 2);
        assert_eq!(rollup.priority_queue_health, "critical");
        assert_eq!(rollup.priority_queue_intervene_count, 1);
        assert_eq!(rollup.priority_queue_watch_count, 1);
        assert_eq!(rollup.priority_queue_none_count, 0);
        assert_eq!(rollup.priority_queue_actionable_count, 2);
        assert_eq!(rollup.priority_queue_intervene_within_actionable_bps, 5_000);
        assert_eq!(rollup.priority_queue_watch_within_actionable_bps, 5_000);
        assert_eq!(rollup.priority_queue_action_escalation_profile, "balanced");
        assert_eq!(rollup.priority_queue_action_weighted_units, 5);
        assert_eq!(rollup.priority_queue_action_weighted_pressure_bps, 8_333);
        assert_eq!(
            rollup.priority_queue_action_weighted_per_service_milli,
            2_500
        );
        assert_eq!(rollup.priority_queue_action_weighted_profile, "urgent");
        assert_eq!(rollup.priority_queue_action_polarization_bps, 0);
        assert_eq!(rollup.priority_queue_action_balance_score_bps, 10_000);
        assert_eq!(
            rollup.priority_queue_action_polarization_profile,
            "balanced"
        );
        assert_eq!(rollup.priority_queue_dominant_action_level, "intervene");
        assert_eq!(rollup.priority_queue_dominant_action_bps, 5_000);
        assert_eq!(rollup.priority_queue_top_service_alert_share_bps, 3_333);
        assert_eq!(rollup.priority_queue_leader_alert_share_bps, 6_666);
        assert_eq!(rollup.priority_queue_runner_up_alert_share_bps, 3_333);
        assert_eq!(rollup.priority_queue_leader_gap_bps, 3_333);
        assert_eq!(rollup.priority_queue_top2_service_alert_share_bps, 10_000);
        assert_eq!(rollup.priority_queue_service_concentration_hhi_bps, 5_555);
        assert_eq!(rollup.priority_queue_concentration_level, "concentrated");
        assert_eq!(rollup.priority_queue_long_tail_alert_share_bps, 0);
        assert_eq!(rollup.priority_queue_effective_service_count_milli, 1_800);
        assert_eq!(rollup.priority_queue_leader_dominance_level, "tilted");
        assert_eq!(rollup.priority_queue_coverage_50_count, 1);
        assert_eq!(rollup.priority_queue_coverage_80_count, 2);
        assert_eq!(rollup.priority_queue_coverage_95_count, 2);
        assert_eq!(rollup.priority_queue_coverage_profile, "top-heavy");
        assert_eq!(rollup.priority_queue_risk_score_bps, 6_888);
        assert_eq!(rollup.priority_queue_risk_band, "high");
        assert_eq!(rollup.priority_queue_response_sla_seconds, 7_200);
        assert_eq!(rollup.priority_queue_sla_multiplier_bps, 10_000);
        assert_eq!(rollup.priority_queue_effective_response_sla_seconds, 7_200);
        assert_eq!(rollup.priority_queue_sla_slippage_bps, 0);
        assert_eq!(rollup.priority_queue_sla_pressure_profile, "on-target");
        assert_eq!(rollup.priority_queue_sla_adjusted_risk_bps, 6_888);
        assert_eq!(rollup.priority_queue_sla_risk_delta_bps, 0);
        assert_eq!(rollup.priority_queue_operational_posture, "strained");
        assert_eq!(rollup.priority_queue_attention_index_bps, 7_610);
        assert_eq!(rollup.priority_queue_attention_delta_bps, 722);
        assert_eq!(rollup.priority_queue_attention_profile, "strained");
        assert_eq!(rollup.priority_queue_readiness_score_bps, 2_029);
        assert_eq!(rollup.priority_queue_readiness_delta_bps, 7_971);
        assert_eq!(rollup.priority_queue_readiness_profile, "critical");
        assert_eq!(rollup.priority_queue_stability_index_bps, 1_668);
        assert_eq!(rollup.priority_queue_stability_delta_bps, 361);
        assert_eq!(rollup.priority_queue_stability_profile, "critical");
        assert_eq!(rollup.priority_queue_resilience_score_bps, 6_667);
        assert_eq!(rollup.priority_queue_resilience_delta_bps, 4_999);
        assert_eq!(rollup.priority_queue_resilience_profile, "resilient");
        assert_eq!(rollup.priority_queue_coherence_score_bps, 3_454);
        assert_eq!(rollup.priority_queue_coherence_delta_bps, 4_999);
        assert_eq!(rollup.priority_queue_coherence_profile, "fragmented");
        assert_eq!(rollup.priority_queue_adaptability_score_bps, 5_818);
        assert_eq!(rollup.priority_queue_adaptability_delta_bps, 2_364);
        assert_eq!(rollup.priority_queue_adaptability_profile, "constrained");
        assert_eq!(rollup.priority_queue_sustainability_score_bps, 4_403);
        assert_eq!(rollup.priority_queue_sustainability_delta_bps, 1_415);
        assert_eq!(rollup.priority_queue_sustainability_profile, "stressed");
        assert_eq!(rollup.priority_queue_continuity_score_bps, 7_023);
        assert_eq!(rollup.priority_queue_continuity_delta_bps, 2_620);
        assert_eq!(rollup.priority_queue_continuity_profile, "durable");
        assert_eq!(rollup.priority_queue_recoverability_score_bps, 6_471);
        assert_eq!(rollup.priority_queue_recoverability_delta_bps, 552);
        assert_eq!(rollup.priority_queue_recoverability_profile, "recoverable");
        assert_eq!(rollup.priority_queue_regeneration_score_bps, 5_291);
        assert_eq!(rollup.priority_queue_regeneration_delta_bps, 1_180);
        assert_eq!(rollup.priority_queue_regeneration_profile, "rebuilding");
        assert_eq!(rollup.priority_queue_restoration_score_bps, 4_660);
        assert_eq!(rollup.priority_queue_restoration_delta_bps, 631);
        assert_eq!(rollup.priority_queue_restoration_profile, "repairing");
        assert_eq!(rollup.priority_queue_stewardship_score_bps, 4_747);
        assert_eq!(rollup.priority_queue_stewardship_delta_bps, 87);
        assert_eq!(rollup.priority_queue_stewardship_profile, "guarded");
        assert_eq!(rollup.priority_queue_guardianship_score_bps, 5_358);
        assert_eq!(rollup.priority_queue_guardianship_delta_bps, 611);
        assert_eq!(rollup.priority_queue_guardianship_profile, "watchful");
        assert_eq!(rollup.priority_queue_assurance_score_bps, 6_701);
        assert_eq!(rollup.priority_queue_assurance_delta_bps, 1_343);
        assert_eq!(rollup.priority_queue_assurance_profile, "assured");
        assert_eq!(rollup.priority_queue_vigilance_score_bps, 7_353);
        assert_eq!(rollup.priority_queue_vigilance_delta_bps, 652);
        assert_eq!(rollup.priority_queue_vigilance_profile, "vigilant");
        assert_eq!(rollup.priority_queue_oversight_score_bps, 6_166);
        assert_eq!(rollup.priority_queue_oversight_delta_bps, 1_187);
        assert_eq!(rollup.priority_queue_oversight_profile, "attentive");
        assert_eq!(rollup.priority_queue_accountability_score_bps, 6_166);
        assert_eq!(rollup.priority_queue_accountability_delta_bps, 1_187);
        assert_eq!(rollup.priority_queue_accountability_profile, "answerable");
        assert_eq!(rollup.priority_queue_verifiability_score_bps, 7_444);
        assert_eq!(rollup.priority_queue_verifiability_delta_bps, 1_278);
        assert_eq!(rollup.priority_queue_verifiability_profile, "traceable");
        assert_eq!(rollup.priority_queue_auditability_score_bps, 6_203);
        assert_eq!(rollup.priority_queue_auditability_delta_bps, 1_241);
        assert_eq!(rollup.priority_queue_auditability_profile, "auditable");
        assert_eq!(rollup.priority_queue_transparency_score_bps, 7_327);
        assert_eq!(rollup.priority_queue_transparency_delta_bps, 1_124);
        assert_eq!(rollup.priority_queue_transparency_profile, "transparent");
        assert_eq!(rollup.priority_queue_legibility_score_bps, 7_510);
        assert_eq!(rollup.priority_queue_legibility_delta_bps, 183);
        assert_eq!(rollup.priority_queue_legibility_profile, "legible");
        assert_eq!(rollup.priority_queue_navigability_score_bps, 5_402);
        assert_eq!(rollup.priority_queue_navigability_delta_bps, 2_108);
        assert_eq!(rollup.priority_queue_navigability_profile, "guided");
        assert_eq!(rollup.priority_queue_interpretability_score_bps, 5_910);
        assert_eq!(rollup.priority_queue_interpretability_delta_bps, 508);
        assert_eq!(rollup.priority_queue_interpretability_profile, "decodable");
        assert_eq!(rollup.priority_queue_explainability_score_bps, 7_806);
        assert_eq!(rollup.priority_queue_explainability_delta_bps, 1_896);
        assert_eq!(rollup.priority_queue_explainability_profile, "explainable");
        assert_eq!(rollup.priority_queue_clarity_score_bps, 6_239);
        assert_eq!(rollup.priority_queue_clarity_delta_bps, 1_567);
        assert_eq!(rollup.priority_queue_clarity_profile, "clear");
        assert_eq!(rollup.priority_queue_comprehensibility_score_bps, 7_774);
        assert_eq!(rollup.priority_queue_comprehensibility_delta_bps, 1_535);
        assert_eq!(
            rollup.priority_queue_comprehensibility_profile,
            "comprehensible"
        );
        assert_eq!(rollup.priority_queue_intelligibility_score_bps, 5_467);
        assert_eq!(rollup.priority_queue_intelligibility_delta_bps, 2_307);
        assert_eq!(
            rollup.priority_queue_intelligibility_profile,
            "understandable"
        );
        assert_eq!(rollup.priority_queue_communicability_score_bps, 7_747);
        assert_eq!(rollup.priority_queue_communicability_delta_bps, 2_280);
        assert_eq!(
            rollup.priority_queue_communicability_profile,
            "communicative"
        );
        assert_eq!(rollup.priority_queue_articulability_score_bps, 7_738);
        assert_eq!(rollup.priority_queue_articulability_delta_bps, 9);
        assert_eq!(rollup.priority_queue_articulability_profile, "articulate");
        assert_eq!(rollup.priority_queue_expressivity_score_bps, 7_939);
        assert_eq!(rollup.priority_queue_expressivity_delta_bps, 201);
        assert_eq!(rollup.priority_queue_expressivity_profile, "expressive");
        assert_eq!(rollup.priority_queue_eloquence_score_bps, 8_318);
        assert_eq!(rollup.priority_queue_eloquence_delta_bps, 379);
        assert_eq!(rollup.priority_queue_eloquence_profile, "eloquent");
        assert_eq!(rollup.priority_queue_lucidity_score_bps, 7_928);
        assert_eq!(rollup.priority_queue_lucidity_delta_bps, 390);
        assert_eq!(rollup.priority_queue_lucidity_profile, "lucid");
        assert_eq!(rollup.priority_queue_illumination_score_bps, 5_881);
        assert_eq!(rollup.priority_queue_illumination_delta_bps, 2_047);
        assert_eq!(rollup.priority_queue_illumination_profile, "visible");
        assert_eq!(rollup.priority_queue_clarion_score_bps, 7_825);
        assert_eq!(rollup.priority_queue_clarion_delta_bps, 1_944);
        assert_eq!(rollup.priority_queue_clarion_profile, "glowing");
        assert_eq!(rollup.priority_queue_resonance_score_bps, 8_524);
        assert_eq!(rollup.priority_queue_resonance_delta_bps, 699);
        assert_eq!(rollup.priority_queue_resonance_profile, "sonorous");
        assert_eq!(rollup.priority_queue_cadence_score_bps, 8_706);
        assert_eq!(rollup.priority_queue_cadence_delta_bps, 182);
        assert_eq!(rollup.priority_queue_cadence_profile, "orchestral");
        assert_eq!(rollup.priority_queue_harmony_score_bps, 8_325);
        assert_eq!(rollup.priority_queue_harmony_delta_bps, 381);
        assert_eq!(rollup.priority_queue_harmony_profile, "symphonic");
        assert_eq!(rollup.priority_queue_inequality_gini_bps, 1_666);
        assert_eq!(rollup.priority_queue_evenness_milli, 900);
        assert_eq!(rollup.priority_queue_distribution_profile, "balanced");
        assert_eq!(rollup.priority_queue_actionable_bps, 10_000);
        assert_eq!(rollup.priority_queue_critical_bps, 5_000);
        assert_eq!(rollup.priority_queue_load_level, "light");
        assert_eq!(rollup.by_severity.len(), 2);
        assert_eq!(rollup.by_severity[0].severity, "critical");
        assert_eq!(rollup.by_severity[0].count, 1);
        assert_eq!(rollup.by_severity[1].severity, "warn");
        assert_eq!(rollup.by_severity[1].count, 2);
        assert_eq!(rollup.by_action_level.len(), 2);
        assert_eq!(rollup.by_action_level[0].action_level, "intervene");
        assert_eq!(rollup.by_action_level[0].count, 1);
        assert_eq!(rollup.by_action_level[1].action_level, "watch");
        assert_eq!(rollup.by_action_level[1].count, 1);
        assert_eq!(rollup.by_code.len(), 2);
        assert_eq!(
            rollup.by_code[0].alert_code,
            "OFFLINE_POLICY_VIOLATION_SPIKE"
        );
        assert_eq!(rollup.by_code[0].count, 1);
        assert_eq!(rollup.by_code[1].alert_code, "OFFLINE_UNRESOLVED_DISPUTES");
        assert_eq!(rollup.by_code[1].count, 2);
        assert_eq!(
            rollup.affected_service_types,
            vec!["local-resource-exchange", "physical-handoff"]
        );
        assert_eq!(rollup.critical_service_types, vec!["physical-handoff"]);
        assert_eq!(
            rollup.top_service_type.as_deref(),
            Some("local-resource-exchange")
        );
        assert_eq!(rollup.service_summaries.len(), 2);
        assert_eq!(
            rollup.service_summaries[0].service_type,
            "local-resource-exchange"
        );
        assert_eq!(rollup.service_summaries[0].alert_count, 2);
        assert!(rollup.service_summaries[0].action_required);
        assert_eq!(rollup.service_summaries[0].action_level, "watch");
        assert_eq!(
            rollup.service_summaries[0].highest_severity.as_deref(),
            Some("warn")
        );
        assert_eq!(
            rollup.service_summaries[0].top_alert_code.as_deref(),
            Some("OFFLINE_UNRESOLVED_DISPUTES")
        );
        assert!(
            !rollup.service_summaries[0]
                .deterministic_fingerprint
                .is_empty()
        );
        assert_eq!(rollup.prioritized_services.len(), 2);
        assert_eq!(rollup.prioritized_services[0].rank, 1);
        assert_eq!(
            rollup.prioritized_services[0].service_type,
            "physical-handoff"
        );
        assert_eq!(rollup.prioritized_services[0].action_level, "intervene");
        assert_eq!(rollup.prioritized_services[1].rank, 2);
        assert_eq!(
            rollup.prioritized_services[1].service_type,
            "local-resource-exchange"
        );
    }

    #[test]
    fn offline_alert_rollup_info_only_is_not_action_required() {
        let alerts = vec![OfflineLaneAlert {
            service_type: "local-resource-exchange".to_string(),
            template: "local_resource_exchange_v1".to_string(),
            alert_code: "OFFLINE_UNRESOLVED_DISPUTES".to_string(),
            severity: "info".to_string(),
            value: 1,
            threshold: 1,
            reason: "informational".to_string(),
        }];
        let rollup = offline_lane_alert_rollup(&alerts);
        assert_eq!(rollup.total_alert_count, 1);
        assert!(!rollup.action_required);
        assert_eq!(rollup.action_level, "none");
        assert_eq!(rollup.highest_severity.as_deref(), Some("info"));
        assert!(!rollup.priority_queue_fingerprint.is_empty());
        assert!(!rollup.priority_queue_membership_fingerprint.is_empty());
        assert!(!rollup.priority_queue_order_fingerprint.is_empty());
        assert!(!rollup.priority_queue_pressure_fingerprint.is_empty());
        assert_eq!(
            rollup.priority_head_service_type.as_deref(),
            Some("local-resource-exchange")
        );
        assert_eq!(rollup.priority_head_action_level.as_deref(), Some("none"));
        assert_eq!(
            rollup.priority_tail_service_type.as_deref(),
            Some("local-resource-exchange")
        );
        assert_eq!(rollup.priority_queue_size, 1);
        assert_eq!(rollup.priority_queue_health, "stable");
        assert_eq!(rollup.priority_queue_intervene_count, 0);
        assert_eq!(rollup.priority_queue_watch_count, 0);
        assert_eq!(rollup.priority_queue_none_count, 1);
        assert_eq!(rollup.priority_queue_actionable_count, 0);
        assert_eq!(rollup.priority_queue_intervene_within_actionable_bps, 0);
        assert_eq!(rollup.priority_queue_watch_within_actionable_bps, 0);
        assert_eq!(rollup.priority_queue_action_escalation_profile, "idle");
        assert_eq!(rollup.priority_queue_action_weighted_units, 1);
        assert_eq!(rollup.priority_queue_action_weighted_pressure_bps, 3_333);
        assert_eq!(
            rollup.priority_queue_action_weighted_per_service_milli,
            1_000
        );
        assert_eq!(rollup.priority_queue_action_weighted_profile, "passive");
        assert_eq!(rollup.priority_queue_action_polarization_bps, 0);
        assert_eq!(rollup.priority_queue_action_balance_score_bps, 0);
        assert_eq!(rollup.priority_queue_action_polarization_profile, "idle");
        assert_eq!(rollup.priority_queue_dominant_action_level, "none");
        assert_eq!(rollup.priority_queue_dominant_action_bps, 10_000);
        assert_eq!(rollup.priority_queue_top_service_alert_share_bps, 10_000);
        assert_eq!(rollup.priority_queue_leader_alert_share_bps, 10_000);
        assert_eq!(rollup.priority_queue_runner_up_alert_share_bps, 0);
        assert_eq!(rollup.priority_queue_leader_gap_bps, 10_000);
        assert_eq!(rollup.priority_queue_top2_service_alert_share_bps, 10_000);
        assert_eq!(rollup.priority_queue_service_concentration_hhi_bps, 10_000);
        assert_eq!(rollup.priority_queue_concentration_level, "concentrated");
        assert_eq!(rollup.priority_queue_long_tail_alert_share_bps, 0);
        assert_eq!(rollup.priority_queue_effective_service_count_milli, 1_000);
        assert_eq!(rollup.priority_queue_leader_dominance_level, "dominant");
        assert_eq!(rollup.priority_queue_coverage_50_count, 1);
        assert_eq!(rollup.priority_queue_coverage_80_count, 1);
        assert_eq!(rollup.priority_queue_coverage_95_count, 1);
        assert_eq!(rollup.priority_queue_coverage_profile, "single");
        assert_eq!(rollup.priority_queue_risk_score_bps, 2_000);
        assert_eq!(rollup.priority_queue_risk_band, "low");
        assert_eq!(rollup.priority_queue_response_sla_seconds, 86_400);
        assert_eq!(rollup.priority_queue_sla_multiplier_bps, 10_000);
        assert_eq!(rollup.priority_queue_effective_response_sla_seconds, 86_400);
        assert_eq!(rollup.priority_queue_sla_slippage_bps, 0);
        assert_eq!(rollup.priority_queue_sla_pressure_profile, "idle");
        assert_eq!(rollup.priority_queue_sla_adjusted_risk_bps, 2_000);
        assert_eq!(rollup.priority_queue_sla_risk_delta_bps, 0);
        assert_eq!(rollup.priority_queue_operational_posture, "none");
        assert_eq!(rollup.priority_queue_attention_index_bps, 0);
        assert_eq!(rollup.priority_queue_attention_delta_bps, 0);
        assert_eq!(rollup.priority_queue_attention_profile, "idle");
        assert_eq!(rollup.priority_queue_readiness_score_bps, 0);
        assert_eq!(rollup.priority_queue_readiness_delta_bps, 0);
        assert_eq!(rollup.priority_queue_readiness_profile, "idle");
        assert_eq!(rollup.priority_queue_stability_index_bps, 0);
        assert_eq!(rollup.priority_queue_stability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_stability_profile, "idle");
        assert_eq!(rollup.priority_queue_resilience_score_bps, 0);
        assert_eq!(rollup.priority_queue_resilience_delta_bps, 0);
        assert_eq!(rollup.priority_queue_resilience_profile, "idle");
        assert_eq!(rollup.priority_queue_coherence_score_bps, 0);
        assert_eq!(rollup.priority_queue_coherence_delta_bps, 0);
        assert_eq!(rollup.priority_queue_coherence_profile, "idle");
        assert_eq!(rollup.priority_queue_adaptability_score_bps, 0);
        assert_eq!(rollup.priority_queue_adaptability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_adaptability_profile, "idle");
        assert_eq!(rollup.priority_queue_sustainability_score_bps, 0);
        assert_eq!(rollup.priority_queue_sustainability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_sustainability_profile, "idle");
        assert_eq!(rollup.priority_queue_continuity_score_bps, 0);
        assert_eq!(rollup.priority_queue_continuity_delta_bps, 0);
        assert_eq!(rollup.priority_queue_continuity_profile, "idle");
        assert_eq!(rollup.priority_queue_recoverability_score_bps, 0);
        assert_eq!(rollup.priority_queue_recoverability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_recoverability_profile, "idle");
        assert_eq!(rollup.priority_queue_regeneration_score_bps, 0);
        assert_eq!(rollup.priority_queue_regeneration_delta_bps, 0);
        assert_eq!(rollup.priority_queue_regeneration_profile, "idle");
        assert_eq!(rollup.priority_queue_restoration_score_bps, 0);
        assert_eq!(rollup.priority_queue_restoration_delta_bps, 0);
        assert_eq!(rollup.priority_queue_restoration_profile, "idle");
        assert_eq!(rollup.priority_queue_stewardship_score_bps, 0);
        assert_eq!(rollup.priority_queue_stewardship_delta_bps, 0);
        assert_eq!(rollup.priority_queue_stewardship_profile, "idle");
        assert_eq!(rollup.priority_queue_guardianship_score_bps, 0);
        assert_eq!(rollup.priority_queue_guardianship_delta_bps, 0);
        assert_eq!(rollup.priority_queue_guardianship_profile, "idle");
        assert_eq!(rollup.priority_queue_assurance_score_bps, 0);
        assert_eq!(rollup.priority_queue_assurance_delta_bps, 0);
        assert_eq!(rollup.priority_queue_assurance_profile, "idle");
        assert_eq!(rollup.priority_queue_vigilance_score_bps, 0);
        assert_eq!(rollup.priority_queue_vigilance_delta_bps, 0);
        assert_eq!(rollup.priority_queue_vigilance_profile, "idle");
        assert_eq!(rollup.priority_queue_oversight_score_bps, 0);
        assert_eq!(rollup.priority_queue_oversight_delta_bps, 0);
        assert_eq!(rollup.priority_queue_oversight_profile, "idle");
        assert_eq!(rollup.priority_queue_accountability_score_bps, 0);
        assert_eq!(rollup.priority_queue_accountability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_accountability_profile, "idle");
        assert_eq!(rollup.priority_queue_verifiability_score_bps, 0);
        assert_eq!(rollup.priority_queue_verifiability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_verifiability_profile, "idle");
        assert_eq!(rollup.priority_queue_auditability_score_bps, 0);
        assert_eq!(rollup.priority_queue_auditability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_auditability_profile, "idle");
        assert_eq!(rollup.priority_queue_transparency_score_bps, 0);
        assert_eq!(rollup.priority_queue_transparency_delta_bps, 0);
        assert_eq!(rollup.priority_queue_transparency_profile, "idle");
        assert_eq!(rollup.priority_queue_legibility_score_bps, 0);
        assert_eq!(rollup.priority_queue_legibility_delta_bps, 0);
        assert_eq!(rollup.priority_queue_legibility_profile, "idle");
        assert_eq!(rollup.priority_queue_navigability_score_bps, 0);
        assert_eq!(rollup.priority_queue_navigability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_navigability_profile, "idle");
        assert_eq!(rollup.priority_queue_interpretability_score_bps, 0);
        assert_eq!(rollup.priority_queue_interpretability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_interpretability_profile, "idle");
        assert_eq!(rollup.priority_queue_explainability_score_bps, 0);
        assert_eq!(rollup.priority_queue_explainability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_explainability_profile, "idle");
        assert_eq!(rollup.priority_queue_clarity_score_bps, 0);
        assert_eq!(rollup.priority_queue_clarity_delta_bps, 0);
        assert_eq!(rollup.priority_queue_clarity_profile, "idle");
        assert_eq!(rollup.priority_queue_comprehensibility_score_bps, 0);
        assert_eq!(rollup.priority_queue_comprehensibility_delta_bps, 0);
        assert_eq!(rollup.priority_queue_comprehensibility_profile, "idle");
        assert_eq!(rollup.priority_queue_intelligibility_score_bps, 0);
        assert_eq!(rollup.priority_queue_intelligibility_delta_bps, 0);
        assert_eq!(rollup.priority_queue_intelligibility_profile, "idle");
        assert_eq!(rollup.priority_queue_communicability_score_bps, 0);
        assert_eq!(rollup.priority_queue_communicability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_communicability_profile, "idle");
        assert_eq!(rollup.priority_queue_articulability_score_bps, 0);
        assert_eq!(rollup.priority_queue_articulability_delta_bps, 0);
        assert_eq!(rollup.priority_queue_articulability_profile, "idle");
        assert_eq!(rollup.priority_queue_expressivity_score_bps, 0);
        assert_eq!(rollup.priority_queue_expressivity_delta_bps, 0);
        assert_eq!(rollup.priority_queue_expressivity_profile, "idle");
        assert_eq!(rollup.priority_queue_eloquence_score_bps, 0);
        assert_eq!(rollup.priority_queue_eloquence_delta_bps, 0);
        assert_eq!(rollup.priority_queue_eloquence_profile, "idle");
        assert_eq!(rollup.priority_queue_lucidity_score_bps, 0);
        assert_eq!(rollup.priority_queue_lucidity_delta_bps, 0);
        assert_eq!(rollup.priority_queue_lucidity_profile, "idle");
        assert_eq!(rollup.priority_queue_illumination_score_bps, 0);
        assert_eq!(rollup.priority_queue_illumination_delta_bps, 0);
        assert_eq!(rollup.priority_queue_illumination_profile, "idle");
        assert_eq!(rollup.priority_queue_clarion_score_bps, 0);
        assert_eq!(rollup.priority_queue_clarion_delta_bps, 0);
        assert_eq!(rollup.priority_queue_clarion_profile, "idle");
        assert_eq!(rollup.priority_queue_resonance_score_bps, 0);
        assert_eq!(rollup.priority_queue_resonance_delta_bps, 0);
        assert_eq!(rollup.priority_queue_resonance_profile, "idle");
        assert_eq!(rollup.priority_queue_cadence_score_bps, 0);
        assert_eq!(rollup.priority_queue_cadence_delta_bps, 0);
        assert_eq!(rollup.priority_queue_cadence_profile, "idle");
        assert_eq!(rollup.priority_queue_harmony_score_bps, 0);
        assert_eq!(rollup.priority_queue_harmony_delta_bps, 0);
        assert_eq!(rollup.priority_queue_harmony_profile, "idle");
        assert_eq!(rollup.priority_queue_inequality_gini_bps, 0);
        assert_eq!(rollup.priority_queue_evenness_milli, 1_000);
        assert_eq!(rollup.priority_queue_distribution_profile, "single");
        assert_eq!(rollup.priority_queue_actionable_bps, 0);
        assert_eq!(rollup.priority_queue_critical_bps, 0);
        assert_eq!(rollup.priority_queue_load_level, "light");
        assert_eq!(rollup.critical_service_types.len(), 0);
        assert_eq!(rollup.by_action_level.len(), 1);
        assert_eq!(rollup.by_action_level[0].action_level, "none");
        assert_eq!(rollup.by_action_level[0].count, 1);
        assert_eq!(
            rollup.top_service_type.as_deref(),
            Some("local-resource-exchange")
        );
        assert_eq!(rollup.service_summaries.len(), 1);
        assert!(!rollup.service_summaries[0].action_required);
        assert_eq!(rollup.service_summaries[0].action_level, "none");
        assert_eq!(rollup.prioritized_services.len(), 1);
        assert_eq!(rollup.prioritized_services[0].rank, 1);
        assert_eq!(
            rollup.prioritized_services[0].service_type,
            "local-resource-exchange"
        );
    }
}
