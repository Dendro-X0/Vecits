use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration, Utc};
use policy::{Policy, policy_from_snapshot_payload};
use protocol_core::{
    AttestationDecision, ContributionAttestPayload, ContributionClaimPayload, CreditLot,
    EVIDENCE_FORMAT_JOB_RECEIPT_V1, EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1,
    EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1, Event, EventKind, EventPayload,
    InvalidReasonCode, MintCreditsPayload, P2HRiskBand,
    PolicyUpdatePayload, ServiceAcceptPayload, ServiceDeliveryPayload,
    ServiceDisputePayload, ServiceOfferPayload, ServiceOrderPayload, ServiceSettleOutcome,
    ServiceSettlePayload, SinkKind, SpendCreditsPayload, VouchPayload, VouchRevokePayload,
    expected_delivery_mode_for_templated_service, parse_raw_event_str, parse_timestamp,
    reason_code_for_protocol_error, required_evidence_format_for_templated_service, verify_event,
};
use reputation::{
    ReputationAccumulator, contribution_score, contribution_score_from_accumulator,
    global_score_from_accumulator, lane_score_from_accumulator, marketplace_score,
    marketplace_score_from_accumulator,
};

use crate::model::{
    ClaimState, CreditBalanceState, CreditLotState, DerivedState, IdentityState,
    InvalidEventReport, LaneReputationState, MilestoneState, OfferState, OrderState, PolicyState,
    PolicyUpdateState, ReplayCheckpoint, ReplayClaimRecord, ReplayIdentityRecord, ReplayInputLine,
    ReplayIssuanceRecord, ReplayLotRecord, ReplayMilestoneRecord, ReplayOfferRecord,
    ReplayOrderRecord, ReplayOutput, ReplayPolicyUpdateRecord, ReplayReputationHistoryRecord,
    ReplayRunOutput, ReplayValidEventRecord, ReplayVouchRecord, ReputationComponentsState,
    ReputationDeltaState, ReputationHistoryEntry, ReputationState, SpendRecord, VouchEdgeState,
};

#[derive(Debug, Clone)]
struct ParsedLine {
    line: usize,
    raw: protocol_core::RawEventEnvelope,
}

#[derive(Debug, Clone)]
struct ReplayContext<'a> {
    base_policy: &'a Policy,
    now: DateTime<Utc>,
    identities: BTreeMap<String, ReplayIdentityRecord>,
    active_to_root: BTreeMap<String, String>,
    vouches: BTreeMap<String, ReplayVouchRecord>,
    claims: BTreeMap<String, ReplayClaimRecord>,
    lots: BTreeMap<String, Vec<ReplayLotRecord>>,
    spend_records: Vec<SpendRecord>,
    invalid_events: Vec<InvalidEventReport>,
    applied_event_ids: Vec<String>,
    valid_events: BTreeMap<String, ReplayValidEventRecord>,
    seen_event_ids: BTreeSet<String>,
    nonces: BTreeSet<String>,
    offers: BTreeMap<String, ReplayOfferRecord>,
    orders: BTreeMap<String, ReplayOrderRecord>,
    milestones: BTreeMap<String, ReplayMilestoneRecord>,
    policy_updates: Vec<ReplayPolicyUpdateRecord>,
    policy_versions: BTreeSet<String>,
    last_event_time: Option<DateTime<Utc>>,
    reputations: BTreeMap<String, ReputationAccumulator>,
    reputation_history: Vec<ReplayReputationHistoryRecord>,
    issuance_history: Vec<ReplayIssuanceRecord>,
}

impl<'a> ReplayContext<'a> {
    fn new(policy: &'a Policy, now: DateTime<Utc>) -> Self {
        let mut policy_versions = BTreeSet::new();
        policy_versions.insert(policy.version.clone());
        Self {
            base_policy: policy,
            now,
            identities: BTreeMap::new(),
            active_to_root: BTreeMap::new(),
            vouches: BTreeMap::new(),
            claims: BTreeMap::new(),
            lots: BTreeMap::new(),
            spend_records: Vec::new(),
            invalid_events: Vec::new(),
            applied_event_ids: Vec::new(),
            valid_events: BTreeMap::new(),
            seen_event_ids: BTreeSet::new(),
            nonces: BTreeSet::new(),
            offers: BTreeMap::new(),
            orders: BTreeMap::new(),
            milestones: BTreeMap::new(),
            policy_updates: Vec::new(),
            policy_versions,
            last_event_time: None,
            reputations: BTreeMap::new(),
            reputation_history: Vec::new(),
            issuance_history: Vec::new(),
        }
    }

    fn from_checkpoint(
        policy: &'a Policy,
        now: DateTime<Utc>,
        checkpoint: ReplayCheckpoint,
    ) -> Self {
        let mut policy_versions = checkpoint.policy_versions;
        if policy_versions.is_empty() {
            policy_versions.insert(policy.version.clone());
            for update in &checkpoint.policy_updates {
                policy_versions.insert(update.version.clone());
            }
        }
        Self {
            base_policy: policy,
            now,
            identities: checkpoint.identities,
            active_to_root: checkpoint.active_to_root,
            vouches: checkpoint.vouches,
            claims: checkpoint.claims,
            lots: checkpoint.lots,
            spend_records: checkpoint.spend_records,
            invalid_events: checkpoint.invalid_events,
            applied_event_ids: checkpoint.applied_event_ids,
            valid_events: checkpoint.valid_events,
            seen_event_ids: checkpoint.seen_event_ids,
            nonces: checkpoint.nonces,
            offers: checkpoint.offers,
            orders: checkpoint.orders,
            milestones: checkpoint.milestones,
            policy_updates: checkpoint.policy_updates,
            policy_versions,
            last_event_time: checkpoint.last_event_time,
            reputations: checkpoint.reputations,
            reputation_history: checkpoint.reputation_history,
            issuance_history: checkpoint.issuance_history,
        }
    }

    fn push_invalid(
        &mut self,
        line: usize,
        event_id: Option<String>,
        kind: Option<String>,
        code: InvalidReasonCode,
        message: impl Into<String>,
    ) {
        self.invalid_events.push(InvalidEventReport {
            line,
            event_id,
            kind,
            code,
            message: message.into(),
        });
    }

    fn effective_policy_for_time(
        &self,
        event_time: DateTime<Utc>,
    ) -> (&Policy, Option<&ReplayPolicyUpdateRecord>) {
        let mut effective: Option<&ReplayPolicyUpdateRecord> = None;
        for update in &self.policy_updates {
            if update.effective_at <= event_time {
                effective = Some(update);
            } else {
                break;
            }
        }

        match effective {
            Some(update) => (&update.policy, Some(update)),
            None => (self.base_policy, None),
        }
    }

    fn has_effective_policy_update(&self, event_time: DateTime<Utc>) -> bool {
        self.policy_updates
            .iter()
            .any(|update| update.effective_at <= event_time)
    }

    fn effective_policy_at_now(&self) -> (&Policy, Option<&ReplayPolicyUpdateRecord>) {
        self.effective_policy_for_time(self.now)
    }

    fn record_reputation_delta(
        &mut self,
        identity_root: &str,
        lane: Option<&str>,
        created_at: DateTime<Utc>,
        event_id: &str,
        reason: &str,
        delta: ReputationDeltaState,
    ) {
        let accumulator = self
            .reputations
            .entry(identity_root.to_string())
            .or_default();
        if delta.claim_approvals_delta > 0 {
            accumulator.claim_approvals = accumulator
                .claim_approvals
                .saturating_add(delta.claim_approvals_delta as u64);
        }
        if delta.claim_rejections_delta > 0 {
            accumulator.claim_rejections = accumulator
                .claim_rejections
                .saturating_add(delta.claim_rejections_delta as u64);
        }
        if delta.contribution_mints_delta > 0 {
            accumulator.contribution_mints = accumulator
                .contribution_mints
                .saturating_add(delta.contribution_mints_delta as u64);
        }
        if delta.provider_accepts_delta > 0 {
            accumulator.provider_accepts = accumulator
                .provider_accepts
                .saturating_add(delta.provider_accepts_delta as u64);
        }
        if delta.buyer_accepts_delta > 0 {
            accumulator.buyer_accepts = accumulator
                .buyer_accepts
                .saturating_add(delta.buyer_accepts_delta as u64);
        }
        if delta.split_settles_delta > 0 {
            accumulator.split_settles = accumulator
                .split_settles
                .saturating_add(delta.split_settles_delta as u64);
        }
        if delta.refund_wins_delta > 0 {
            accumulator.refund_wins = accumulator
                .refund_wins
                .saturating_add(delta.refund_wins_delta as u64);
        }
        if delta.refund_losses_delta > 0 {
            accumulator.refund_losses = accumulator
                .refund_losses
                .saturating_add(delta.refund_losses_delta as u64);
        }
        if delta.disputes_against_delta > 0 {
            accumulator.disputes_against = accumulator
                .disputes_against
                .saturating_add(delta.disputes_against_delta as u64);
        }

        if let Some(service_type) = lane {
            let lane_state = accumulator
                .lanes
                .entry(service_type.to_string())
                .or_default();
            if delta.provider_accepts_delta > 0 {
                lane_state.provider_accepts = lane_state
                    .provider_accepts
                    .saturating_add(delta.provider_accepts_delta as u64);
            }
            if delta.buyer_accepts_delta > 0 {
                lane_state.buyer_accepts = lane_state
                    .buyer_accepts
                    .saturating_add(delta.buyer_accepts_delta as u64);
            }
            if delta.split_settles_delta > 0 {
                lane_state.split_settles = lane_state
                    .split_settles
                    .saturating_add(delta.split_settles_delta as u64);
            }
            if delta.refund_wins_delta > 0 {
                lane_state.refund_wins = lane_state
                    .refund_wins
                    .saturating_add(delta.refund_wins_delta as u64);
            }
            if delta.refund_losses_delta > 0 {
                lane_state.refund_losses = lane_state
                    .refund_losses
                    .saturating_add(delta.refund_losses_delta as u64);
            }
            if delta.disputes_against_delta > 0 {
                lane_state.disputes_against = lane_state
                    .disputes_against
                    .saturating_add(delta.disputes_against_delta as u64);
            }
        }

        let contribution_delta = contribution_score(
            delta.claim_approvals_delta,
            delta.claim_rejections_delta,
            delta.contribution_mints_delta,
        );
        let marketplace_delta = marketplace_score(
            delta.provider_accepts_delta,
            delta.buyer_accepts_delta,
            delta.split_settles_delta,
            delta.refund_wins_delta,
            delta.refund_losses_delta,
            delta.disputes_against_delta,
        );
        self.reputation_history.push(ReplayReputationHistoryRecord {
            event_id: event_id.to_string(),
            created_at,
            identity_pub_key: identity_root.to_string(),
            lane: lane.map(str::to_string),
            reason: reason.to_string(),
            delta: delta.clone(),
            global_score_delta: delta.trust_delta + contribution_delta + marketplace_delta,
            lane_score_delta: if lane.is_some() { marketplace_delta } else { 0 },
        });
    }

