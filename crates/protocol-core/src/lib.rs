use std::collections::{BTreeMap, BTreeSet};
use std::fmt::{Display, Formatter};
use std::str::FromStr;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use thiserror::Error;

pub const PROTOCOL_VERSION: &str = "v0";
pub const SERVICE_TYPE_COMPUTE_JOB: &str = "compute-job";
pub const SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE: &str = "local-resource-exchange";
pub const SERVICE_TYPE_PHYSICAL_HANDOFF: &str = "physical-handoff";
pub const EVIDENCE_FORMAT_JOB_RECEIPT_V1: &str = "job-receipt-v1";
pub const EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1: &str = "local-resource-receipt-v1";
pub const EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1: &str = "physical-handoff-ack-dual-v1";

pub fn template_for_service_type(service_type: &str) -> Option<&'static str> {
    match service_type {
        SERVICE_TYPE_COMPUTE_JOB => Some("compute_job_v1"),
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE => Some("local_resource_exchange_v1"),
        SERVICE_TYPE_PHYSICAL_HANDOFF => Some("physical_handoff_dual_ack_v1"),
        _ => None,
    }
}

pub fn expected_delivery_mode_for_templated_service(service_type: &str) -> Option<&'static str> {
    match service_type {
        SERVICE_TYPE_COMPUTE_JOB => Some("receipt"),
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE => Some("local-community"),
        SERVICE_TYPE_PHYSICAL_HANDOFF => Some("in-person"),
        _ => None,
    }
}

pub fn required_evidence_format_for_templated_service(service_type: &str) -> Option<&'static str> {
    match service_type {
        SERVICE_TYPE_COMPUTE_JOB => Some(EVIDENCE_FORMAT_JOB_RECEIPT_V1),
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE => Some(EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1),
        SERVICE_TYPE_PHYSICAL_HANDOFF => Some(EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1),
        _ => None,
    }
}

pub fn offline_template_for_service_type(service_type: &str) -> Option<&'static str> {
    match service_type {
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE | SERVICE_TYPE_PHYSICAL_HANDOFF => {
            template_for_service_type(service_type)
        }
        _ => None,
    }
}

pub fn expected_delivery_mode_for_offline_service(service_type: &str) -> Option<&'static str> {
    match service_type {
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE | SERVICE_TYPE_PHYSICAL_HANDOFF => {
            expected_delivery_mode_for_templated_service(service_type)
        }
        _ => None,
    }
}

pub fn required_evidence_format_for_offline_service(service_type: &str) -> Option<&'static str> {
    match service_type {
        SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE | SERVICE_TYPE_PHYSICAL_HANDOFF => {
            required_evidence_format_for_templated_service(service_type)
        }
        _ => None,
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InvalidReasonCode {
    UnsupportedVersion,
    UnsupportedKind,
    BadSignature,
    BadEventId,
    MissingReference,
    UnauthorizedActor,
    InvalidNonce,
    InvalidStateTransition,
    PolicyViolation,
    BadTimestamp,
    ForbiddenTransferSemantics,
    IssuanceRateLimitExceeded,
    IssuanceDiversityViolation,
    EconomicEligibilityViolation,
    InvalidPayload,
    InvalidJson,
}

impl Display for InvalidReasonCode {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let text = match self {
            Self::UnsupportedVersion => "ERR_UNSUPPORTED_VERSION",
            Self::UnsupportedKind => "ERR_UNSUPPORTED_KIND",
            Self::BadSignature => "ERR_BAD_SIGNATURE",
            Self::BadEventId => "ERR_BAD_EVENT_ID",
            Self::MissingReference => "ERR_MISSING_REFERENCE",
            Self::UnauthorizedActor => "ERR_UNAUTHORIZED_ACTOR",
            Self::InvalidNonce => "ERR_INVALID_NONCE",
            Self::InvalidStateTransition => "ERR_INVALID_STATE_TRANSITION",
            Self::PolicyViolation => "ERR_POLICY_VIOLATION",
            Self::BadTimestamp => "ERR_BAD_TIMESTAMP",
            Self::ForbiddenTransferSemantics => "ERR_FORBIDDEN_TRANSFER_SEMANTICS",
            Self::IssuanceRateLimitExceeded => "ERR_ISSUANCE_RATE_LIMIT_EXCEEDED",
            Self::IssuanceDiversityViolation => "ERR_ISSUANCE_DIVERSITY_VIOLATION",
            Self::EconomicEligibilityViolation => "ERR_ECONOMIC_ELIGIBILITY_VIOLATION",
            Self::InvalidPayload => "ERR_INVALID_PAYLOAD",
            Self::InvalidJson => "ERR_INVALID_JSON",
        };

        write!(f, "{text}")
    }
}

/// Maps protocol validation failures to stable ingest/replay reject reason codes.
pub fn reason_code_for_protocol_error(error: &ProtocolError) -> InvalidReasonCode {
    match error {
        ProtocolError::UnsupportedVersion => InvalidReasonCode::UnsupportedVersion,
        ProtocolError::UnsupportedKind => InvalidReasonCode::UnsupportedKind,
        ProtocolError::InvalidPayload(_) => InvalidReasonCode::InvalidPayload,
        ProtocolError::InvalidPublicKey | ProtocolError::InvalidSignature => {
            InvalidReasonCode::BadSignature
        }
        ProtocolError::InvalidSecretKey => InvalidReasonCode::InvalidPayload,
        ProtocolError::InvalidEventId => InvalidReasonCode::BadEventId,
        ProtocolError::InvalidTimestamp => InvalidReasonCode::BadTimestamp,
    }
}

/// Canonical registry of all stable reject reason codes (wire form via `Display`).
pub fn all_invalid_reason_codes() -> &'static [InvalidReasonCode] {
    &[
        InvalidReasonCode::UnsupportedVersion,
        InvalidReasonCode::UnsupportedKind,
        InvalidReasonCode::BadSignature,
        InvalidReasonCode::BadEventId,
        InvalidReasonCode::MissingReference,
        InvalidReasonCode::UnauthorizedActor,
        InvalidReasonCode::InvalidNonce,
        InvalidReasonCode::InvalidStateTransition,
        InvalidReasonCode::PolicyViolation,
        InvalidReasonCode::BadTimestamp,
        InvalidReasonCode::ForbiddenTransferSemantics,
        InvalidReasonCode::IssuanceRateLimitExceeded,
        InvalidReasonCode::IssuanceDiversityViolation,
        InvalidReasonCode::EconomicEligibilityViolation,
        InvalidReasonCode::InvalidPayload,
        InvalidReasonCode::InvalidJson,
    ]
}

