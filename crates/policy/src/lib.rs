use std::sync::LazyLock;

use protocol_core::{
    AlertSeverity, P2HRiskBand, PolicySnapshotPayload, SERVICE_TYPE_COMPUTE_JOB,
    SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE, SERVICE_TYPE_PHYSICAL_HANDOFF, SinkKind,
};
use serde::{Deserialize, Serialize};

pub const DEFAULT_POLICY_VERSION: &str = "v0-default";
pub const DEFAULT_POLICY_AUTHORITY_PUB_KEY: &str =
    "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737";
pub const DEFAULT_OFFLINE_ALERT_UNRESOLVED_DISPUTE_COUNT_THRESHOLD: u64 = 1;
pub const DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_BPS_THRESHOLD: u64 = 0;
pub const DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_MIN_ORDERS: u64 = 0;
pub const DEFAULT_OFFLINE_ALERT_AUTO_REFUND_RATE_BPS_THRESHOLD: u64 = 5_000;
pub const DEFAULT_OFFLINE_ALERT_AUTO_REFUND_MIN_DISPUTES: u64 = 2;
pub const DEFAULT_OFFLINE_ALERT_INVALID_PAYLOAD_COUNT_THRESHOLD: u64 = 2;
pub const DEFAULT_OFFLINE_ALERT_POLICY_VIOLATION_COUNT_THRESHOLD: u64 = 2;
pub const DEFAULT_OFFLINE_ALERT_UNRESOLVED_DISPUTES_SEVERITY: AlertSeverity = AlertSeverity::Warn;
pub const DEFAULT_OFFLINE_ALERT_AUTO_REFUND_RATE_SEVERITY: AlertSeverity = AlertSeverity::Warn;
pub const DEFAULT_OFFLINE_ALERT_INVALID_PAYLOAD_SPIKE_SEVERITY: AlertSeverity =
    AlertSeverity::Critical;
pub const DEFAULT_OFFLINE_ALERT_POLICY_VIOLATION_SPIKE_SEVERITY: AlertSeverity =
    AlertSeverity::Critical;