    fn service_type_for_order(
        &self,
        order: &ReplayOrderRecord,
    ) -> Result<String, (InvalidReasonCode, String)> {
        self.offers
            .get(&order.offer_id)
            .map(|offer| offer.service_type.clone())
            .ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "referenced offer is missing for order".into(),
                )
            })
    }

    fn identity_root_from_pub_key(&self, pub_key: &str) -> String {
        self.active_to_root
            .get(pub_key)
            .cloned()
            .or_else(|| {
                self.identities
                    .contains_key(pub_key)
                    .then(|| pub_key.to_string())
            })
            .unwrap_or_else(|| pub_key.to_string())
    }

    fn p2h_risk_score_for_identity(&self, identity_root: &str, as_of: DateTime<Utc>) -> i64 {
        let mut score = 0_i64;

        let mut interaction_counts = BTreeMap::<String, u64>::new();
        for milestone in self.milestones.values() {
            let close_time = match milestone.status.as_str() {
                "Accepted" | "Settled" => milestone
                    .settlement_event_id
                    .as_deref()
                    .and_then(|event_id| self.valid_events.get(event_id))
                    .and_then(|event| parse_timestamp(&event.created_at).ok()),
                "AutoRefunded" => milestone
                    .dispute_timeout_at
                    .and_then(|timestamp| (timestamp <= as_of).then_some(timestamp)),
                _ => None,
            };
            let Some(close_time) = close_time else {
                continue;
            };
            if close_time > as_of {
                continue;
            }
            let Some(order) = self.orders.get(&milestone.order_id) else {
                continue;
            };
            let involved =
                order.provider_pub_key == identity_root || order.buyer_pub_key == identity_root;
            if !involved {
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
            let count = interaction_counts.entry(counterparty).or_insert(0);
            *count = count.saturating_add(1);
            if *count > 1 {
                score = score.saturating_add(12);
            }
        }

        let mut issuance_events = self
            .issuance_history
            .iter()
            .filter(|record| record.recipient_root == identity_root && record.issued_at <= as_of)
            .collect::<Vec<_>>();
        issuance_events.sort_by(|left, right| {
            left.issued_at
                .cmp(&right.issued_at)
                .then_with(|| left.source_event_id.cmp(&right.source_event_id))
                .then_with(|| left.counterparties.cmp(&right.counterparties))
        });
        let mut seen_issuance_counterparties = BTreeSet::<String>::new();
        for record in issuance_events {
            let filtered = record
                .counterparties
                .iter()
                .filter(|counterparty| counterparty.as_str() != identity_root)
                .cloned()
                .collect::<Vec<_>>();
            if filtered.is_empty() {
                continue;
            }
            let has_new = filtered
                .iter()
                .any(|counterparty| !seen_issuance_counterparties.contains(counterparty));
            if !has_new {
                score = score.saturating_add(8);
            }
            for counterparty in filtered {
                seen_issuance_counterparties.insert(counterparty);
            }
        }

        for milestone in self.milestones.values() {
            let Some(_dispute_event_id) = milestone.dispute_event_id.as_deref() else {
                continue;
            };
            let Some(settlement_event_id) = milestone.settlement_event_id.as_deref() else {
                continue;
            };
            let Some(order) = self.orders.get(&milestone.order_id) else {
                continue;
            };
            if order.provider_pub_key != identity_root && order.buyer_pub_key != identity_root {
                continue;
            }
            let Some(disputed_at) = milestone.disputed_at else {
                continue;
            };
            if disputed_at > as_of {
                continue;
            }
            let Some(settled_at) = self
                .valid_events
                .get(settlement_event_id)
                .and_then(|event| parse_timestamp(&event.created_at).ok())
            else {
                continue;
            };
            if settled_at > as_of {
                continue;
            }
            let elapsed_seconds = (settled_at - disputed_at).num_seconds();
            if (0..=900).contains(&elapsed_seconds) {
                score = score.saturating_add(15);
            }
        }

        let mut claim_created_at = BTreeMap::<String, DateTime<Utc>>::new();
        let mut attests_by_claim = BTreeMap::<String, Vec<(String, DateTime<Utc>, String)>>::new();
        for (event_id, event) in &self.valid_events {
            let Ok(created_at) = parse_timestamp(&event.created_at) else {
                continue;
            };
            if created_at > as_of {
                continue;
            }
            match event.kind {
                EventKind::ContributionClaim => {
                    if let Some(claim_id) = &event.claim_id {
                        claim_created_at.insert(claim_id.clone(), created_at);
                    }
                }
                EventKind::ContributionAttest => {
                    if let Some(claim_id) = &event.claim_id {
                        attests_by_claim.entry(claim_id.clone()).or_default().push((
                            self.identity_root_from_pub_key(&event.author_pub_key),
                            created_at,
                            event_id.clone(),
                        ));
                    }
                }
                _ => {}
            }
        }
        for entries in attests_by_claim.values_mut() {
            entries.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.2.cmp(&right.2)));
        }

        let mut claim_rows = self
            .claims
            .values()
            .filter(|claim| claim.claimant_root == identity_root)
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
        for (claim_id, _) in claim_rows {
            let Some(entries) = attests_by_claim.get(&claim_id).cloned() else {
                continue;
            };

            if entries.len() >= 2 {
                let first = entries.first().map(|item| item.1).unwrap_or(as_of);
                let last = entries.last().map(|item| item.1).unwrap_or(as_of);
                if (last - first).num_seconds() <= 300 {
                    score = score.saturating_add(7);
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
                    score = score.saturating_add(9);
                }
                seen_attestor_sets.insert(attestor_set_key);
            }
        }

        score
    }

    fn enforce_economic_eligibility(
        &self,
        recipient_root: &str,
        lane: Option<&str>,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let policy = self.effective_policy_for_time(event_time).0;
        if policy.min_global_reputation_score.is_none()
            && policy.min_lane_reputation_score.is_none()
            && policy.max_p2h_risk_band.is_none()
        {
            return Ok(());
        }

        let trust_weight = self.incoming_vouch_score(recipient_root, event_time) as i64;
        let accumulator = self
            .reputations
            .get(recipient_root)
            .cloned()
            .unwrap_or_default();
        let global_score = global_score_from_accumulator(trust_weight, &accumulator);
        if let Some(min_global) = policy.min_global_reputation_score
            && global_score < min_global
        {
            return Err((
                InvalidReasonCode::EconomicEligibilityViolation,
                format!("global reputation score {global_score} is below minimum {min_global}"),
            ));
        }

        if let (Some(min_lane), Some(lane_key)) = (policy.min_lane_reputation_score, lane) {
            let lane_score = accumulator
                .lanes
                .get(lane_key)
                .map(lane_score_from_accumulator)
                .unwrap_or(0);
            if lane_score < min_lane {
                return Err((
                    InvalidReasonCode::EconomicEligibilityViolation,
                    format!(
                        "lane reputation score {lane_score} is below minimum {min_lane} for lane `{lane_key}`"
                    ),
                ));
            }
        }

        if let Some(max_band) = policy.max_p2h_risk_band {
            let score = self.p2h_risk_score_for_identity(recipient_root, event_time);
            let current_band = p2h_risk_band_for_score(score);
            if current_band > max_band {
                return Err((
                    InvalidReasonCode::EconomicEligibilityViolation,
                    format!(
                        "p2h risk band `{}` exceeds allowed `{}`",
                        p2h_risk_band_label(current_band),
                        p2h_risk_band_label(max_band)
                    ),
                ));
            }
        }

        Ok(())
    }

    fn enforce_issuance_controls(
        &self,
        recipient_root: &str,
        lane: &str,
        counterparties: &BTreeSet<String>,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let policy = self.effective_policy_for_time(event_time).0;
        let max_identity = policy.max_issuance_events_per_identity_window;
        let max_lane = policy.max_issuance_events_per_lane_window;
        let min_diversity = policy.min_issuance_counterparty_diversity;
        if max_identity == 0 && max_lane == 0 && min_diversity == 0 {
            return Ok(());
        }
        if policy.issuance_window_seconds <= 0 {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "issuance controls require positive issuanceWindowSeconds".into(),
            ));
        }

        let window_start = event_time - Duration::seconds(policy.issuance_window_seconds);
        let in_window = self
            .issuance_history
            .iter()
            .filter(|record| {
                record.recipient_root == recipient_root
                    && record.issued_at > window_start
                    && record.issued_at <= event_time
            })
            .collect::<Vec<_>>();

        if max_identity > 0 && in_window.len() >= max_identity {
            return Err((
                InvalidReasonCode::IssuanceRateLimitExceeded,
                "identity issuance rate limit exceeded for rolling window".into(),
            ));
        }

        let lane_count = in_window
            .iter()
            .filter(|record| record.lane == lane)
            .count();
        if max_lane > 0 && lane_count >= max_lane {
            return Err((
                InvalidReasonCode::IssuanceRateLimitExceeded,
                "lane issuance rate limit exceeded for rolling window".into(),
            ));
        }

        if min_diversity > 0 {
            let mut observed = BTreeSet::new();
            for record in &in_window {
                for counterparty in &record.counterparties {
                    observed.insert(counterparty.clone());
                }
            }
            observed.extend(counterparties.iter().cloned());
            if observed.len() < min_diversity {
                return Err((
                    InvalidReasonCode::IssuanceDiversityViolation,
                    "counterparty diversity threshold not met for issuance".into(),
                ));
            }
        }

        Ok(())
    }

    fn record_issuance(
        &mut self,
        recipient_root: &str,
        lane: &str,
        counterparties: &BTreeSet<String>,
        event_time: DateTime<Utc>,
        source_event_id: &str,
    ) {
        self.issuance_history.push(ReplayIssuanceRecord {
            recipient_root: recipient_root.to_string(),
            lane: lane.to_string(),
            counterparties: counterparties.iter().cloned().collect(),
            issued_at: event_time,
            source_event_id: source_event_id.to_string(),
        });
    }

    fn process_event(&mut self, line: usize, event: Event) {
        if !self.seen_event_ids.insert(event.event_id.clone()) {
            self.push_invalid(
                line,
                Some(event.event_id.clone()),
                Some(event.kind.to_string()),
                InvalidReasonCode::InvalidStateTransition,
                "duplicate eventId",
            );
            return;
        }

        let event_time = match parse_timestamp(&event.created_at) {
            Ok(time) => time,
            Err(_) => {
                self.push_invalid(
                    line,
                    Some(event.event_id.clone()),
                    Some(event.kind.to_string()),
                    InvalidReasonCode::BadTimestamp,
                    "invalid createdAt timestamp",
                );
                return;
            }
        };

        let (effective_policy, _) = self.effective_policy_for_time(event_time);
        if event_time > self.now + Duration::seconds(effective_policy.clock_skew_seconds) {
            self.push_invalid(
                line,
                Some(event.event_id.clone()),
                Some(event.kind.to_string()),
                InvalidReasonCode::BadTimestamp,
                "event createdAt exceeds allowed clock skew",
            );
            return;
        }

        if let Err(error) = verify_event(&event) {
            let code = reason_code_for_protocol_error(&error);
            self.push_invalid(
                line,
                Some(event.event_id.clone()),
                Some(event.kind.to_string()),
                code,
                error.to_string(),
            );
            return;
        }

        if event.kind != EventKind::PolicyUpdate {
            let expected_policy_version = if self.has_effective_policy_update(event_time) {
                effective_policy.version.as_str()
            } else {
                self.base_policy.version.as_str()
            };
            if event.policy_version != expected_policy_version {
                self.push_invalid(
                    line,
                    Some(event.event_id.clone()),
                    Some(event.kind.to_string()),
                    InvalidReasonCode::PolicyViolation,
                    format!(
                        "policyVersion `{}` does not match effective `{expected_policy_version}`",
                        event.policy_version
                    ),
                );
                return;
            }
        }

        if let Err((code, message)) = self.validate_references(&event) {
            self.push_invalid(
                line,
                Some(event.event_id.clone()),
                Some(event.kind.to_string()),
                code,
                message,
            );
            return;
        }

        if let Err((code, message)) = self.apply_event(&event, event_time) {
            self.push_invalid(
                line,
                Some(event.event_id.clone()),
                Some(event.kind.to_string()),
                code,
                message,
            );
            return;
        }

        let event_id = event.event_id.clone();
        self.last_event_time = Some(event_time.max(self.last_event_time.unwrap_or(event_time)));
        self.valid_events
            .insert(event_id.clone(), summarize_valid_event(&event));
        self.applied_event_ids.push(event_id);
    }

    fn validate_references(&self, event: &Event) -> Result<(), (InvalidReasonCode, String)> {
        let references = event.references.as_ref();
        let expect_reference = |name: &str| -> Result<String, (InvalidReasonCode, String)> {
            references
                .and_then(|map| map.get(name).cloned())
                .ok_or_else(|| {
                    (
                        InvalidReasonCode::MissingReference,
                        format!("missing required reference `{name}`"),
                    )
                })
        };

        match event.kind {
            EventKind::IdentityCreate
            | EventKind::Vouch
            | EventKind::ContributionClaim
            | EventKind::ServiceOffer
            | EventKind::SpendCredits
            | EventKind::PolicyUpdate => {}
            EventKind::IdentityUpdate => {
                let event_id = expect_reference("identityCreate")?;
                self.require_valid_reference(&event_id, EventKind::IdentityCreate)?;
            }
            EventKind::VouchRevoke => {
                let event_id = expect_reference("vouch")?;
                self.require_valid_reference(&event_id, EventKind::Vouch)?;
            }
            EventKind::ContributionAttest => {
                let event_id = expect_reference("claim")?;
                self.require_valid_reference(&event_id, EventKind::ContributionClaim)?;
            }
            EventKind::MintCredits => {
                let event_id = expect_reference("claim")?;
                self.require_valid_reference(&event_id, EventKind::ContributionClaim)?;
            }
            EventKind::ServiceOrder => {
                let event_id = expect_reference("offer")?;
                self.require_valid_reference(&event_id, EventKind::ServiceOffer)?;
            }
            EventKind::ServiceDelivery => {
                let event_id = expect_reference("order")?;
                self.require_valid_reference(&event_id, EventKind::ServiceOrder)?;
            }
            EventKind::ServiceAccept | EventKind::ServiceDispute => {
                let event_id = expect_reference("delivery")?;
                self.require_valid_reference(&event_id, EventKind::ServiceDelivery)?;
            }
            EventKind::ServiceSettle => {
                let event_id = expect_reference("dispute")?;
                self.require_valid_reference(&event_id, EventKind::ServiceDispute)?;
            }
        }

        Ok(())
    }

    fn require_valid_reference(
        &self,
        event_id: &str,
        expected_kind: EventKind,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let referenced = self.valid_events.get(event_id).ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                format!("referenced event `{event_id}` not found"),
            )
        })?;

        if referenced.kind != expected_kind {
            return Err((
                InvalidReasonCode::MissingReference,
                format!(
                    "reference `{event_id}` is `{}` instead of `{expected_kind}`",
                    referenced.kind
                ),
            ));
        }

        Ok(())
    }

    fn apply_event(
        &mut self,
        event: &Event,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        match &event.payload {
            EventPayload::IdentityCreate(payload) => self.apply_identity_create(event, payload),
            EventPayload::IdentityUpdate(payload) => self.apply_identity_update(event, payload),
            EventPayload::Vouch(payload) => self.apply_vouch(event, payload, event_time),
            EventPayload::VouchRevoke(payload) => {
                self.apply_vouch_revoke(event, payload, event_time)
            }
            EventPayload::ContributionClaim(payload) => {
                self.apply_claim(event, payload, event_time)
            }
            EventPayload::ContributionAttest(payload) => {
                self.apply_attest(event, payload, event_time)
            }
            EventPayload::MintCredits(payload) => self.apply_mint(event, payload, event_time),
            EventPayload::SpendCredits(payload) => self.apply_spend(event, payload, event_time),
            EventPayload::ServiceOffer(payload) => {
                self.apply_service_offer(event, payload, event_time)
            }
            EventPayload::ServiceOrder(payload) => {
                self.apply_service_order(event, payload, event_time)
            }
            EventPayload::ServiceDelivery(payload) => {
                self.apply_service_delivery(event, payload, event_time)
            }
            EventPayload::ServiceAccept(payload) => {
                self.apply_service_accept(event, payload, event_time)
            }
            EventPayload::ServiceDispute(payload) => {
                self.apply_service_dispute(event, payload, event_time)
            }
            EventPayload::ServiceSettle(payload) => {
                self.apply_service_settle(event, payload, event_time)
            }
            EventPayload::PolicyUpdate(payload) => {
                self.apply_policy_update(event, payload, event_time)
            }
        }
    }

    fn apply_identity_create(
        &mut self,
        event: &Event,
        payload: &protocol_core::IdentityCreatePayload,
    ) -> Result<(), (InvalidReasonCode, String)> {
        if payload.identity_pub_key != event.author_pub_key {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "identityPubKey must match authorPubKey".into(),
            ));
        }
        if self.identities.contains_key(&payload.identity_pub_key) {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "identity already exists".into(),
            ));
        }

        self.active_to_root.insert(
            payload.identity_pub_key.clone(),
            payload.identity_pub_key.clone(),
        );
        self.identities.insert(
            payload.identity_pub_key.clone(),
            ReplayIdentityRecord {
                root_pub_key: payload.identity_pub_key.clone(),
                active_pub_key: payload.identity_pub_key.clone(),
                metadata: payload.metadata.clone(),
                recovery_policy_hash: payload.recovery_policy_hash.clone(),
                created_event_id: event.event_id.clone(),
            },
        );
        Ok(())
    }

    fn apply_identity_update(
        &mut self,
        event: &Event,
        payload: &protocol_core::IdentityUpdatePayload,
    ) -> Result<(), (InvalidReasonCode, String)> {
        if let Some(next_pub_key) = &payload.next_pub_key {
            if self.active_to_root.contains_key(next_pub_key)
                || self.identities.contains_key(next_pub_key)
            {
                return Err((
                    InvalidReasonCode::InvalidStateTransition,
                    "nextPubKey is already in use".into(),
                ));
            }
        }

        let record = self
            .identities
            .get_mut(&payload.identity_pub_key)
            .ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "target identity does not exist".into(),
                )
            })?;
        let reference = event
            .references
            .as_ref()
            .and_then(|map| map.get("identityCreate"))
            .cloned()
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing identityCreate reference".into(),
                )
            })?;
        if reference != record.created_event_id {
            return Err((
                InvalidReasonCode::MissingReference,
                "identityCreate reference does not match target identity".into(),
            ));
        }
        if event.author_pub_key != record.active_pub_key {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "only the active key may update the identity".into(),
            ));
        }

        if let Some(metadata) = &payload.metadata {
            record.metadata = Some(metadata.clone());
        }
        if let Some(next_pub_key) = &payload.next_pub_key {
            self.active_to_root.remove(&record.active_pub_key);
            record.active_pub_key = next_pub_key.clone();
            self.active_to_root
                .insert(next_pub_key.clone(), payload.identity_pub_key.clone());
        }
        Ok(())
    }

    fn apply_vouch(
        &mut self,
        event: &Event,
        payload: &VouchPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let voucher_root = self.require_active_identity(&event.author_pub_key)?;
        let subject_root = self.resolve_existing_root(&payload.subject_pub_key)?;
        if voucher_root == subject_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "self-vouch is not allowed".into(),
            ));
        }

        let key = vouch_key(&voucher_root, &subject_root);
        if self
            .vouches
            .get(&key)
            .is_some_and(|record| !record.revoked && !is_vouch_expired(record, event_time))
        {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "active vouch already exists".into(),
            ));
        }

        let expires_at = payload
            .expires_at
            .as_deref()
            .map(parse_timestamp)
            .transpose()
            .map_err(|_| {
                (
                    InvalidReasonCode::BadTimestamp,
                    "invalid vouch expiresAt".into(),
                )
            })?;

        let subject_for_reputation = subject_root.clone();
        self.vouches.insert(
            key,
            ReplayVouchRecord {
                voucher_root,
                subject_root,
                weight: payload.weight.unwrap_or(1),
                expires_at,
                revoked: false,
                event_id: event.event_id.clone(),
            },
        );
        self.record_reputation_delta(
            &subject_for_reputation,
            None,
            event_time,
            &event.event_id,
            "Vouch",
            ReputationDeltaState {
                trust_delta: payload.weight.unwrap_or(1) as i64,
                ..ReputationDeltaState::default()
            },
        );
        Ok(())
    }

    fn apply_vouch_revoke(
        &mut self,
        event: &Event,
        payload: &VouchRevokePayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let voucher_root = self.require_active_identity(&event.author_pub_key)?;
        let subject_root = self.resolve_existing_root(&payload.subject_pub_key)?;
        let reference = event
            .references
            .as_ref()
            .and_then(|map| map.get("vouch"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing vouch reference".into(),
                )
            })?;
        let key = vouch_key(&voucher_root, &subject_root);
        let record = self.vouches.get_mut(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "no active vouch exists for revoke".into(),
            )
        })?;
        if &record.event_id != reference {
            return Err((
                InvalidReasonCode::MissingReference,
                "vouch reference does not match active edge".into(),
            ));
        }
        if record.revoked {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "vouch is already revoked".into(),
            ));
        }
        let revoked_weight = record.weight as i64;
        record.revoked = true;
        self.record_reputation_delta(
            &subject_root,
            None,
            event_time,
            &event.event_id,
            "VouchRevoke",
            ReputationDeltaState {
                trust_delta: -revoked_weight,
                ..ReputationDeltaState::default()
            },
        );
        Ok(())
    }

    fn apply_claim(
        &mut self,
        event: &Event,
        payload: &ContributionClaimPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let claimant_root = self.require_active_identity(&event.author_pub_key)?;
        let beneficiary_root = match &payload.beneficiary_pub_key {
            Some(beneficiary_pub_key) => {
                let beneficiary_root = self.resolve_existing_root(beneficiary_pub_key)?;
                if beneficiary_root != claimant_root {
                    return Err((
                        InvalidReasonCode::ForbiddenTransferSemantics,
                        "beneficiaryPubKey must equal the claimant in v0 phase 1".into(),
                    ));
                }
                beneficiary_root
            }
            None => claimant_root.clone(),
        };
        let policy = self.effective_policy_for_time(event_time).0;
        if payload.requested_credits > policy.max_contribution_claim_credits {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "requested credits exceed policy cap".into(),
            ));
        }

        let key = claim_key(&claimant_root, &payload.claim_id);
        if self.claims.contains_key(&key) {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "claimId is already active for claimant".into(),
            ));
        }

        self.claims.insert(
            key,
            ReplayClaimRecord {
                claimant_root,
                beneficiary_root,
                claim_id: payload.claim_id.clone(),
                claim_type: payload.claim_type.clone(),
                artifact_hash: payload.artifact_hash.clone(),
                summary: payload.summary.clone(),
                requested_credits: payload.requested_credits,
                approvals: BTreeSet::new(),
                rejections: BTreeSet::new(),
                minted: false,
            },
        );
        Ok(())
    }

    fn apply_attest(
        &mut self,
        event: &Event,
        payload: &ContributionAttestPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let attestor_eligibility_threshold = self
            .effective_policy_for_time(event_time)
            .0
            .attestor_eligibility_threshold;
        let attestor_root = self.require_active_identity(&event.author_pub_key)?;
        let claim_reference = event
            .references
            .as_ref()
            .and_then(|map| map.get("claim"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing claim reference".into(),
                )
            })?
            .to_owned();
        let claim_event = self.valid_events.get(&claim_reference).ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                "referenced claim event does not exist".into(),
            )
        })?;
        if claim_event.kind != EventKind::ContributionClaim {
            return Err((
                InvalidReasonCode::MissingReference,
                "claim reference must point to ContributionClaim".into(),
            ));
        }
        let claim_id = claim_event.claim_id.as_ref().ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                "claim reference does not include claimId".into(),
            )
        })?;
        let claimant_root = self.resolve_existing_root(&claim_event.author_pub_key)?;
        let key = claim_key(&claimant_root, claim_id);
        let score = self.incoming_vouch_score(&attestor_root, event_time);
        let claim = self.claims.get_mut(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "claim state is missing".into(),
            )
        })?;

        if attestor_root == claim.claimant_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "claimant cannot attest their own claim".into(),
            ));
        }

        if score < attestor_eligibility_threshold {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "attestor does not meet trust threshold".into(),
            ));
        }

        if claim.approvals.contains(&attestor_root) || claim.rejections.contains(&attestor_root) {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "attestor has already voted on this claim".into(),
            ));
        }

        let claimant_for_reputation = claim.claimant_root.clone();
        let decision = payload.decision.clone();
        match decision {
            AttestationDecision::Approve => {
                claim.approvals.insert(attestor_root);
            }
            AttestationDecision::Reject => {
                claim.rejections.insert(attestor_root);
            }
        }
        let (reason, delta) = match payload.decision {
            AttestationDecision::Approve => (
                "ContributionAttest.approve",
                ReputationDeltaState {
                    claim_approvals_delta: 1,
                    ..ReputationDeltaState::default()
                },
            ),
            AttestationDecision::Reject => (
                "ContributionAttest.reject",
                ReputationDeltaState {
                    claim_rejections_delta: 1,
                    ..ReputationDeltaState::default()
                },
            ),
        };
        self.record_reputation_delta(
            &claimant_for_reputation,
            None,
            event_time,
            &event.event_id,
            reason,
            delta,
        );
        Ok(())
    }

    fn apply_mint(
        &mut self,
        event: &Event,
        payload: &MintCreditsPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let (claim_approval_threshold, max_contribution_claim_credits, demurrage_rate_weekly_bps) = {
            let policy = self.effective_policy_for_time(event_time).0;
            (
                policy.claim_approval_threshold,
                policy.max_contribution_claim_credits,
                policy.demurrage_rate_weekly_bps,
            )
        };
        let beneficiary_root = self.resolve_existing_root(&payload.beneficiary_pub_key)?;
        let author_root = self.require_active_identity(&event.author_pub_key)?;
        if payload.mint_reason != "contribution" {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "phase 1 only supports contribution minting".into(),
            ));
        }
        if author_root != beneficiary_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "mint author must equal beneficiary in phase 1".into(),
            ));
        }

        let claim_reference = event
            .references
            .as_ref()
            .and_then(|map| map.get("claim"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing claim reference".into(),
                )
            })?
            .to_owned();
        let claim_event = self.valid_events.get(&claim_reference).ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                "referenced claim event does not exist".into(),
            )
        })?;
        if claim_event.kind != EventKind::ContributionClaim {
            return Err((
                InvalidReasonCode::MissingReference,
                "claim reference must point to ContributionClaim".into(),
            ));
        }
        let claim_id = claim_event.claim_id.as_ref().ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                "claim reference does not include claimId".into(),
            )
        })?;
        if payload.source_claim_id.as_deref() != Some(claim_id.as_str()) {
            return Err((
                InvalidReasonCode::MissingReference,
                "sourceClaimId does not match referenced claim".into(),
            ));
        }

        let claimant_root = self.resolve_existing_root(&claim_event.author_pub_key)?;
        let key = claim_key(&claimant_root, claim_id);
        let claim = self.claims.get(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "claim state is missing".into(),
            )
        })?;
        let claim_approvals = claim.approvals.clone();

        if claim.claimant_root != author_root || claim.beneficiary_root != beneficiary_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "only the claimant beneficiary may mint this claim".into(),
            ));
        }
        if claim.minted {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "claim has already been minted".into(),
            ));
        }
        if claim.approvals.len() < claim_approval_threshold {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "claim approval threshold not met".into(),
            ));
        }
        if payload.amount > claim.requested_credits
            || payload.amount > max_contribution_claim_credits
        {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "mint amount exceeds claim or policy cap".into(),
            ));
        }
        self.enforce_issuance_controls(
            &beneficiary_root,
            "contribution",
            &claim_approvals,
            event_time,
        )?;
        self.enforce_economic_eligibility(&beneficiary_root, None, event_time)?;

        let expires_at = parse_timestamp(&payload.expires_at)
            .map_err(|_| (InvalidReasonCode::BadTimestamp, "invalid expiresAt".into()))?;
        if expires_at <= event_time {
            return Err((
                InvalidReasonCode::BadTimestamp,
                "expiresAt must be later than mint event time".into(),
            ));
        }

        self.normalize_lots(&beneficiary_root, event_time);
        self.lots
            .entry(beneficiary_root.clone())
            .or_default()
            .push(ReplayLotRecord {
                amount: payload.amount,
                remaining_amount: payload.amount,
                minted_at: event_time,
                expires_at,
                source_event_id: event.event_id.clone(),
                last_decay_at: event_time,
                demurrage_rate_weekly_bps,
            });
        self.record_issuance(
            &beneficiary_root,
            "contribution",
            &claim_approvals,
            event_time,
            &event.event_id,
        );
        {
            let claim = self.claims.get_mut(&key).ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "claim state disappeared before mint finalization".into(),
                )
            })?;
            claim.minted = true;
        }
        self.record_reputation_delta(
            &beneficiary_root,
            None,
            event_time,
            &event.event_id,
            "MintCredits.contribution",
            ReputationDeltaState {
                contribution_mints_delta: 1,
                ..ReputationDeltaState::default()
            },
        );
        Ok(())
    }

    fn apply_spend(
        &mut self,
        event: &Event,
        payload: &SpendCreditsPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let sink_allowed = self
            .effective_policy_for_time(event_time)
            .0
            .allowed_sink_kinds
            .contains(&payload.sink_kind);
        let spender_root = self.require_active_identity(&event.author_pub_key)?;
        if payload.spender_pub_key != event.author_pub_key {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "spenderPubKey must match authorPubKey".into(),
            ));
        }
        if !sink_allowed {
            return Err((
                InvalidReasonCode::PolicyViolation,
                format!("sink `{}` is not supported in phase 1", payload.sink_kind),
            ));
        }

        let nonce = event.nonce.clone().ok_or_else(|| {
            (
                InvalidReasonCode::InvalidNonce,
                "nonce is required for SpendCredits".into(),
            )
        })?;
        if !self
            .nonces
            .insert(nonce_key(&spender_root, payload.sink_kind, &nonce))
        {
            return Err((
                InvalidReasonCode::InvalidNonce,
                "nonce has already been used for this spender and sink".into(),
            ));
        }

        self.normalize_lots(&spender_root, event_time);
        let lots = self.lots.entry(spender_root.clone()).or_default();
        let available: u64 = lots.iter().map(|lot| lot.remaining_amount).sum();
        if available < payload.amount {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "insufficient effective balance".into(),
            ));
        }

        if payload.sink_kind == SinkKind::ServiceEscrowSink {
            let order_id = payload.order_id.as_deref().ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidPayload,
                    "orderId is required for ServiceEscrowSink".into(),
                )
            })?;
            let milestone_id = payload.milestone_id.as_deref().ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidPayload,
                    "milestoneId is required for ServiceEscrowSink".into(),
                )
            })?;
            let order = self.orders.get(order_id).ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "order does not exist".into(),
                )
            })?;
            if order.buyer_pub_key != spender_root {
                return Err((
                    InvalidReasonCode::UnauthorizedActor,
                    "only order buyer may fund escrow".into(),
                ));
            }
            if !order.milestones.contains_key(milestone_id) {
                return Err((
                    InvalidReasonCode::InvalidStateTransition,
                    "milestone is not defined in order".into(),
                ));
            }
            let milestone_key = milestone_key(order_id, milestone_id);
            let milestone = self.milestones.get_mut(&milestone_key).ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "milestone does not exist".into(),
                )
            })?;
            if !matches!(
                milestone.status.as_str(),
                "Open" | "PartiallyFunded" | "Funded"
            ) {
                return Err((
                    InvalidReasonCode::InvalidStateTransition,
                    "milestone is not fundable".into(),
                ));
            }
            if milestone.funded_amount.saturating_add(payload.amount) > milestone.amount_credits {
                return Err((
                    InvalidReasonCode::PolicyViolation,
                    "funding exceeds milestone amount".into(),
                ));
            }
            milestone.funded_amount = milestone.funded_amount.saturating_add(payload.amount);
            milestone
                .funded_spend_event_ids
                .push(event.event_id.clone());
            milestone.status = if milestone.funded_amount == milestone.amount_credits {
                "Funded".into()
            } else {
                "PartiallyFunded".into()
            };
        }

        lots.sort_by(|left, right| {
            left.expires_at
                .cmp(&right.expires_at)
                .then_with(|| left.minted_at.cmp(&right.minted_at))
                .then_with(|| left.source_event_id.cmp(&right.source_event_id))
        });
        let mut remaining = payload.amount;
        for lot in lots.iter_mut() {
            if remaining == 0 {
                break;
            }
            let consumed = remaining.min(lot.remaining_amount);
            lot.remaining_amount -= consumed;
            remaining -= consumed;
        }
        lots.retain(|lot| lot.remaining_amount > 0);

        self.spend_records.push(SpendRecord {
            event_id: event.event_id.clone(),
            spender_pub_key: spender_root,
            sink_kind: payload.sink_kind.to_string(),
            amount: payload.amount,
            created_at: event.created_at.clone(),
            nonce,
        });
        Ok(())
    }

    fn apply_service_offer(
        &mut self,
        event: &Event,
        payload: &ServiceOfferPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let (provider_eligibility_threshold, allowed_service_types) = {
            let policy = self.effective_policy_for_time(event_time).0;
            (
                policy.provider_eligibility_threshold,
                policy.allowed_service_types.clone(),
            )
        };
        let provider_root = self.require_active_identity(&event.author_pub_key)?;
        let provider_score = self.incoming_vouch_score(&provider_root, event_time);
        if provider_score < provider_eligibility_threshold {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "provider does not meet trust threshold".into(),
            ));
        }
        let offer_expires_at = parse_timestamp(&payload.offer_expires_at).map_err(|_| {
            (
                InvalidReasonCode::BadTimestamp,
                "invalid offerExpiresAt".into(),
            )
        })?;
        if offer_expires_at <= event_time {
            return Err((
                InvalidReasonCode::BadTimestamp,
                "offerExpiresAt must be later than createdAt".into(),
            ));
        }
        if !allowed_service_types.contains(&payload.service_type) {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "serviceType is not allowed by policy".into(),
            ));
        }
        if let Some(expected_mode) =
            expected_delivery_mode_for_templated_service(&payload.service_type)
            && payload.delivery_mode != expected_mode
        {
            return Err((
                InvalidReasonCode::PolicyViolation,
                format!(
                    "templated serviceType `{}` requires deliveryMode `{expected_mode}`",
                    payload.service_type
                ),
            ));
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
                return Err((
                    InvalidReasonCode::PolicyViolation,
                    format!(
                        "templated serviceType `{}` requires allowedEvidenceFormats to equal [`{required_format}`]",
                        payload.service_type
                    ),
                ));
            }
        }
        if let Some(existing) = self.offers.get(&payload.offer_id)
            && existing.offer_expires_at > event_time
        {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "active offerId already exists".into(),
            ));
        }

        self.offers.insert(
            payload.offer_id.clone(),
            ReplayOfferRecord {
                offer_id: payload.offer_id.clone(),
                provider_pub_key: provider_root,
                service_type: payload.service_type.clone(),
                unit_definition: payload.unit_definition.clone(),
                price_per_unit_credits: payload.price_per_unit_credits,
                delivery_mode: payload.delivery_mode.clone(),
                offer_expires_at,
                terms_hash: payload.terms_hash.clone(),
                allowed_evidence_formats: payload.allowed_evidence_formats.clone(),
                created_event_id: event.event_id.clone(),
            },
        );
        Ok(())
    }

    fn apply_service_order(
        &mut self,
        event: &Event,
        payload: &ServiceOrderPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let (max_milestones_per_order, max_milestone_credits) = {
            let policy = self.effective_policy_for_time(event_time).0;
            (
                policy.max_milestones_per_order,
                policy.max_milestone_credits,
            )
        };
        let buyer_root = self.require_active_identity(&event.author_pub_key)?;
        if payload.buyer_pub_key != buyer_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "buyerPubKey must match order author".into(),
            ));
        }
        let provider_root = self.resolve_existing_root(&payload.provider_pub_key)?;
        if self.orders.contains_key(&payload.order_id) {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "orderId already exists".into(),
            ));
        }
        if payload.milestones.len() > max_milestones_per_order {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "too many milestones for order".into(),
            ));
        }
        let order_expires_at = parse_timestamp(&payload.order_expires_at).map_err(|_| {
            (
                InvalidReasonCode::BadTimestamp,
                "invalid orderExpiresAt".into(),
            )
        })?;
        if order_expires_at <= event_time {
            return Err((
                InvalidReasonCode::BadTimestamp,
                "orderExpiresAt must be later than createdAt".into(),
            ));
        }
        let offer_reference = event
            .references
            .as_ref()
            .and_then(|refs| refs.get("offer"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing offer reference".into(),
                )
            })?;
        let offer = self.offers.get(&payload.offer_id).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "referenced offer does not exist".into(),
            )
        })?;
        if &offer.created_event_id != offer_reference {
            return Err((
                InvalidReasonCode::MissingReference,
                "offer reference does not match offer state".into(),
            ));
        }
        if offer.provider_pub_key != provider_root
            || offer.provider_pub_key != payload.provider_pub_key
        {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "providerPubKey does not match offer".into(),
            ));
        }
        if offer.offer_expires_at <= event_time {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "offer has expired".into(),
            ));
        }

        let mut seen_milestones = BTreeSet::new();
        let mut milestone_specs = BTreeMap::new();
        let required_offline_evidence =
            required_evidence_format_for_templated_service(&offer.service_type);
        for milestone in &payload.milestones {
            if !seen_milestones.insert(milestone.milestone_id.clone()) {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    "duplicate milestoneId in order".into(),
                ));
            }
            if milestone.amount_credits > max_milestone_credits {
                return Err((
                    InvalidReasonCode::PolicyViolation,
                    "milestone amount exceeds policy cap".into(),
                ));
            }
            if !offer
                .allowed_evidence_formats
                .contains(&milestone.evidence_format)
            {
                return Err((
                    InvalidReasonCode::PolicyViolation,
                    "milestone evidenceFormat is not allowed by offer".into(),
                ));
            }
            if let Some(required_evidence) = required_offline_evidence
                && milestone.evidence_format != required_evidence
            {
                return Err((
                    InvalidReasonCode::PolicyViolation,
                    format!(
                        "templated lane `{}` requires milestone evidenceFormat `{required_evidence}`",
                        offer.service_type
                    ),
                ));
            }
            milestone_specs.insert(
                milestone.milestone_id.clone(),
                crate::model::ReplayMilestoneSpecRecord {
                    milestone_id: milestone.milestone_id.clone(),
                    amount_credits: milestone.amount_credits,
                    evidence_format: milestone.evidence_format.clone(),
                },
            );
            self.milestones.insert(
                milestone_key(&payload.order_id, &milestone.milestone_id),
                ReplayMilestoneRecord {
                    order_id: payload.order_id.clone(),
                    milestone_id: milestone.milestone_id.clone(),
                    amount_credits: milestone.amount_credits,
                    evidence_format: milestone.evidence_format.clone(),
                    funded_amount: 0,
                    funded_spend_event_ids: Vec::new(),
                    status: "Open".into(),
                    delivery_event_id: None,
                    dispute_event_id: None,
                    settlement_event_id: None,
                    settlement_pending_event_id: None,
                    pending_settlement_author: None,
                    pending_settlement_outcome: None,
                    pending_buyer_refund_credits: None,
                    pending_provider_reward_credits: None,
                    disputed_at: None,
                    dispute_timeout_at: None,
                    buyer_refund_credits: None,
                    provider_reward_credits: None,
                },
            );
        }

        self.orders.insert(
            payload.order_id.clone(),
            ReplayOrderRecord {
                order_id: payload.order_id.clone(),
                offer_id: payload.offer_id.clone(),
                provider_pub_key: provider_root,
                buyer_pub_key: buyer_root,
                order_expires_at,
                milestones: milestone_specs,
                created_event_id: event.event_id.clone(),
            },
        );
        Ok(())
    }

    fn apply_service_delivery(
        &mut self,
        event: &Event,
        payload: &ServiceDeliveryPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let provider_root = self.require_active_identity(&event.author_pub_key)?;
        let delivered_at = parse_timestamp(&payload.delivered_at).map_err(|_| {
            (
                InvalidReasonCode::BadTimestamp,
                "invalid deliveredAt".into(),
            )
        })?;
        if delivered_at < event_time {
            return Err((
                InvalidReasonCode::BadTimestamp,
                "deliveredAt cannot be earlier than createdAt".into(),
            ));
        }

        let order_reference = event
            .references
            .as_ref()
            .and_then(|refs| refs.get("order"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing order reference".into(),
                )
            })?;
        let order = self.orders.get(&payload.order_id).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "order does not exist".into(),
            )
        })?;
        let service_type = self.service_type_for_order(order)?;
        if &order.created_event_id != order_reference {
            return Err((
                InvalidReasonCode::MissingReference,
                "order reference does not match order state".into(),
            ));
        }
        if order.provider_pub_key != provider_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "only order provider may deliver".into(),
            ));
        }
        let spec = order.milestones.get(&payload.milestone_id).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "milestone does not exist in order".into(),
            )
        })?;
        if spec.evidence_format != payload.evidence_format {
            return Err((
                InvalidReasonCode::InvalidPayload,
                "evidenceFormat does not match milestone".into(),
            ));
        }
        if let Some(required_evidence) = required_evidence_format_for_templated_service(&service_type)
            && payload.evidence_format != required_evidence
        {
            return Err((
                InvalidReasonCode::PolicyViolation,
                format!(
                    "templated lane `{service_type}` requires delivery evidenceFormat `{required_evidence}`"
                ),
            ));
        }
        if service_type == protocol_core::SERVICE_TYPE_COMPUTE_JOB {
            let artifact_hashes = payload.artifact_hashes.as_ref().ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_JOB_RECEIPT_V1}` delivery requires at least one artifact hash"
                    ),
                )
            })?;
            if artifact_hashes.is_empty() {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_JOB_RECEIPT_V1}` delivery requires at least one artifact hash"
                    ),
                ));
            }
            let unique = artifact_hashes.iter().collect::<BTreeSet<_>>();
            if unique.len() != artifact_hashes.len() {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_JOB_RECEIPT_V1}` delivery artifactHashes must be unique"
                    ),
                ));
            }
            if payload
                .notes_hash
                .as_ref()
                .map_or(true, |value| value.trim().is_empty())
            {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!("`{EVIDENCE_FORMAT_JOB_RECEIPT_V1}` delivery requires notesHash"),
                ));
            }
        }
        if service_type == protocol_core::SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE
            && payload
                .artifact_hashes
                .as_ref()
                .map_or(true, |hashes| hashes.is_empty())
        {
            return Err((
                InvalidReasonCode::InvalidPayload,
                format!(
                    "`{EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1}` delivery requires at least one artifact hash"
                ),
            ));
        }
        if service_type == protocol_core::SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE {
            let artifact_hashes = payload.artifact_hashes.as_ref().ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1}` delivery requires at least one artifact hash"
                    ),
                )
            })?;
            let unique = artifact_hashes.iter().collect::<BTreeSet<_>>();
            if unique.len() != artifact_hashes.len() {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1}` delivery artifactHashes must be unique"
                    ),
                ));
            }
            if payload
                .notes_hash
                .as_ref()
                .map_or(true, |value| value.trim().is_empty())
            {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1}` delivery requires notesHash"
                    ),
                ));
            }
        }
        if service_type == protocol_core::SERVICE_TYPE_PHYSICAL_HANDOFF {
            let artifact_hashes = payload.artifact_hashes.as_ref().ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1}` delivery requires exactly two artifact hashes"
                    ),
                )
            })?;
            if artifact_hashes.len() != 2 {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1}` delivery requires exactly two artifact hashes"
                    ),
                ));
            }
            if artifact_hashes[0] == artifact_hashes[1] {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1}` delivery requires distinct provider/buyer artifact hashes"
                    ),
                ));
            }
            if payload
                .notes_hash
                .as_ref()
                .map_or(true, |value| value.trim().is_empty())
            {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1}` delivery requires notesHash"
                    ),
                ));
            }
            if payload.urls.as_ref().is_some_and(|urls| !urls.is_empty()) {
                return Err((
                    InvalidReasonCode::InvalidPayload,
                    format!(
                        "`{EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1}` delivery must not include urls"
                    ),
                ));
            }
        }
        let key = milestone_key(&payload.order_id, &payload.milestone_id);
        let milestone = self.milestones.get_mut(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "milestone state is missing".into(),
            )
        })?;
        if milestone.status != "Funded" {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "milestone must be Funded before delivery".into(),
            ));
        }
        milestone.status = "Delivered".into();
        milestone.delivery_event_id = Some(event.event_id.clone());
        Ok(())
    }

    fn apply_service_accept(
        &mut self,
        event: &Event,
        payload: &ServiceAcceptPayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let (acceptance_window_seconds, provider_reward_expiry_days, demurrage_rate_weekly_bps) = {
            let policy = self.effective_policy_for_time(event_time).0;
            (
                policy.acceptance_window_seconds,
                policy.provider_reward_expiry_days,
                policy.demurrage_rate_weekly_bps,
            )
        };
        let buyer_root = self.require_active_identity(&event.author_pub_key)?;
        let accepted_at = parse_timestamp(&payload.accepted_at)
            .map_err(|_| (InvalidReasonCode::BadTimestamp, "invalid acceptedAt".into()))?;
        let delivery_reference = event
            .references
            .as_ref()
            .and_then(|refs| refs.get("delivery"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing delivery reference".into(),
                )
            })?;
        let delivery_event = self.valid_events.get(delivery_reference).ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                "delivery reference event does not exist".into(),
            )
        })?;
        let delivered_at = parse_timestamp(&delivery_event.created_at).map_err(|_| {
            (
                InvalidReasonCode::BadTimestamp,
                "invalid delivery timestamp".into(),
            )
        })?;
        if event_time > delivered_at + Duration::seconds(acceptance_window_seconds) {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "acceptance window has expired".into(),
            ));
        }
        let order = self.orders.get(&payload.order_id).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "order does not exist".into(),
            )
        })?;
        let service_type = self.service_type_for_order(order)?;
        if service_type == protocol_core::SERVICE_TYPE_PHYSICAL_HANDOFF
            && accepted_at < delivered_at
        {
            return Err((
                InvalidReasonCode::BadTimestamp,
                "acceptedAt cannot be earlier than deliveredAt for physical-handoff lane".into(),
            ));
        }
        let provider_pub_key = order.provider_pub_key.clone();
        if order.buyer_pub_key != buyer_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "only order buyer may accept delivery".into(),
            ));
        }
        let issuance_counterparties = BTreeSet::from([buyer_root.clone()]);
        self.enforce_issuance_controls(
            &provider_pub_key,
            &service_type,
            &issuance_counterparties,
            event_time,
        )?;
        self.enforce_economic_eligibility(&provider_pub_key, Some(&service_type), event_time)?;
        let key = milestone_key(&payload.order_id, &payload.milestone_id);
        let funded_amount = {
            let milestone = self.milestones.get_mut(&key).ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "milestone state is missing".into(),
                )
            })?;
            if milestone.status != "Delivered" {
                return Err((
                    InvalidReasonCode::InvalidStateTransition,
                    "milestone is not in Delivered state".into(),
                ));
            }
            if milestone.delivery_event_id.as_deref() != Some(delivery_reference) {
                return Err((
                    InvalidReasonCode::MissingReference,
                    "delivery reference does not match milestone".into(),
                ));
            }
            milestone.status = "Accepted".into();
            milestone.settlement_event_id = Some(event.event_id.clone());
            milestone.provider_reward_credits = Some(milestone.funded_amount);
            milestone.buyer_refund_credits = Some(0);
            milestone.funded_amount
        };

        self.normalize_lots(&provider_pub_key, event_time);
        let provider_lot_expiry = event_time + Duration::days(provider_reward_expiry_days);
        self.lots
            .entry(provider_pub_key.clone())
            .or_default()
            .push(ReplayLotRecord {
                amount: funded_amount,
                remaining_amount: funded_amount,
                minted_at: event_time,
                expires_at: provider_lot_expiry,
                source_event_id: event.event_id.clone(),
                last_decay_at: event_time,
                demurrage_rate_weekly_bps,
            });
        self.record_issuance(
            &provider_pub_key,
            &service_type,
            &issuance_counterparties,
            event_time,
            &event.event_id,
        );
        self.record_reputation_delta(
            &provider_pub_key,
            Some(&service_type),
            event_time,
            &event.event_id,
            "ServiceAccept.provider",
            ReputationDeltaState {
                provider_accepts_delta: 1,
                ..ReputationDeltaState::default()
            },
        );
        self.record_reputation_delta(
            &buyer_root,
            Some(&service_type),
            event_time,
            &event.event_id,
            "ServiceAccept.buyer",
            ReputationDeltaState {
                buyer_accepts_delta: 1,
                ..ReputationDeltaState::default()
            },
        );
        Ok(())
    }

    fn apply_service_dispute(
        &mut self,
        event: &Event,
        payload: &ServiceDisputePayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let (acceptance_window_seconds, dispute_timeout_seconds) = {
            let policy = self.effective_policy_for_time(event_time).0;
            (
                policy.acceptance_window_seconds,
                policy.dispute_timeout_seconds,
            )
        };
        let buyer_root = self.require_active_identity(&event.author_pub_key)?;
        let disputed_at = parse_timestamp(&payload.disputed_at)
            .map_err(|_| (InvalidReasonCode::BadTimestamp, "invalid disputedAt".into()))?;
        let delivery_reference = event
            .references
            .as_ref()
            .and_then(|refs| refs.get("delivery"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing delivery reference".into(),
                )
            })?;
        let delivery_event = self.valid_events.get(delivery_reference).ok_or_else(|| {
            (
                InvalidReasonCode::MissingReference,
                "delivery reference event does not exist".into(),
            )
        })?;
        let delivered_at = parse_timestamp(&delivery_event.created_at).map_err(|_| {
            (
                InvalidReasonCode::BadTimestamp,
                "invalid delivery timestamp".into(),
            )
        })?;
        if disputed_at > delivered_at + Duration::seconds(acceptance_window_seconds) {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "dispute is outside acceptance window".into(),
            ));
        }
        let order = self.orders.get(&payload.order_id).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "order does not exist".into(),
            )
        })?;
        let service_type = self.service_type_for_order(order)?;
        let provider_pub_key = order.provider_pub_key.clone();
        if order.buyer_pub_key != buyer_root {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "only order buyer may dispute".into(),
            ));
        }
        let key = milestone_key(&payload.order_id, &payload.milestone_id);
        let milestone = self.milestones.get_mut(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "milestone state is missing".into(),
            )
        })?;
        if milestone.status != "Delivered" {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "milestone is not in Delivered state".into(),
            ));
        }
        if milestone.delivery_event_id.as_deref() != Some(delivery_reference) {
            return Err((
                InvalidReasonCode::MissingReference,
                "delivery reference does not match milestone".into(),
            ));
        }
        milestone.status = "Disputed".into();
        milestone.dispute_event_id = Some(event.event_id.clone());
        milestone.disputed_at = Some(disputed_at);
        milestone.dispute_timeout_at =
            Some(disputed_at + Duration::seconds(dispute_timeout_seconds));
        self.record_reputation_delta(
            &provider_pub_key,
            Some(&service_type),
            event_time,
            &event.event_id,
            "ServiceDispute.provider",
            ReputationDeltaState {
                disputes_against_delta: 1,
                ..ReputationDeltaState::default()
            },
        );
        Ok(())
    }

    fn apply_service_settle(
        &mut self,
        event: &Event,
        payload: &ServiceSettlePayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let (credit_default_expiry_days, provider_reward_expiry_days, demurrage_rate_weekly_bps) = {
            let policy = self.effective_policy_for_time(event_time).0;
            (
                policy.credit_default_expiry_days,
                policy.provider_reward_expiry_days,
                policy.demurrage_rate_weekly_bps,
            )
        };
        let actor = self.require_active_identity(&event.author_pub_key)?;
        let _settled_at = parse_timestamp(&payload.settled_at)
            .map_err(|_| (InvalidReasonCode::BadTimestamp, "invalid settledAt".into()))?;
        let dispute_reference = event
            .references
            .as_ref()
            .and_then(|refs| refs.get("dispute"))
            .ok_or_else(|| {
                (
                    InvalidReasonCode::MissingReference,
                    "missing dispute reference".into(),
                )
            })?;
        let order = self.orders.get(&payload.order_id).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "order does not exist".into(),
            )
        })?;
        let service_type = self.service_type_for_order(order)?;
        let buyer_pub_key = order.buyer_pub_key.clone();
        let provider_pub_key = order.provider_pub_key.clone();
        if actor != order.buyer_pub_key && actor != order.provider_pub_key {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "settlement actor must be buyer or provider".into(),
            ));
        }
        let key = milestone_key(&payload.order_id, &payload.milestone_id);
        let milestone_snapshot = self.milestones.get(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "milestone state is missing".into(),
            )
        })?;
        if milestone_snapshot.dispute_event_id.as_deref() != Some(dispute_reference) {
            return Err((
                InvalidReasonCode::MissingReference,
                "dispute reference does not match milestone".into(),
            ));
        }
        if !matches!(
            milestone_snapshot.status.as_str(),
            "Disputed" | "SettlementPending"
        ) {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "milestone is not disputable for settlement".into(),
            ));
        }
        let funded_amount = milestone_snapshot.funded_amount;
        if payload
            .buyer_refund_credits
            .saturating_add(payload.provider_reward_credits)
            != funded_amount
        {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "settlement amounts must sum to milestone funded amount".into(),
            ));
        }

        if milestone_snapshot.status == "Disputed" {
            let milestone = self.milestones.get_mut(&key).ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "milestone state is missing".into(),
                )
            })?;
            milestone.status = "SettlementPending".into();
            milestone.settlement_pending_event_id = Some(event.event_id.clone());
            milestone.pending_settlement_author = Some(actor);
            milestone.pending_settlement_outcome = Some(match payload.outcome {
                ServiceSettleOutcome::BuyerWins => "buyerWins".into(),
                ServiceSettleOutcome::Split => "split".into(),
            });
            milestone.pending_buyer_refund_credits = Some(payload.buyer_refund_credits);
            milestone.pending_provider_reward_credits = Some(payload.provider_reward_credits);
            return Ok(());
        }

        let pending_author = milestone_snapshot
            .pending_settlement_author
            .clone()
            .ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "pending settlement author missing".into(),
                )
            })?;
        if pending_author == actor {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "second settlement must come from counterparty".into(),
            ));
        }
        let expected_outcome = milestone_snapshot
            .pending_settlement_outcome
            .clone()
            .ok_or_else(|| {
                (
                    InvalidReasonCode::InvalidStateTransition,
                    "pending settlement outcome missing".into(),
                )
            })?;
        let outcome = match payload.outcome {
            ServiceSettleOutcome::BuyerWins => "buyerWins",
            ServiceSettleOutcome::Split => "split",
        };
        if expected_outcome != outcome
            || milestone_snapshot.pending_buyer_refund_credits != Some(payload.buyer_refund_credits)
            || milestone_snapshot.pending_provider_reward_credits
                != Some(payload.provider_reward_credits)
        {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "settlement handshake does not match pending proposal".into(),
            ));
        }

        let provider_counterparties = BTreeSet::from([buyer_pub_key.clone()]);
        if payload.provider_reward_credits > 0 {
            self.enforce_issuance_controls(
                &provider_pub_key,
                &service_type,
                &provider_counterparties,
                event_time,
            )?;
            self.enforce_economic_eligibility(&provider_pub_key, Some(&service_type), event_time)?;
        }

        let milestone = self.milestones.get_mut(&key).ok_or_else(|| {
            (
                InvalidReasonCode::InvalidStateTransition,
                "milestone state is missing".into(),
            )
        })?;
        milestone.status = "Settled".into();
        milestone.settlement_event_id = Some(event.event_id.clone());
        milestone.settlement_pending_event_id = None;
        milestone.pending_settlement_author = None;
        milestone.pending_settlement_outcome = None;
        milestone.pending_buyer_refund_credits = None;
        milestone.pending_provider_reward_credits = None;
        milestone.buyer_refund_credits = Some(payload.buyer_refund_credits);
        milestone.provider_reward_credits = Some(payload.provider_reward_credits);

        if payload.buyer_refund_credits > 0 {
            self.normalize_lots(&buyer_pub_key, event_time);
            self.lots
                .entry(buyer_pub_key.clone())
                .or_default()
                .push(ReplayLotRecord {
                    amount: payload.buyer_refund_credits,
                    remaining_amount: payload.buyer_refund_credits,
                    minted_at: event_time,
                    expires_at: event_time + Duration::days(credit_default_expiry_days),
                    source_event_id: event.event_id.clone(),
                    last_decay_at: event_time,
                    demurrage_rate_weekly_bps,
                });
        }
        if payload.provider_reward_credits > 0 {
            self.normalize_lots(&provider_pub_key, event_time);
            self.lots
                .entry(provider_pub_key.clone())
                .or_default()
                .push(ReplayLotRecord {
                    amount: payload.provider_reward_credits,
                    remaining_amount: payload.provider_reward_credits,
                    minted_at: event_time,
                    expires_at: event_time + Duration::days(provider_reward_expiry_days),
                    source_event_id: event.event_id.clone(),
                    last_decay_at: event_time,
                    demurrage_rate_weekly_bps,
                });
            self.record_issuance(
                &provider_pub_key,
                &service_type,
                &provider_counterparties,
                event_time,
                &event.event_id,
            );
        }
        match payload.outcome {
            ServiceSettleOutcome::BuyerWins => {
                self.record_reputation_delta(
                    &buyer_pub_key,
                    Some(&service_type),
                    event_time,
                    &event.event_id,
                    "ServiceSettle.buyerWins.buyer",
                    ReputationDeltaState {
                        refund_wins_delta: 1,
                        ..ReputationDeltaState::default()
                    },
                );
                self.record_reputation_delta(
                    &provider_pub_key,
                    Some(&service_type),
                    event_time,
                    &event.event_id,
                    "ServiceSettle.buyerWins.provider",
                    ReputationDeltaState {
                        refund_losses_delta: 1,
                        ..ReputationDeltaState::default()
                    },
                );
            }
            ServiceSettleOutcome::Split => {
                self.record_reputation_delta(
                    &buyer_pub_key,
                    Some(&service_type),
                    event_time,
                    &event.event_id,
                    "ServiceSettle.split.buyer",
                    ReputationDeltaState {
                        split_settles_delta: 1,
                        ..ReputationDeltaState::default()
                    },
                );
                self.record_reputation_delta(
                    &provider_pub_key,
                    Some(&service_type),
                    event_time,
                    &event.event_id,
                    "ServiceSettle.split.provider",
                    ReputationDeltaState {
                        split_settles_delta: 1,
                        ..ReputationDeltaState::default()
                    },
                );
            }
        }
        Ok(())
    }

    fn apply_policy_update(
        &mut self,
        event: &Event,
        payload: &PolicyUpdatePayload,
        event_time: DateTime<Utc>,
    ) -> Result<(), (InvalidReasonCode, String)> {
        let current_policy = self.effective_policy_for_time(event_time).0;
        if event.author_pub_key != current_policy.policy_authority_pub_key {
            return Err((
                InvalidReasonCode::UnauthorizedActor,
                "only the current policy authority may publish PolicyUpdate".into(),
            ));
        }

        let effective_at = parse_timestamp(&payload.effective_at).map_err(|_| {
            (
                InvalidReasonCode::BadTimestamp,
                "invalid effectiveAt".into(),
            )
        })?;
        if effective_at <= event_time {
            return Err((
                InvalidReasonCode::PolicyViolation,
                "effectiveAt must be later than createdAt".into(),
            ));
        }
        if self.policy_versions.contains(&payload.next_policy_version) {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "policy version already exists".into(),
            ));
        }
        if let Some(last) = self.policy_updates.last()
            && effective_at <= last.effective_at
        {
            return Err((
                InvalidReasonCode::InvalidStateTransition,
                "policy effectiveAt must be strictly increasing".into(),
            ));
        }

        let policy = policy_from_snapshot_payload(&payload.policy).map_err(|message| {
            (
                InvalidReasonCode::InvalidPayload,
                format!("invalid policy snapshot: {message}"),
            )
        })?;
        if policy.version != payload.next_policy_version {
            return Err((
                InvalidReasonCode::InvalidPayload,
                "nextPolicyVersion must match policy.version".into(),
            ));
        }

        self.policy_updates.push(ReplayPolicyUpdateRecord {
            event_id: event.event_id.clone(),
            created_at: event_time,
            effective_at,
            version: payload.next_policy_version.clone(),
            policy,
        });
        self.policy_versions
            .insert(payload.next_policy_version.clone());
        Ok(())
    }

    fn auto_refund_disputed_milestones(&mut self, final_time: DateTime<Utc>) {
        let keys = self.milestones.keys().cloned().collect::<Vec<_>>();
        for key in keys {
            let Some(milestone_snapshot) = self.milestones.get(&key).cloned() else {
                continue;
            };
            if milestone_snapshot.status != "Disputed"
                && milestone_snapshot.status != "SettlementPending"
            {
                continue;
            }
            let Some(disputed_at) = milestone_snapshot.disputed_at else {
                continue;
            };
            let timeout_at = milestone_snapshot.dispute_timeout_at.unwrap_or(disputed_at);
            if final_time < timeout_at {
                continue;
            }
            let Some(order) = self.orders.get(&milestone_snapshot.order_id) else {
                continue;
            };
            let Ok(service_type) = self.service_type_for_order(order) else {
                continue;
            };
            let buyer_pub_key = order.buyer_pub_key.clone();
            let provider_pub_key = order.provider_pub_key.clone();
            let refund_amount = milestone_snapshot.funded_amount;
            let (credit_default_expiry_days, demurrage_rate_weekly_bps) = {
                let policy = self.effective_policy_for_time(timeout_at).0;
                (
                    policy.credit_default_expiry_days,
                    policy.demurrage_rate_weekly_bps,
                )
            };
            let Some(milestone) = self.milestones.get_mut(&key) else {
                continue;
            };
            milestone.status = "AutoRefunded".into();
            milestone.buyer_refund_credits = Some(refund_amount);
            milestone.provider_reward_credits = Some(0);
            milestone.settlement_pending_event_id = None;
            milestone.pending_settlement_author = None;
            milestone.pending_settlement_outcome = None;
            milestone.pending_buyer_refund_credits = None;
            milestone.pending_provider_reward_credits = None;
            self.normalize_lots(&buyer_pub_key, final_time);
            self.lots
                .entry(buyer_pub_key.clone())
                .or_default()
                .push(ReplayLotRecord {
                    amount: refund_amount,
                    remaining_amount: refund_amount,
                    minted_at: timeout_at,
                    expires_at: timeout_at + Duration::days(credit_default_expiry_days),
                    source_event_id: format!("auto-refund:{}", key),
                    last_decay_at: timeout_at,
                    demurrage_rate_weekly_bps,
                });
            let synthetic_event_id = format!("auto-refund:{}", key);
            self.record_reputation_delta(
                &provider_pub_key,
                Some(&service_type),
                timeout_at,
                &synthetic_event_id,
                "AutoRefunded.provider",
                ReputationDeltaState {
                    refund_losses_delta: 1,
                    ..ReputationDeltaState::default()
                },
            );
            self.record_reputation_delta(
                &buyer_pub_key,
                Some(&service_type),
                timeout_at,
                &synthetic_event_id,
                "AutoRefunded.buyer",
                ReputationDeltaState {
                    refund_wins_delta: 1,
                    ..ReputationDeltaState::default()
                },
            );
        }
    }

    fn normalize_lots(&mut self, identity_root: &str, event_time: DateTime<Utc>) {
        let Some(lots) = self.lots.get_mut(identity_root) else {
            return;
        };
        lots.retain_mut(|lot| {
            if event_time >= lot.expires_at {
                return false;
            }

            let elapsed = event_time.signed_duration_since(lot.last_decay_at);
            let weeks = elapsed.num_seconds() / Duration::weeks(1).num_seconds();
            if weeks > 0 {
                let decay_factor = 10_000_u64.saturating_sub(lot.demurrage_rate_weekly_bps);
                for _ in 0..weeks {
                    lot.remaining_amount =
                        lot.remaining_amount.saturating_mul(decay_factor) / 10_000;
                }
                lot.last_decay_at += Duration::weeks(weeks);
            }
            lot.remaining_amount > 0
        });
    }

    fn require_active_identity(
        &self,
        active_pub_key: &str,
    ) -> Result<String, (InvalidReasonCode, String)> {
        self.active_to_root
            .get(active_pub_key)
            .cloned()
            .ok_or_else(|| {
                (
                    InvalidReasonCode::UnauthorizedActor,
                    "author is not an active identity".into(),
                )
            })
    }

    fn resolve_existing_root(&self, pub_key: &str) -> Result<String, (InvalidReasonCode, String)> {
        if let Some(root) = self.active_to_root.get(pub_key) {
            return Ok(root.clone());
        }
        if self.identities.contains_key(pub_key) {
            return Ok(pub_key.to_string());
        }
        Err((
            InvalidReasonCode::InvalidStateTransition,
            format!("identity `{pub_key}` does not exist"),
        ))
    }

    fn incoming_vouch_score(&self, subject_root: &str, event_time: DateTime<Utc>) -> usize {
        self.vouches
            .values()
            .filter(|record| {
                !record.revoked
                    && record.subject_root == subject_root
                    && !is_vouch_expired(record, event_time)
            })
            .map(|record| record.weight as usize)
            .sum()
    }

    fn into_replay_run(mut self) -> ReplayRunOutput {
        let final_time = self.last_event_time.unwrap_or(self.now);
        self.auto_refund_disputed_milestones(self.now);
        let balance_keys = self.lots.keys().cloned().collect::<Vec<_>>();
        for identity_root in balance_keys {
            self.normalize_lots(&identity_root, final_time);
        }
        self.reputation_history.sort_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.event_id.cmp(&right.event_id))
                .then_with(|| left.identity_pub_key.cmp(&right.identity_pub_key))
                .then_with(|| left.lane.cmp(&right.lane))
                .then_with(|| left.reason.cmp(&right.reason))
        });

        let identities = self
            .identities
            .iter()
            .map(|(root, record)| {
                (
                    root.clone(),
                    IdentityState {
                        identity_pub_key: record.root_pub_key.clone(),
                        active_pub_key: record.active_pub_key.clone(),
                        status: if record.root_pub_key == record.active_pub_key {
                            "active".into()
                        } else {
                            "rotated".into()
                        },
                        metadata: record.metadata.clone(),
                        recovery_policy_hash: record.recovery_policy_hash.clone(),
                    },
                )
            })
            .collect();
        let mut vouches = self
            .vouches
            .values()
            .map(|record| VouchEdgeState {
                voucher_pub_key: record.voucher_root.clone(),
                subject_pub_key: record.subject_root.clone(),
                status: if record.revoked {
                    "revoked".into()
                } else if is_vouch_expired(record, final_time) {
                    "expired".into()
                } else {
                    "active".into()
                },
                weight: record.weight,
                expires_at: record.expires_at.map(|timestamp| timestamp.to_rfc3339()),
            })
            .collect::<Vec<_>>();
        vouches.sort_by(|left, right| {
            left.voucher_pub_key
                .cmp(&right.voucher_pub_key)
                .then_with(|| left.subject_pub_key.cmp(&right.subject_pub_key))
        });

        let claims = self
            .claims
            .iter()
            .map(|(key, claim)| {
                (
                    key.clone(),
                    ClaimState {
                        claim_key: key.clone(),
                        claimant_pub_key: claim.claimant_root.clone(),
                        beneficiary_pub_key: claim.beneficiary_root.clone(),
                        claim_id: claim.claim_id.clone(),
                        claim_type: claim.claim_type.clone(),
                        artifact_hash: claim.artifact_hash.clone(),
                        summary: claim.summary.clone(),
                        requested_credits: claim.requested_credits,
                        approvals: claim.approvals.clone(),
                        rejections: claim.rejections.clone(),
                        minted: claim.minted,
                    },
                )
            })
            .collect();

        let balances = self
            .lots
            .iter()
            .map(|(identity_root, lots)| {
                let serialized_lots = lots
                    .iter()
                    .map(|lot| CreditLotState {
                        amount: lot.amount,
                        remaining_amount: lot.remaining_amount,
                        minted_at: lot.minted_at.to_rfc3339(),
                        expires_at: lot.expires_at.to_rfc3339(),
                        source_event_id: lot.source_event_id.clone(),
                        demurrage_rate_weekly_bps: lot.demurrage_rate_weekly_bps,
                    })
                    .collect::<Vec<_>>();
                let effective_balance =
                    serialized_lots.iter().map(|lot| lot.remaining_amount).sum();
                (
                    identity_root.clone(),
                    CreditBalanceState {
                        identity_pub_key: identity_root.clone(),
                        effective_balance,
                        lots: serialized_lots,
                    },
                )
            })
            .collect();

        let mut reputation_keys = BTreeSet::new();
        reputation_keys.extend(self.identities.keys().cloned());
        reputation_keys.extend(self.reputations.keys().cloned());
        for edge in self.vouches.values() {
            reputation_keys.insert(edge.subject_root.clone());
        }

        let reputations = reputation_keys
            .into_iter()
            .map(|identity_root| {
                let trust_weight = self.incoming_vouch_score(&identity_root, self.now) as i64;
                let accumulator = self
                    .reputations
                    .get(&identity_root)
                    .cloned()
                    .unwrap_or_default();
                let contribution = contribution_score_from_accumulator(&accumulator);
                let marketplace = marketplace_score_from_accumulator(&accumulator);
                let global = global_score_from_accumulator(trust_weight, &accumulator);
                let lanes = accumulator
                    .lanes
                    .iter()
                    .map(|(service_type, lane)| {
                        (
                            service_type.clone(),
                            LaneReputationState {
                                service_type: service_type.clone(),
                                score: lane_score_from_accumulator(lane),
                                provider_accepts: lane.provider_accepts,
                                buyer_accepts: lane.buyer_accepts,
                                split_settles: lane.split_settles,
                                refund_wins: lane.refund_wins,
                                refund_losses: lane.refund_losses,
                                disputes_against: lane.disputes_against,
                            },
                        )
                    })
                    .collect::<BTreeMap<_, _>>();
                (
                    identity_root.clone(),
                    ReputationState {
                        identity_pub_key: identity_root,
                        global_score: global,
                        trust_score: trust_weight,
                        contribution_score: contribution,
                        marketplace_score: marketplace,
                        components: ReputationComponentsState {
                            trust_weight,
                            claim_approvals: accumulator.claim_approvals,
                            claim_rejections: accumulator.claim_rejections,
                            contribution_mints: accumulator.contribution_mints,
                            provider_accepts: accumulator.provider_accepts,
                            buyer_accepts: accumulator.buyer_accepts,
                            split_settles: accumulator.split_settles,
                            refund_wins: accumulator.refund_wins,
                            refund_losses: accumulator.refund_losses,
                            disputes_against: accumulator.disputes_against,
                        },
                        lanes,
                    },
                )
            })
            .collect::<BTreeMap<_, _>>();

        let reputation_history = self
            .reputation_history
            .iter()
            .map(|entry| ReputationHistoryEntry {
                event_id: entry.event_id.clone(),
                created_at: entry.created_at.to_rfc3339(),
                identity_pub_key: entry.identity_pub_key.clone(),
                lane: entry.lane.clone(),
                reason: entry.reason.clone(),
                delta: entry.delta.clone(),
                global_score_delta: entry.global_score_delta,
                lane_score_delta: entry.lane_score_delta,
            })
            .collect::<Vec<_>>();

        let (effective_policy, effective_update) = self.effective_policy_at_now();
        let effective_policy_version = effective_policy.version.clone();
        let effective_policy_effective_at = effective_update.map(|update| update.effective_at);
        let effective_policy_last_update_event_id =
            effective_update.map(|update| update.event_id.clone());
        let effective_policy_effective_label = effective_policy_effective_at
            .map(|timestamp| timestamp.to_rfc3339())
            .unwrap_or_else(|| "genesis".to_string());
        let effective_policy_authority_pub_key = effective_policy.policy_authority_pub_key.clone();
        let effective_policy_snapshot = effective_policy.clone();
        let policy_updates = self
            .policy_updates
            .iter()
            .map(|update| PolicyUpdateState {
                event_id: update.event_id.clone(),
                created_at: update.created_at.to_rfc3339(),
                effective_at: update.effective_at.to_rfc3339(),
                version: update.version.clone(),
                policy: update.policy.clone(),
            })
            .collect::<Vec<_>>();
        let policy_state = PolicyState {
            effective_version: effective_policy_version.clone(),
            effective_at: effective_policy_effective_label,
            policy_authority_pub_key: effective_policy_authority_pub_key,
            last_update_event_id: effective_policy_last_update_event_id.clone(),
            update_count: self.policy_updates.len(),
            policy: effective_policy_snapshot,
        };

        let offers = self
            .offers
            .iter()
            .map(|(offer_id, record)| {
                (
                    offer_id.clone(),
                    OfferState {
                        offer_id: record.offer_id.clone(),
                        provider_pub_key: record.provider_pub_key.clone(),
                        service_type: record.service_type.clone(),
                        unit_definition: record.unit_definition.clone(),
                        price_per_unit_credits: record.price_per_unit_credits,
                        delivery_mode: record.delivery_mode.clone(),
                        offer_expires_at: record.offer_expires_at.to_rfc3339(),
                        terms_hash: record.terms_hash.clone(),
                        allowed_evidence_formats: record.allowed_evidence_formats.clone(),
                        status: if record.offer_expires_at <= final_time {
                            "expired".into()
                        } else {
                            "active".into()
                        },
                        created_event_id: record.created_event_id.clone(),
                    },
                )
            })
            .collect();

        let orders = self
            .orders
            .iter()
            .map(|(order_id, record)| {
                let milestone_ids = record.milestones.keys().cloned().collect::<Vec<_>>();
                let status = if milestone_ids.iter().all(|milestone_id| {
                    self.milestones
                        .get(&milestone_key(order_id, milestone_id))
                        .map(|milestone| {
                            matches!(
                                milestone.status.as_str(),
                                "Accepted" | "Settled" | "AutoRefunded"
                            )
                        })
                        .unwrap_or(false)
                }) {
                    "closed".to_string()
                } else {
                    "open".to_string()
                };
                (
                    order_id.clone(),
                    OrderState {
                        order_id: record.order_id.clone(),
                        offer_id: record.offer_id.clone(),
                        provider_pub_key: record.provider_pub_key.clone(),
                        buyer_pub_key: record.buyer_pub_key.clone(),
                        order_expires_at: record.order_expires_at.to_rfc3339(),
                        milestone_ids,
                        status,
                        created_event_id: record.created_event_id.clone(),
                    },
                )
            })
            .collect();

        let milestones = self
            .milestones
            .iter()
            .map(|(key, record)| {
                (
                    key.clone(),
                    MilestoneState {
                        order_id: record.order_id.clone(),
                        milestone_id: record.milestone_id.clone(),
                        amount_credits: record.amount_credits,
                        evidence_format: record.evidence_format.clone(),
                        status: record.status.clone(),
                        funded_amount: record.funded_amount,
                        funded_spend_event_ids: record.funded_spend_event_ids.clone(),
                        delivery_event_id: record.delivery_event_id.clone(),
                        dispute_event_id: record.dispute_event_id.clone(),
                        settlement_event_id: record.settlement_event_id.clone(),
                        settlement_pending_event_id: record.settlement_pending_event_id.clone(),
                        dispute_timeout_at: record
                            .dispute_timeout_at
                            .map(|timestamp| timestamp.to_rfc3339()),
                        buyer_refund_credits: record.buyer_refund_credits,
                        provider_reward_credits: record.provider_reward_credits,
                    },
                )
            })
            .collect();

        let replay = ReplayOutput {
            state: DerivedState {
                identities,
                vouches,
                claims,
                balances,
                spend_records: self.spend_records.clone(),
                offers,
                orders,
                milestones,
                policy: policy_state,
                policy_updates,
                reputations,
                reputation_history,
            },
            invalid_events: self.invalid_events.clone(),
            applied_event_ids: self.applied_event_ids.clone(),
        };

        ReplayRunOutput {
            replay,
            checkpoint: ReplayCheckpoint {
                identities: self.identities,
                active_to_root: self.active_to_root,
                vouches: self.vouches,
                claims: self.claims,
                lots: self.lots,
                spend_records: self.spend_records,
                invalid_events: self.invalid_events,
                applied_event_ids: self.applied_event_ids,
                valid_events: self.valid_events,
                seen_event_ids: self.seen_event_ids,
                nonces: self.nonces,
                offers: self.offers,
                orders: self.orders,
                milestones: self.milestones,
                policy_updates: self.policy_updates,
                policy_versions: self.policy_versions,
                effective_policy_version: Some(effective_policy_version),
                effective_policy_effective_at,
                last_event_time: self.last_event_time,
                reputations: self.reputations,
                reputation_history: self.reputation_history,
                issuance_history: self.issuance_history,
            },
        }
    }
}