#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("unsupported protocol version")]
    UnsupportedVersion,
    #[error("unsupported event kind")]
    UnsupportedKind,
    #[error("invalid payload: {0}")]
    InvalidPayload(String),
    #[error("invalid public key")]
    InvalidPublicKey,
    #[error("invalid secret key")]
    InvalidSecretKey,
    #[error("invalid signature")]
    InvalidSignature,
    #[error("invalid event id")]
    InvalidEventId,
    #[error("invalid timestamp")]
    InvalidTimestamp,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bio: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub links: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_categories: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CreditLot {
    pub amount: u64,
    pub minted_at: String,
    pub expires_at: String,
    pub source_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityCreatePayload {
    pub identity_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IdentityMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_policy_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityUpdatePayload {
    pub identity_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IdentityMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_pub_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rotation_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VouchPayload {
    pub subject_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VouchRevokePayload {
    pub subject_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributionClaimPayload {
    pub claim_id: String,
    pub claim_type: String,
    pub artifact_hash: String,
    pub summary: String,
    pub requested_credits: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub beneficiary_pub_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AttestationDecision {
    Approve,
    Reject,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributionAttestPayload {
    pub claim_id: String,
    pub decision: AttestationDecision,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MintCreditsPayload {
    pub beneficiary_pub_key: String,
    pub amount: u64,
    pub expires_at: String,
    pub mint_reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_claim_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_order_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_milestone_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum SinkKind {
    ServiceEscrowSink,
    ComputeSink,
    AISink,
    StorageSink,
    BountySink,
}

impl Display for SinkKind {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let text = match self {
            Self::ServiceEscrowSink => "ServiceEscrowSink",
            Self::ComputeSink => "ComputeSink",
            Self::AISink => "AISink",
            Self::StorageSink => "StorageSink",
            Self::BountySink => "BountySink",
        };

        write!(f, "{text}")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum P2HRiskBand {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Info,
    Warn,
    Critical,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineAlertLanePolicyPayload {
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
#[serde(rename_all = "camelCase")]
pub struct SpendCreditsPayload {
    pub spender_pub_key: String,
    pub sink_kind: SinkKind,
    pub amount: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub milestone_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneSpec {
    pub milestone_id: String,
    pub amount_credits: u64,
    pub evidence_format: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceOfferPayload {
    pub offer_id: String,
    pub service_type: String,
    pub unit_definition: String,
    pub price_per_unit_credits: u64,
    pub delivery_mode: String,
    pub offer_expires_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_hash: Option<String>,
    pub allowed_evidence_formats: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceOrderPayload {
    pub order_id: String,
    pub offer_id: String,
    pub provider_pub_key: String,
    pub buyer_pub_key: String,
    pub milestones: Vec<MilestoneSpec>,
    pub order_expires_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDeliveryPayload {
    pub order_id: String,
    pub milestone_id: String,
    pub evidence_format: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artifact_hashes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub urls: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes_hash: Option<String>,
    pub delivered_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceAcceptPayload {
    pub order_id: String,
    pub milestone_id: String,
    pub accepted_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDisputePayload {
    pub order_id: String,
    pub milestone_id: String,
    pub reason_code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes_hash: Option<String>,
    pub disputed_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ServiceSettleOutcome {
    BuyerWins,
    Split,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSettlePayload {
    pub order_id: String,
    pub milestone_id: String,
    pub outcome: ServiceSettleOutcome,
    pub buyer_refund_credits: u64,
    pub provider_reward_credits: u64,
    pub settled_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicySnapshotPayload {
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issuance_window_seconds: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_issuance_events_per_identity_window: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_issuance_events_per_lane_window: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_issuance_counterparty_diversity: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_global_reputation_score: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_lane_reputation_score: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_p2h_risk_band: Option<P2HRiskBand>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_unresolved_dispute_count_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_dispute_rate_bps_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_dispute_rate_min_orders: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_auto_refund_rate_bps_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_auto_refund_min_disputes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_invalid_payload_count_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_policy_violation_count_threshold: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_unresolved_disputes_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_dispute_rate_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_auto_refund_rate_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_invalid_payload_spike_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_policy_violation_spike_severity: Option<AlertSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_enabled_service_types: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_alert_lane_overrides: Option<Vec<OfflineAlertLanePolicyPayload>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyUpdatePayload {
    pub next_policy_version: String,
    pub effective_at: String,
    pub policy: PolicySnapshotPayload,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum EventKind {
    IdentityCreate,
    IdentityUpdate,
    Vouch,
    VouchRevoke,
    ContributionClaim,
    ContributionAttest,
    MintCredits,
    SpendCredits,
    ServiceOffer,
    ServiceOrder,
    ServiceDelivery,
    ServiceAccept,
    ServiceDispute,
    ServiceSettle,
    PolicyUpdate,
}

impl FromStr for EventKind {
    type Err = ProtocolError;

    fn from_str(input: &str) -> std::result::Result<Self, Self::Err> {
        match input {
            "IdentityCreate" => Ok(Self::IdentityCreate),
            "IdentityUpdate" => Ok(Self::IdentityUpdate),
            "Vouch" => Ok(Self::Vouch),
            "VouchRevoke" => Ok(Self::VouchRevoke),
            "ContributionClaim" => Ok(Self::ContributionClaim),
            "ContributionAttest" => Ok(Self::ContributionAttest),
            "MintCredits" => Ok(Self::MintCredits),
            "SpendCredits" => Ok(Self::SpendCredits),
            "ServiceOffer" => Ok(Self::ServiceOffer),
            "ServiceOrder" => Ok(Self::ServiceOrder),
            "ServiceDelivery" => Ok(Self::ServiceDelivery),
            "ServiceAccept" => Ok(Self::ServiceAccept),
            "ServiceDispute" => Ok(Self::ServiceDispute),
            "ServiceSettle" => Ok(Self::ServiceSettle),
            "PolicyUpdate" => Ok(Self::PolicyUpdate),
            _ => Err(ProtocolError::UnsupportedKind),
        }
    }
}

pub fn is_phase1_kind_name(kind: &str) -> bool {
    matches!(
        kind,
        "IdentityCreate"
            | "IdentityUpdate"
            | "Vouch"
            | "VouchRevoke"
            | "ContributionClaim"
            | "ContributionAttest"
            | "MintCredits"
            | "SpendCredits"
    )
}

pub fn is_marketplace_kind_name(kind: &str) -> bool {
    matches!(
        kind,
        "ServiceOffer"
            | "ServiceOrder"
            | "ServiceDelivery"
            | "ServiceAccept"
            | "ServiceDispute"
            | "ServiceSettle"
    )
}

pub fn is_replay_supported_kind_name(kind: &str) -> bool {
    is_phase1_kind_name(kind) || is_marketplace_kind_name(kind) || kind == "PolicyUpdate"
}

pub fn is_marketplace_or_policy_kind_name(kind: &str) -> bool {
    is_marketplace_kind_name(kind) || kind == "PolicyUpdate"
}

pub fn is_node_ingest_supported_kind_name(kind: &str) -> bool {
    is_replay_supported_kind_name(kind)
}

impl Display for EventKind {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let text = match self {
            Self::IdentityCreate => "IdentityCreate",
            Self::IdentityUpdate => "IdentityUpdate",
            Self::Vouch => "Vouch",
            Self::VouchRevoke => "VouchRevoke",
            Self::ContributionClaim => "ContributionClaim",
            Self::ContributionAttest => "ContributionAttest",
            Self::MintCredits => "MintCredits",
            Self::SpendCredits => "SpendCredits",
            Self::ServiceOffer => "ServiceOffer",
            Self::ServiceOrder => "ServiceOrder",
            Self::ServiceDelivery => "ServiceDelivery",
            Self::ServiceAccept => "ServiceAccept",
            Self::ServiceDispute => "ServiceDispute",
            Self::ServiceSettle => "ServiceSettle",
            Self::PolicyUpdate => "PolicyUpdate",
        };

        write!(f, "{text}")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventPayload {
    IdentityCreate(IdentityCreatePayload),
    IdentityUpdate(IdentityUpdatePayload),
    Vouch(VouchPayload),
    VouchRevoke(VouchRevokePayload),
    ContributionClaim(ContributionClaimPayload),
    ContributionAttest(ContributionAttestPayload),
    MintCredits(MintCreditsPayload),
    SpendCredits(SpendCreditsPayload),
    ServiceOffer(ServiceOfferPayload),
    ServiceOrder(ServiceOrderPayload),
    ServiceDelivery(ServiceDeliveryPayload),
    ServiceAccept(ServiceAcceptPayload),
    ServiceDispute(ServiceDisputePayload),
    ServiceSettle(ServiceSettlePayload),
    PolicyUpdate(PolicyUpdatePayload),
}

impl EventPayload {
    pub fn kind(&self) -> EventKind {
        match self {
            Self::IdentityCreate(_) => EventKind::IdentityCreate,
            Self::IdentityUpdate(_) => EventKind::IdentityUpdate,
            Self::Vouch(_) => EventKind::Vouch,
            Self::VouchRevoke(_) => EventKind::VouchRevoke,
            Self::ContributionClaim(_) => EventKind::ContributionClaim,
            Self::ContributionAttest(_) => EventKind::ContributionAttest,
            Self::MintCredits(_) => EventKind::MintCredits,
            Self::SpendCredits(_) => EventKind::SpendCredits,
            Self::ServiceOffer(_) => EventKind::ServiceOffer,
            Self::ServiceOrder(_) => EventKind::ServiceOrder,
            Self::ServiceDelivery(_) => EventKind::ServiceDelivery,
            Self::ServiceAccept(_) => EventKind::ServiceAccept,
            Self::ServiceDispute(_) => EventKind::ServiceDispute,
            Self::ServiceSettle(_) => EventKind::ServiceSettle,
            Self::PolicyUpdate(_) => EventKind::PolicyUpdate,
        }
    }

    pub fn to_value(&self) -> Result<Value> {
        let value = match self {
            Self::IdentityCreate(payload) => serde_json::to_value(payload),
            Self::IdentityUpdate(payload) => serde_json::to_value(payload),
            Self::Vouch(payload) => serde_json::to_value(payload),
            Self::VouchRevoke(payload) => serde_json::to_value(payload),
            Self::ContributionClaim(payload) => serde_json::to_value(payload),
            Self::ContributionAttest(payload) => serde_json::to_value(payload),
            Self::MintCredits(payload) => serde_json::to_value(payload),
            Self::SpendCredits(payload) => serde_json::to_value(payload),
            Self::ServiceOffer(payload) => serde_json::to_value(payload),
            Self::ServiceOrder(payload) => serde_json::to_value(payload),
            Self::ServiceDelivery(payload) => serde_json::to_value(payload),
            Self::ServiceAccept(payload) => serde_json::to_value(payload),
            Self::ServiceDispute(payload) => serde_json::to_value(payload),
            Self::ServiceSettle(payload) => serde_json::to_value(payload),
            Self::PolicyUpdate(payload) => serde_json::to_value(payload),
        }?;

        Ok(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawEventEnvelope {
    pub version: String,
    pub event_id: String,
    pub author_pub_key: String,
    pub created_at: String,
    pub kind: EventKind,
    pub policy_version: String,
    pub payload: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub references: Option<BTreeMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    pub sig: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawEnvelopeLoose {
    pub version: String,
    pub event_id: String,
    pub author_pub_key: String,
    pub created_at: String,
    pub kind: String,
    pub policy_version: String,
    pub payload: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub references: Option<BTreeMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    pub sig: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsignedEvent {
    pub version: String,
    pub author_pub_key: String,
    pub created_at: String,
    pub kind: EventKind,
    pub policy_version: String,
    pub payload: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub references: Option<BTreeMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsignedEnvelopeLoose {
    pub version: String,
    pub author_pub_key: String,
    pub created_at: String,
    pub kind: String,
    pub policy_version: String,
    pub payload: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub references: Option<BTreeMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Event {
    pub version: String,
    pub event_id: String,
    pub author_pub_key: String,
    pub created_at: String,
    pub kind: EventKind,
    pub policy_version: String,
    pub payload: EventPayload,
    pub references: Option<BTreeMap<String, String>>,
    pub nonce: Option<String>,
    pub sig: String,
}

impl RawEventEnvelope {
    pub fn into_event(self) -> Result<Event, ProtocolError> {
        let payload = parse_payload(self.kind, self.payload)?;
        let event = Event {
            version: self.version,
            event_id: self.event_id,
            author_pub_key: self.author_pub_key,
            created_at: self.created_at,
            kind: self.kind,
            policy_version: self.policy_version,
            payload,
            references: self.references,
            nonce: self.nonce,
            sig: self.sig,
        };

        validate_static(&event)?;
        Ok(event)
    }
}

impl RawEnvelopeLoose {
    pub fn into_typed_raw(self) -> Result<RawEventEnvelope, ProtocolError> {
        let kind = EventKind::from_str(&self.kind)?;
        Ok(RawEventEnvelope {
            version: self.version,
            event_id: self.event_id,
            author_pub_key: self.author_pub_key,
            created_at: self.created_at,
            kind,
            policy_version: self.policy_version,
            payload: self.payload,
            references: self.references,
            nonce: self.nonce,
            sig: self.sig,
        })
    }

    pub fn to_unsigned_loose(&self) -> UnsignedEnvelopeLoose {
        UnsignedEnvelopeLoose {
            version: self.version.clone(),
            author_pub_key: self.author_pub_key.clone(),
            created_at: self.created_at.clone(),
            kind: self.kind.clone(),
            policy_version: self.policy_version.clone(),
            payload: self.payload.clone(),
            references: self.references.clone(),
            nonce: self.nonce.clone(),
        }
    }
}

impl Event {
    pub fn to_raw(&self) -> Result<RawEventEnvelope> {
        Ok(RawEventEnvelope {
            version: self.version.clone(),
            event_id: self.event_id.clone(),
            author_pub_key: self.author_pub_key.clone(),
            created_at: self.created_at.clone(),
            kind: self.kind,
            policy_version: self.policy_version.clone(),
            payload: self.payload.to_value()?,
            references: self.references.clone(),
            nonce: self.nonce.clone(),
            sig: self.sig.clone(),
        })
    }

    pub fn to_json_value(&self) -> Result<Value> {
        serde_json::to_value(self.to_raw()?).context("serializing event")
    }

    pub fn to_unsigned(&self) -> Result<UnsignedEvent> {
        Ok(UnsignedEvent {
            version: self.version.clone(),
            author_pub_key: self.author_pub_key.clone(),
            created_at: self.created_at.clone(),
            kind: self.kind,
            policy_version: self.policy_version.clone(),
            payload: self.payload.to_value()?,
            references: self.references.clone(),
            nonce: self.nonce.clone(),
        })
    }
}

pub fn parse_raw_event_str(input: &str) -> Result<RawEventEnvelope> {
    let raw: RawEventEnvelope = serde_json::from_str(input).context("parsing raw event json")?;
    Ok(raw)
}

pub fn parse_raw_envelope_loose_str(input: &str) -> Result<RawEnvelopeLoose> {
    let raw: RawEnvelopeLoose = serde_json::from_str(input).context("parsing raw envelope json")?;
    Ok(raw)
}

pub fn parse_unsigned_event_str(input: &str) -> Result<UnsignedEvent> {
    let event: UnsignedEvent =
        serde_json::from_str(input).context("parsing unsigned event json")?;
    Ok(event)
}

pub fn parse_timestamp(input: &str) -> Result<DateTime<Utc>, ProtocolError> {
    DateTime::parse_from_rfc3339(input)
        .map(|timestamp| timestamp.with_timezone(&Utc))
        .map_err(|_| ProtocolError::InvalidTimestamp)
}

pub fn validate_static(event: &Event) -> Result<(), ProtocolError> {
    if event.version != PROTOCOL_VERSION {
        return Err(ProtocolError::UnsupportedVersion);
    }

    validate_hex_length(&event.author_pub_key, 64, ProtocolError::InvalidPublicKey)?;
    validate_hex_length(&event.sig, 128, ProtocolError::InvalidSignature)?;
    parse_timestamp(&event.created_at)?;

    match &event.payload {
        EventPayload::IdentityCreate(payload) => {
            validate_hex_length(
                &payload.identity_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid identityPubKey".into()),
            )?;
        }
        EventPayload::IdentityUpdate(payload) => {
            validate_hex_length(
                &payload.identity_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid identityPubKey".into()),
            )?;
            if payload.next_pub_key.is_some() && payload.rotation_reason.is_none() {
                return Err(ProtocolError::InvalidPayload(
                    "rotationReason is required when nextPubKey is present".into(),
                ));
            }
            if let Some(next_pub_key) = &payload.next_pub_key {
                validate_hex_length(
                    next_pub_key,
                    64,
                    ProtocolError::InvalidPayload("invalid nextPubKey".into()),
                )?;
            }
        }
        EventPayload::Vouch(payload) => {
            validate_hex_length(
                &payload.subject_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid subjectPubKey".into()),
            )?;
            if let Some(expires_at) = &payload.expires_at {
                parse_timestamp(expires_at)?;
            }
        }
        EventPayload::VouchRevoke(payload) => {
            validate_hex_length(
                &payload.subject_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid subjectPubKey".into()),
            )?;
        }
        EventPayload::ContributionClaim(payload) => {
            if payload.requested_credits == 0 {
                return Err(ProtocolError::InvalidPayload(
                    "requestedCredits must be positive".into(),
                ));
            }
            if payload.summary.len() > 500 {
                return Err(ProtocolError::InvalidPayload(
                    "summary exceeds 500 chars".into(),
                ));
            }
            if let Some(beneficiary_pub_key) = &payload.beneficiary_pub_key {
                validate_hex_length(
                    beneficiary_pub_key,
                    64,
                    ProtocolError::InvalidPayload("invalid beneficiaryPubKey".into()),
                )?;
            }
        }
        EventPayload::ContributionAttest(_) => {}
        EventPayload::MintCredits(payload) => {
            validate_hex_length(
                &payload.beneficiary_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid beneficiaryPubKey".into()),
            )?;
            if payload.amount == 0 {
                return Err(ProtocolError::InvalidPayload(
                    "amount must be positive".into(),
                ));
            }
            parse_timestamp(&payload.expires_at)?;
            if payload.mint_reason == "contribution" && payload.source_claim_id.is_none() {
                return Err(ProtocolError::InvalidPayload(
                    "sourceClaimId is required for contribution minting".into(),
                ));
            }
        }
        EventPayload::SpendCredits(payload) => {
            validate_hex_length(
                &payload.spender_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid spenderPubKey".into()),
            )?;
            if payload.amount == 0 {
                return Err(ProtocolError::InvalidPayload(
                    "amount must be positive".into(),
                ));
            }
            if payload.sink_kind == SinkKind::ServiceEscrowSink
                && (payload.order_id.is_none() || payload.milestone_id.is_none())
            {
                return Err(ProtocolError::InvalidPayload(
                    "orderId and milestoneId are required for ServiceEscrowSink".into(),
                ));
            }
            if event.nonce.as_ref().is_none() {
                return Err(ProtocolError::InvalidPayload(
                    "nonce is required for SpendCredits".into(),
                ));
            }
        }
        EventPayload::ServiceOffer(payload) => {
            if payload.offer_id.is_empty() {
                return Err(ProtocolError::InvalidPayload("offerId is required".into()));
            }
            if payload.service_type.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "serviceType is required".into(),
                ));
            }
            if payload.unit_definition.is_empty() || payload.unit_definition.len() > 200 {
                return Err(ProtocolError::InvalidPayload(
                    "unitDefinition must be 1..200 chars".into(),
                ));
            }
            if payload.price_per_unit_credits == 0 {
                return Err(ProtocolError::InvalidPayload(
                    "pricePerUnitCredits must be positive".into(),
                ));
            }
            parse_timestamp(&payload.offer_expires_at)?;
            if payload.allowed_evidence_formats.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "allowedEvidenceFormats must be non-empty".into(),
                ));
            }
            if let Some(expected_mode) =
                expected_delivery_mode_for_templated_service(&payload.service_type)
                && payload.delivery_mode != expected_mode
            {
                return Err(ProtocolError::InvalidPayload(format!(
                    "templated serviceType `{}` requires deliveryMode `{expected_mode}`",
                    payload.service_type
                )));
            }
            if let Some(required_format) =
                required_evidence_format_for_templated_service(&payload.service_type)
            {
                let offered_formats = payload
                    .allowed_evidence_formats
                    .iter()
                    .map(String::as_str)
                    .collect::<BTreeSet<_>>();
                let expected_formats = BTreeSet::from([required_format]);
                if offered_formats != expected_formats {
                    return Err(ProtocolError::InvalidPayload(format!(
                        "templated serviceType `{}` requires allowedEvidenceFormats to equal [`{required_format}`]",
                        payload.service_type
                    )));
                }
            }
        }
        EventPayload::ServiceOrder(payload) => {
            if payload.order_id.is_empty() {
                return Err(ProtocolError::InvalidPayload("orderId is required".into()));
            }
            if payload.offer_id.is_empty() {
                return Err(ProtocolError::InvalidPayload("offerId is required".into()));
            }
            validate_hex_length(
                &payload.provider_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid providerPubKey".into()),
            )?;
            validate_hex_length(
                &payload.buyer_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid buyerPubKey".into()),
            )?;
            parse_timestamp(&payload.order_expires_at)?;
            if payload.milestones.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "milestones must be non-empty".into(),
                ));
            }
            for milestone in &payload.milestones {
                if milestone.milestone_id.is_empty() {
                    return Err(ProtocolError::InvalidPayload(
                        "milestoneId is required".into(),
                    ));
                }
                if milestone.amount_credits == 0 {
                    return Err(ProtocolError::InvalidPayload(
                        "milestone amountCredits must be positive".into(),
                    ));
                }
                if milestone.evidence_format.is_empty() {
                    return Err(ProtocolError::InvalidPayload(
                        "milestone evidenceFormat is required".into(),
                    ));
                }
            }
        }
        EventPayload::ServiceDelivery(payload) => {
            if payload.order_id.is_empty() || payload.milestone_id.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "orderId and milestoneId are required".into(),
                ));
            }
            if payload.evidence_format.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "evidenceFormat is required".into(),
                ));
            }
            if payload.evidence_format == EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1
                && payload
                    .artifact_hashes
                    .as_ref()
                    .map_or(true, |hashes| hashes.is_empty())
            {
                return Err(ProtocolError::InvalidPayload(
                    "local-resource-receipt-v1 requires at least one artifact hash".into(),
                ));
            }
            if payload.evidence_format == EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1 {
                let artifact_hashes = payload.artifact_hashes.as_ref().ok_or_else(|| {
                    ProtocolError::InvalidPayload(
                        "local-resource-receipt-v1 requires at least one artifact hash".into(),
                    )
                })?;
                let unique = artifact_hashes.iter().collect::<BTreeSet<_>>();
                if unique.len() != artifact_hashes.len() {
                    return Err(ProtocolError::InvalidPayload(
                        "local-resource-receipt-v1 artifactHashes must be unique".into(),
                    ));
                }
                if payload
                    .notes_hash
                    .as_ref()
                    .map_or(true, |value| value.trim().is_empty())
                {
                    return Err(ProtocolError::InvalidPayload(
                        "local-resource-receipt-v1 requires notesHash".into(),
                    ));
                }
            }
            if payload.evidence_format == EVIDENCE_FORMAT_JOB_RECEIPT_V1 {
                let artifact_hashes = payload.artifact_hashes.as_ref().ok_or_else(|| {
                    ProtocolError::InvalidPayload(
                        "job-receipt-v1 requires at least one artifact hash".into(),
                    )
                })?;
                if artifact_hashes.is_empty() {
                    return Err(ProtocolError::InvalidPayload(
                        "job-receipt-v1 requires at least one artifact hash".into(),
                    ));
                }
                let unique = artifact_hashes.iter().collect::<BTreeSet<_>>();
                if unique.len() != artifact_hashes.len() {
                    return Err(ProtocolError::InvalidPayload(
                        "job-receipt-v1 artifactHashes must be unique".into(),
                    ));
                }
                if payload
                    .notes_hash
                    .as_ref()
                    .map_or(true, |value| value.trim().is_empty())
                {
                    return Err(ProtocolError::InvalidPayload(
                        "job-receipt-v1 requires notesHash".into(),
                    ));
                }
            }
            if payload.evidence_format == EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1 {
                let artifact_hashes = payload.artifact_hashes.as_ref().ok_or_else(|| {
                    ProtocolError::InvalidPayload(
                        "physical-handoff-ack-dual-v1 requires exactly two artifact hashes".into(),
                    )
                })?;
                if artifact_hashes.len() != 2 {
                    return Err(ProtocolError::InvalidPayload(
                        "physical-handoff-ack-dual-v1 requires exactly two artifact hashes".into(),
                    ));
                }
                if artifact_hashes[0] == artifact_hashes[1] {
                    return Err(ProtocolError::InvalidPayload(
                        "physical-handoff-ack-dual-v1 requires distinct provider/buyer artifact hashes".into(),
                    ));
                }
                if payload
                    .notes_hash
                    .as_ref()
                    .map_or(true, |value| value.trim().is_empty())
                {
                    return Err(ProtocolError::InvalidPayload(
                        "physical-handoff-ack-dual-v1 requires notesHash".into(),
                    ));
                }
                if payload.urls.as_ref().is_some_and(|urls| !urls.is_empty()) {
                    return Err(ProtocolError::InvalidPayload(
                        "physical-handoff-ack-dual-v1 must not include urls".into(),
                    ));
                }
            }
            parse_timestamp(&payload.delivered_at)?;
        }
        EventPayload::ServiceAccept(payload) => {
            if payload.order_id.is_empty() || payload.milestone_id.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "orderId and milestoneId are required".into(),
                ));
            }
            parse_timestamp(&payload.accepted_at)?;
        }
        EventPayload::ServiceDispute(payload) => {
            if payload.order_id.is_empty() || payload.milestone_id.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "orderId and milestoneId are required".into(),
                ));
            }
            if payload.reason_code.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "reasonCode is required".into(),
                ));
            }
            parse_timestamp(&payload.disputed_at)?;
        }
        EventPayload::ServiceSettle(payload) => {
            if payload.order_id.is_empty() || payload.milestone_id.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "orderId and milestoneId are required".into(),
                ));
            }
            parse_timestamp(&payload.settled_at)?;
            if payload
                .buyer_refund_credits
                .saturating_add(payload.provider_reward_credits)
                == 0
            {
                return Err(ProtocolError::InvalidPayload(
                    "settlement amounts must be positive".into(),
                ));
            }
            match payload.outcome {
                ServiceSettleOutcome::BuyerWins => {
                    if payload.provider_reward_credits != 0 {
                        return Err(ProtocolError::InvalidPayload(
                            "providerRewardCredits must be 0 for buyerWins".into(),
                        ));
                    }
                }
                ServiceSettleOutcome::Split => {
                    if payload.buyer_refund_credits == 0 || payload.provider_reward_credits == 0 {
                        return Err(ProtocolError::InvalidPayload(
                            "split outcome requires non-zero buyer and provider amounts".into(),
                        ));
                    }
                }
            }
        }
        EventPayload::PolicyUpdate(payload) => {
            if payload.next_policy_version.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "nextPolicyVersion is required".into(),
                ));
            }
            let created_at = parse_timestamp(&event.created_at)?;
            let effective_at = parse_timestamp(&payload.effective_at)?;
            if effective_at <= created_at {
                return Err(ProtocolError::InvalidPayload(
                    "effectiveAt must be later than createdAt".into(),
                ));
            }
            if payload.policy.version != payload.next_policy_version {
                return Err(ProtocolError::InvalidPayload(
                    "policy.version must equal nextPolicyVersion".into(),
                ));
            }
            validate_hex_length(
                &payload.policy.policy_authority_pub_key,
                64,
                ProtocolError::InvalidPayload("invalid policyAuthorityPubKey".into()),
            )?;
            if payload.policy.clock_skew_seconds <= 0
                || payload.policy.credit_default_expiry_days <= 0
                || payload.policy.provider_reward_expiry_days <= 0
                || payload.policy.claim_approval_threshold == 0
                || payload.policy.max_contribution_claim_credits == 0
                || payload.policy.max_milestones_per_order == 0
                || payload.policy.max_milestone_credits == 0
                || payload.policy.acceptance_window_seconds <= 0
                || payload.policy.dispute_timeout_seconds <= 0
                || payload.policy.provider_eligibility_threshold == 0
                || payload.policy.attestor_eligibility_threshold == 0
            {
                return Err(ProtocolError::InvalidPayload(
                    "policy snapshot contains non-positive limits or thresholds".into(),
                ));
            }
            if payload.policy.demurrage_rate_weekly_bps == 0
                || payload.policy.demurrage_rate_weekly_bps > 10_000
            {
                return Err(ProtocolError::InvalidPayload(
                    "demurrageRateWeeklyBps must be in 1..=10000".into(),
                ));
            }
            if payload.policy.allowed_service_types.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "allowedServiceTypes must be non-empty".into(),
                ));
            }
            if payload.policy.allowed_sink_kinds.is_empty() {
                return Err(ProtocolError::InvalidPayload(
                    "allowedSinkKinds must be non-empty".into(),
                ));
            }
            let issuance_window_seconds = payload.policy.issuance_window_seconds.unwrap_or(0);
            let max_identity = payload
                .policy
                .max_issuance_events_per_identity_window
                .unwrap_or(0);
            let max_lane = payload
                .policy
                .max_issuance_events_per_lane_window
                .unwrap_or(0);
            let min_diversity = payload
                .policy
                .min_issuance_counterparty_diversity
                .unwrap_or(0);
            if (max_identity > 0 || max_lane > 0 || min_diversity > 0)
                && issuance_window_seconds <= 0
            {
                return Err(ProtocolError::InvalidPayload(
                    "issuanceWindowSeconds must be positive when issuance controls are enabled"
                        .into(),
                ));
            }
            let offline_auto_refund_rate_bps = payload
                .policy
                .offline_alert_auto_refund_rate_bps_threshold
                .unwrap_or(5_000);
            if offline_auto_refund_rate_bps > 10_000 {
                return Err(ProtocolError::InvalidPayload(
                    "offlineAlertAutoRefundRateBpsThreshold must be in 0..=10000".into(),
                ));
            }
            let offline_dispute_rate_bps = payload
                .policy
                .offline_alert_dispute_rate_bps_threshold
                .unwrap_or(0);
            if offline_dispute_rate_bps > 10_000 {
                return Err(ProtocolError::InvalidPayload(
                    "offlineAlertDisputeRateBpsThreshold must be in 0..=10000".into(),
                ));
            }
            if payload
                .policy
                .offline_alert_enabled_service_types
                .as_ref()
                .is_some_and(|values| values.is_empty())
            {
                return Err(ProtocolError::InvalidPayload(
                    "offlineAlertEnabledServiceTypes must be non-empty when provided".into(),
                ));
            }
            if let Some(overrides) = payload.policy.offline_alert_lane_overrides.as_ref() {
                if overrides.is_empty() {
                    return Err(ProtocolError::InvalidPayload(
                        "offlineAlertLaneOverrides must be non-empty when provided".into(),
                    ));
                }
                let mut service_types = BTreeSet::new();
                for override_entry in overrides {
                    if override_entry.service_type.trim().is_empty() {
                        return Err(ProtocolError::InvalidPayload(
                            "offlineAlertLaneOverrides.serviceType is required".into(),
                        ));
                    }
                    if offline_template_for_service_type(&override_entry.service_type).is_none() {
                        return Err(ProtocolError::InvalidPayload(
                            "offlineAlertLaneOverrides.serviceType must be an offline template lane"
                                .into(),
                        ));
                    }
                    if !service_types.insert(override_entry.service_type.clone()) {
                        return Err(ProtocolError::InvalidPayload(
                            "offlineAlertLaneOverrides.serviceType must be unique".into(),
                        ));
                    }
                    if override_entry
                        .dispute_rate_bps_threshold
                        .is_some_and(|value| value > 10_000)
                    {
                        return Err(ProtocolError::InvalidPayload(
                            "offlineAlertLaneOverrides.disputeRateBpsThreshold must be in 0..=10000"
                                .into(),
                        ));
                    }
                    if override_entry
                        .auto_refund_rate_bps_threshold
                        .is_some_and(|value| value > 10_000)
                    {
                        return Err(ProtocolError::InvalidPayload(
                            "offlineAlertLaneOverrides.autoRefundRateBpsThreshold must be in 0..=10000"
                                .into(),
                        ));
                    }
                }
            }
        }
    }

    Ok(())
}