pub const DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_SEVERITY: AlertSeverity = AlertSeverity::Warn;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OfflineAlertLanePolicy {
    pub service_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_rate_bps_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_rate_min_orders: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unresolved_dispute_count_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_refund_rate_bps_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_refund_min_disputes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invalid_payload_count_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_violation_count_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unresolved_disputes_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_rate_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_refund_rate_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invalid_payload_spike_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_violation_spike_severity: Option<AlertSeverity>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Policy {
    pub version: String,
    pub clock_skew_seconds: i64,
    pub credit_default_expiry_days: i64,
    pub provider_reward_expiry_days: i64,
    pub demurrage_rate_weekly_bps: u64,
    pub claim_approval_threshold: usize,
    pub max_contribution_claim_credits: u64,
    pub allowed_service_types: Vec<String>,
    pub max_milestones_per_order: usize,
    pub max_milestone_credits: u64,
    pub acceptance_window_seconds: i64,
    pub dispute_timeout_seconds: i64,
    pub provider_eligibility_threshold: usize,
    pub attestor_eligibility_threshold: usize,
    pub allowed_sink_kinds: Vec<SinkKind>,
    pub policy_authority_pub_key: String,
    pub issuance_window_seconds: i64,
    pub max_issuance_events_per_identity_window: usize,
    pub max_issuance_events_per_lane_window: usize,
    pub min_issuance_counterparty_diversity: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_global_reputation_score: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_lane_reputation_score: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_p2h_risk_band: Option<P2HRiskBand>,
    pub offline_alert_unresolved_dispute_count_threshold: u64,
    pub offline_alert_dispute_rate_bps_threshold: u64,
    pub offline_alert_dispute_rate_min_orders: u64,
    pub offline_alert_auto_refund_rate_bps_threshold: u64,
    pub offline_alert_auto_refund_min_disputes: u64,
    pub offline_alert_invalid_payload_count_threshold: u64,
    pub offline_alert_policy_violation_count_threshold: u64,
    pub offline_alert_unresolved_disputes_severity: AlertSeverity,
    pub offline_alert_dispute_rate_severity: AlertSeverity,
    pub offline_alert_auto_refund_rate_severity: AlertSeverity,
    pub offline_alert_invalid_payload_spike_severity: AlertSeverity,
    pub offline_alert_policy_violation_spike_severity: AlertSeverity,
    pub offline_alert_enabled_service_types: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub offline_alert_lane_overrides: Vec<OfflineAlertLanePolicy>,
}

pub static DEFAULT_V0_POLICY: LazyLock<Policy> = LazyLock::new(|| Policy {
    version: DEFAULT_POLICY_VERSION.to_string(),
    clock_skew_seconds: 300,
    credit_default_expiry_days: 180,
    provider_reward_expiry_days: 90,
    demurrage_rate_weekly_bps: 100,
    claim_approval_threshold: 2,
    max_contribution_claim_credits: 1_000,
    allowed_service_types: vec![
        "software-fixes".to_string(),
        "feature-work".to_string(),
        "documentation".to_string(),
        "translation".to_string(),
        "testing".to_string(),
        "research".to_string(),
        "project-maintenance".to_string(),
        SERVICE_TYPE_COMPUTE_JOB.to_string(),
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.to_string(),
        SERVICE_TYPE_PHYSICAL_HANDOFF.to_string(),
    ],
    max_milestones_per_order: 16,
    max_milestone_credits: 5_000,
    acceptance_window_seconds: 7 * 24 * 60 * 60,
    dispute_timeout_seconds: 14 * 24 * 60 * 60,
    provider_eligibility_threshold: 2,
    attestor_eligibility_threshold: 1,
    allowed_sink_kinds: vec![
        SinkKind::ServiceEscrowSink,
        SinkKind::ComputeSink,
        SinkKind::AISink,
        SinkKind::StorageSink,
        SinkKind::BountySink,
    ],
    policy_authority_pub_key: DEFAULT_POLICY_AUTHORITY_PUB_KEY.to_string(),
    issuance_window_seconds: 0,
    max_issuance_events_per_identity_window: 0,
    max_issuance_events_per_lane_window: 0,
    min_issuance_counterparty_diversity: 0,
    min_global_reputation_score: None,
    min_lane_reputation_score: None,
    max_p2h_risk_band: None,
    offline_alert_unresolved_dispute_count_threshold:
        DEFAULT_OFFLINE_ALERT_UNRESOLVED_DISPUTE_COUNT_THRESHOLD,
    offline_alert_dispute_rate_bps_threshold: DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_BPS_THRESHOLD,
    offline_alert_dispute_rate_min_orders: DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_MIN_ORDERS,
    offline_alert_auto_refund_rate_bps_threshold:
        DEFAULT_OFFLINE_ALERT_AUTO_REFUND_RATE_BPS_THRESHOLD,
    offline_alert_auto_refund_min_disputes: DEFAULT_OFFLINE_ALERT_AUTO_REFUND_MIN_DISPUTES,
    offline_alert_invalid_payload_count_threshold:
        DEFAULT_OFFLINE_ALERT_INVALID_PAYLOAD_COUNT_THRESHOLD,
    offline_alert_policy_violation_count_threshold:
        DEFAULT_OFFLINE_ALERT_POLICY_VIOLATION_COUNT_THRESHOLD,
    offline_alert_unresolved_disputes_severity: DEFAULT_OFFLINE_ALERT_UNRESOLVED_DISPUTES_SEVERITY,
    offline_alert_dispute_rate_severity: DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_SEVERITY,
    offline_alert_auto_refund_rate_severity: DEFAULT_OFFLINE_ALERT_AUTO_REFUND_RATE_SEVERITY,
    offline_alert_invalid_payload_spike_severity:
        DEFAULT_OFFLINE_ALERT_INVALID_PAYLOAD_SPIKE_SEVERITY,
    offline_alert_policy_violation_spike_severity:
        DEFAULT_OFFLINE_ALERT_POLICY_VIOLATION_SPIKE_SEVERITY,
    offline_alert_enabled_service_types: vec![
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.to_string(),
        SERVICE_TYPE_PHYSICAL_HANDOFF.to_string(),
    ],
    offline_alert_lane_overrides: Vec::new(),
});

pub fn default_policy() -> &'static Policy {
    &DEFAULT_V0_POLICY
}