pub fn replay_jsonl(input: &str, policy: &Policy, now: DateTime<Utc>) -> ReplayOutput {
    let lines = input
        .lines()
        .enumerate()
        .map(|(index, line)| ReplayInputLine {
            line: index + 1,
            raw_json: line.to_string(),
        })
        .collect::<Vec<_>>();
    replay_jsonl_from_lines(&lines, policy, now)
}

pub fn replay_jsonl_from_lines(
    input: &[ReplayInputLine],
    policy: &Policy,
    now: DateTime<Utc>,
) -> ReplayOutput {
    replay_jsonl_resume(input, policy, now, None).replay
}

pub fn replay_jsonl_resume(
    input: &[ReplayInputLine],
    policy: &Policy,
    now: DateTime<Utc>,
    checkpoint: Option<ReplayCheckpoint>,
) -> ReplayRunOutput {
    let mut context = match checkpoint {
        Some(checkpoint) => ReplayContext::from_checkpoint(policy, now, checkpoint),
        None => ReplayContext::new(policy, now),
    };
    replay_lines(&mut context, input);
    context.into_replay_run()
}

pub fn replay_jsonl_from_lines_as_of(
    input: &[ReplayInputLine],
    policy: &Policy,
    as_of: Option<DateTime<Utc>>,
) -> ReplayOutput {
    replay_jsonl_from_lines(input, policy, as_of.unwrap_or_else(Utc::now))
}