pub fn compute_event_id(unsigned: &UnsignedEvent) -> Result<String> {
    if unsigned.version != PROTOCOL_VERSION {
        return Err(anyhow::anyhow!("unsupported version"));
    }

    let canonical = canonicalize_value(&unsigned.to_canonical_value()?)?;
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(hex::encode(digest))
}

pub fn compute_event_id_loose(unsigned: &UnsignedEnvelopeLoose) -> Result<String> {
    if unsigned.version != PROTOCOL_VERSION {
        return Err(anyhow::anyhow!("unsupported version"));
    }

    let canonical = canonicalize_value(&unsigned.to_canonical_value()?)?;
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(hex::encode(digest))
}

pub fn sign_event(unsigned: &UnsignedEvent, secret_key_hex: &str) -> Result<Event> {
    let signing_key = signing_key_from_hex(secret_key_hex)?;
    let canonical_unsigned = UnsignedEvent {
        author_pub_key: hex::encode(signing_key.verifying_key().to_bytes()),
        ..unsigned.clone()
    };
    let event_id = compute_event_id(&canonical_unsigned)?;
    let canonical = canonicalize_value(&canonical_unsigned.to_canonical_value()?)?;
    let sig = signing_key.sign(canonical.as_bytes());

    let raw = RawEventEnvelope {
        version: canonical_unsigned.version.clone(),
        event_id,
        author_pub_key: hex::encode(signing_key.verifying_key().to_bytes()),
        created_at: canonical_unsigned.created_at.clone(),
        kind: canonical_unsigned.kind,
        policy_version: canonical_unsigned.policy_version.clone(),
        payload: canonical_unsigned.payload.clone(),
        references: canonical_unsigned.references.clone(),
        nonce: canonical_unsigned.nonce.clone(),
        sig: hex::encode(sig.to_bytes()),
    };

    raw.into_event().context("converting signed event")
}