pub fn policy_from_snapshot_payload(snapshot: &PolicySnapshotPayload) -> Result<Policy, String> {
    let mut policy = Policy {
        version: snapshot.version.clone(),
        clock_skew_seconds: snapshot.clock_skew_seconds,
        credit_default_expiry_days: snapshot.credit_default_expiry_days,
        provider_reward_expiry_days: snapshot.provider_reward_expiry_days,
        demurrage_rate_weekly_bps: snapshot.demurrage_rate_weekly_bps,
        claim_approval_threshold: snapshot.claim_approval_threshold,
        max_contribution_claim_credits: snapshot.max_contribution_claim_credits,
        allowed_service_types: snapshot.allowed_service_types.clone(),
        max_milestones_per_order: snapshot.max_milestones_per_order,
        max_milestone_credits: snapshot.max_milestone_credits,
        acceptance_window_seconds: snapshot.acceptance_window_seconds,
        dispute_timeout_seconds: snapshot.dispute_timeout_seconds,
        provider_eligibility_threshold: snapshot.provider_eligibility_threshold,
        attestor_eligibility_threshold: snapshot.attestor_eligibility_threshold,
        allowed_sink_kinds: snapshot.allowed_sink_kinds.clone(),
        policy_authority_pub_key: snapshot.policy_authority_pub_key.clone(),
        issuance_window_seconds: snapshot.issuance_window_seconds.unwrap_or(0),
        max_issuance_events_per_identity_window: snapshot
            .max_issuance_events_per_identity_window
            .unwrap_or(0),
        max_issuance_events_per_lane_window: snapshot
            .max_issuance_events_per_lane_window
            .unwrap_or(0),
        min_issuance_counterparty_diversity: snapshot
            .min_issuance_counterparty_diversity
            .unwrap_or(0),
        min_global_reputation_score: snapshot.min_global_reputation_score,
        min_lane_reputation_score: snapshot.min_lane_reputation_score,
        max_p2h_risk_band: snapshot.max_p2h_risk_band,
        offline_alert_unresolved_dispute_count_threshold: snapshot
            .offline_alert_unresolved_dispute_count_threshold
            .unwrap_or(DEFAULT_OFFLINE_ALERT_UNRESOLVED_DISPUTE_COUNT_THRESHOLD),
        offline_alert_dispute_rate_bps_threshold: snapshot
            .offline_alert_dispute_rate_bps_threshold
            .unwrap_or(DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_BPS_THRESHOLD),
        offline_alert_dispute_rate_min_orders: snapshot
            .offline_alert_dispute_rate_min_orders
            .unwrap_or(DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_MIN_ORDERS),
        offline_alert_auto_refund_rate_bps_threshold: snapshot
            .offline_alert_auto_refund_rate_bps_threshold
            .unwrap_or(DEFAULT_OFFLINE_ALERT_AUTO_REFUND_RATE_BPS_THRESHOLD),
        offline_alert_auto_refund_min_disputes: snapshot
            .offline_alert_auto_refund_min_disputes
            .unwrap_or(DEFAULT_OFFLINE_ALERT_AUTO_REFUND_MIN_DISPUTES),
        offline_alert_invalid_payload_count_threshold: snapshot
            .offline_alert_invalid_payload_count_threshold
            .unwrap_or(DEFAULT_OFFLINE_ALERT_INVALID_PAYLOAD_COUNT_THRESHOLD),
        offline_alert_policy_violation_count_threshold: snapshot
            .offline_alert_policy_violation_count_threshold
            .unwrap_or(DEFAULT_OFFLINE_ALERT_POLICY_VIOLATION_COUNT_THRESHOLD),
        offline_alert_unresolved_disputes_severity: snapshot
            .offline_alert_unresolved_disputes_severity
            .unwrap_or(DEFAULT_OFFLINE_ALERT_UNRESOLVED_DISPUTES_SEVERITY),
        offline_alert_dispute_rate_severity: snapshot
            .offline_alert_dispute_rate_severity
            .unwrap_or(DEFAULT_OFFLINE_ALERT_DISPUTE_RATE_SEVERITY),
        offline_alert_auto_refund_rate_severity: snapshot
            .offline_alert_auto_refund_rate_severity
            .unwrap_or(DEFAULT_OFFLINE_ALERT_AUTO_REFUND_RATE_SEVERITY),
        offline_alert_invalid_payload_spike_severity: snapshot
            .offline_alert_invalid_payload_spike_severity
            .unwrap_or(DEFAULT_OFFLINE_ALERT_INVALID_PAYLOAD_SPIKE_SEVERITY),
        offline_alert_policy_violation_spike_severity: snapshot
            .offline_alert_policy_violation_spike_severity
            .unwrap_or(DEFAULT_OFFLINE_ALERT_POLICY_VIOLATION_SPIKE_SEVERITY),
        offline_alert_enabled_service_types: snapshot
            .offline_alert_enabled_service_types
            .clone()
            .unwrap_or_else(|| {
                vec![
                    SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.to_string(),
                    SERVICE_TYPE_PHYSICAL_HANDOFF.to_string(),
                ]
            }),
        offline_alert_lane_overrides: snapshot
            .offline_alert_lane_overrides
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|override_entry| OfflineAlertLanePolicy {
                service_type: override_entry.service_type,
                dispute_rate_bps_threshold: override_entry.dispute_rate_bps_threshold,
                dispute_rate_min_orders: override_entry.dispute_rate_min_orders,
                unresolved_dispute_count_threshold: override_entry
                    .unresolved_dispute_count_threshold,
                auto_refund_rate_bps_threshold: override_entry.auto_refund_rate_bps_threshold,
                auto_refund_min_disputes: override_entry.auto_refund_min_disputes,
                invalid_payload_count_threshold: override_entry.invalid_payload_count_threshold,
                policy_violation_count_threshold: override_entry.policy_violation_count_threshold,
                unresolved_disputes_severity: override_entry.unresolved_disputes_severity,
                dispute_rate_severity: override_entry.dispute_rate_severity,
                auto_refund_rate_severity: override_entry.auto_refund_rate_severity,
                invalid_payload_spike_severity: override_entry.invalid_payload_spike_severity,
                policy_violation_spike_severity: override_entry.policy_violation_spike_severity,
            })
            .collect(),
    };
    normalize_policy(&mut policy);
    validate_policy(&policy)?;
    Ok(policy)
}