pub fn replay_jsonl_resume_as_of(
    input: &[ReplayInputLine],
    policy: &Policy,
    as_of: Option<DateTime<Utc>>,
    checkpoint: Option<ReplayCheckpoint>,
) -> ReplayRunOutput {
    replay_jsonl_resume(input, policy, as_of.unwrap_or_else(Utc::now), checkpoint)
}

fn replay_lines(context: &mut ReplayContext<'_>, input: &[ReplayInputLine]) {
    let mut parsed = Vec::new();
    for line in input {
        let trimmed = line.raw_json.trim();
        if trimmed.is_empty() {
            continue;
        }

        match parse_raw_event_str(trimmed) {
            Ok(raw) => parsed.push(ParsedLine {
                line: line.line,
                raw,
            }),
            Err(error) => context.push_invalid(
                line.line,
                None,
                None,
                InvalidReasonCode::InvalidJson,
                error.to_string(),
            ),
        }
    }

    parsed.sort_by(|left, right| {
        left.raw
            .created_at
            .cmp(&right.raw.created_at)
            .then_with(|| left.raw.event_id.cmp(&right.raw.event_id))
            .then_with(|| left.line.cmp(&right.line))
    });

    for parsed_line in parsed {
        let raw = parsed_line.raw;
        let raw_event_id = raw.event_id.clone();
        let raw_kind = raw.kind.to_string();
        match raw.into_event() {
            Ok(event) => context.process_event(parsed_line.line, event),
            Err(error) => {
                let code = reason_code_for_protocol_error(&error);
                context.push_invalid(
                    parsed_line.line,
                    Some(raw_event_id),
                    Some(raw_kind),
                    code,
                    error.to_string(),
                );
            }
        }
    }
}