pub fn verify_event(event: &Event) -> Result<(), ProtocolError> {
    if event.version != PROTOCOL_VERSION {
        return Err(ProtocolError::UnsupportedVersion);
    }

    let unsigned = event
        .to_unsigned()
        .map_err(|_| ProtocolError::InvalidPayload("unable to encode payload".into()))?;
    let expected_event_id =
        compute_event_id(&unsigned).map_err(|_| ProtocolError::InvalidEventId)?;
    if expected_event_id != event.event_id {
        return Err(ProtocolError::InvalidEventId);
    }

    let public_key = verifying_key_from_hex(&event.author_pub_key)?;
    let signature = signature_from_hex(&event.sig)?;
    let canonical = canonicalize_value(
        &unsigned
            .to_canonical_value()
            .map_err(|_| ProtocolError::InvalidPayload("unable to encode payload".into()))?,
    )
    .map_err(|_| ProtocolError::InvalidPayload("unable to canonicalize payload".into()))?;

    public_key
        .verify(canonical.as_bytes(), &signature)
        .map_err(|_| ProtocolError::InvalidSignature)
}

pub fn verify_envelope_signature(raw: &RawEnvelopeLoose) -> Result<(), ProtocolError> {
    if raw.version != PROTOCOL_VERSION {
        return Err(ProtocolError::UnsupportedVersion);
    }

    validate_hex_length(&raw.author_pub_key, 64, ProtocolError::InvalidPublicKey)?;
    validate_hex_length(&raw.sig, 128, ProtocolError::InvalidSignature)?;
    parse_timestamp(&raw.created_at)?;

    let unsigned = raw.to_unsigned_loose();
    let expected_event_id =
        compute_event_id_loose(&unsigned).map_err(|_| ProtocolError::InvalidEventId)?;
    if expected_event_id != raw.event_id {
        return Err(ProtocolError::InvalidEventId);
    }

    let public_key = verifying_key_from_hex(&raw.author_pub_key)?;
    let signature = signature_from_hex(&raw.sig)?;
    let canonical = canonicalize_value(
        &unsigned
            .to_canonical_value()
            .map_err(|_| ProtocolError::InvalidPayload("unable to encode payload".into()))?,
    )
    .map_err(|_| ProtocolError::InvalidPayload("unable to canonicalize payload".into()))?;

    public_key
        .verify(canonical.as_bytes(), &signature)
        .map_err(|_| ProtocolError::InvalidSignature)
}

