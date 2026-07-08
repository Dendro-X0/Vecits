use std::collections::BTreeMap;

use policy::default_policy;
use protocol_core::{
    Event, EventKind, PROTOCOL_VERSION, UnsignedEvent, parse_timestamp, sign_event,
    signing_key_from_hex,
};
use state_engine::{
    ReplayCheckpoint, ReplayInputLine, replay_jsonl, replay_jsonl_from_lines, replay_jsonl_resume,
};

const ALICE_SECRET: &str = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET: &str = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET: &str = "3333333333333333333333333333333333333333333333333333333333333333";

fn pub_key(secret: &str) -> String {
    let signing_key = signing_key_from_hex(secret).expect("signing key");
    hex::encode(signing_key.verifying_key().to_bytes())
}

fn signed_event(
    secret: &str,
    created_at: &str,
    kind: EventKind,
    payload: serde_json::Value,
    references: Option<BTreeMap<String, String>>,
    nonce: Option<&str>,
) -> Event {
    let unsigned = UnsignedEvent {
        version: PROTOCOL_VERSION.into(),
        author_pub_key: pub_key(secret),
        created_at: created_at.into(),
        kind,
        policy_version: policy::DEFAULT_POLICY_VERSION.into(),
        payload,
        references,
        nonce: nonce.map(str::to_string),
    };
    sign_event(&unsigned, secret).expect("signed event")
}

fn serialize(event: &Event) -> String {
    serde_json::to_string(&event.to_raw().expect("raw")).expect("json")
}

fn replay_lines(events: &[String]) -> Vec<ReplayInputLine> {
    events
        .iter()
        .enumerate()
        .map(|(index, raw_json)| ReplayInputLine {
            line: index + 1,
            raw_json: raw_json.clone(),
        })
        .collect()
}

fn build_marketplace_accept_log() -> (String, String, Vec<String>) {
    let alice_pk = pub_key(ALICE_SECRET);
    let bob_pk = pub_key(BOB_SECRET);
    let carol_pk = pub_key(CAROL_SECRET);

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
        serde_json::json!({
            "claimId": "claim-1",
            "claimType": "maintenance",
            "artifactHash": "a1",
            "summary": "claim summary",
            "requestedCredits": 200
        }),
        None,
        None,
    );
    let attest_bob = signed_event(
        BOB_SECRET,
        "2026-03-01T00:03:00Z",
        EventKind::ContributionAttest,
        serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
        None,
    );
    let attest_carol = signed_event(
        CAROL_SECRET,
        "2026-03-01T00:03:01Z",
        EventKind::ContributionAttest,
        serde_json::json!({ "claimId": "claim-1", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim.event_id.clone())])),
        None,
    );
    let mint = signed_event(
        ALICE_SECRET,
        "2026-03-01T00:04:00Z",
        EventKind::MintCredits,
        serde_json::json!({
            "beneficiaryPubKey": alice_pk,
            "amount": 200,
            "expiresAt": "2026-12-01T00:00:00Z",
            "mintReason": "contribution",
            "sourceClaimId": "claim-1"
        }),
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
            "milestones": [{ "milestoneId": "m1", "amountCredits": 100, "evidenceFormat": "artifactHash" }]
        }),
        Some(BTreeMap::from([("offer".into(), offer.event_id.clone())])),
        None,
    );
    let spend = signed_event(
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

    let events = vec![
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
        serialize(&spend),
        serialize(&delivery),
        serialize(&accept),
    ];
    (alice_pk, bob_pk, events)
}

#[test]
fn reputation_global_and_lane_scores_follow_balanced_model() {
    let (alice_pk, bob_pk, events) = build_marketplace_accept_log();
    let output = replay_jsonl(
        &events.join("\n"),
        default_policy(),
        parse_timestamp("2026-04-01T00:00:00Z").expect("as_of"),
    );

    assert!(
        output.invalid_events.is_empty(),
        "{:?}",
        output.invalid_events
    );

    let bob = output
        .state
        .reputations
        .get(&bob_pk)
        .expect("bob reputation");
    assert_eq!(bob.trust_score, 2);
    assert_eq!(bob.marketplace_score, 4);
    assert_eq!(bob.global_score, 6);
    assert_eq!(bob.lanes.get("software-fixes").expect("lane").score, 4);

    let alice = output
        .state
        .reputations
        .get(&alice_pk)
        .expect("alice reputation");
    assert_eq!(alice.contribution_score, 11);
    assert_eq!(alice.marketplace_score, 1);
    assert_eq!(alice.global_score, 12);
}

