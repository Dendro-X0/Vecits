use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub const CLAIM_APPROVAL_WEIGHT: i64 = 3;
pub const CLAIM_REJECTION_WEIGHT: i64 = -4;
pub const CONTRIBUTION_MINT_WEIGHT: i64 = 5;
pub const PROVIDER_ACCEPT_WEIGHT: i64 = 4;
pub const BUYER_ACCEPT_WEIGHT: i64 = 1;
pub const SPLIT_SETTLE_WEIGHT: i64 = 2;
pub const REFUND_WIN_WEIGHT: i64 = 3;
pub const REFUND_LOSS_WEIGHT: i64 = -5;
pub const DISPUTE_AGAINST_WEIGHT: i64 = -2;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct LaneAccumulator {
    pub provider_accepts: u64,
    pub buyer_accepts: u64,
    pub split_settles: u64,
    pub refund_wins: u64,
    pub refund_losses: u64,
    pub disputes_against: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ReputationAccumulator {
    pub claim_approvals: u64,
    pub claim_rejections: u64,
    pub contribution_mints: u64,
    pub provider_accepts: u64,
    pub buyer_accepts: u64,
    pub split_settles: u64,
    pub refund_wins: u64,
    pub refund_losses: u64,
    pub disputes_against: u64,
    #[serde(default)]
    pub lanes: BTreeMap<String, LaneAccumulator>,
}

pub fn contribution_score(
    claim_approvals: i64,
    claim_rejections: i64,
    contribution_mints: i64,
) -> i64 {
    (CLAIM_APPROVAL_WEIGHT * claim_approvals)
        + (CLAIM_REJECTION_WEIGHT * claim_rejections)
        + (CONTRIBUTION_MINT_WEIGHT * contribution_mints)
}

pub fn marketplace_score(
    provider_accepts: i64,
    buyer_accepts: i64,
    split_settles: i64,
    refund_wins: i64,
    refund_losses: i64,
    disputes_against: i64,
) -> i64 {
    (PROVIDER_ACCEPT_WEIGHT * provider_accepts)
        + (BUYER_ACCEPT_WEIGHT * buyer_accepts)
        + (SPLIT_SETTLE_WEIGHT * split_settles)
        + (REFUND_WIN_WEIGHT * refund_wins)
        + (REFUND_LOSS_WEIGHT * refund_losses)
        + (DISPUTE_AGAINST_WEIGHT * disputes_against)
}

pub fn contribution_score_from_accumulator(accumulator: &ReputationAccumulator) -> i64 {
    contribution_score(
        accumulator.claim_approvals as i64,
        accumulator.claim_rejections as i64,
        accumulator.contribution_mints as i64,
    )
}

pub fn marketplace_score_from_accumulator(accumulator: &ReputationAccumulator) -> i64 {
    marketplace_score(
        accumulator.provider_accepts as i64,
        accumulator.buyer_accepts as i64,
        accumulator.split_settles as i64,
        accumulator.refund_wins as i64,
        accumulator.refund_losses as i64,
        accumulator.disputes_against as i64,
    )
}

pub fn lane_score_from_accumulator(accumulator: &LaneAccumulator) -> i64 {
    marketplace_score(
        accumulator.provider_accepts as i64,
        accumulator.buyer_accepts as i64,
        accumulator.split_settles as i64,
        accumulator.refund_wins as i64,
        accumulator.refund_losses as i64,
        accumulator.disputes_against as i64,
    )
}

pub fn global_score_from_accumulator(
    trust_weight: i64,
    accumulator: &ReputationAccumulator,
) -> i64 {
    trust_weight
        + contribution_score_from_accumulator(accumulator)
        + marketplace_score_from_accumulator(accumulator)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_formulas_match_phase_24_weights() {
        let mut accumulator = ReputationAccumulator {
            claim_approvals: 2,
            claim_rejections: 1,
            contribution_mints: 1,
            provider_accepts: 1,
            buyer_accepts: 1,
            split_settles: 1,
            refund_wins: 1,
            refund_losses: 1,
            disputes_against: 1,
            lanes: BTreeMap::new(),
        };
        accumulator.lanes.insert(
            "software-fixes".into(),
            LaneAccumulator {
                provider_accepts: 1,
                buyer_accepts: 1,
                split_settles: 1,
                refund_wins: 1,
                refund_losses: 1,
                disputes_against: 1,
            },
        );

        assert_eq!(contribution_score_from_accumulator(&accumulator), 7);
        assert_eq!(marketplace_score_from_accumulator(&accumulator), 3);
        assert_eq!(global_score_from_accumulator(5, &accumulator), 15);
        assert_eq!(
            lane_score_from_accumulator(accumulator.lanes.get("software-fixes").expect("lane")),
            3
        );
    }
}