pub fn signing_key_from_hex(secret_key_hex: &str) -> Result<SigningKey> {
    let bytes = hex::decode(secret_key_hex).context("decoding secret key")?;
    let secret: [u8; 32] = bytes
        .try_into()
        .map_err(|_| ProtocolError::InvalidSecretKey)
        .context("secret key length")?;
    Ok(SigningKey::from_bytes(&secret))
}

pub fn verifying_key_from_hex(public_key_hex: &str) -> Result<VerifyingKey, ProtocolError> {
    let bytes = hex::decode(public_key_hex).map_err(|_| ProtocolError::InvalidPublicKey)?;
    let public_key: [u8; 32] = bytes
        .try_into()
        .map_err(|_| ProtocolError::InvalidPublicKey)?;
    VerifyingKey::from_bytes(&public_key).map_err(|_| ProtocolError::InvalidPublicKey)
}

pub fn signature_from_hex(signature_hex: &str) -> Result<Signature, ProtocolError> {
    let bytes = hex::decode(signature_hex).map_err(|_| ProtocolError::InvalidSignature)?;
    let signature: [u8; 64] = bytes
        .try_into()
        .map_err(|_| ProtocolError::InvalidSignature)?;
    Ok(Signature::from_bytes(&signature))
}

impl UnsignedEvent {
    pub fn to_canonical_value(&self) -> Result<Value> {
        let mut object = Map::new();
        object.insert("version".into(), Value::String(self.version.clone()));
        object.insert(
            "authorPubKey".into(),
            Value::String(self.author_pub_key.clone()),
        );
        object.insert("createdAt".into(), Value::String(self.created_at.clone()));
        object.insert("kind".into(), Value::String(self.kind.to_string()));
        object.insert(
            "policyVersion".into(),
            Value::String(self.policy_version.clone()),
        );
        object.insert("payload".into(), self.payload.clone());

        if let Some(references) = &self.references {
            object.insert(
                "references".into(),
                serde_json::to_value(references).context("encoding references")?,
            );
        }

        if let Some(nonce) = &self.nonce {
            object.insert("nonce".into(), Value::String(nonce.clone()));
        }

        Ok(Value::Object(object))
    }
}