#[test]
fn reputation_trust_excludes_expired_vouches_and_tracks_revoke_history() {
    let alice_pk = pub_key(ALICE_SECRET);
    let bob_pk = pub_key(BOB_SECRET);

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
    let vouch = signed_event(
        ALICE_SECRET,
        "2026-01-01T00:01:00Z",
        EventKind::Vouch,
        serde_json::json!({
            "subjectPubKey": bob_pk,
            "weight": 1,
            "expiresAt": "2026-01-10T00:00:00Z"
        }),
        None,
        None,
    );
    let revoke = signed_event(
        ALICE_SECRET,
        "2026-01-16T00:00:00Z",
        EventKind::VouchRevoke,
        serde_json::json!({ "subjectPubKey": bob_pk }),
        Some(BTreeMap::from([("vouch".into(), vouch.event_id.clone())])),
        None,
    );

    let before_expiry = replay_jsonl(
        &[
            serialize(&alice_create),
            serialize(&bob_create),
            serialize(&vouch),
        ]
        .join("\n"),
        default_policy(),
        parse_timestamp("2026-01-05T00:00:00Z").expect("as_of"),
    );
    assert_eq!(
        before_expiry
            .state
            .reputations
            .get(&bob_pk)
            .expect("bob")
            .trust_score,
        1
    );

    let after_expiry = replay_jsonl(
        &[
            serialize(&alice_create),
            serialize(&bob_create),
            serialize(&vouch),
            serialize(&revoke),
        ]
        .join("\n"),
        default_policy(),
        parse_timestamp("2026-01-20T00:00:00Z").expect("as_of"),
    );
    assert_eq!(
        after_expiry
            .state
            .reputations
            .get(&bob_pk)
            .expect("bob")
            .trust_score,
        0
    );
    assert!(after_expiry.state.reputation_history.iter().any(|entry| {
        entry.identity_pub_key == bob_pk
            && entry.reason == "VouchRevoke"
            && entry.delta.trust_delta == -1
    }));
}

#[test]
fn reputation_checkpoint_resume_matches_genesis_with_auto_refund() {
    let (alice_pk, bob_pk, mut events) = build_marketplace_accept_log();
    events.pop();

    let delivery_event: Event = {
        let raw = serde_json::from_str::<protocol_core::RawEventEnvelope>(
            events.last().expect("delivery"),
        )
        .expect("raw event");
        raw.into_event().expect("typed event")
    };
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
            delivery_event.event_id.clone(),
        )])),
        None,
    );
    events.push(serialize(&dispute));

    let lines = replay_lines(&events);
    let as_of = parse_timestamp("2026-05-01T00:00:00Z").expect("as_of");

    let expected = replay_jsonl_from_lines(&lines, default_policy(), as_of);
    let split = lines.len() / 2;
    let first_run = replay_jsonl_resume(&lines[..split], default_policy(), as_of, None);
    let serialized = serde_json::to_string(&first_run.checkpoint).expect("checkpoint json");
    let checkpoint: ReplayCheckpoint = serde_json::from_str(&serialized).expect("checkpoint");
    let resumed = replay_jsonl_resume(&lines[split..], default_policy(), as_of, Some(checkpoint));

    assert_eq!(expected, resumed.replay);
    assert!(
        expected
            .state
            .reputation_history
            .iter()
            .any(|entry| entry.reason == "AutoRefunded.provider"
                && entry.event_id.starts_with("auto-refund:order-1:m1"))
    );

    let buyer_score = expected
        .state
        .reputations
        .get(&alice_pk)
        .expect("buyer")
        .global_score;
    let provider_score = expected
        .state
        .reputations
        .get(&bob_pk)
        .expect("provider")
        .global_score;
    assert!(buyer_score > provider_score);
}