pub fn replay_jsonl_with_default_now(input: &str, policy: &Policy) -> ReplayOutput {
    replay_jsonl(input, policy, Utc::now())
}

pub fn replay_jsonl_as_of(
    input: &str,
    policy: &Policy,
    as_of: Option<DateTime<Utc>>,
) -> ReplayOutput {
    replay_jsonl(input, policy, as_of.unwrap_or_else(Utc::now))
}

/// Pure in-memory replay entrypoint for embeddable kernel use (no SQLite or filesystem).
pub fn replay_raw_events(
    raw_events: &[impl AsRef<str>],
    policy: &Policy,
    as_of: Option<DateTime<Utc>>,
) -> ReplayOutput {
    replay_raw_events_with_checkpoint(raw_events, policy, as_of, None).replay
}

/// In-memory replay with optional checkpoint resume.
pub fn replay_raw_events_with_checkpoint(
    raw_events: &[impl AsRef<str>],
    policy: &Policy,
    as_of: Option<DateTime<Utc>>,
    checkpoint: Option<ReplayCheckpoint>,
) -> ReplayRunOutput {
    let lines = raw_events
        .iter()
        .enumerate()
        .map(|(index, raw)| ReplayInputLine {
            line: index + 1,
            raw_json: raw.as_ref().to_string(),
        })
        .collect::<Vec<_>>();
    replay_jsonl_resume_as_of(&lines, policy, as_of, checkpoint)
}