impl UnsignedEnvelopeLoose {
    pub fn to_canonical_value(&self) -> Result<Value> {
        let mut object = Map::new();
        object.insert("version".into(), Value::String(self.version.clone()));
        object.insert(
            "authorPubKey".into(),
            Value::String(self.author_pub_key.clone()),
        );
        object.insert("createdAt".into(), Value::String(self.created_at.clone()));
        object.insert("kind".into(), Value::String(self.kind.clone()));
        object.insert(
            "policyVersion".into(),
            Value::String(self.policy_version.clone()),
        );
        object.insert("payload".into(), self.payload.clone());

        if let Some(references) = &self.references {
            object.insert(
                "references".into(),
                serde_json::to_value(references).context("encoding references")?,
            );
        }

        if let Some(nonce) = &self.nonce {
            object.insert("nonce".into(), Value::String(nonce.clone()));
        }

        Ok(Value::Object(object))
    }
}

pub fn canonicalize_value(value: &Value) -> Result<String> {
    let mut output = String::new();
    write_canonical_json(value, &mut output)?;
    Ok(output)
}

fn parse_payload(kind: EventKind, payload: Value) -> Result<EventPayload, ProtocolError> {
    let typed = match kind {
        EventKind::IdentityCreate => EventPayload::IdentityCreate(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::IdentityUpdate => EventPayload::IdentityUpdate(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::Vouch => EventPayload::Vouch(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::VouchRevoke => EventPayload::VouchRevoke(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ContributionClaim => EventPayload::ContributionClaim(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ContributionAttest => EventPayload::ContributionAttest(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::MintCredits => EventPayload::MintCredits(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::SpendCredits => EventPayload::SpendCredits(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ServiceOffer => EventPayload::ServiceOffer(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ServiceOrder => EventPayload::ServiceOrder(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ServiceDelivery => EventPayload::ServiceDelivery(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ServiceAccept => EventPayload::ServiceAccept(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ServiceDispute => EventPayload::ServiceDispute(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::ServiceSettle => EventPayload::ServiceSettle(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
        EventKind::PolicyUpdate => EventPayload::PolicyUpdate(
            serde_json::from_value(payload)
                .map_err(|error| ProtocolError::InvalidPayload(error.to_string()))?,
        ),
    };

    Ok(typed)
}

fn validate_hex_length(
    value: &str,
    expected_len: usize,
    error: ProtocolError,
) -> Result<(), ProtocolError> {
    if value.len() != expected_len || !value.chars().all(|character| character.is_ascii_hexdigit())
    {
        return Err(error);
    }

    Ok(())
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<()> {
    match value {
        Value::Null => output.push_str("null"),
        Value::Bool(boolean) => output.push_str(if *boolean { "true" } else { "false" }),
        Value::Number(number) => output.push_str(&number.to_string()),
        Value::String(text) => output.push_str(&serde_json::to_string(text)?),
        Value::Array(items) => {
            output.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_canonical_json(item, output)?;
            }
            output.push(']');
        }
        Value::Object(object) => {
            output.push('{');
            let mut keys = object.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            for (index, key) in keys.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(&serde_json::to_string(key)?);
                output.push(':');
                write_canonical_json(&object[key], output)?;
            }
            output.push('}');
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalization_sorts_object_keys() {
        let value = serde_json::json!({
            "z": 1,
            "a": { "y": 2, "x": 1 },
            "b": ["two", "one"]
        });

        let canonical = canonicalize_value(&value).expect("canonical json");
        assert_eq!(canonical, r#"{"a":{"x":1,"y":2},"b":["two","one"],"z":1}"#);
    }

    #[test]
    fn signing_and_verification_round_trip() {
        let secret_key =
            "1111111111111111111111111111111111111111111111111111111111111111".to_string();
        let signing_key = signing_key_from_hex(&secret_key).expect("signing key");
        let event = UnsignedEvent {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: hex::encode(signing_key.verifying_key().to_bytes()),
            created_at: "2026-01-01T00:00:00Z".into(),
            kind: EventKind::IdentityCreate,
            policy_version: "v0-default".into(),
            payload: serde_json::json!({
                "identityPubKey": hex::encode(signing_key.verifying_key().to_bytes())
            }),
            references: None,
            nonce: None,
        };

        let signed = sign_event(&event, &secret_key).expect("signed event");
        verify_event(&signed).expect("verified");
    }

    #[test]
    fn static_validation_requires_nonce_for_spend() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-01T00:00:00Z".into(),
            kind: EventKind::SpendCredits,
            policy_version: "v0-default".into(),
            payload: EventPayload::SpendCredits(SpendCreditsPayload {
                spender_pub_key: "1".repeat(64),
                sink_kind: SinkKind::ComputeSink,
                amount: 1,
                order_id: None,
                milestone_id: None,
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("missing nonce");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn envelope_verification_supports_marketplace_kinds() {
        let secret_key =
            "1111111111111111111111111111111111111111111111111111111111111111".to_string();
        let signing_key = signing_key_from_hex(&secret_key).expect("signing key");
        let public_key = hex::encode(signing_key.verifying_key().to_bytes());
        let unsigned = UnsignedEnvelopeLoose {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: public_key.clone(),
            created_at: "2026-02-01T00:00:00Z".into(),
            kind: "ServiceOffer".into(),
            policy_version: "v0-default".into(),
            payload: serde_json::json!({
                "offerId": "offer-1",
                "serviceType": "software-fixes"
            }),
            references: None,
            nonce: None,
        };
        let event_id = compute_event_id_loose(&unsigned).expect("event id");
        let canonical =
            canonicalize_value(&unsigned.to_canonical_value().expect("value")).expect("canonical");
        let signature = signing_key.sign(canonical.as_bytes());
        let raw = RawEnvelopeLoose {
            version: PROTOCOL_VERSION.into(),
            event_id,
            author_pub_key: public_key,
            created_at: "2026-02-01T00:00:00Z".into(),
            kind: "ServiceOffer".into(),
            policy_version: "v0-default".into(),
            payload: unsigned.payload,
            references: None,
            nonce: None,
            sig: hex::encode(signature.to_bytes()),
        };

        verify_envelope_signature(&raw).expect("verified envelope");
        assert!(is_node_ingest_supported_kind_name(&raw.kind));
    }

    #[test]
    fn static_validation_rejects_backdated_policy_update() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-01T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: None,
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("backdated effectiveAt");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_enabled_issuance_controls_without_window() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: Some(0),
                    max_issuance_events_per_identity_window: Some(1),
                    max_issuance_events_per_lane_window: Some(0),
                    min_issuance_counterparty_diversity: Some(0),
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: None,
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid issuance controls");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_invalid_offline_alert_bps_threshold() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: Some(20_000),
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: None,
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid offline alert bps threshold");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_invalid_offline_alert_dispute_rate_bps_threshold() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: Some(20_000),
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: None,
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid offline alert dispute-rate bps");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_empty_offline_alert_enabled_service_types() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: Some(vec![]),
                    offline_alert_lane_overrides: None,
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error =
            validate_static(&event).expect_err("empty offlineAlertEnabledServiceTypes invalid");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_duplicate_offline_alert_lane_overrides() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: Some(vec![
                        OfflineAlertLanePolicyPayload {
                            service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.into(),
                            dispute_rate_bps_threshold: None,
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
                        },
                        OfflineAlertLanePolicyPayload {
                            service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.into(),
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
                    ]),
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("duplicate lane override");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_invalid_offline_alert_lane_override_bps_threshold() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: Some(vec![OfflineAlertLanePolicyPayload {
                        service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.into(),
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
                    }]),
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid lane override bps");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_invalid_offline_alert_lane_override_dispute_rate_bps_threshold() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: None,
                    min_lane_reputation_score: None,
                    max_p2h_risk_band: None,
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: Some(vec![OfflineAlertLanePolicyPayload {
                        service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.into(),
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
                    }]),
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid lane override dispute-rate bps");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_accepts_soft_gating_policy_fields() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::PolicyUpdate,
            policy_version: "v0-default".into(),
            payload: EventPayload::PolicyUpdate(PolicyUpdatePayload {
                next_policy_version: "v0-policy-1".into(),
                effective_at: "2026-01-03T00:00:00Z".into(),
                policy: PolicySnapshotPayload {
                    version: "v0-policy-1".into(),
                    clock_skew_seconds: 300,
                    credit_default_expiry_days: 180,
                    provider_reward_expiry_days: 90,
                    demurrage_rate_weekly_bps: 100,
                    claim_approval_threshold: 2,
                    max_contribution_claim_credits: 1000,
                    allowed_service_types: vec!["software-fixes".into()],
                    max_milestones_per_order: 16,
                    max_milestone_credits: 5000,
                    acceptance_window_seconds: 3600,
                    dispute_timeout_seconds: 7200,
                    provider_eligibility_threshold: 2,
                    attestor_eligibility_threshold: 1,
                    allowed_sink_kinds: vec![SinkKind::ComputeSink],
                    policy_authority_pub_key: "1".repeat(64),
                    issuance_window_seconds: None,
                    max_issuance_events_per_identity_window: None,
                    max_issuance_events_per_lane_window: None,
                    min_issuance_counterparty_diversity: None,
                    min_global_reputation_score: Some(5),
                    min_lane_reputation_score: Some(1),
                    max_p2h_risk_band: Some(P2HRiskBand::Medium),
                    offline_alert_unresolved_dispute_count_threshold: None,
                    offline_alert_dispute_rate_bps_threshold: None,
                    offline_alert_dispute_rate_min_orders: None,
                    offline_alert_auto_refund_rate_bps_threshold: None,
                    offline_alert_auto_refund_min_disputes: None,
                    offline_alert_invalid_payload_count_threshold: None,
                    offline_alert_policy_violation_count_threshold: None,
                    offline_alert_unresolved_disputes_severity: None,
                    offline_alert_dispute_rate_severity: None,
                    offline_alert_auto_refund_rate_severity: None,
                    offline_alert_invalid_payload_spike_severity: None,
                    offline_alert_policy_violation_spike_severity: None,
                    offline_alert_enabled_service_types: None,
                    offline_alert_lane_overrides: None,
                },
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        validate_static(&event).expect("valid soft-gating policy fields");
    }

    #[test]
    fn static_validation_rejects_offline_offer_with_wrong_schema() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceOffer,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceOffer(ServiceOfferPayload {
                offer_id: "offer-local".into(),
                service_type: SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE.into(),
                unit_definition: "crate".into(),
                price_per_unit_credits: 10,
                delivery_mode: "artifact".into(),
                offer_expires_at: "2026-02-01T00:00:00Z".into(),
                terms_hash: None,
                allowed_evidence_formats: vec!["artifactHash".into()],
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid offline template offer");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_compute_job_offer_with_wrong_schema() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceOffer,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceOffer(ServiceOfferPayload {
                offer_id: "offer-compute".into(),
                service_type: SERVICE_TYPE_COMPUTE_JOB.into(),
                unit_definition: "deterministic compute job".into(),
                price_per_unit_credits: 25,
                delivery_mode: "artifact".into(),
                offer_expires_at: "2026-02-01T00:00:00Z".into(),
                terms_hash: None,
                allowed_evidence_formats: vec!["artifactHash".into()],
            }),
            references: None,
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid compute template offer");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_physical_handoff_delivery_without_dual_hashes() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceDelivery,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceDelivery(ServiceDeliveryPayload {
                order_id: "order-1".into(),
                milestone_id: "m1".into(),
                evidence_format: EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1.into(),
                artifact_hashes: Some(vec!["ack-provider".into()]),
                urls: None,
                notes_hash: Some("handoff-notes-hash".into()),
                delivered_at: "2026-01-02T00:00:00Z".into(),
            }),
            references: Some(BTreeMap::from([("order".into(), "e1".into())])),
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("invalid dual-ack evidence");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_physical_handoff_delivery_without_notes_hash() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceDelivery,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceDelivery(ServiceDeliveryPayload {
                order_id: "order-1".into(),
                milestone_id: "m1".into(),
                evidence_format: EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1.into(),
                artifact_hashes: Some(vec!["ack-provider".into(), "ack-buyer".into()]),
                urls: None,
                notes_hash: None,
                delivered_at: "2026-01-02T00:00:00Z".into(),
            }),
            references: Some(BTreeMap::from([("order".into(), "e1".into())])),
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("missing notes hash");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_local_resource_delivery_without_notes_hash() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceDelivery,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceDelivery(ServiceDeliveryPayload {
                order_id: "order-1".into(),
                milestone_id: "m1".into(),
                evidence_format: EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1.into(),
                artifact_hashes: Some(vec!["receipt-hash".into()]),
                urls: None,
                notes_hash: None,
                delivered_at: "2026-01-02T00:00:00Z".into(),
            }),
            references: Some(BTreeMap::from([("order".into(), "e1".into())])),
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("missing notes hash");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_compute_job_delivery_without_notes_hash() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceDelivery,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceDelivery(ServiceDeliveryPayload {
                order_id: "order-1".into(),
                milestone_id: "m1".into(),
                evidence_format: EVIDENCE_FORMAT_JOB_RECEIPT_V1.into(),
                artifact_hashes: Some(vec!["receipt-hash".into()]),
                urls: Some(vec!["https://example.com/compute/receipt".into()]),
                notes_hash: None,
                delivered_at: "2026-01-02T00:00:00Z".into(),
            }),
            references: Some(BTreeMap::from([("order".into(), "e1".into())])),
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("missing compute receipt notes hash");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn static_validation_rejects_local_resource_delivery_with_duplicate_hashes() {
        let event = Event {
            version: PROTOCOL_VERSION.into(),
            event_id: "0".repeat(64),
            author_pub_key: "1".repeat(64),
            created_at: "2026-01-02T00:00:00Z".into(),
            kind: EventKind::ServiceDelivery,
            policy_version: "v0-default".into(),
            payload: EventPayload::ServiceDelivery(ServiceDeliveryPayload {
                order_id: "order-1".into(),
                milestone_id: "m1".into(),
                evidence_format: EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1.into(),
                artifact_hashes: Some(vec!["receipt-hash".into(), "receipt-hash".into()]),
                urls: None,
                notes_hash: Some("receipt-notes".into()),
                delivered_at: "2026-01-02T00:00:00Z".into(),
            }),
            references: Some(BTreeMap::from([("order".into(), "e1".into())])),
            nonce: None,
            sig: "2".repeat(128),
        };

        let error = validate_static(&event).expect_err("duplicate artifact hashes");
        assert!(matches!(error, ProtocolError::InvalidPayload(_)));
    }

    #[test]
    fn reason_code_registry_has_unique_wire_codes() {
        use std::collections::BTreeSet;

        let codes = all_invalid_reason_codes();
        let mut wire = BTreeSet::new();
        for code in codes {
            let text = code.to_string();
            assert!(text.starts_with("ERR_"), "wire code must be ERR_*: {text}");
            assert!(wire.insert(text.clone()), "duplicate wire code: {text}");
        }
        assert_eq!(wire.len(), codes.len());
    }

    #[test]
    fn reason_code_for_protocol_error_maps_all_variants() {
        assert_eq!(
            reason_code_for_protocol_error(&ProtocolError::UnsupportedVersion),
            InvalidReasonCode::UnsupportedVersion
        );
        assert_eq!(
            reason_code_for_protocol_error(&ProtocolError::InvalidSignature),
            InvalidReasonCode::BadSignature
        );
        assert_eq!(
            reason_code_for_protocol_error(&ProtocolError::InvalidPayload("x".into())),
            InvalidReasonCode::InvalidPayload
        );
    }
}