pub fn normalize_policy(policy: &mut Policy) {
    policy.allowed_service_types.sort();
    policy.allowed_service_types.dedup();
    policy.allowed_sink_kinds.sort();
    policy.allowed_sink_kinds.dedup();
    policy.offline_alert_enabled_service_types.sort();
    policy.offline_alert_enabled_service_types.dedup();
    policy
        .offline_alert_lane_overrides
        .sort_by(|left, right| left.service_type.cmp(&right.service_type));
}

pub fn validate_policy(policy: &Policy) -> Result<(), String> {
    if policy.version.is_empty() {
        return Err("policy version is required".into());
    }
    if policy.clock_skew_seconds <= 0
        || policy.credit_default_expiry_days <= 0
        || policy.provider_reward_expiry_days <= 0
        || policy.claim_approval_threshold == 0
        || policy.max_contribution_claim_credits == 0
        || policy.max_milestones_per_order == 0
        || policy.max_milestone_credits == 0
        || policy.acceptance_window_seconds <= 0
        || policy.dispute_timeout_seconds <= 0
        || policy.provider_eligibility_threshold == 0
        || policy.attestor_eligibility_threshold == 0
    {
        return Err("policy contains non-positive limits or thresholds".into());
    }
    if policy.demurrage_rate_weekly_bps == 0 || policy.demurrage_rate_weekly_bps > 10_000 {
        return Err("demurrageRateWeeklyBps must be in 1..=10000".into());
    }
    if policy.allowed_service_types.is_empty() {
        return Err("allowedServiceTypes must be non-empty".into());
    }
    if policy.allowed_sink_kinds.is_empty() {
        return Err("allowedSinkKinds must be non-empty".into());
    }
    if policy.policy_authority_pub_key.len() != 64
        || !policy
            .policy_authority_pub_key
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err("invalid policyAuthorityPubKey".into());
    }
    if (policy.max_issuance_events_per_identity_window > 0
        || policy.max_issuance_events_per_lane_window > 0
        || policy.min_issuance_counterparty_diversity > 0)
        && policy.issuance_window_seconds <= 0
    {
        return Err(
            "issuanceWindowSeconds must be positive when issuance controls are enabled".into(),
        );
    }
    if policy.offline_alert_auto_refund_rate_bps_threshold > 10_000 {
        return Err("offlineAlertAutoRefundRateBpsThreshold must be in 0..=10000".into());
    }
    if policy.offline_alert_dispute_rate_bps_threshold > 10_000 {
        return Err("offlineAlertDisputeRateBpsThreshold must be in 0..=10000".into());
    }
    if policy.offline_alert_enabled_service_types.is_empty() {
        return Err("offlineAlertEnabledServiceTypes must be non-empty".into());
    }
    let mut lane_ids = std::collections::BTreeSet::new();
    for lane_override in &policy.offline_alert_lane_overrides {
        if lane_override.service_type.trim().is_empty() {
            return Err("offlineAlertLaneOverrides.serviceType is required".into());
        }
        if !lane_ids.insert(lane_override.service_type.clone()) {
            return Err("offlineAlertLaneOverrides.serviceType must be unique".into());
        }
        if lane_override
            .dispute_rate_bps_threshold
            .is_some_and(|value| value > 10_000)
        {
            return Err(
                "offlineAlertLaneOverrides.disputeRateBpsThreshold must be in 0..=10000".into(),
            );
        }
        if lane_override
            .auto_refund_rate_bps_threshold
            .is_some_and(|value| value > 10_000)
        {
            return Err(
                "offlineAlertLaneOverrides.autoRefundRateBpsThreshold must be in 0..=10000".into(),
            );
        }
    }

    Ok(())
}