pub fn inspect_identity(output: &ReplayOutput, identity_pub_key: &str) -> serde_json::Value {
    let root = output
        .state
        .identities
        .iter()
        .find_map(|(root, identity)| {
            if root == identity_pub_key || identity.active_pub_key == identity_pub_key {
                Some(root.clone())
            } else {
                None
            }
        })
        .unwrap_or_else(|| identity_pub_key.to_string());
    serde_json::json!({
        "identity": output.state.identities.get(&root),
        "balance": output.state.balances.get(&root),
        "claims": output.state.claims.values().filter(|claim| claim.claimant_pub_key == root || claim.beneficiary_pub_key == root).collect::<Vec<_>>(),
        "vouches": output.state.vouches.iter().filter(|edge| edge.voucher_pub_key == root || edge.subject_pub_key == root).collect::<Vec<_>>(),
        "reputation": output.state.reputations.get(&root),
        "reputationHistory": output.state.reputation_history.iter().filter(|entry| entry.identity_pub_key == root).collect::<Vec<_>>(),
    })
}

pub fn lot_to_public(lot: &CreditLot) -> CreditLotState {
    CreditLotState {
        amount: lot.amount,
        remaining_amount: lot.amount,
        minted_at: lot.minted_at.clone(),
        expires_at: lot.expires_at.clone(),
        source_event_id: lot.source_event_id.clone(),
        demurrage_rate_weekly_bps: policy::default_policy().demurrage_rate_weekly_bps,
    }
}

fn claim_key(claimant_root: &str, claim_id: &str) -> String {
    format!("{claimant_root}:{claim_id}")
}

fn vouch_key(voucher_root: &str, subject_root: &str) -> String {
    format!("{voucher_root}:{subject_root}")
}

fn nonce_key(spender_root: &str, sink_kind: SinkKind, nonce: &str) -> String {
    format!("{spender_root}|{sink_kind}|{nonce}")
}

fn milestone_key(order_id: &str, milestone_id: &str) -> String {
    format!("{order_id}:{milestone_id}")
}

fn summarize_valid_event(event: &Event) -> ReplayValidEventRecord {
    let claim_id = match &event.payload {
        EventPayload::ContributionClaim(payload) => Some(payload.claim_id.clone()),
        _ => None,
    };
    let offer_id = match &event.payload {
        EventPayload::ServiceOffer(payload) => Some(payload.offer_id.clone()),
        EventPayload::ServiceOrder(payload) => Some(payload.offer_id.clone()),
        _ => None,
    };
    let order_id = match &event.payload {
        EventPayload::ServiceOrder(payload) => Some(payload.order_id.clone()),
        EventPayload::ServiceDelivery(payload) => Some(payload.order_id.clone()),
        EventPayload::ServiceAccept(payload) => Some(payload.order_id.clone()),
        EventPayload::ServiceDispute(payload) => Some(payload.order_id.clone()),
        EventPayload::ServiceSettle(payload) => Some(payload.order_id.clone()),
        _ => None,
    };
    let milestone_id = match &event.payload {
        EventPayload::ServiceDelivery(payload) => Some(payload.milestone_id.clone()),
        EventPayload::ServiceAccept(payload) => Some(payload.milestone_id.clone()),
        EventPayload::ServiceDispute(payload) => Some(payload.milestone_id.clone()),
        EventPayload::ServiceSettle(payload) => Some(payload.milestone_id.clone()),
        _ => None,
    };

    ReplayValidEventRecord {
        kind: event.kind,
        author_pub_key: event.author_pub_key.clone(),
        created_at: event.created_at.clone(),
        claim_id,
        offer_id,
        order_id,
        milestone_id,
    }
}

fn is_vouch_expired(record: &ReplayVouchRecord, now: DateTime<Utc>) -> bool {
    record.expires_at.is_some_and(|timestamp| timestamp <= now)
}

fn p2h_risk_band_for_score(score: i64) -> P2HRiskBand {
    if score < 20 {
        P2HRiskBand::Low
    } else if score < 50 {
        P2HRiskBand::Medium
    } else {
        P2HRiskBand::High
    }
}

