use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use policy::Policy;
use protocol_core::{EventKind, IdentityMetadata, InvalidReasonCode};
use reputation::ReputationAccumulator;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvalidEventReport {
    pub line: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    pub code: InvalidReasonCode,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IdentityState {
    pub identity_pub_key: String,
    pub active_pub_key: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IdentityMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_policy_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VouchEdgeState {
    pub voucher_pub_key: String,
    pub subject_pub_key: String,
    pub status: String,
    pub weight: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClaimState {
    pub claim_key: String,
    pub claimant_pub_key: String,
    pub beneficiary_pub_key: String,
    pub claim_id: String,
    pub claim_type: String,
    pub artifact_hash: String,
    pub summary: String,
    pub requested_credits: u64,
    pub approvals: BTreeSet<String>,
    pub rejections: BTreeSet<String>,
    pub minted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpendRecord {
    pub event_id: String,
    pub spender_pub_key: String,
    pub sink_kind: String,
    pub amount: u64,
    pub created_at: String,
    pub nonce: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CreditLotState {
    pub amount: u64,
    pub remaining_amount: u64,
    pub minted_at: String,
    pub expires_at: String,
    pub source_event_id: String,
    pub demurrage_rate_weekly_bps: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CreditBalanceState {
    pub identity_pub_key: String,
    pub effective_balance: u64,
    pub lots: Vec<CreditLotState>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OfferState {
    pub offer_id: String,
    pub provider_pub_key: String,
    pub service_type: String,
    pub unit_definition: String,
    pub price_per_unit_credits: u64,
    pub delivery_mode: String,
    pub offer_expires_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_hash: Option<String>,
    pub allowed_evidence_formats: Vec<String>,
    pub status: String,
    pub created_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrderState {
    pub order_id: String,
    pub offer_id: String,
    pub provider_pub_key: String,
    pub buyer_pub_key: String,
    pub order_expires_at: String,
    pub milestone_ids: Vec<String>,
    pub status: String,
    pub created_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MilestoneState {
    pub order_id: String,
    pub milestone_id: String,
    pub amount_credits: u64,
    pub evidence_format: String,
    pub status: String,
    pub funded_amount: u64,
    pub funded_spend_event_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivery_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settlement_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settlement_pending_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_timeout_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_refund_credits: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_reward_credits: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyState {
    pub effective_version: String,
    pub effective_at: String,
    pub policy_authority_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_update_event_id: Option<String>,
    pub update_count: usize,
    pub policy: Policy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyUpdateState {
    pub event_id: String,
    pub created_at: String,
    pub effective_at: String,
    pub version: String,
    pub policy: Policy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ReputationDeltaState {
    pub trust_delta: i64,
    pub claim_approvals_delta: i64,
    pub claim_rejections_delta: i64,
    pub contribution_mints_delta: i64,
    pub provider_accepts_delta: i64,
    pub buyer_accepts_delta: i64,
    pub split_settles_delta: i64,
    pub refund_wins_delta: i64,
    pub refund_losses_delta: i64,
    pub disputes_against_delta: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LaneReputationState {
    pub service_type: String,
    pub score: i64,
    pub provider_accepts: u64,
    pub buyer_accepts: u64,
    pub split_settles: u64,
    pub refund_wins: u64,
    pub refund_losses: u64,
    pub disputes_against: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReputationComponentsState {
    pub trust_weight: i64,
    pub claim_approvals: u64,
    pub claim_rejections: u64,
    pub contribution_mints: u64,
    pub provider_accepts: u64,
    pub buyer_accepts: u64,
    pub split_settles: u64,
    pub refund_wins: u64,
    pub refund_losses: u64,
    pub disputes_against: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReputationState {
    pub identity_pub_key: String,
    pub global_score: i64,
    pub trust_score: i64,
    pub contribution_score: i64,
    pub marketplace_score: i64,
    pub components: ReputationComponentsState,
    pub lanes: BTreeMap<String, LaneReputationState>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReputationHistoryEntry {
    pub event_id: String,
    pub created_at: String,
    pub identity_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lane: Option<String>,
    pub reason: String,
    pub delta: ReputationDeltaState,
    pub global_score_delta: i64,
    pub lane_score_delta: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DerivedState {
    pub identities: BTreeMap<String, IdentityState>,
    pub vouches: Vec<VouchEdgeState>,
    pub claims: BTreeMap<String, ClaimState>,
    pub balances: BTreeMap<String, CreditBalanceState>,
    pub spend_records: Vec<SpendRecord>,
    pub offers: BTreeMap<String, OfferState>,
    pub orders: BTreeMap<String, OrderState>,
    pub milestones: BTreeMap<String, MilestoneState>,
    pub policy: PolicyState,
    pub policy_updates: Vec<PolicyUpdateState>,
    #[serde(default)]
    pub reputations: BTreeMap<String, ReputationState>,
    #[serde(default)]
    pub reputation_history: Vec<ReputationHistoryEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayOutput {
    pub state: DerivedState,
    pub invalid_events: Vec<InvalidEventReport>,
    pub applied_event_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayInputLine {
    pub line: usize,
    pub raw_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayIdentityRecord {
    pub root_pub_key: String,
    pub active_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IdentityMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_policy_hash: Option<String>,
    pub created_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayVouchRecord {
    pub voucher_root: String,
    pub subject_root: String,
    pub weight: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked: bool,
    pub event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayClaimRecord {
    pub claimant_root: String,
    pub beneficiary_root: String,
    pub claim_id: String,
    pub claim_type: String,
    pub artifact_hash: String,
    pub summary: String,
    pub requested_credits: u64,
    pub approvals: BTreeSet<String>,
    pub rejections: BTreeSet<String>,
    pub minted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayLotRecord {
    pub amount: u64,
    pub remaining_amount: u64,
    pub minted_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub source_event_id: String,
    pub last_decay_at: DateTime<Utc>,
    #[serde(default = "default_demurrage_rate_weekly_bps")]
    pub demurrage_rate_weekly_bps: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayValidEventRecord {
    pub kind: EventKind,
    pub author_pub_key: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub claim_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offer_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub milestone_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayMilestoneSpecRecord {
    pub milestone_id: String,
    pub amount_credits: u64,
    pub evidence_format: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayOfferRecord {
    pub offer_id: String,
    pub provider_pub_key: String,
    pub service_type: String,
    pub unit_definition: String,
    pub price_per_unit_credits: u64,
    pub delivery_mode: String,
    pub offer_expires_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_hash: Option<String>,
    pub allowed_evidence_formats: Vec<String>,
    pub created_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayOrderRecord {
    pub order_id: String,
    pub offer_id: String,
    pub provider_pub_key: String,
    pub buyer_pub_key: String,
    pub order_expires_at: DateTime<Utc>,
    pub milestones: BTreeMap<String, ReplayMilestoneSpecRecord>,
    pub created_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayMilestoneRecord {
    pub order_id: String,
    pub milestone_id: String,
    pub amount_credits: u64,
    pub evidence_format: String,
    pub funded_amount: u64,
    pub funded_spend_event_ids: Vec<String>,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivery_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settlement_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settlement_pending_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_settlement_author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_settlement_outcome: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_buyer_refund_credits: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_provider_reward_credits: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disputed_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_timeout_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_refund_credits: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_reward_credits: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayPolicyUpdateRecord {
    pub event_id: String,
    pub created_at: DateTime<Utc>,
    pub effective_at: DateTime<Utc>,
    pub version: String,
    pub policy: Policy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayReputationHistoryRecord {
    pub event_id: String,
    pub created_at: DateTime<Utc>,
    pub identity_pub_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lane: Option<String>,
    pub reason: String,
    pub delta: ReputationDeltaState,
    pub global_score_delta: i64,
    pub lane_score_delta: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayIssuanceRecord {
    pub recipient_root: String,
    pub lane: String,
    pub counterparties: Vec<String>,
    pub issued_at: DateTime<Utc>,
    pub source_event_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayCheckpoint {
    pub identities: BTreeMap<String, ReplayIdentityRecord>,
    pub active_to_root: BTreeMap<String, String>,
    pub vouches: BTreeMap<String, ReplayVouchRecord>,
    pub claims: BTreeMap<String, ReplayClaimRecord>,
    pub lots: BTreeMap<String, Vec<ReplayLotRecord>>,
    pub spend_records: Vec<SpendRecord>,
    pub invalid_events: Vec<InvalidEventReport>,
    pub applied_event_ids: Vec<String>,
    pub valid_events: BTreeMap<String, ReplayValidEventRecord>,
    pub seen_event_ids: BTreeSet<String>,
    pub nonces: BTreeSet<String>,
    #[serde(default)]
    pub offers: BTreeMap<String, ReplayOfferRecord>,
    #[serde(default)]
    pub orders: BTreeMap<String, ReplayOrderRecord>,
    #[serde(default)]
    pub milestones: BTreeMap<String, ReplayMilestoneRecord>,
    #[serde(default)]
    pub policy_updates: Vec<ReplayPolicyUpdateRecord>,
    #[serde(default)]
    pub policy_versions: BTreeSet<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_policy_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_policy_effective_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_event_time: Option<DateTime<Utc>>,
    #[serde(default)]
    pub reputations: BTreeMap<String, ReputationAccumulator>,
    #[serde(default)]
    pub reputation_history: Vec<ReplayReputationHistoryRecord>,
    #[serde(default)]
    pub issuance_history: Vec<ReplayIssuanceRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayRunOutput {
    pub replay: ReplayOutput,
    pub checkpoint: ReplayCheckpoint,
}

fn default_demurrage_rate_weekly_bps() -> u64 {
    policy::default_policy().demurrage_rate_weekly_bps
}
