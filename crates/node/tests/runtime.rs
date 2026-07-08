use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use node::{LocalNode, hash_value, replay_phase1_from_jsonl};
use protocol_core::{
    PROTOCOL_VERSION, RawEnvelopeLoose, UnsignedEnvelopeLoose, canonicalize_value,
    compute_event_id_loose, parse_timestamp, signing_key_from_hex,
};
use rusqlite::Connection;

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
        .join(format!("node-{label}-{nanos}"));
    fs::create_dir_all(&path).expect("create temp path");
    path
}

fn sign_loose_event(
    secret_key_hex: &str,
    created_at: &str,
    kind: &str,
    payload: serde_json::Value,
) -> RawEnvelopeLoose {
    use ed25519_dalek::Signer;

    let signing_key = signing_key_from_hex(secret_key_hex).expect("signing key");
    let unsigned = UnsignedEnvelopeLoose {
        version: PROTOCOL_VERSION.into(),
        author_pub_key: hex::encode(signing_key.verifying_key().to_bytes()),
        created_at: created_at.into(),
        kind: kind.into(),
        policy_version: "v0-default".into(),
        payload,
        references: None,
        nonce: None,
    };
    let event_id = compute_event_id_loose(&unsigned).expect("event id");
    let canonical =
        canonicalize_value(&unsigned.to_canonical_value().expect("value")).expect("canonical");
    let sig = signing_key.sign(canonical.as_bytes());

    RawEnvelopeLoose {
        version: unsigned.version,
        event_id,
        author_pub_key: unsigned.author_pub_key,
        created_at: unsigned.created_at,
        kind: unsigned.kind,
        policy_version: unsigned.policy_version,
        payload: unsigned.payload,
        references: None,
        nonce: None,
        sig: hex::encode(sig.to_bytes()),
    }
}

fn load_claim_fixture_events() -> Vec<String> {
    let fixture = workspace_root()
        .join("fixtures")
        .join("valid")
        .join("claim-mint-spend.jsonl");
    let content = fs::read_to_string(fixture).expect("fixture");
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>()
}

#[test]
fn ingest_snapshot_and_replay_equivalence() {
    let data_dir = temp_data_dir("runtime");
    let node = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();

    let batch = node.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);
    assert_eq!(batch.accepted_count, events.len());

    let as_of = parse_timestamp("2026-02-01T00:00:00Z").expect("as_of");
    let snapshot_meta = node.create_snapshot(Some(as_of)).expect("snapshot");
    let snapshot = node
        .get_snapshot(&snapshot_meta.snapshot_id)
        .expect("get snapshot")
        .expect("snapshot exists");
    let replay = node.replay(Some(as_of)).expect("replay");

    let replay_hash =
        hash_value(&serde_json::to_value(&replay).expect("replay json")).expect("hash");
    assert_eq!(snapshot.meta.state_hash, replay_hash);

    let stats = node.db_inspect().expect("db stats");
    assert_eq!(stats.event_count as usize, events.len());
    assert_eq!(stats.snapshot_count, 1);
}

#[test]
fn replay_view_uses_snapshot_plus_delta_when_eligible() {
    let data_dir = temp_data_dir("snapshot-plus-delta");
    let node = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();
    let batch = node.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);

    let snapshot_as_of = parse_timestamp("2026-01-01T00:04:00Z").expect("snapshot as_of");
    let snapshot = node
        .create_snapshot(Some(snapshot_as_of))
        .expect("snapshot created");
    assert_eq!(snapshot.format_version, 5);

    let replay_as_of = parse_timestamp("2026-02-01T00:00:00Z").expect("replay as_of");
    let view = node.replay_view(Some(replay_as_of)).expect("replay view");
    assert_eq!(view.source, "snapshot_plus_delta");
    assert_eq!(
        view.snapshot_id.as_deref(),
        Some(snapshot.snapshot_id.as_str())
    );

    let log_content = fs::read_to_string(node.events_log_path()).expect("events log");
    let expected = replay_phase1_from_jsonl(&log_content, Some(replay_as_of));
    assert_eq!(view.data, expected);
}

#[test]
fn replay_view_falls_back_to_genesis_on_backfill() {
    let data_dir = temp_data_dir("backfill-fallback");
    let node = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();
    let batch = node.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);

    let snapshot_as_of = parse_timestamp("2026-02-01T00:00:00Z").expect("snapshot as_of");
    let snapshot = node
        .create_snapshot(Some(snapshot_as_of))
        .expect("snapshot created");
    assert_eq!(snapshot.format_version, 5);

    let backfill_signing_key =
        signing_key_from_hex("4444444444444444444444444444444444444444444444444444444444444444")
            .expect("signing key");
    let backfill_pub_key = hex::encode(backfill_signing_key.verifying_key().to_bytes());
    let backfill = sign_loose_event(
        "4444444444444444444444444444444444444444444444444444444444444444",
        "2026-01-10T00:00:00Z",
        "IdentityCreate",
        serde_json::json!({ "identityPubKey": backfill_pub_key }),
    );
    let ingest = node.ingest_event(&serde_json::to_string(&backfill).expect("json"));
    assert!(ingest.accepted);

    let view = node.replay_view(Some(snapshot_as_of)).expect("replay view");
    assert_eq!(view.source, "genesis_replay");
    assert!(view.snapshot_id.is_none());
}