impl Policy {
    pub fn offline_alert_lane_override(
        &self,
        service_type: &str,
    ) -> Option<&OfflineAlertLanePolicy> {
        self.offline_alert_lane_overrides
            .iter()
            .find(|lane_override| lane_override.service_type == service_type)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_policy_rejects_enabled_issuance_controls_without_window() {
        let mut policy = default_policy().clone();
        policy.max_issuance_events_per_identity_window = 1;
        policy.issuance_window_seconds = 0;
        assert!(validate_policy(&policy).is_err());
    }

    #[test]
    fn validate_policy_rejects_invalid_offline_alert_bps_threshold() {
        let mut policy = default_policy().clone();
        policy.offline_alert_auto_refund_rate_bps_threshold = 20_000;
        assert!(validate_policy(&policy).is_err());
    }

    #[test]
    fn validate_policy_rejects_invalid_offline_alert_dispute_rate_bps_threshold() {
        let mut policy = default_policy().clone();
        policy.offline_alert_dispute_rate_bps_threshold = 20_000;
        assert!(validate_policy(&policy).is_err());
    }

    #[test]
    fn validate_policy_rejects_empty_offline_alert_enabled_service_types() {
        let mut policy = default_policy().clone();
        policy.offline_alert_enabled_service_types.clear();
        assert!(validate_policy(&policy).is_err());
    }

    #[test]
    fn validate_policy_rejects_duplicate_offline_alert_lane_overrides() {
        let mut policy = default_policy().clone();
        policy.offline_alert_lane_overrides = vec![
            OfflineAlertLanePolicy {
                service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.to_string(),
                dispute_rate_bps_threshold: None,
                dispute_rate_min_orders: None,
                unresolved_dispute_count_threshold: Some(2),
                auto_refund_rate_bps_threshold: None,
                auto_refund_min_disputes: None,
                invalid_payload_count_threshold: None,
                policy_violation_count_threshold: None,
                unresolved_disputes_severity: None,
                dispute_rate_severity: None,
                auto_refund_rate_severity: None,
                invalid_payload_spike_severity: None,
                policy_violation_spike_severity: None,
            },
            OfflineAlertLanePolicy {
                service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.to_string(),
                dispute_rate_bps_threshold: None,
                dispute_rate_min_orders: None,
                unresolved_dispute_count_threshold: Some(3),
                auto_refund_rate_bps_threshold: None,
                auto_refund_min_disputes: None,
                invalid_payload_count_threshold: None,
                policy_violation_count_threshold: None,
                unresolved_disputes_severity: None,
                dispute_rate_severity: None,
                auto_refund_rate_severity: None,
                invalid_payload_spike_severity: None,
                policy_violation_spike_severity: None,
            },
        ];
        assert!(validate_policy(&policy).is_err());
    }

    #[test]
    fn validate_policy_rejects_offline_alert_lane_override_invalid_bps() {
        let mut policy = default_policy().clone();
        policy.offline_alert_lane_overrides = vec![OfflineAlertLanePolicy {
            service_type: SERVICE_TYPE_PHYSICAL_HANDOFF.to_string(),
            dispute_rate_bps_threshold: None,
            dispute_rate_min_orders: None,
            unresolved_dispute_count_threshold: None,
            auto_refund_rate_bps_threshold: Some(20_000),
            auto_refund_min_disputes: None,
            invalid_payload_count_threshold: None,
            policy_violation_count_threshold: None,
            unresolved_disputes_severity: None,
            dispute_rate_severity: None,
            auto_refund_rate_severity: None,
            invalid_payload_spike_severity: None,
            policy_violation_spike_severity: None,
        }];
        assert!(validate_policy(&policy).is_err());
    }

    #[test]
    fn validate_policy_rejects_offline_alert_lane_override_invalid_dispute_rate_bps() {
        let mut policy = default_policy().clone();
        policy.offline_alert_lane_overrides = vec![OfflineAlertLanePolicy {
            service_type: SERVICE_TYPE_PHYSICAL_HANDOFF.to_string(),
            dispute_rate_bps_threshold: Some(20_000),
            dispute_rate_min_orders: None,
            unresolved_dispute_count_threshold: None,
            auto_refund_rate_bps_threshold: None,
            auto_refund_min_disputes: None,
            invalid_payload_count_threshold: None,
            policy_violation_count_threshold: None,
            unresolved_disputes_severity: None,
            dispute_rate_severity: None,
            auto_refund_rate_severity: None,
            invalid_payload_spike_severity: None,
            policy_violation_spike_severity: None,
        }];
        assert!(validate_policy(&policy).is_err());
    }
}