fn p2h_risk_band_label(band: P2HRiskBand) -> &'static str {
    match band {
        P2HRiskBand::Low => "low",
        P2HRiskBand::Medium => "medium",
        P2HRiskBand::High => "high",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use policy::default_policy;
    use protocol_core::{
        EventKind, PROTOCOL_VERSION, UnsignedEvent, sign_event, signing_key_from_hex,
    };

    const ALICE_SECRET: &str = "1111111111111111111111111111111111111111111111111111111111111111";
    const BOB_SECRET: &str = "2222222222222222222222222222222222222222222222222222222222222222";
    const CAROL_SECRET: &str = "3333333333333333333333333333333333333333333333333333333333333333";

    fn signed_event(
        secret: &str,
        created_at: &str,
        kind: EventKind,
        payload: serde_json::Value,
        references: Option<BTreeMap<String, String>>,
        nonce: Option<&str>,
    ) -> Event {
        signed_event_with_policy_version(
            secret,
            created_at,
            kind,
            policy::DEFAULT_POLICY_VERSION,
            payload,
            references,
            nonce,
        )
    }

    fn signed_event_with_policy_version(
        secret: &str,
        created_at: &str,
        kind: EventKind,
        policy_version: &str,
        payload: serde_json::Value,
        references: Option<BTreeMap<String, String>>,
        nonce: Option<&str>,
    ) -> Event {
        let signing_key = signing_key_from_hex(secret).expect("signing key");
        let unsigned = UnsignedEvent {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: hex::encode(signing_key.verifying_key().to_bytes()),
            created_at: created_at.into(),
            kind,
            policy_version: policy_version.into(),
            payload,
            references,
            nonce: nonce.map(str::to_string),
        };
        sign_event(&unsigned, secret).expect("signed event")
    }

    fn serialize(event: &Event) -> String {
        serde_json::to_string(&event.to_raw().expect("raw event")).expect("json")
    }

    fn policy_payload_with_issuance_controls(
        authority_pub_key: &str,
        version: &str,
        issuance_window_seconds: i64,
        max_identity: usize,
        max_lane: usize,
        min_diversity: usize,
    ) -> serde_json::Value {
        serde_json::json!({
            "version": version,
            "clockSkewSeconds": 300,
            "creditDefaultExpiryDays": 180,
            "providerRewardExpiryDays": 90,
            "demurrageRateWeeklyBps": 100,
            "claimApprovalThreshold": 2,
            "maxContributionClaimCredits": 1000,
            "allowedServiceTypes": ["software-fixes", "documentation"],
            "maxMilestonesPerOrder": 16,
            "maxMilestoneCredits": 5000,
            "acceptanceWindowSeconds": 3600,
            "disputeTimeoutSeconds": 1209600,
            "providerEligibilityThreshold": 2,
            "attestorEligibilityThreshold": 1,
            "allowedSinkKinds": ["ServiceEscrowSink", "ComputeSink", "AISink", "StorageSink", "BountySink"],
            "policyAuthorityPubKey": authority_pub_key,
            "issuanceWindowSeconds": issuance_window_seconds,
            "maxIssuanceEventsPerIdentityWindow": max_identity,
            "maxIssuanceEventsPerLaneWindow": max_lane,
            "minIssuanceCounterpartyDiversity": min_diversity
        })
    }

    fn policy_payload_with_soft_gates(
        authority_pub_key: &str,
        version: &str,
        min_global_reputation_score: Option<i64>,
        min_lane_reputation_score: Option<i64>,
        max_p2h_risk_band: Option<&str>,
    ) -> serde_json::Value {
        let mut payload =
            policy_payload_with_issuance_controls(authority_pub_key, version, 0, 0, 0, 0);
        let object = payload
            .as_object_mut()
            .expect("policy payload should be an object");
        if let Some(min_global) = min_global_reputation_score {
            object.insert(
                "minGlobalReputationScore".to_string(),
                serde_json::json!(min_global),
            );
        }
        if let Some(min_lane) = min_lane_reputation_score {
            object.insert(
                "minLaneReputationScore".to_string(),
                serde_json::json!(min_lane),
            );
        }
        if let Some(max_band) = max_p2h_risk_band {
            object.insert("maxP2hRiskBand".to_string(), serde_json::json!(max_band));
        }
        payload
    }

    #[test]
    fn replay_identity_claim_mint_and_spend() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk, "metadata": { "displayName": "alice" } }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-01-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk, "metadata": { "displayName": "bob" } }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk, "metadata": { "displayName": "carol" } }),
            None,
            None,
        );
        let bob_vouch = signed_event(
            BOB_SECRET,
            "2026-01-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": alice_pk, "weight": 1 }),
            None,
            None,
        );
        let carol_vouch = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": alice_pk, "weight": 1 }),
            None,
            None,
        );
        let alice_vouches_bob = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:02Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk, "weight": 1 }),
            None,
            None,
        );
        let alice_vouches_carol = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:03Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk, "weight": 1 }),
            None,
            None,
        );
        let claim = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-1", "claimType": "maintenance", "artifactHash": "abc123", "summary": "revived a stalled project", "requestedCredits": 100 }),
            None,
            None,
        );
        let bob_attest = signed_event(
            BOB_SECRET,
            "2026-01-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let carol_attest = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let mint = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 100, "expiresAt": "2026-07-01T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-1" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let spend = signed_event(
            ALICE_SECRET,
            "2026-01-15T00:04:00Z",
            EventKind::SpendCredits,
            serde_json::json!({ "spenderPubKey": alice_pk, "sinkKind": "ComputeSink", "amount": 50 }),
            None,
            Some("nonce-1"),
        );

        let input = [
            serialize(&spend),
            serialize(&alice_create),
            serialize(&bob_create),
            serialize(&carol_create),
            serialize(&claim),
            serialize(&bob_vouch),
            serialize(&carol_vouch),
            serialize(&alice_vouches_bob),
            serialize(&alice_vouches_carol),
            serialize(&bob_attest),
            serialize(&carol_attest),
            serialize(&mint),
        ]
        .join("\n");
        let output = replay_jsonl(
            &input,
            default_policy(),
            parse_timestamp("2026-08-01T00:00:00Z").expect("now"),
        );

        assert!(
            output.invalid_events.is_empty(),
            "{:?}",
            output.invalid_events
        );
        let balance = output.state.balances.get(&alice_pk).expect("alice balance");
        assert_eq!(balance.effective_balance, 48);
        assert_eq!(output.state.claims.len(), 1);
        assert_eq!(output.state.spend_records.len(), 1);
    }

    #[test]
    fn replay_rejects_duplicate_nonces() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let create = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-01-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let bob_vouch = signed_event(
            BOB_SECRET,
            "2026-01-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": alice_pk }),
            None,
            None,
        );
        let carol_vouch = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": alice_pk }),
            None,
            None,
        );
        let alice_vouches_bob = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:02Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let alice_vouches_carol = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:03Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );
        let claim = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-1", "claimType": "maintenance", "artifactHash": "abc123", "summary": "revived a stalled project", "requestedCredits": 100 }),
            None,
            None,
        );
        let bob_attest = signed_event(
            BOB_SECRET,
            "2026-01-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let carol_attest = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let mint = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 100, "expiresAt": "2026-07-01T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-1" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let spend_a = signed_event(
            ALICE_SECRET,
            "2026-01-02T00:00:00Z",
            EventKind::SpendCredits,
            serde_json::json!({ "spenderPubKey": alice_pk, "sinkKind": "ComputeSink", "amount": 10 }),
            None,
            Some("nonce-1"),
        );
        let spend_b = signed_event(
            ALICE_SECRET,
            "2026-01-02T00:00:01Z",
            EventKind::SpendCredits,
            serde_json::json!({ "spenderPubKey": alice_pk, "sinkKind": "ComputeSink", "amount": 10 }),
            None,
            Some("nonce-1"),
        );

        let input = [
            serialize(&create),
            serialize(&bob_create),
            serialize(&carol_create),
            serialize(&bob_vouch),
            serialize(&carol_vouch),
            serialize(&alice_vouches_bob),
            serialize(&alice_vouches_carol),
            serialize(&claim),
            serialize(&bob_attest),
            serialize(&carol_attest),
            serialize(&mint),
            serialize(&spend_a),
            serialize(&spend_b),
        ]
        .join("\n");
        let output = replay_jsonl(
            &input,
            default_policy(),
            parse_timestamp("2026-08-01T00:00:00Z").expect("now"),
        );

        assert_eq!(
            output.invalid_events.len(),
            1,
            "{:?}",
            output.invalid_events
        );
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::InvalidNonce
        );
    }

    #[test]
    fn replay_checkpoint_roundtrip_matches_genesis() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let create = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-01-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let bob_vouch = signed_event(
            BOB_SECRET,
            "2026-01-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": alice_pk }),
            None,
            None,
        );
        let carol_vouch = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": alice_pk }),
            None,
            None,
        );
        let alice_vouches_bob = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:02Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let alice_vouches_carol = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:03Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );
        let claim = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-1", "claimType": "maintenance", "artifactHash": "abc123", "summary": "revived a stalled project", "requestedCredits": 100 }),
            None,
            None,
        );
        let bob_attest = signed_event(
            BOB_SECRET,
            "2026-01-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let carol_attest = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let mint = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 100, "expiresAt": "2026-07-01T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-1" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let spend = signed_event(
            ALICE_SECRET,
            "2026-01-15T00:04:00Z",
            EventKind::SpendCredits,
            serde_json::json!({ "spenderPubKey": alice_pk, "sinkKind": "ComputeSink", "amount": 50 }),
            None,
            Some("nonce-1"),
        );

        let input = [
            serialize(&create),
            serialize(&bob_create),
            serialize(&carol_create),
            serialize(&bob_vouch),
            serialize(&carol_vouch),
            serialize(&alice_vouches_bob),
            serialize(&alice_vouches_carol),
            serialize(&claim),
            serialize(&bob_attest),
            serialize(&carol_attest),
            serialize(&mint),
            serialize(&spend),
        ]
        .join("\n");
        let lines = input
            .lines()
            .enumerate()
            .map(|(index, line)| ReplayInputLine {
                line: index + 1,
                raw_json: line.to_string(),
            })
            .collect::<Vec<_>>();
        let now = parse_timestamp("2026-08-01T00:00:00Z").expect("now");

        let expected = replay_jsonl_from_lines(&lines, default_policy(), now);
        let split = lines.len() / 2;
        let first = lines[..split].to_vec();
        let second = lines[split..].to_vec();

        let first_run = replay_jsonl_resume(&first, default_policy(), now, None);
        let serialized_checkpoint =
            serde_json::to_string(&first_run.checkpoint).expect("serialize checkpoint");
        let checkpoint: ReplayCheckpoint =
            serde_json::from_str(&serialized_checkpoint).expect("deserialize checkpoint");
        let resumed = replay_jsonl_resume(&second, default_policy(), now, Some(checkpoint));

        assert_eq!(expected, resumed.replay);
    }

    fn build_marketplace_prereq() -> (
        String,
        String,
        String,
        Event,
        Event,
        Event,
        Event,
        Vec<String>,
    ) {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-03-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-03-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let alice_vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let carol_vouch_bob = signed_event(
            CAROL_SECRET,
            "2026-03-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let alice_vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:01:02Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );

        let claim = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-market", "claimType": "maintenance", "artifactHash": "abc123", "summary": "market buyer credit prep", "requestedCredits": 200 }),
            None,
            None,
        );
        let attest_bob = signed_event(
            BOB_SECRET,
            "2026-03-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-market", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let attest_carol = signed_event(
            CAROL_SECRET,
            "2026-03-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-market", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let mint = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 200, "expiresAt": "2026-12-01T00:00:00Z", "mintReason": "contribution", "sourceClaimId": "claim-market" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );

        let offer = signed_event(
            BOB_SECRET,
            "2026-03-01T00:05:00Z",
            EventKind::ServiceOffer,
            serde_json::json!({
                "offerId": "offer-1",
                "serviceType": "software-fixes",
                "unitDefinition": "fix per issue",
                "pricePerUnitCredits": 100,
                "deliveryMode": "artifact",
                "offerExpiresAt": "2026-12-01T00:00:00Z",
                "allowedEvidenceFormats": ["artifactHash"]
            }),
            None,
            None,
        );
        let order = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:06:00Z",
            EventKind::ServiceOrder,
            serde_json::json!({
                "orderId": "order-1",
                "offerId": "offer-1",
                "providerPubKey": bob_pk,
                "buyerPubKey": alice_pk,
                "orderExpiresAt": "2026-12-15T00:00:00Z",
                "milestones": [
                    {
                        "milestoneId": "m1",
                        "amountCredits": 100,
                        "evidenceFormat": "artifactHash"
                    }
                ]
            }),
            Some(BTreeMap::from([("offer".into(), offer.event_id.clone())])),
            None,
        );
        let spend_escrow = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:07:00Z",
            EventKind::SpendCredits,
            serde_json::json!({
                "spenderPubKey": alice_pk,
                "sinkKind": "ServiceEscrowSink",
                "amount": 100,
                "orderId": "order-1",
                "milestoneId": "m1"
            }),
            None,
            Some("escrow-1"),
        );
        let delivery = signed_event(
            BOB_SECRET,
            "2026-03-01T00:08:00Z",
            EventKind::ServiceDelivery,
            serde_json::json!({
                "orderId": "order-1",
                "milestoneId": "m1",
                "evidenceFormat": "artifactHash",
                "artifactHashes": ["hash-1"],
                "deliveredAt": "2026-03-01T00:08:00Z"
            }),
            Some(BTreeMap::from([("order".into(), order.event_id.clone())])),
            None,
        );

        let base = vec![
            serialize(&alice_create),
            serialize(&bob_create),
            serialize(&carol_create),
            serialize(&alice_vouch_bob),
            serialize(&carol_vouch_bob),
            serialize(&alice_vouch_carol),
            serialize(&claim),
            serialize(&attest_bob),
            serialize(&attest_carol),
            serialize(&mint),
            serialize(&offer),
            serialize(&order),
            serialize(&spend_escrow),
            serialize(&delivery),
        ];

        (
            alice_pk, bob_pk, carol_pk, offer, order, delivery, mint, base,
        )
    }

    fn build_offline_lane_prereq(
        service_type: &str,
        delivery_mode: &str,
        evidence_format: &str,
        offer_id: &str,
        order_id: &str,
        milestone_id: &str,
    ) -> (String, String, Event, Vec<String>) {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-04-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-04-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let alice_vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let carol_vouch_bob = signed_event(
            CAROL_SECRET,
            "2026-04-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let alice_vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:01:02Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );

        let claim = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-offline", "claimType": "maintenance", "artifactHash": "offline-artifact", "summary": "offline lane prep", "requestedCredits": 200 }),
            None,
            None,
        );
        let attest_bob = signed_event(
            BOB_SECRET,
            "2026-04-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-offline", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let attest_carol = signed_event(
            CAROL_SECRET,
            "2026-04-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-offline", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let mint = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 200, "expiresAt": "2026-12-31T00:00:00Z", "mintReason": "contribution", "sourceClaimId": "claim-offline" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );

        let offer = signed_event(
            BOB_SECRET,
            "2026-04-01T00:05:00Z",
            EventKind::ServiceOffer,
            serde_json::json!({
                "offerId": offer_id,
                "serviceType": service_type,
                "unitDefinition": "handoff unit",
                "pricePerUnitCredits": 100,
                "deliveryMode": delivery_mode,
                "offerExpiresAt": "2026-12-31T00:00:00Z",
                "allowedEvidenceFormats": [evidence_format]
            }),
            None,
            None,
        );
        let order = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:06:00Z",
            EventKind::ServiceOrder,
            serde_json::json!({
                "orderId": order_id,
                "offerId": offer_id,
                "providerPubKey": bob_pk,
                "buyerPubKey": alice_pk,
                "orderExpiresAt": "2026-12-31T00:00:00Z",
                "milestones": [
                    {
                        "milestoneId": milestone_id,
                        "amountCredits": 100,
                        "evidenceFormat": evidence_format
                    }
                ]
            }),
            Some(BTreeMap::from([("offer".into(), offer.event_id.clone())])),
            None,
        );
        let spend_escrow = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:07:00Z",
            EventKind::SpendCredits,
            serde_json::json!({
                "spenderPubKey": alice_pk,
                "sinkKind": "ServiceEscrowSink",
                "amount": 100,
                "orderId": order_id,
                "milestoneId": milestone_id
            }),
            None,
            Some("escrow-offline-1"),
        );

        let base = vec![
            serialize(&alice_create),
            serialize(&bob_create),
            serialize(&carol_create),
            serialize(&alice_vouch_bob),
            serialize(&carol_vouch_bob),
            serialize(&alice_vouch_carol),
            serialize(&claim),
            serialize(&attest_bob),
            serialize(&attest_carol),
            serialize(&mint),
            serialize(&offer),
            serialize(&order),
            serialize(&spend_escrow),
        ];

        (alice_pk, bob_pk, order, base)
    }

    #[test]
    fn replay_marketplace_accept_flow() {
        let (alice_pk, bob_pk, _carol_pk, _offer, _order, delivery, _mint, mut base) =
            build_marketplace_prereq();
        let accept = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:09:00Z",
            EventKind::ServiceAccept,
            serde_json::json!({
                "orderId": "order-1",
                "milestoneId": "m1",
                "acceptedAt": "2026-03-01T00:09:00Z"
            }),
            Some(BTreeMap::from([(
                "delivery".into(),
                delivery.event_id.clone(),
            )])),
            None,
        );
        base.push(serialize(&accept));

        let output = replay_jsonl(
            &base.join("\n"),
            default_policy(),
            parse_timestamp("2026-04-01T00:00:00Z").expect("now"),
        );
        assert!(
            output.invalid_events.is_empty(),
            "{:?}",
            output.invalid_events
        );
        let milestone = output
            .state
            .milestones
            .get("order-1:m1")
            .expect("milestone state");
        assert_eq!(milestone.status, "Accepted");
        assert_eq!(milestone.provider_reward_credits, Some(100));
        let buyer_balance = output
            .state
            .balances
            .get(&alice_pk)
            .expect("buyer balance")
            .effective_balance;
        let provider_balance = output
            .state
            .balances
            .get(&bob_pk)
            .expect("provider balance")
            .effective_balance;
        assert!(buyer_balance < 200);
        assert!(provider_balance >= 100);
    }

    #[test]
    fn replay_marketplace_settlement_and_timeout() {
        let (alice_pk, bob_pk, _carol_pk, _offer, _order, delivery, _mint, base) =
            build_marketplace_prereq();
        let dispute = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:09:00Z",
            EventKind::ServiceDispute,
            serde_json::json!({
                "orderId": "order-1",
                "milestoneId": "m1",
                "reasonCode": "quality",
                "disputedAt": "2026-03-01T00:09:00Z"
            }),
            Some(BTreeMap::from([(
                "delivery".into(),
                delivery.event_id.clone(),
            )])),
            None,
        );
        let settle_buyer = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:10:00Z",
            EventKind::ServiceSettle,
            serde_json::json!({
                "orderId": "order-1",
                "milestoneId": "m1",
                "outcome": "split",
                "buyerRefundCredits": 40,
                "providerRewardCredits": 60,
                "settledAt": "2026-03-01T00:10:00Z"
            }),
            Some(BTreeMap::from([(
                "dispute".into(),
                dispute.event_id.clone(),
            )])),
            None,
        );
        let settle_provider = signed_event(
            BOB_SECRET,
            "2026-03-01T00:10:30Z",
            EventKind::ServiceSettle,
            serde_json::json!({
                "orderId": "order-1",
                "milestoneId": "m1",
                "outcome": "split",
                "buyerRefundCredits": 40,
                "providerRewardCredits": 60,
                "settledAt": "2026-03-01T00:10:30Z"
            }),
            Some(BTreeMap::from([(
                "dispute".into(),
                dispute.event_id.clone(),
            )])),
            None,
        );

        let settled_output = replay_jsonl(
            &[
                base.clone(),
                vec![
                    serialize(&dispute),
                    serialize(&settle_buyer),
                    serialize(&settle_provider),
                ],
            ]
            .concat()
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-04-01T00:00:00Z").expect("now"),
        );
        assert!(settled_output.invalid_events.is_empty());
        let settled_milestone = settled_output
            .state
            .milestones
            .get("order-1:m1")
            .expect("milestone");
        assert_eq!(settled_milestone.status, "Settled");
        assert_eq!(settled_milestone.buyer_refund_credits, Some(40));
        assert_eq!(settled_milestone.provider_reward_credits, Some(60));

        let timeout_output = replay_jsonl(
            &[base, vec![serialize(&dispute)]].concat().join("\n"),
            default_policy(),
            parse_timestamp("2026-05-01T00:00:00Z").expect("later now"),
        );
        assert!(timeout_output.invalid_events.is_empty());
        let timeout_milestone = timeout_output
            .state
            .milestones
            .get("order-1:m1")
            .expect("milestone");
        assert_eq!(timeout_milestone.status, "AutoRefunded");
        assert_eq!(timeout_milestone.buyer_refund_credits, Some(100));
        let buyer_balance = timeout_output
            .state
            .balances
            .get(&alice_pk)
            .expect("buyer balance")
            .effective_balance;
        let provider_balance = timeout_output
            .state
            .balances
            .get(&bob_pk)
            .map(|balance| balance.effective_balance)
            .unwrap_or(0);
        assert!(buyer_balance > provider_balance);
    }

    #[test]
    fn replay_offline_local_resource_lane_accept_flow() {
        let (alice_pk, bob_pk, order, mut base) = build_offline_lane_prereq(
            protocol_core::SERVICE_TYPE_LOCAL_RESOURCE_EXCHANGE,
            "local-community",
            protocol_core::EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1,
            "offer-local-1",
            "order-local-1",
            "m1",
        );

        let delivery = signed_event(
            BOB_SECRET,
            "2026-04-01T00:08:00Z",
            EventKind::ServiceDelivery,
            serde_json::json!({
                "orderId": "order-local-1",
                "milestoneId": "m1",
                "evidenceFormat": protocol_core::EVIDENCE_FORMAT_LOCAL_RESOURCE_RECEIPT_V1,
                "artifactHashes": ["receipt-a"],
                "notesHash": "local-receipt-notes",
                "deliveredAt": "2026-04-01T00:08:00Z"
            }),
            Some(BTreeMap::from([("order".into(), order.event_id.clone())])),
            None,
        );
        let accept = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:09:00Z",
            EventKind::ServiceAccept,
            serde_json::json!({
                "orderId": "order-local-1",
                "milestoneId": "m1",
                "acceptedAt": "2026-04-01T00:09:00Z"
            }),
            Some(BTreeMap::from([(
                "delivery".into(),
                delivery.event_id.clone(),
            )])),
            None,
        );
        base.push(serialize(&delivery));
        base.push(serialize(&accept));

        let output = replay_jsonl(
            &base.join("\n"),
            default_policy(),
            parse_timestamp("2026-05-01T00:00:00Z").expect("now"),
        );
        assert!(
            output.invalid_events.is_empty(),
            "{:?}",
            output.invalid_events
        );
        let milestone = output
            .state
            .milestones
            .get("order-local-1:m1")
            .expect("milestone");
        assert_eq!(milestone.status, "Accepted");
        assert_eq!(
            output
                .state
                .balances
                .get(&bob_pk)
                .expect("provider balance")
                .effective_balance,
            100
        );
        assert!(
            output
                .state
                .balances
                .get(&alice_pk)
                .expect("buyer balance")
                .effective_balance
                < 200
        );
    }

    #[test]
    fn replay_offline_physical_handoff_lane_accept_flow() {
        let (alice_pk, bob_pk, order, mut base) = build_offline_lane_prereq(
            protocol_core::SERVICE_TYPE_PHYSICAL_HANDOFF,
            "in-person",
            protocol_core::EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1,
            "offer-handoff-accept",
            "order-handoff-accept",
            "m1",
        );

        let delivery = signed_event(
            BOB_SECRET,
            "2026-04-01T00:08:00Z",
            EventKind::ServiceDelivery,
            serde_json::json!({
                "orderId": "order-handoff-accept",
                "milestoneId": "m1",
                "evidenceFormat": protocol_core::EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1,
                "artifactHashes": ["provider-handoff-ack", "buyer-handoff-ack"],
                "notesHash": "handoff-notes",
                "deliveredAt": "2026-04-01T00:08:00Z"
            }),
            Some(BTreeMap::from([("order".into(), order.event_id.clone())])),
            None,
        );
        let accept = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:09:00Z",
            EventKind::ServiceAccept,
            serde_json::json!({
                "orderId": "order-handoff-accept",
                "milestoneId": "m1",
                "acceptedAt": "2026-04-01T00:09:00Z"
            }),
            Some(BTreeMap::from([(
                "delivery".into(),
                delivery.event_id.clone(),
            )])),
            None,
        );
        base.push(serialize(&delivery));
        base.push(serialize(&accept));

        let output = replay_jsonl(
            &base.join("\n"),
            default_policy(),
            parse_timestamp("2026-05-01T00:00:00Z").expect("now"),
        );
        assert!(
            output.invalid_events.is_empty(),
            "{:?}",
            output.invalid_events
        );
        let milestone = output
            .state
            .milestones
            .get("order-handoff-accept:m1")
            .expect("milestone");
        assert_eq!(milestone.status, "Accepted");
        assert_eq!(
            output.state.orders.get("order-handoff-accept").expect("order").status,
            "closed"
        );
        assert_eq!(
            output
                .state
                .balances
                .get(&bob_pk)
                .expect("provider balance")
                .effective_balance,
            100
        );
        assert!(
            output
                .state
                .balances
                .get(&alice_pk)
                .expect("buyer balance")
                .effective_balance
                < 200
        );
    }

    #[test]
    fn replay_offline_physical_handoff_rejects_non_template_delivery_evidence() {
        let (_alice_pk, _bob_pk, order, mut base) = build_offline_lane_prereq(
            protocol_core::SERVICE_TYPE_PHYSICAL_HANDOFF,
            "in-person",
            protocol_core::EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1,
            "offer-handoff-1",
            "order-handoff-1",
            "m1",
        );

        let bad_delivery = signed_event(
            BOB_SECRET,
            "2026-04-01T00:08:00Z",
            EventKind::ServiceDelivery,
            serde_json::json!({
                "orderId": "order-handoff-1",
                "milestoneId": "m1",
                "evidenceFormat": "artifactHash",
                "artifactHashes": ["provider-ack-only"],
                "deliveredAt": "2026-04-01T00:08:00Z"
            }),
            Some(BTreeMap::from([("order".into(), order.event_id.clone())])),
            None,
        );
        base.push(serialize(&bad_delivery));

        let output = replay_jsonl(
            &base.join("\n"),
            default_policy(),
            parse_timestamp("2026-05-01T00:00:00Z").expect("now"),
        );
        assert_eq!(
            output.invalid_events.len(),
            1,
            "{:?}",
            output.invalid_events
        );
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::InvalidPayload
        );
    }

    #[test]
    fn replay_offline_physical_handoff_rejects_accept_before_delivery_time() {
        let (_alice_pk, _bob_pk, order, mut base) = build_offline_lane_prereq(
            protocol_core::SERVICE_TYPE_PHYSICAL_HANDOFF,
            "in-person",
            protocol_core::EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1,
            "offer-handoff-2",
            "order-handoff-2",
            "m1",
        );

        let delivery = signed_event(
            BOB_SECRET,
            "2026-04-01T00:08:00Z",
            EventKind::ServiceDelivery,
            serde_json::json!({
                "orderId": "order-handoff-2",
                "milestoneId": "m1",
                "evidenceFormat": protocol_core::EVIDENCE_FORMAT_PHYSICAL_HANDOFF_DUAL_ACK_V1,
                "artifactHashes": ["provider-ack", "buyer-ack"],
                "notesHash": "handoff-notes",
                "deliveredAt": "2026-04-01T00:08:00Z"
            }),
            Some(BTreeMap::from([("order".into(), order.event_id.clone())])),
            None,
        );
        let accept = signed_event(
            ALICE_SECRET,
            "2026-04-01T00:09:00Z",
            EventKind::ServiceAccept,
            serde_json::json!({
                "orderId": "order-handoff-2",
                "milestoneId": "m1",
                "acceptedAt": "2026-04-01T00:07:59Z"
            }),
            Some(BTreeMap::from([(
                "delivery".into(),
                delivery.event_id.clone(),
            )])),
            None,
        );
        base.push(serialize(&delivery));
        base.push(serialize(&accept));

        let output = replay_jsonl(
            &base.join("\n"),
            default_policy(),
            parse_timestamp("2026-05-01T00:00:00Z").expect("now"),
        );
        assert_eq!(
            output.invalid_events.len(),
            1,
            "{:?}",
            output.invalid_events
        );
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::BadTimestamp
        );
    }

    #[test]
    fn replay_policy_update_applies_by_effective_time_and_enforces_policy_version() {
        let authority = signing_key_from_hex(ALICE_SECRET).expect("authority");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let authority_pk = hex::encode(authority.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());

        let authority_identity = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": authority_pk }),
            None,
            None,
        );
        let update = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:00:10Z",
            EventKind::PolicyUpdate,
            serde_json::json!({
                "nextPolicyVersion": "v0-policy-1",
                "effectiveAt": "2026-03-02T00:00:00Z",
                "policy": {
                    "version": "v0-policy-1",
                    "clockSkewSeconds": 300,
                    "creditDefaultExpiryDays": 180,
                    "providerRewardExpiryDays": 90,
                    "demurrageRateWeeklyBps": 100,
                    "claimApprovalThreshold": 2,
                    "maxContributionClaimCredits": 1000,
                    "allowedServiceTypes": ["software-fixes", "documentation"],
                    "maxMilestonesPerOrder": 16,
                    "maxMilestoneCredits": 5000,
                    "acceptanceWindowSeconds": 3600,
                    "disputeTimeoutSeconds": 1209600,
                    "providerEligibilityThreshold": 2,
                    "attestorEligibilityThreshold": 1,
                    "allowedSinkKinds": ["ServiceEscrowSink", "ComputeSink", "AISink", "StorageSink", "BountySink"],
                    "policyAuthorityPubKey": authority_pk
                }
            }),
            None,
            None,
        );
        let bob_identity_bad_version = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-03-03T00:00:00Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let bob_identity_good_version = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-03-03T00:00:01Z",
            EventKind::IdentityCreate,
            "v0-policy-1",
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );

        let output = replay_jsonl(
            &[
                serialize(&authority_identity),
                serialize(&update),
                serialize(&bob_identity_bad_version),
                serialize(&bob_identity_good_version),
            ]
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-03-04T00:00:00Z").expect("now"),
        );

        assert_eq!(
            output.invalid_events.len(),
            1,
            "{:?}",
            output.invalid_events
        );
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::PolicyViolation
        );
        assert_eq!(output.state.policy.effective_version, "v0-policy-1");
        assert_eq!(output.state.policy.update_count, 1);
    }

    #[test]
    fn replay_issuance_rate_limit_enforces_after_policy_effective_time() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-01-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );

        let claim_one = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-one", "claimType": "maintenance", "artifactHash": "artifact-1", "summary": "first contribution", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_one_bob = signed_event(
            BOB_SECRET,
            "2026-01-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-one", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_one.event_id.clone(),
            )])),
            None,
        );
        let attest_one_carol = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-one", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_one.event_id.clone(),
            )])),
            None,
        );
        let mint_one = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-01T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-one" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_one.event_id.clone(),
            )])),
            None,
        );
        let policy_update = signed_event(
            ALICE_SECRET,
            "2026-01-01T12:00:00Z",
            EventKind::PolicyUpdate,
            serde_json::json!({
                "nextPolicyVersion": "v0-policy-1",
                "effectiveAt": "2026-01-02T00:00:00Z",
                "policy": policy_payload_with_issuance_controls(&alice_pk, "v0-policy-1", 604800, 1, 0, 2)
            }),
            None,
            None,
        );

        let claim_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-03T00:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-1",
            serde_json::json!({ "claimId": "claim-two", "claimType": "maintenance", "artifactHash": "artifact-2", "summary": "second contribution", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_two_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-01-03T00:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-1",
            serde_json::json!({ "claimId": "claim-two", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_two.event_id.clone(),
            )])),
            None,
        );
        let attest_two_carol = signed_event_with_policy_version(
            CAROL_SECRET,
            "2026-01-03T00:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-1",
            serde_json::json!({ "claimId": "claim-two", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_two.event_id.clone(),
            )])),
            None,
        );
        let mint_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-03T00:04:00Z",
            EventKind::MintCredits,
            "v0-policy-1",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-03T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-two" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_two.event_id.clone(),
            )])),
            None,
        );

        let output = replay_jsonl(
            &[
                serialize(&alice_create),
                serialize(&bob_create),
                serialize(&carol_create),
                serialize(&vouch_bob),
                serialize(&vouch_carol),
                serialize(&claim_one),
                serialize(&attest_one_bob),
                serialize(&attest_one_carol),
                serialize(&mint_one),
                serialize(&policy_update),
                serialize(&claim_two),
                serialize(&attest_two_bob),
                serialize(&attest_two_carol),
                serialize(&mint_two),
            ]
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-01-04T00:00:00Z").expect("now"),
        );

        assert_eq!(output.invalid_events.len(), 1);
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::IssuanceRateLimitExceeded
        );
        let balance = output.state.balances.get(&alice_pk).expect("alice balance");
        assert_eq!(balance.effective_balance, 10);
    }

    #[test]
    fn replay_issuance_rate_limit_recovers_after_window_advance() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-01-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-01-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-01-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );
        let policy_update = signed_event(
            ALICE_SECRET,
            "2026-01-01T12:00:00Z",
            EventKind::PolicyUpdate,
            serde_json::json!({
                "nextPolicyVersion": "v0-policy-rate-window",
                "effectiveAt": "2026-01-02T00:00:00Z",
                "policy": policy_payload_with_issuance_controls(&alice_pk, "v0-policy-rate-window", 86400, 1, 0, 0)
            }),
            None,
            None,
        );

        let claim_one = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-03T00:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-1", "claimType": "maintenance", "artifactHash": "artifact-rate-1", "summary": "first issuance", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_one_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-01-03T00:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_one.event_id.clone())])),
            None,
        );
        let attest_one_carol = signed_event_with_policy_version(
            CAROL_SECRET,
            "2026-01-03T00:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_one.event_id.clone())])),
            None,
        );
        let mint_one = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-03T00:04:00Z",
            EventKind::MintCredits,
            "v0-policy-rate-window",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-03T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-rate-1" }),
            Some(BTreeMap::from([("claim".into(), claim_one.event_id.clone())])),
            None,
        );

        let claim_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-03T12:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-2", "claimType": "maintenance", "artifactHash": "artifact-rate-2", "summary": "second issuance in window", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_two_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-01-03T12:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-2", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_two.event_id.clone())])),
            None,
        );
        let attest_two_carol = signed_event_with_policy_version(
            CAROL_SECRET,
            "2026-01-03T12:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-2", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_two.event_id.clone())])),
            None,
        );
        let mint_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-03T12:04:00Z",
            EventKind::MintCredits,
            "v0-policy-rate-window",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-03T12:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-rate-2" }),
            Some(BTreeMap::from([("claim".into(), claim_two.event_id.clone())])),
            None,
        );

        let claim_three = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-05T00:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-3", "claimType": "maintenance", "artifactHash": "artifact-rate-3", "summary": "post-window issuance", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_three_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-01-05T00:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-3", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_three.event_id.clone())])),
            None,
        );
        let attest_three_carol = signed_event_with_policy_version(
            CAROL_SECRET,
            "2026-01-05T00:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-rate-window",
            serde_json::json!({ "claimId": "claim-rate-3", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_three.event_id.clone())])),
            None,
        );
        let mint_three = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-01-05T00:04:00Z",
            EventKind::MintCredits,
            "v0-policy-rate-window",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-05T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-rate-3" }),
            Some(BTreeMap::from([("claim".into(), claim_three.event_id.clone())])),
            None,
        );

        let output = replay_jsonl(
            &[
                serialize(&alice_create),
                serialize(&bob_create),
                serialize(&carol_create),
                serialize(&vouch_bob),
                serialize(&vouch_carol),
                serialize(&policy_update),
                serialize(&claim_one),
                serialize(&attest_one_bob),
                serialize(&attest_one_carol),
                serialize(&mint_one),
                serialize(&claim_two),
                serialize(&attest_two_bob),
                serialize(&attest_two_carol),
                serialize(&mint_two),
                serialize(&claim_three),
                serialize(&attest_three_bob),
                serialize(&attest_three_carol),
                serialize(&mint_three),
            ]
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-01-06T00:00:00Z").expect("now"),
        );

        assert_eq!(output.invalid_events.len(), 1);
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::IssuanceRateLimitExceeded
        );
        let balance = output.state.balances.get(&alice_pk).expect("alice balance");
        assert_eq!(balance.effective_balance, 20);
    }

    #[test]
    fn replay_issuance_diversity_threshold_rejects_low_diversity_mint() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-02-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-02-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );
        let policy_update = signed_event(
            ALICE_SECRET,
            "2026-02-01T01:00:00Z",
            EventKind::PolicyUpdate,
            serde_json::json!({
                "nextPolicyVersion": "v0-policy-2",
                "effectiveAt": "2026-02-02T00:00:00Z",
                "policy": policy_payload_with_issuance_controls(&alice_pk, "v0-policy-2", 604800, 0, 0, 3)
            }),
            None,
            None,
        );
        let claim = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-02-03T00:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-2",
            serde_json::json!({ "claimId": "claim-diversity", "claimType": "maintenance", "artifactHash": "artifact-diversity", "summary": "diversity test", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-02-03T00:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-2",
            serde_json::json!({ "claimId": "claim-diversity", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let attest_carol = signed_event_with_policy_version(
            CAROL_SECRET,
            "2026-02-03T00:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-2",
            serde_json::json!({ "claimId": "claim-diversity", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );
        let mint = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-02-03T00:04:00Z",
            EventKind::MintCredits,
            "v0-policy-2",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-03T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-diversity" }),
            Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
            None,
        );

        let output = replay_jsonl(
            &[
                serialize(&alice_create),
                serialize(&bob_create),
                serialize(&carol_create),
                serialize(&vouch_bob),
                serialize(&vouch_carol),
                serialize(&policy_update),
                serialize(&claim),
                serialize(&attest_bob),
                serialize(&attest_carol),
                serialize(&mint),
            ]
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-02-04T00:00:00Z").expect("now"),
        );

        assert_eq!(output.invalid_events.len(), 1);
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::IssuanceDiversityViolation
        );
    }

    #[test]
    fn replay_issuance_diversity_allows_cross_lane_counterparty_recovery() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let dave_secret = "4444444444444444444444444444444444444444444444444444444444444444";
        let dave = signing_key_from_hex(dave_secret).expect("dave");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());
        let dave_pk = hex::encode(dave.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-02-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-02-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let dave_create = signed_event(
            dave_secret,
            "2026-02-01T00:00:03Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": dave_pk }),
            None,
            None,
        );
        let vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );
        let vouch_dave = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:01:02Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": dave_pk }),
            None,
            None,
        );

        let claim_one = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-diverse-1", "claimType": "maintenance", "artifactHash": "artifact-diverse-1", "summary": "baseline lane issuance", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_one_bob = signed_event(
            BOB_SECRET,
            "2026-02-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-diverse-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_one.event_id.clone())])),
            None,
        );
        let attest_one_carol = signed_event(
            CAROL_SECRET,
            "2026-02-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-diverse-1", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_one.event_id.clone())])),
            None,
        );
        let mint_one = signed_event(
            ALICE_SECRET,
            "2026-02-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-01T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-diverse-1" }),
            Some(BTreeMap::from([("claim".into(), claim_one.event_id.clone())])),
            None,
        );

        let policy_update = signed_event(
            ALICE_SECRET,
            "2026-02-01T01:00:00Z",
            EventKind::PolicyUpdate,
            serde_json::json!({
                "nextPolicyVersion": "v0-policy-diverse-cross-lane",
                "effectiveAt": "2026-02-02T00:00:00Z",
                "policy": policy_payload_with_issuance_controls(&alice_pk, "v0-policy-diverse-cross-lane", 604800, 0, 0, 3)
            }),
            None,
            None,
        );

        let claim_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-02-03T00:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-diverse-cross-lane",
            serde_json::json!({ "claimId": "claim-diverse-2", "claimType": "documentation", "artifactHash": "artifact-diverse-2", "summary": "cross-lane issuance", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_two_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-02-03T00:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-diverse-cross-lane",
            serde_json::json!({ "claimId": "claim-diverse-2", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_two.event_id.clone())])),
            None,
        );
        let attest_two_dave = signed_event_with_policy_version(
            dave_secret,
            "2026-02-03T00:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-diverse-cross-lane",
            serde_json::json!({ "claimId": "claim-diverse-2", "decision": "approve" }),
            Some(BTreeMap::from([("claim".into(), claim_two.event_id.clone())])),
            None,
        );
        let mint_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-02-03T00:04:00Z",
            EventKind::MintCredits,
            "v0-policy-diverse-cross-lane",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-08-03T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-diverse-2" }),
            Some(BTreeMap::from([("claim".into(), claim_two.event_id.clone())])),
            None,
        );

        let output = replay_jsonl(
            &[
                serialize(&alice_create),
                serialize(&bob_create),
                serialize(&carol_create),
                serialize(&dave_create),
                serialize(&vouch_bob),
                serialize(&vouch_carol),
                serialize(&vouch_dave),
                serialize(&claim_one),
                serialize(&attest_one_bob),
                serialize(&attest_one_carol),
                serialize(&mint_one),
                serialize(&policy_update),
                serialize(&claim_two),
                serialize(&attest_two_bob),
                serialize(&attest_two_dave),
                serialize(&mint_two),
            ]
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-02-04T00:00:00Z").expect("now"),
        );

        assert_eq!(output.invalid_events.len(), 0, "{:?}", output.invalid_events);
        let balance = output.state.balances.get(&alice_pk).expect("alice balance");
        assert_eq!(balance.effective_balance, 20);
    }

    #[test]
    fn economic_eligibility_rejects_when_p2h_band_exceeds_policy_limit() {
        let mut policy = default_policy().clone();
        policy.max_p2h_risk_band = Some(P2HRiskBand::Low);
        let now = parse_timestamp("2026-03-01T00:10:00Z").expect("now");
        let mut context = ReplayContext::new(&policy, now);
        context.issuance_history = vec![
            ReplayIssuanceRecord {
                recipient_root: "alice".into(),
                lane: "contribution".into(),
                counterparties: vec!["bob".into()],
                issued_at: parse_timestamp("2026-03-01T00:01:00Z").expect("t1"),
                source_event_id: "e1".into(),
            },
            ReplayIssuanceRecord {
                recipient_root: "alice".into(),
                lane: "contribution".into(),
                counterparties: vec!["bob".into()],
                issued_at: parse_timestamp("2026-03-01T00:02:00Z").expect("t2"),
                source_event_id: "e2".into(),
            },
            ReplayIssuanceRecord {
                recipient_root: "alice".into(),
                lane: "contribution".into(),
                counterparties: vec!["bob".into()],
                issued_at: parse_timestamp("2026-03-01T00:03:00Z").expect("t3"),
                source_event_id: "e3".into(),
            },
            ReplayIssuanceRecord {
                recipient_root: "alice".into(),
                lane: "contribution".into(),
                counterparties: vec!["bob".into()],
                issued_at: parse_timestamp("2026-03-01T00:04:00Z").expect("t4"),
                source_event_id: "e4".into(),
            },
        ];

        let error = context
            .enforce_economic_eligibility("alice", None, now)
            .expect_err("p2h medium risk should exceed low policy gate");
        assert_eq!(error.0, InvalidReasonCode::EconomicEligibilityViolation);
    }

    #[test]
    fn economic_eligibility_is_noop_when_policy_thresholds_unset() {
        let policy = default_policy().clone();
        let now = parse_timestamp("2026-03-01T00:10:00Z").expect("now");
        let mut context = ReplayContext::new(&policy, now);
        context.issuance_history = vec![ReplayIssuanceRecord {
            recipient_root: "alice".into(),
            lane: "contribution".into(),
            counterparties: vec!["bob".into()],
            issued_at: parse_timestamp("2026-03-01T00:01:00Z").expect("t1"),
            source_event_id: "e1".into(),
        }];

        context
            .enforce_economic_eligibility("alice", None, now)
            .expect("unset policy thresholds should not reject");
    }

    #[test]
    fn replay_soft_gating_enforces_after_policy_effective_time() {
        let alice = signing_key_from_hex(ALICE_SECRET).expect("alice");
        let bob = signing_key_from_hex(BOB_SECRET).expect("bob");
        let carol = signing_key_from_hex(CAROL_SECRET).expect("carol");
        let alice_pk = hex::encode(alice.verifying_key().to_bytes());
        let bob_pk = hex::encode(bob.verifying_key().to_bytes());
        let carol_pk = hex::encode(carol.verifying_key().to_bytes());

        let alice_create = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:00:00Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        );
        let bob_create = signed_event(
            BOB_SECRET,
            "2026-03-01T00:00:01Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        );
        let carol_create = signed_event(
            CAROL_SECRET,
            "2026-03-01T00:00:02Z",
            EventKind::IdentityCreate,
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        );
        let vouch_bob = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:01:00Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        );
        let vouch_carol = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:01:01Z",
            EventKind::Vouch,
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        );
        let claim_one = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:02:00Z",
            EventKind::ContributionClaim,
            serde_json::json!({ "claimId": "claim-ec4-1", "claimType": "maintenance", "artifactHash": "artifact-ec4-1", "summary": "ec4 baseline claim", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_one_bob = signed_event(
            BOB_SECRET,
            "2026-03-01T00:03:00Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-ec4-1", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_one.event_id.clone(),
            )])),
            None,
        );
        let attest_one_carol = signed_event(
            CAROL_SECRET,
            "2026-03-01T00:03:01Z",
            EventKind::ContributionAttest,
            serde_json::json!({ "claimId": "claim-ec4-1", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_one.event_id.clone(),
            )])),
            None,
        );
        let mint_one = signed_event(
            ALICE_SECRET,
            "2026-03-01T00:04:00Z",
            EventKind::MintCredits,
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-09-01T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-ec4-1" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_one.event_id.clone(),
            )])),
            None,
        );
        let policy_update = signed_event(
            ALICE_SECRET,
            "2026-03-01T12:00:00Z",
            EventKind::PolicyUpdate,
            serde_json::json!({
                "nextPolicyVersion": "v0-policy-ec4",
                "effectiveAt": "2026-03-02T00:00:00Z",
                "policy": policy_payload_with_soft_gates(&alice_pk, "v0-policy-ec4", Some(100), None, None)
            }),
            None,
            None,
        );
        let claim_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-03-03T00:02:00Z",
            EventKind::ContributionClaim,
            "v0-policy-ec4",
            serde_json::json!({ "claimId": "claim-ec4-2", "claimType": "maintenance", "artifactHash": "artifact-ec4-2", "summary": "ec4 gated claim", "requestedCredits": 10 }),
            None,
            None,
        );
        let attest_two_bob = signed_event_with_policy_version(
            BOB_SECRET,
            "2026-03-03T00:03:00Z",
            EventKind::ContributionAttest,
            "v0-policy-ec4",
            serde_json::json!({ "claimId": "claim-ec4-2", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_two.event_id.clone(),
            )])),
            None,
        );
        let attest_two_carol = signed_event_with_policy_version(
            CAROL_SECRET,
            "2026-03-03T00:03:01Z",
            EventKind::ContributionAttest,
            "v0-policy-ec4",
            serde_json::json!({ "claimId": "claim-ec4-2", "decision": "approve" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_two.event_id.clone(),
            )])),
            None,
        );
        let mint_two = signed_event_with_policy_version(
            ALICE_SECRET,
            "2026-03-03T00:04:00Z",
            EventKind::MintCredits,
            "v0-policy-ec4",
            serde_json::json!({ "beneficiaryPubKey": alice_pk, "amount": 10, "expiresAt": "2026-09-03T00:04:00Z", "mintReason": "contribution", "sourceClaimId": "claim-ec4-2" }),
            Some(BTreeMap::from([(
                "claim".into(),
                claim_two.event_id.clone(),
            )])),
            None,
        );

        let output = replay_jsonl(
            &[
                serialize(&alice_create),
                serialize(&bob_create),
                serialize(&carol_create),
                serialize(&vouch_bob),
                serialize(&vouch_carol),
                serialize(&claim_one),
                serialize(&attest_one_bob),
                serialize(&attest_one_carol),
                serialize(&mint_one),
                serialize(&policy_update),
                serialize(&claim_two),
                serialize(&attest_two_bob),
                serialize(&attest_two_carol),
                serialize(&mint_two),
            ]
            .join("\n"),
            default_policy(),
            parse_timestamp("2026-03-04T00:00:00Z").expect("now"),
        );

        assert_eq!(output.invalid_events.len(), 1);
        assert_eq!(
            output.invalid_events[0].code,
            InvalidReasonCode::EconomicEligibilityViolation
        );
        let balance = output.state.balances.get(&alice_pk).expect("alice balance");
        assert_eq!(balance.effective_balance, 10);
    }
}