#[test]
fn replay_view_falls_back_to_genesis_for_legacy_snapshot() {
    let data_dir = temp_data_dir("legacy-snapshot");
    let node = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();
    let batch = node.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);

    let snapshot_as_of = parse_timestamp("2026-01-20T00:00:00Z").expect("snapshot as_of");
    let snapshot = node
        .create_snapshot(Some(snapshot_as_of))
        .expect("snapshot created");

    let connection = Connection::open(node.db_path()).expect("open db");
    connection
        .execute(
            "UPDATE snapshots SET format_version = 3, checkpoint_json = NULL WHERE snapshot_id = ?1",
            [&snapshot.snapshot_id],
        )
        .expect("downgrade snapshot row");

    let view = node.replay_view(Some(snapshot_as_of)).expect("replay view");
    assert_eq!(view.source, "genesis_replay");
    assert!(view.snapshot_id.is_none());
}

#[test]
fn marketplace_events_are_reduced_into_derived_state() {
    let data_dir = temp_data_dir("marketplace");
    let node = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();
    let batch = node.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);

    let raw_marketplace = sign_loose_event(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
        "ServiceOffer",
        serde_json::json!({
            "offerId": "offer-1",
            "serviceType": "software-fixes",
            "unitDefinition": "fix per issue",
            "pricePerUnitCredits": 10,
            "deliveryMode": "artifact",
            "offerExpiresAt": "2026-12-01T00:00:00Z",
            "allowedEvidenceFormats": ["artifactHash"]
        }),
    );
    let ingest = node.ingest_event(&serde_json::to_string(&raw_marketplace).expect("json"));
    assert!(ingest.accepted);

    let page = node
        .list_events(None, 10, Some("ServiceOffer"), None)
        .expect("list");
    assert_eq!(page.events.len(), 1);

    let replay = node.replay(Some(Utc::now())).expect("replay");
    assert!(replay.invalid_events.is_empty());
    assert!(replay.state.offers.contains_key("offer-1"));
}

#[test]
fn initialize_creates_manifest_and_is_idempotent() {
    let data_dir = temp_data_dir("initialize");
    let first = LocalNode::initialize(&data_dir).expect("first init");
    assert!(!first.already_initialized);
    assert_eq!(
        first.manifest.schema_version,
        node::NODE_MANIFEST_SCHEMA_VERSION
    );
    assert!(data_dir.join("manifest.json").exists());
    assert!(data_dir.join("node.db").exists());
    assert!(data_dir.join("events.log").exists());

    let second = LocalNode::initialize(&data_dir).expect("second init");
    assert!(second.already_initialized);
    assert_eq!(second.manifest.created_at, first.manifest.created_at);
}

#[test]
fn events_log_malformed_tail_fails_closed_on_restart() {
    let data_dir = temp_data_dir("malformed-tail");
    let node = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();
    let batch = node.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);

    let log_path = node.events_log_path();
    let mut log_content = fs::read_to_string(log_path).expect("events log");
    log_content.push_str("{\"eventId\":\"partial-write\",\"kind\":\"Offer");
    fs::write(log_path, log_content).expect("append malformed tail");

    let error = LocalNode::new(&data_dir).expect_err("restart should fail closed");
    let message = error.to_string();
    assert!(
        message.contains("events.log fails closed on restart"),
        "unexpected error: {message}"
    );
    assert!(
        message.contains("malformed JSON"),
        "unexpected error: {message}"
    );
}

#[test]
fn events_log_hash_chain_tamper_fails_closed_on_restart() {
    let data_dir = temp_data_dir("hash-chain-tamper");
    LocalNode::initialize_with_options(
        &data_dir,
        node::NodeInitOptions {
            event_log_hash_chain_enabled: true,
        },
    )
    .expect("init");

    let local = LocalNode::new(&data_dir).expect("node");
    let events = load_claim_fixture_events();
    let batch = local.ingest_batch(&events);
    assert_eq!(batch.rejected_count, 0);
    local
        .verify_event_log_hash_chain()
        .expect("chain should verify before tamper");

    let log_path = local.events_log_path();
    let mut log_content = fs::read_to_string(log_path).expect("events log");
    if let Some(first_line) = log_content.lines().find(|line| !line.trim().is_empty()) {
        let tampered = first_line.replacen("\"createdAt\"", "\"createdAtTampered\"", 1);
        log_content = log_content.replacen(first_line, &tampered, 1);
        fs::write(log_path, log_content).expect("tamper events log");
    } else {
        panic!("expected at least one event line");
    }

    let error = LocalNode::new(&data_dir).expect_err("restart should fail closed");
    let message = error.to_string();
    assert!(
        message.contains("hash chain verification failed"),
        "unexpected error: {message}"
    );
}
