use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::http::{Method, Request, StatusCode};
use node::{LocalNode, build_router};
use protocol_core::{EventKind, PROTOCOL_VERSION, UnsignedEvent, sign_event, signing_key_from_hex};
use serde_json::Value;
use tower::ServiceExt;

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
        .join(format!("api-{label}-{nanos}"));
    fs::create_dir_all(&path).expect("create temp path");
    path
}

fn write_peers_config(data_dir: &std::path::Path, json: serde_json::Value) {
    let path = data_dir.join("peers.json");
    fs::write(path, format!("{json}\n")).expect("write peers config");
}

fn load_fixture_events(name: &str) -> Vec<String> {
    load_fixture_events_from("valid", name)
}

fn load_fixture_events_from(group: &str, name: &str) -> Vec<String> {
    let fixture = workspace_root().join("fixtures").join(group).join(name);
    let content = fs::read_to_string(fixture).expect("fixture");
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>()
}

fn signed_identity_create(secret_key: &str, created_at: &str) -> serde_json::Value {
    let signing_key = signing_key_from_hex(secret_key).expect("signing key");
    let public_key = hex::encode(signing_key.verifying_key().to_bytes());
    let unsigned = UnsignedEvent {
        version: PROTOCOL_VERSION.into(),
        author_pub_key: public_key.clone(),
        created_at: created_at.into(),
        kind: EventKind::IdentityCreate,
        policy_version: "v0-default".into(),
        payload: serde_json::json!({
            "identityPubKey": public_key
        }),
        references: None,
        nonce: None,
    };
    let event = sign_event(&unsigned, secret_key).expect("signed");
    serde_json::to_value(event.to_raw().expect("raw")).expect("json")
}

fn signed_service_offer(secret_key: &str, created_at: &str, offer_id: &str) -> serde_json::Value {
    let signing_key = signing_key_from_hex(secret_key).expect("signing key");
    let public_key = hex::encode(signing_key.verifying_key().to_bytes());
    let unsigned = UnsignedEvent {
        version: PROTOCOL_VERSION.into(),
        author_pub_key: public_key,
        created_at: created_at.into(),
        kind: EventKind::ServiceOffer,
        policy_version: "v0-default".into(),
        payload: serde_json::json!({
            "offerId": offer_id,
            "serviceType": "software-fixes",
            "unitDefinition": "fix per issue",
            "pricePerUnitCredits": 10,
            "deliveryMode": "artifact",
            "offerExpiresAt": "2026-12-01T00:00:00Z",
            "allowedEvidenceFormats": ["artifactHash"]
        }),
        references: None,
        nonce: None,
    };
    let event = sign_event(&unsigned, secret_key).expect("signed");
    serde_json::to_value(event.to_raw().expect("raw")).expect("json")
}

fn signed_event_value(
    secret_key: &str,
    created_at: &str,
    kind: EventKind,
    policy_version: &str,
    payload: serde_json::Value,
    references: Option<BTreeMap<String, String>>,
    nonce: Option<&str>,
) -> serde_json::Value {
    let signing_key = signing_key_from_hex(secret_key).expect("signing key");
    let public_key = hex::encode(signing_key.verifying_key().to_bytes());
    let unsigned = UnsignedEvent {
        version: PROTOCOL_VERSION.into(),
        author_pub_key: public_key,
        created_at: created_at.into(),
        kind,
        policy_version: policy_version.into(),
        payload,
        references,
        nonce: nonce.map(str::to_string),
    };
    let event = sign_event(&unsigned, secret_key).expect("signed");
    serde_json::to_value(event.to_raw().expect("raw")).expect("json")
}

fn signed_policy_update(
    secret_key: &str,
    created_at: &str,
    effective_at: &str,
    next_policy_version: &str,
) -> serde_json::Value {
    let signing_key = signing_key_from_hex(secret_key).expect("signing key");
    let authority_pub_key = hex::encode(signing_key.verifying_key().to_bytes());
    let unsigned = UnsignedEvent {
        version: PROTOCOL_VERSION.into(),
        author_pub_key: authority_pub_key.clone(),
        created_at: created_at.into(),
        kind: EventKind::PolicyUpdate,
        policy_version: "v0-default".into(),
        payload: serde_json::json!({
            "nextPolicyVersion": next_policy_version,
            "effectiveAt": effective_at,
            "policy": {
                "version": next_policy_version,
                "clockSkewSeconds": 300,
                "creditDefaultExpiryDays": 180,
                "providerRewardExpiryDays": 90,
                "demurrageRateWeeklyBps": 100,
                "claimApprovalThreshold": 2,
                "maxContributionClaimCredits": 1000,
                "allowedServiceTypes": ["software-fixes", "documentation"],
                "maxMilestonesPerOrder": 16,
                "maxMilestoneCredits": 5000,
                "acceptanceWindowSeconds": 7200,
                "disputeTimeoutSeconds": 1209600,
                "providerEligibilityThreshold": 2,
                "attestorEligibilityThreshold": 1,
                "allowedSinkKinds": ["ServiceEscrowSink", "ComputeSink", "AISink", "StorageSink", "BountySink"],
                "policyAuthorityPubKey": authority_pub_key
            }
        }),
        references: None,
        nonce: None,
    };
    let event = sign_event(&unsigned, secret_key).expect("signed");
    serde_json::to_value(event.to_raw().expect("raw")).expect("json")
}

async fn response_json(response: axum::response::Response) -> Value {
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    serde_json::from_slice(&bytes).expect("json body")
}

#[tokio::test]
async fn api_health_endpoint_returns_kernel_and_data_dir_status() {
    let data_dir = temp_data_dir("health");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let manifest = node.read_manifest().expect("manifest").expect("present");
    assert_eq!(manifest.schema_version, node::NODE_MANIFEST_SCHEMA_VERSION);
    assert_eq!(manifest.kernel.protocol_version, PROTOCOL_VERSION);
    assert_eq!(
        manifest.kernel.snapshot_format_version,
        node::CURRENT_SNAPSHOT_FORMAT_VERSION
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri("/health")
        .body(Body::empty())
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;
    assert_eq!(body["status"], "ok");
    assert_eq!(body["kernel"]["protocol_version"], PROTOCOL_VERSION);
    assert_eq!(body["kernel"]["replay_engine"], "state-engine");
    assert_eq!(
        body["kernel"]["snapshot_format_version"],
        node::CURRENT_SNAPSHOT_FORMAT_VERSION
    );
    assert_eq!(body["data_dir"]["events_log_exists"], true);
    assert_eq!(body["data_dir"]["database_exists"], true);
    assert_eq!(body["data_dir"]["manifest_exists"], true);
    assert_eq!(body["data_dir"]["event_count"], 0);
}

#[tokio::test]
async fn api_health_endpoint_does_not_leak_peers_secrets() {
    let data_dir = temp_data_dir("health-no-secrets");
    write_peers_config(
        &data_dir,
        serde_json::json!({
            "version": 1,
            "read_token": "super-secret-read-token-value",
            "peers": [{
                "id": "peer-a",
                "base_url": "http://127.0.0.1:7979",
                "enabled": true,
                "read_token": "peer-level-secret-token"
            }]
        }),
    );
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/health")
        .body(Body::empty())
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;
    let serialized = body.to_string();
    assert!(!serialized.contains("super-secret-read-token-value"));
    assert!(!serialized.contains("peer-level-secret-token"));
}

#[tokio::test]
async fn api_ingest_events_and_snapshot_flow() {
    let data_dir = temp_data_dir("ingest");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let event = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .body(Body::from(event.to_string()))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/events?limit=10")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/replay")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-01T00:00:01Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn api_events_requires_auth_when_read_token_configured() {
    let data_dir = temp_data_dir("events-auth");
    write_peers_config(
        &data_dir,
        serde_json::json!({
            "version": 1,
            "read_token": "test-token",
            "peers": []
        }),
    );
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/events?limit=10")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/events?limit=10")
        .header("authorization", "Bearer test-token")
        .body(Body::empty())
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn api_snapshot_reads_require_auth_when_read_token_configured() {
    let data_dir = temp_data_dir("snapshots-auth");
    write_peers_config(
        &data_dir,
        serde_json::json!({
            "version": 1,
            "read_token": "test-token",
            "peers": []
        }),
    );
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let event = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .body(Body::from(event.to_string()))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-01T00:00:01Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"].as_str().expect("snapshot id");

    let request = Request::builder()
        .method(Method::GET)
        .uri("/snapshots/latest")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/snapshots/latest")
        .header("authorization", "Bearer test-token")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/snapshots/{snapshot_id}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/snapshots/{snapshot_id}"))
        .header("authorization", "Bearer test-token")
        .body(Body::empty())
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn api_sync_observability_endpoints_return_runtime_views() {
    let data_dir = temp_data_dir("sync-observability");
    write_peers_config(
        &data_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "peer-a",
                "base_url": "http://127.0.0.1:7979",
                "enabled": true
            }]
        }),
    );
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/sync/status")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let status_body = response_json(response).await;
    assert_eq!(status_body["enabled"], true);
    assert_eq!(status_body["interval_seconds"], 30);
    assert_eq!(status_body["max_parallel_peers"], 4);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/sync/peers")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let peers_body = response_json(response).await;
    assert_eq!(peers_body["peers"][0]["peer_id"], "peer-a");
    assert_eq!(peers_body["peers"][0]["enabled"], true);
    assert_eq!(peers_body["peers"][0]["last_remote_cursor"], 0);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/sync/peers?peer=peer-a")
        .body(Body::empty())
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let filtered_body = response_json(response).await;
    assert_eq!(
        filtered_body["peers"]
            .as_array()
            .map_or(0, |items| items.len()),
        1
    );
}

#[tokio::test]
async fn api_state_endpoints_return_source_and_snapshot_metadata() {
    let data_dir = temp_data_dir("source-metadata");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let event = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    let identity = event["authorPubKey"].as_str().expect("pubkey").to_string();

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .body(Body::from(event.to_string()))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-01T00:00:01Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/replay?as_of=2026-03-01T00:00:01Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    assert_eq!(replay_body["source"], "snapshot_plus_delta");
    assert_eq!(replay_body["snapshot_id"], snapshot_id);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/identity/{identity}?as_of=2026-03-01T00:00:01Z"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let identity_body = response_json(response).await;
    assert_eq!(identity_body["source"], "snapshot_plus_delta");
    assert_eq!(identity_body["snapshot_id"], snapshot_id);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/balance/{identity}?as_of=2026-03-01T00:00:01Z"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let balance_body = response_json(response).await;
    assert_eq!(balance_body["source"], "snapshot_plus_delta");
    assert_eq!(balance_body["snapshot_id"], snapshot_id);
}

#[tokio::test]
async fn api_marketplace_read_endpoints_return_state() {
    let data_dir = temp_data_dir("marketplace-read");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let identity_a = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    let identity_b = signed_identity_create(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-03-01T00:00:01Z",
    );
    let identity_c = signed_identity_create(
        "3333333333333333333333333333333333333333333333333333333333333333",
        "2026-03-01T00:00:02Z",
    );
    let vouch_1 = {
        let provider_pub = identity_b["authorPubKey"]
            .as_str()
            .expect("provider")
            .to_string();
        let unsigned = UnsignedEvent {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: identity_a["authorPubKey"].as_str().expect("a").into(),
            created_at: "2026-03-01T00:00:03Z".into(),
            kind: EventKind::Vouch,
            policy_version: "v0-default".into(),
            payload: serde_json::json!({ "subjectPubKey": provider_pub }),
            references: None,
            nonce: None,
        };
        serde_json::to_value(
            sign_event(
                &unsigned,
                "1111111111111111111111111111111111111111111111111111111111111111",
            )
            .expect("signed")
            .to_raw()
            .expect("raw"),
        )
        .expect("json")
    };
    let vouch_2 = {
        let provider_pub = identity_b["authorPubKey"]
            .as_str()
            .expect("provider")
            .to_string();
        let unsigned = UnsignedEvent {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: identity_c["authorPubKey"].as_str().expect("c").into(),
            created_at: "2026-03-01T00:00:04Z".into(),
            kind: EventKind::Vouch,
            policy_version: "v0-default".into(),
            payload: serde_json::json!({ "subjectPubKey": provider_pub }),
            references: None,
            nonce: None,
        };
        serde_json::to_value(
            sign_event(
                &unsigned,
                "3333333333333333333333333333333333333333333333333333333333333333",
            )
            .expect("signed")
            .to_raw()
            .expect("raw"),
        )
        .expect("json")
    };
    let offer = signed_service_offer(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-03-01T00:00:05Z",
        "offer-1",
    );

    for event in [identity_a, identity_b, identity_c, vouch_1, vouch_2, offer] {
        let request = Request::builder()
            .method(Method::POST)
            .uri("/events")
            .header("content-type", "application/json")
            .body(Body::from(event.to_string()))
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/offer/offer-1?as_of=2026-03-01T00:00:06Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let offer_body = response_json(response).await;
    assert_eq!(offer_body["data"]["offer_id"], "offer-1");
}

#[tokio::test]
async fn api_marketplace_accept_flow_transitions_are_replay_stable() {
    let data_dir = temp_data_dir("marketplace-accept-flow");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";
    let carol_secret = "3333333333333333333333333333333333333333333333333333333333333333";

    let alice_pk = hex::encode(
        signing_key_from_hex(alice_secret)
            .expect("alice key")
            .verifying_key()
            .to_bytes(),
    );
    let bob_pk = hex::encode(
        signing_key_from_hex(bob_secret)
            .expect("bob key")
            .verifying_key()
            .to_bytes(),
    );
    let carol_pk = hex::encode(
        signing_key_from_hex(carol_secret)
            .expect("carol key")
            .verifying_key()
            .to_bytes(),
    );

    let alice_create = signed_event_value(
        alice_secret,
        "2026-06-01T00:00:00Z",
        EventKind::IdentityCreate,
        "v0-default",
        serde_json::json!({ "identityPubKey": alice_pk }),
        None,
        None,
    );
    let bob_create = signed_event_value(
        bob_secret,
        "2026-06-01T00:00:01Z",
        EventKind::IdentityCreate,
        "v0-default",
        serde_json::json!({ "identityPubKey": bob_pk }),
        None,
        None,
    );
    let carol_create = signed_event_value(
        carol_secret,
        "2026-06-01T00:00:02Z",
        EventKind::IdentityCreate,
        "v0-default",
        serde_json::json!({ "identityPubKey": carol_pk }),
        None,
        None,
    );

    let vouch_alice_to_bob = signed_event_value(
        alice_secret,
        "2026-06-01T00:01:00Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": bob_pk }),
        None,
        None,
    );
    let vouch_carol_to_bob = signed_event_value(
        carol_secret,
        "2026-06-01T00:01:01Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": bob_pk }),
        None,
        None,
    );
    let vouch_alice_to_carol = signed_event_value(
        alice_secret,
        "2026-06-01T00:01:02Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": carol_pk }),
        None,
        None,
    );

    let claim = signed_event_value(
        alice_secret,
        "2026-06-01T00:02:00Z",
        EventKind::ContributionClaim,
        "v0-default",
        serde_json::json!({
            "claimId": "claim-accept-node",
            "claimType": "maintenance",
            "artifactHash": "claim-accept-artifact",
            "summary": "accept flow buyer credits",
            "requestedCredits": 200
        }),
        None,
        None,
    );
    let claim_event_id = claim["eventId"]
        .as_str()
        .expect("claim event id")
        .to_string();
    let attest_bob = signed_event_value(
        bob_secret,
        "2026-06-01T00:03:00Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-accept-node", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    );
    let attest_carol = signed_event_value(
        carol_secret,
        "2026-06-01T00:03:01Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-accept-node", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    );
    let mint = signed_event_value(
        alice_secret,
        "2026-06-01T00:04:00Z",
        EventKind::MintCredits,
        "v0-default",
        serde_json::json!({
            "beneficiaryPubKey": alice_pk,
            "amount": 200,
            "expiresAt": "2026-12-01T00:00:00Z",
            "mintReason": "contribution",
            "sourceClaimId": "claim-accept-node"
        }),
        Some(BTreeMap::from([("claim".into(), claim_event_id)])),
        None,
    );

    let offer = signed_event_value(
        bob_secret,
        "2026-06-01T00:05:00Z",
        EventKind::ServiceOffer,
        "v0-default",
        serde_json::json!({
            "offerId": "offer-accept-node",
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
    let offer_event_id = offer["eventId"]
        .as_str()
        .expect("offer event id")
        .to_string();
    let order = signed_event_value(
        alice_secret,
        "2026-06-01T00:06:00Z",
        EventKind::ServiceOrder,
        "v0-default",
        serde_json::json!({
            "orderId": "order-accept-node",
            "offerId": "offer-accept-node",
            "providerPubKey": bob_pk,
            "buyerPubKey": alice_pk,
            "orderExpiresAt": "2026-12-01T00:00:00Z",
            "milestones": [{
                "milestoneId": "m1",
                "amountCredits": 100,
                "evidenceFormat": "artifactHash"
            }]
        }),
        Some(BTreeMap::from([("offer".into(), offer_event_id)])),
        None,
    );
    let order_event_id = order["eventId"]
        .as_str()
        .expect("order event id")
        .to_string();
    let spend = signed_event_value(
        alice_secret,
        "2026-06-01T00:07:00Z",
        EventKind::SpendCredits,
        "v0-default",
        serde_json::json!({
            "spenderPubKey": alice_pk,
            "sinkKind": "ServiceEscrowSink",
            "amount": 100,
            "orderId": "order-accept-node",
            "milestoneId": "m1"
        }),
        None,
        Some("escrow-accept-1"),
    );
    let delivery = signed_event_value(
        bob_secret,
        "2026-06-01T00:08:00Z",
        EventKind::ServiceDelivery,
        "v0-default",
        serde_json::json!({
            "orderId": "order-accept-node",
            "milestoneId": "m1",
            "evidenceFormat": "artifactHash",
            "artifactHashes": ["delivery-hash-1"],
            "deliveredAt": "2026-06-01T00:08:00Z"
        }),
        Some(BTreeMap::from([("order".into(), order_event_id)])),
        None,
    );
    let delivery_event_id = delivery["eventId"]
        .as_str()
        .expect("delivery event id")
        .to_string();
    let accept = signed_event_value(
        alice_secret,
        "2026-06-01T00:09:00Z",
        EventKind::ServiceAccept,
        "v0-default",
        serde_json::json!({
            "orderId": "order-accept-node",
            "milestoneId": "m1",
            "acceptedAt": "2026-06-01T00:09:00Z"
        }),
        Some(BTreeMap::from([("delivery".into(), delivery_event_id)])),
        None,
    );

    let lines = vec![
        alice_create,
        bob_create,
        carol_create,
        vouch_alice_to_bob,
        vouch_carol_to_bob,
        vouch_alice_to_carol,
        claim,
        attest_bob,
        attest_carol,
        mint,
        offer,
        order,
        spend,
        delivery,
        accept,
    ]
    .into_iter()
    .map(|value| serde_json::to_string(&value).expect("line"))
    .collect::<Vec<_>>();

    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-06-01T00:10:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/order/order-accept-node?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let order_body = response_json(response).await;
    assert_eq!(order_body["data"]["order_id"], "order-accept-node");
    assert_eq!(order_body["data"]["offer_id"], "offer-accept-node");
    assert_eq!(order_body["data"]["status"], "closed");
    assert_eq!(order_body["data"]["milestone_ids"][0], "m1");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/milestone/order-accept-node/m1?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body = response_json(response).await;
    assert_eq!(milestone_body["data"]["status"], "Accepted");
    assert_eq!(milestone_body["data"]["funded_amount"], 100);
    assert_eq!(milestone_body["data"]["provider_reward_credits"], 100);
    assert!(
        milestone_body["data"]["buyer_refund_credits"].is_null()
            || milestone_body["data"]["buyer_refund_credits"] == 0
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/milestone/order-accept-node/m1?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body_again = response_json(response).await;
    assert_eq!(milestone_body_again, milestone_body);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/balance/{alice_pk}?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let buyer_balance = response_json(response).await;
    assert_eq!(buyer_balance["data"]["effective_balance"], 100);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/balance/{bob_pk}?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let provider_balance = response_json(response).await;
    assert_eq!(provider_balance["data"]["effective_balance"], 100);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    if replay_body["data"]["invalid_events"]
        .as_array()
        .map_or(0, |items| items.len())
        > 0
    {
        panic!(
            "invalid_events={}",
            serde_json::to_string_pretty(&replay_body["data"]["invalid_events"])
                .expect("invalid events json")
        );
    }
    assert_eq!(
        replay_body["data"]["invalid_events"]
            .as_array()
            .map_or(0, |items| items.len()),
        0
    );
    assert_eq!(
        replay_body["data"]["state"]["milestones"]["order-accept-node:m1"]["status"],
        "Accepted"
    );
}

#[tokio::test]
async fn api_marketplace_dispute_settlement_handshake_is_replay_stable() {
    let data_dir = temp_data_dir("marketplace-dispute-settle");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let events = load_fixture_events("marketplace-dispute-settle.jsonl");
    let ingest = node.ingest_batch(&events);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-01T00:11:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/order/mk-settle-order?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let order_body = response_json(response).await;
    assert_eq!(order_body["data"]["order_id"], "mk-settle-order");
    assert_eq!(order_body["data"]["status"], "closed");
    assert_eq!(order_body["data"]["milestone_ids"][0], "m1");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/milestone/mk-settle-order/m1?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body = response_json(response).await;
    assert_eq!(milestone_body["data"]["status"], "Settled");
    assert_eq!(milestone_body["data"]["funded_amount"], 100);
    assert_eq!(milestone_body["data"]["buyer_refund_credits"], 40);
    assert_eq!(milestone_body["data"]["provider_reward_credits"], 60);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/milestone/mk-settle-order/m1?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body_again = response_json(response).await;
    assert_eq!(milestone_body_again, milestone_body);

    let buyer_pub_key = "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737";
    let provider_pub_key = "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/balance/{buyer_pub_key}?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let buyer_balance_body = response_json(response).await;
    assert_eq!(buyer_balance_body["data"]["effective_balance"], 140);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/balance/{provider_pub_key}?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let provider_balance_body = response_json(response).await;
    assert_eq!(provider_balance_body["data"]["effective_balance"], 60);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    if replay_body["data"]["invalid_events"]
        .as_array()
        .map_or(0, |items| items.len())
        > 0
    {
        panic!(
            "invalid_events={}",
            serde_json::to_string_pretty(&replay_body["data"]["invalid_events"])
                .expect("invalid events json")
        );
    }
    assert_eq!(
        replay_body["data"]["invalid_events"]
            .as_array()
            .map_or(0, |items| items.len()),
        0
    );
    assert_eq!(
        replay_body["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "Settled"
    );
}

#[tokio::test]
async fn api_marketplace_dispute_timeout_autorefund_is_replay_stable() {
    let data_dir = temp_data_dir("marketplace-dispute-timeout");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let events = load_fixture_events("marketplace-dispute-settle.jsonl")
        .into_iter()
        .filter(|line| {
            serde_json::from_str::<Value>(line)
                .ok()
                .and_then(|value| value["kind"].as_str().map(str::to_string))
                .map(|kind| kind != "ServiceSettle")
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&events);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let early_as_of = "2026-03-01T00:11:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/milestone/mk-settle-order/m1?as_of={early_as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let early_milestone = response_json(response).await;
    assert_eq!(early_milestone["data"]["status"], "Disputed");

    let late_as_of = "2026-04-01T00:00:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/order/mk-settle-order?as_of={late_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let order_body = response_json(response).await;
    assert_eq!(order_body["data"]["status"], "closed");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/milestone/mk-settle-order/m1?as_of={late_as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body = response_json(response).await;
    assert_eq!(milestone_body["data"]["status"], "AutoRefunded");
    assert_eq!(milestone_body["data"]["funded_amount"], 100);
    assert_eq!(milestone_body["data"]["buyer_refund_credits"], 100);
    assert!(
        milestone_body["data"]["provider_reward_credits"] == 0
            || milestone_body["data"]["provider_reward_credits"].is_null()
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/milestone/mk-settle-order/m1?as_of={late_as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body_again = response_json(response).await;
    assert_eq!(milestone_body_again, milestone_body);

    let buyer_pub_key = "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737";
    let provider_pub_key = "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/balance/{buyer_pub_key}?as_of={late_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let buyer_balance_body = response_json(response).await;
    assert_eq!(buyer_balance_body["data"]["effective_balance"], 196);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/balance/{provider_pub_key}?as_of={late_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let provider_balance_body = response_json(response).await;
    assert!(
        provider_balance_body["data"].is_null()
            || provider_balance_body["data"]["effective_balance"] == 0
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={late_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    let invalid_count = replay_body["data"]["invalid_events"]
        .as_array()
        .map_or(0, |items| items.len());
    if invalid_count > 0 {
        panic!(
            "invalid_events={}",
            serde_json::to_string_pretty(&replay_body["data"]["invalid_events"])
                .expect("invalid events json")
        );
    }
    assert_eq!(invalid_count, 0);
    assert_eq!(
        replay_body["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "AutoRefunded"
    );
}

#[tokio::test]
async fn api_marketplace_accept_flow_covers_initial_digital_lanes() {
    let data_dir = temp_data_dir("marketplace-accept-initial-lanes");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let lanes = [
        "software-fixes",
        "feature-work",
        "documentation",
        "translation",
        "testing",
        "research",
        "project-maintenance",
    ];

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";
    let carol_secret = "3333333333333333333333333333333333333333333333333333333333333333";

    let alice_pk = hex::encode(
        signing_key_from_hex(alice_secret)
            .expect("alice key")
            .verifying_key()
            .to_bytes(),
    );
    let bob_pk = hex::encode(
        signing_key_from_hex(bob_secret)
            .expect("bob key")
            .verifying_key()
            .to_bytes(),
    );
    let carol_pk = hex::encode(
        signing_key_from_hex(carol_secret)
            .expect("carol key")
            .verifying_key()
            .to_bytes(),
    );

    let mut events = vec![
        signed_event_value(
            alice_secret,
            "2026-08-01T00:00:00Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        ),
        signed_event_value(
            bob_secret,
            "2026-08-01T00:00:01Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        ),
        signed_event_value(
            carol_secret,
            "2026-08-01T00:00:02Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        ),
        signed_event_value(
            alice_secret,
            "2026-08-01T00:00:03Z",
            EventKind::Vouch,
            "v0-default",
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        ),
        signed_event_value(
            carol_secret,
            "2026-08-01T00:00:04Z",
            EventKind::Vouch,
            "v0-default",
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        ),
        signed_event_value(
            alice_secret,
            "2026-08-01T00:00:05Z",
            EventKind::Vouch,
            "v0-default",
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        ),
    ];

    let claim = signed_event_value(
        alice_secret,
        "2026-08-01T00:00:06Z",
        EventKind::ContributionClaim,
        "v0-default",
        serde_json::json!({
            "claimId": "claim-initial-lanes-accept",
            "claimType": "maintenance",
            "artifactHash": "claim-initial-lanes-accept-artifact",
            "summary": "initial lane accept coverage",
            "requestedCredits": 500
        }),
        None,
        None,
    );
    let claim_event_id = claim["eventId"]
        .as_str()
        .expect("claim event id")
        .to_string();
    events.push(claim);
    events.push(signed_event_value(
        bob_secret,
        "2026-08-01T00:00:07Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-initial-lanes-accept", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    ));
    events.push(signed_event_value(
        carol_secret,
        "2026-08-01T00:00:08Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-initial-lanes-accept", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    ));
    events.push(signed_event_value(
        alice_secret,
        "2026-08-01T00:00:09Z",
        EventKind::MintCredits,
        "v0-default",
        serde_json::json!({
            "beneficiaryPubKey": alice_pk,
            "amount": 500,
            "expiresAt": "2026-12-01T00:00:00Z",
            "mintReason": "contribution",
            "sourceClaimId": "claim-initial-lanes-accept"
        }),
        Some(BTreeMap::from([("claim".into(), claim_event_id)])),
        None,
    ));

    let mut second = 10_i32;
    for (index, lane) in lanes.iter().enumerate() {
        let slug = lane.replace('-', "_");
        let offer_id = format!("initial-{slug}-offer");
        let order_id = format!("initial-{slug}-order");
        let milestone_id = "m1";
        let offer_time = format!("2026-08-01T00:00:{second:02}Z");
        second += 1;
        let order_time = format!("2026-08-01T00:00:{second:02}Z");
        second += 1;
        let spend_time = format!("2026-08-01T00:00:{second:02}Z");
        second += 1;
        let delivery_time = format!("2026-08-01T00:00:{second:02}Z");
        second += 1;
        let accept_time = format!("2026-08-01T00:00:{second:02}Z");
        second += 1;

        let offer = signed_event_value(
            bob_secret,
            &offer_time,
            EventKind::ServiceOffer,
            "v0-default",
            serde_json::json!({
                "offerId": offer_id,
                "serviceType": lane,
                "unitDefinition": "lane unit",
                "pricePerUnitCredits": 20,
                "deliveryMode": "artifact",
                "offerExpiresAt": "2026-12-01T00:00:00Z",
                "allowedEvidenceFormats": ["artifactHash"]
            }),
            None,
            None,
        );
        let offer_event_id = offer["eventId"]
            .as_str()
            .expect("offer event id")
            .to_string();
        events.push(offer);

        let order = signed_event_value(
            alice_secret,
            &order_time,
            EventKind::ServiceOrder,
            "v0-default",
            serde_json::json!({
                "orderId": order_id,
                "offerId": format!("initial-{slug}-offer"),
                "providerPubKey": bob_pk,
                "buyerPubKey": alice_pk,
                "orderExpiresAt": "2026-12-01T00:00:00Z",
                "milestones": [{
                    "milestoneId": milestone_id,
                    "amountCredits": 20,
                    "evidenceFormat": "artifactHash"
                }]
            }),
            Some(BTreeMap::from([("offer".into(), offer_event_id)])),
            None,
        );
        let order_event_id = order["eventId"]
            .as_str()
            .expect("order event id")
            .to_string();
        events.push(order);

        events.push(signed_event_value(
            alice_secret,
            &spend_time,
            EventKind::SpendCredits,
            "v0-default",
            serde_json::json!({
                "spenderPubKey": alice_pk,
                "sinkKind": "ServiceEscrowSink",
                "amount": 20,
                "orderId": format!("initial-{slug}-order"),
                "milestoneId": milestone_id
            }),
            None,
            Some(&format!("initial-lane-spend-{index}")),
        ));

        let delivery = signed_event_value(
            bob_secret,
            &delivery_time,
            EventKind::ServiceDelivery,
            "v0-default",
            serde_json::json!({
                "orderId": format!("initial-{slug}-order"),
                "milestoneId": milestone_id,
                "evidenceFormat": "artifactHash",
                "artifactHashes": [format!("initial-lane-delivery-{slug}")],
                "deliveredAt": delivery_time
            }),
            Some(BTreeMap::from([("order".into(), order_event_id)])),
            None,
        );
        let delivery_event_id = delivery["eventId"]
            .as_str()
            .expect("delivery event id")
            .to_string();
        events.push(delivery);

        events.push(signed_event_value(
            alice_secret,
            &accept_time,
            EventKind::ServiceAccept,
            "v0-default",
            serde_json::json!({
                "orderId": format!("initial-{slug}-order"),
                "milestoneId": milestone_id,
                "acceptedAt": accept_time
            }),
            Some(BTreeMap::from([("delivery".into(), delivery_event_id)])),
            None,
        ));
    }

    let lines = events
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    if ingest.rejected_count != 0 {
        panic!(
            "rejected_count={} results={}",
            ingest.rejected_count,
            serde_json::to_string_pretty(&ingest.results).expect("ingest results json")
        );
    }

    let as_of = "2026-08-01T00:00:59Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    let invalid_count = replay_body["data"]["invalid_events"]
        .as_array()
        .map_or(0, |items| items.len());
    if invalid_count > 0 {
        panic!(
            "invalid_events={}",
            serde_json::to_string_pretty(&replay_body["data"]["invalid_events"])
                .expect("invalid events json")
        );
    }
    assert_eq!(invalid_count, 0);

    for lane in lanes {
        let slug = lane.replace('-', "_");
        let order_id = format!("initial-{slug}-order");
        let request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/order/{order_id}?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let order_body = response_json(response).await;
        assert_eq!(order_body["data"]["status"], "closed");

        let request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/milestone/{order_id}/m1?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let milestone_body = response_json(response).await;
        assert_eq!(milestone_body["data"]["status"], "Accepted");
    }
}

#[tokio::test]
async fn api_marketplace_dispute_timeout_covers_initial_digital_lanes() {
    let data_dir = temp_data_dir("marketplace-dispute-timeout-initial-lanes");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let lanes = [
        "software-fixes",
        "feature-work",
        "documentation",
        "translation",
        "testing",
        "research",
        "project-maintenance",
    ];

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";
    let carol_secret = "3333333333333333333333333333333333333333333333333333333333333333";

    let alice_pk = hex::encode(
        signing_key_from_hex(alice_secret)
            .expect("alice key")
            .verifying_key()
            .to_bytes(),
    );
    let bob_pk = hex::encode(
        signing_key_from_hex(bob_secret)
            .expect("bob key")
            .verifying_key()
            .to_bytes(),
    );
    let carol_pk = hex::encode(
        signing_key_from_hex(carol_secret)
            .expect("carol key")
            .verifying_key()
            .to_bytes(),
    );

    let mut events = vec![
        signed_event_value(
            alice_secret,
            "2026-08-02T00:00:00Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": alice_pk }),
            None,
            None,
        ),
        signed_event_value(
            bob_secret,
            "2026-08-02T00:00:01Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": bob_pk }),
            None,
            None,
        ),
        signed_event_value(
            carol_secret,
            "2026-08-02T00:00:02Z",
            EventKind::IdentityCreate,
            "v0-default",
            serde_json::json!({ "identityPubKey": carol_pk }),
            None,
            None,
        ),
        signed_event_value(
            alice_secret,
            "2026-08-02T00:00:03Z",
            EventKind::Vouch,
            "v0-default",
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        ),
        signed_event_value(
            carol_secret,
            "2026-08-02T00:00:04Z",
            EventKind::Vouch,
            "v0-default",
            serde_json::json!({ "subjectPubKey": bob_pk }),
            None,
            None,
        ),
        signed_event_value(
            alice_secret,
            "2026-08-02T00:00:05Z",
            EventKind::Vouch,
            "v0-default",
            serde_json::json!({ "subjectPubKey": carol_pk }),
            None,
            None,
        ),
    ];

    let claim = signed_event_value(
        alice_secret,
        "2026-08-02T00:00:06Z",
        EventKind::ContributionClaim,
        "v0-default",
        serde_json::json!({
            "claimId": "claim-initial-lanes-dispute",
            "claimType": "maintenance",
            "artifactHash": "claim-initial-lanes-dispute-artifact",
            "summary": "initial lane dispute coverage",
            "requestedCredits": 500
        }),
        None,
        None,
    );
    let claim_event_id = claim["eventId"]
        .as_str()
        .expect("claim event id")
        .to_string();
    events.push(claim);
    events.push(signed_event_value(
        bob_secret,
        "2026-08-02T00:00:07Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-initial-lanes-dispute", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    ));
    events.push(signed_event_value(
        carol_secret,
        "2026-08-02T00:00:08Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-initial-lanes-dispute", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    ));
    events.push(signed_event_value(
        alice_secret,
        "2026-08-02T00:00:09Z",
        EventKind::MintCredits,
        "v0-default",
        serde_json::json!({
            "beneficiaryPubKey": alice_pk,
            "amount": 500,
            "expiresAt": "2026-12-01T00:00:00Z",
            "mintReason": "contribution",
            "sourceClaimId": "claim-initial-lanes-dispute"
        }),
        Some(BTreeMap::from([("claim".into(), claim_event_id)])),
        None,
    ));

    let mut second = 10_i32;
    for (index, lane) in lanes.iter().enumerate() {
        let slug = lane.replace('-', "_");
        let offer_id = format!("initial-dispute-{slug}-offer");
        let order_id = format!("initial-dispute-{slug}-order");
        let milestone_id = "m1";
        let offer_time = format!("2026-08-02T00:00:{second:02}Z");
        second += 1;
        let order_time = format!("2026-08-02T00:00:{second:02}Z");
        second += 1;
        let spend_time = format!("2026-08-02T00:00:{second:02}Z");
        second += 1;
        let delivery_time = format!("2026-08-02T00:00:{second:02}Z");
        second += 1;
        let dispute_time = format!("2026-08-02T00:00:{second:02}Z");
        second += 1;

        let offer = signed_event_value(
            bob_secret,
            &offer_time,
            EventKind::ServiceOffer,
            "v0-default",
            serde_json::json!({
                "offerId": offer_id,
                "serviceType": lane,
                "unitDefinition": "lane unit",
                "pricePerUnitCredits": 20,
                "deliveryMode": "artifact",
                "offerExpiresAt": "2026-12-01T00:00:00Z",
                "allowedEvidenceFormats": ["artifactHash"]
            }),
            None,
            None,
        );
        let offer_event_id = offer["eventId"]
            .as_str()
            .expect("offer event id")
            .to_string();
        events.push(offer);

        let order = signed_event_value(
            alice_secret,
            &order_time,
            EventKind::ServiceOrder,
            "v0-default",
            serde_json::json!({
                "orderId": order_id,
                "offerId": format!("initial-dispute-{slug}-offer"),
                "providerPubKey": bob_pk,
                "buyerPubKey": alice_pk,
                "orderExpiresAt": "2026-12-01T00:00:00Z",
                "milestones": [{
                    "milestoneId": milestone_id,
                    "amountCredits": 20,
                    "evidenceFormat": "artifactHash"
                }]
            }),
            Some(BTreeMap::from([("offer".into(), offer_event_id)])),
            None,
        );
        let order_event_id = order["eventId"]
            .as_str()
            .expect("order event id")
            .to_string();
        events.push(order);

        events.push(signed_event_value(
            alice_secret,
            &spend_time,
            EventKind::SpendCredits,
            "v0-default",
            serde_json::json!({
                "spenderPubKey": alice_pk,
                "sinkKind": "ServiceEscrowSink",
                "amount": 20,
                "orderId": format!("initial-dispute-{slug}-order"),
                "milestoneId": milestone_id
            }),
            None,
            Some(&format!("initial-dispute-spend-{index}")),
        ));

        let delivery = signed_event_value(
            bob_secret,
            &delivery_time,
            EventKind::ServiceDelivery,
            "v0-default",
            serde_json::json!({
                "orderId": format!("initial-dispute-{slug}-order"),
                "milestoneId": milestone_id,
                "evidenceFormat": "artifactHash",
                "artifactHashes": [format!("initial-dispute-delivery-{slug}")],
                "deliveredAt": delivery_time
            }),
            Some(BTreeMap::from([("order".into(), order_event_id)])),
            None,
        );
        let delivery_event_id = delivery["eventId"]
            .as_str()
            .expect("delivery event id")
            .to_string();
        events.push(delivery);

        events.push(signed_event_value(
            alice_secret,
            &dispute_time,
            EventKind::ServiceDispute,
            "v0-default",
            serde_json::json!({
                "orderId": format!("initial-dispute-{slug}-order"),
                "milestoneId": milestone_id,
                "reasonCode": "quality-mismatch",
                "disputedAt": dispute_time
            }),
            Some(BTreeMap::from([("delivery".into(), delivery_event_id)])),
            None,
        ));
    }

    let lines = events
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(
        ingest.rejected_count,
        0,
        "{}",
        serde_json::to_string_pretty(&ingest.results).expect("ingest results json")
    );

    let early_as_of = "2026-08-02T00:00:59Z";
    for lane in lanes {
        let slug = lane.replace('-', "_");
        let order_id = format!("initial-dispute-{slug}-order");
        let request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/milestone/{order_id}/m1?as_of={early_as_of}"))
            .body(Body::empty())
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let milestone_body = response_json(response).await;
        assert_eq!(milestone_body["data"]["status"], "Disputed");
    }

    let late_as_of = "2026-09-01T00:00:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={late_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    assert_eq!(
        replay_body["data"]["invalid_events"]
            .as_array()
            .map_or(0, |items| items.len()),
        0
    );

    for lane in lanes {
        let slug = lane.replace('-', "_");
        let key = format!("initial-dispute-{slug}-order:m1");
        assert_eq!(replay_body["data"]["state"]["milestones"][key]["status"], "AutoRefunded");
    }
}

#[tokio::test]
async fn api_marketplace_deadlock_same_actor_settlement_rejects_with_replay_parity() {
    let data_dir = temp_data_dir("marketplace-deadlock-same-actor");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let mut parsed = load_fixture_events("marketplace-dispute-settle.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();

    let dispute_event_id = parsed
        .iter()
        .find(|event| event["kind"] == "ServiceDispute")
        .and_then(|event| event["eventId"].as_str())
        .expect("fixture dispute event id")
        .to_string();
    parsed.retain(|event| event["kind"] != "ServiceSettle");

    let settle_1 = signed_event_value(
        alice_secret,
        "2026-03-01T00:10:00Z",
        EventKind::ServiceSettle,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-settle-order",
            "milestoneId": "m1",
            "outcome": "split",
            "buyerRefundCredits": 40,
            "providerRewardCredits": 60,
            "settledAt": "2026-03-01T00:10:00Z"
        }),
        Some(BTreeMap::from([("dispute".into(), dispute_event_id.clone())])),
        None,
    );
    let settle_2_same_actor = signed_event_value(
        alice_secret,
        "2026-03-01T00:10:30Z",
        EventKind::ServiceSettle,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-settle-order",
            "milestoneId": "m1",
            "outcome": "split",
            "buyerRefundCredits": 40,
            "providerRewardCredits": 60,
            "settledAt": "2026-03-01T00:10:30Z"
        }),
        Some(BTreeMap::from([("dispute".into(), dispute_event_id)])),
        None,
    );
    parsed.push(settle_1);
    parsed.push(settle_2_same_actor);

    let lines = parsed
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let early_as_of = "2026-03-01T00:11:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/milestone/mk-settle-order/m1?as_of={early_as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let early_milestone = response_json(response).await;
    assert_eq!(early_milestone["data"]["status"], "SettlementPending");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={early_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;
    let invalid_events = replay_genesis["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    assert_eq!(invalid_events.len(), 1);
    let code = invalid_events[0]["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("INVALID_STATE_TRANSITION"),
        "unexpected invalid code: {code}"
    );
    assert!(
        invalid_events[0]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("counterparty")
    );
    assert_eq!(
        replay_genesis["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "SettlementPending"
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{early_as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={early_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
    assert_eq!(
        replay_snapshot["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "SettlementPending"
    );

    let late_as_of = "2026-04-01T00:00:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/milestone/mk-settle-order/m1?as_of={late_as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let late_milestone = response_json(response).await;
    assert_eq!(late_milestone["data"]["status"], "AutoRefunded");
}

#[tokio::test]
async fn api_marketplace_settlement_missing_dispute_reference_rejected_deterministically() {
    let data_dir = temp_data_dir("marketplace-settle-missing-dispute-ref");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let mut parsed = load_fixture_events("marketplace-dispute-settle.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();
    parsed.retain(|event| event["kind"] != "ServiceSettle");

    let settle_missing_reference = signed_event_value(
        alice_secret,
        "2026-03-01T00:10:00Z",
        EventKind::ServiceSettle,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-settle-order",
            "milestoneId": "m1",
            "outcome": "split",
            "buyerRefundCredits": 40,
            "providerRewardCredits": 60,
            "settledAt": "2026-03-01T00:10:00Z"
        }),
        None,
        None,
    );
    parsed.push(settle_missing_reference);

    let lines = parsed
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let early_as_of = "2026-03-01T00:11:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={early_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;
    let invalid_events = replay_genesis["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    assert_eq!(invalid_events.len(), 1);
    let code = invalid_events[0]["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("MISSING_REFERENCE"),
        "unexpected invalid code: {code}"
    );
    assert!(
        invalid_events[0]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("dispute")
    );
    assert_eq!(
        replay_genesis["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "Disputed"
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{early_as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={early_as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
    assert_eq!(
        replay_snapshot["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "Disputed"
    );

    let late_as_of = "2026-04-01T00:00:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/milestone/mk-settle-order/m1?as_of={late_as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let late_milestone = response_json(response).await;
    assert_eq!(late_milestone["data"]["status"], "AutoRefunded");
}

#[tokio::test]
async fn api_missing_reference_fixtures_preserve_reason_code_parity_across_replay_sources() {
    let cases = [
        (
            "missing-reference.jsonl",
            "ContributionAttest",
            "2026-01-20T00:01:00Z",
            "claim",
        ),
        (
            "marketplace-missing-reference.jsonl",
            "ServiceDispute",
            "2026-03-01T00:10:00Z",
            "delivery",
        ),
    ];

    for (fixture, target_kind, as_of, hint) in cases {
        let label = fixture.trim_end_matches(".jsonl").replace('-', "_");
        let data_dir = temp_data_dir(&format!("missing-ref-parity-{label}"));
        let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
        let app = build_router(node.clone());

        let parsed = load_fixture_events_from("invalid", fixture)
            .into_iter()
            .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
            .collect::<Vec<_>>();
        let lines = parsed
            .iter()
            .map(|value| serde_json::to_string(value).expect("line"))
            .collect::<Vec<_>>();
        let ingest = node.ingest_batch(&lines);
        assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

        let target_event_id = parsed
            .iter()
            .find(|event| event["kind"] == target_kind)
            .and_then(|event| event["eventId"].as_str())
            .expect("target fixture event id")
            .to_string();

        let request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/replay?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let replay_genesis = response_json(response).await;
        let invalid_events = replay_genesis["data"]["invalid_events"]
            .as_array()
            .expect("invalid events array");
        let invalid_by_event_id = invalid_events
            .iter()
            .filter_map(|entry| {
                entry["event_id"]
                    .as_str()
                    .map(|event_id| (event_id.to_string(), entry))
            })
            .collect::<BTreeMap<_, _>>();
        let invalid = invalid_by_event_id
            .get(&target_event_id)
            .expect("target invalid event");
        let code = invalid["code"].as_str().unwrap_or_default();
        assert!(
            code.contains("MISSING_REFERENCE"),
            "unexpected invalid code for {fixture}: {code}"
        );
        assert!(
            invalid["message"].as_str().unwrap_or_default().contains(hint),
            "unexpected invalid message for {fixture}: {}",
            invalid["message"].as_str().unwrap_or_default()
        );

        let request = Request::builder()
            .method(Method::POST)
            .uri("/snapshots")
            .header("content-type", "application/json")
            .body(Body::from(format!("{{\"as_of\":\"{as_of}\"}}")))
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let snapshot_body = response_json(response).await;
        let snapshot_id = snapshot_body["snapshot_id"]
            .as_str()
            .expect("snapshot id")
            .to_string();

        let request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/replay?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let replay_snapshot = response_json(response).await;
        assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
        assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
        assert_eq!(
            replay_snapshot["data"]["invalid_events"],
            replay_genesis["data"]["invalid_events"]
        );
    }
}

#[tokio::test]
async fn api_marketplace_second_settlement_signature_from_unauthorized_actor_rejects_deterministically()
{
    let data_dir = temp_data_dir("marketplace-settlement-unauthorized-actor");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let carol_secret = "3333333333333333333333333333333333333333333333333333333333333333";
    let mut parsed = load_fixture_events("marketplace-dispute-settle.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();

    let dispute_event_id = parsed
        .iter()
        .find(|event| event["kind"] == "ServiceDispute")
        .and_then(|event| event["eventId"].as_str())
        .expect("fixture dispute event id")
        .to_string();
    parsed.retain(|event| event["kind"] != "ServiceSettle");

    let settle_1 = signed_event_value(
        alice_secret,
        "2026-03-01T00:10:00Z",
        EventKind::ServiceSettle,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-settle-order",
            "milestoneId": "m1",
            "outcome": "split",
            "buyerRefundCredits": 40,
            "providerRewardCredits": 60,
            "settledAt": "2026-03-01T00:10:00Z"
        }),
        Some(BTreeMap::from([("dispute".into(), dispute_event_id.clone())])),
        None,
    );
    let settle_2_unauthorized = signed_event_value(
        carol_secret,
        "2026-03-01T00:10:30Z",
        EventKind::ServiceSettle,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-settle-order",
            "milestoneId": "m1",
            "outcome": "buyerWins",
            "buyerRefundCredits": 100,
            "providerRewardCredits": 0,
            "settledAt": "2026-03-01T00:10:30Z"
        }),
        Some(BTreeMap::from([("dispute".into(), dispute_event_id)])),
        None,
    );
    let unauthorized_event_id = settle_2_unauthorized["eventId"]
        .as_str()
        .expect("unauthorized settle event id")
        .to_string();
    parsed.push(settle_1);
    parsed.push(settle_2_unauthorized);

    let lines = parsed
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-01T00:11:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;
    let invalid_events = replay_genesis["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    let invalid_by_event_id = invalid_events
        .iter()
        .filter_map(|entry| {
            entry["event_id"]
                .as_str()
                .map(|event_id| (event_id.to_string(), entry))
        })
        .collect::<BTreeMap<_, _>>();
    let unauthorized_invalid = invalid_by_event_id
        .get(&unauthorized_event_id)
        .expect("unauthorized settlement invalid event");
    let code = unauthorized_invalid["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("UNAUTHORIZED_ACTOR"),
        "unexpected invalid code: {code}"
    );
    assert!(
        unauthorized_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("buyer or provider")
    );
    assert_eq!(
        replay_genesis["data"]["state"]["milestones"]["mk-settle-order:m1"]["status"],
        "SettlementPending"
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
}

#[tokio::test]
async fn api_marketplace_overfund_with_stale_policy_version_rejects_with_policy_violation() {
    let data_dir = temp_data_dir("marketplace-overfund-stale-policy");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let authority_secret =
        "1111111111111111111111111111111111111111111111111111111111111111";
    let policy_update = signed_policy_update(
        authority_secret,
        "2026-03-01T00:00:30Z",
        "2026-03-01T00:08:15Z",
        "v0-policy-overfund",
    );
    let stale_overfund_spend = signed_event_value(
        authority_secret,
        "2026-03-01T00:08:30Z",
        EventKind::SpendCredits,
        "v0-default",
        serde_json::json!({
            "amount": 1,
            "milestoneId": "m1",
            "orderId": "mk-overfund-order",
            "sinkKind": "ServiceEscrowSink",
            "spenderPubKey": "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737"
        }),
        None,
        Some("mk-overfund-stale-policy-escrow-2"),
    );
    let stale_spend_event_id = stale_overfund_spend["eventId"]
        .as_str()
        .expect("stale spend event id")
        .to_string();

    let mut parsed = load_fixture_events_from("invalid", "marketplace-overfunding.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();
    let mut spend_seen = 0usize;
    parsed.retain(|event| {
        if event["kind"] == "SpendCredits" {
            spend_seen += 1;
            return spend_seen < 2;
        }
        true
    });
    parsed.insert(1, policy_update);
    parsed.push(stale_overfund_spend);

    let lines = parsed
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-01T00:10:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay = response_json(response).await;
    let invalid_events = replay["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    let invalid_by_event_id = invalid_events
        .iter()
        .filter_map(|entry| {
            entry["event_id"]
                .as_str()
                .map(|event_id| (event_id.to_string(), entry))
        })
        .collect::<BTreeMap<_, _>>();
    let stale_invalid = invalid_by_event_id
        .get(&stale_spend_event_id)
        .expect("stale overfund invalid event");
    let code = stale_invalid["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("POLICY_VIOLATION"),
        "unexpected invalid code: {code}"
    );
    assert!(
        stale_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("policyVersion")
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/milestone/mk-overfund-order/m1?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone = response_json(response).await;
    assert_eq!(milestone["data"]["funded_amount"], 100);
}

#[tokio::test]
async fn api_onboarding_guardrails_reject_self_vouch_and_duplicate_active_vouch() {
    let data_dir = temp_data_dir("onboarding-vouch-guardrails");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";

    let alice_create = signed_identity_create(alice_secret, "2026-03-01T00:00:00Z");
    let bob_create = signed_identity_create(bob_secret, "2026-03-01T00:00:01Z");
    let alice_pub_key = alice_create["authorPubKey"]
        .as_str()
        .expect("alice pubkey")
        .to_string();
    let bob_pub_key = bob_create["authorPubKey"]
        .as_str()
        .expect("bob pubkey")
        .to_string();

    let sponsor_vouch = signed_event_value(
        bob_secret,
        "2026-03-01T00:00:10Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": alice_pub_key }),
        None,
        None,
    );
    let duplicate_vouch = signed_event_value(
        bob_secret,
        "2026-03-01T00:00:11Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": alice_pub_key }),
        None,
        None,
    );
    let self_vouch = signed_event_value(
        alice_secret,
        "2026-03-01T00:00:12Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": alice_pub_key }),
        None,
        None,
    );

    let duplicate_vouch_event_id = duplicate_vouch["eventId"]
        .as_str()
        .expect("duplicate vouch event id")
        .to_string();
    let self_vouch_event_id = self_vouch["eventId"]
        .as_str()
        .expect("self vouch event id")
        .to_string();

    let lines = vec![
        alice_create,
        bob_create,
        sponsor_vouch,
        duplicate_vouch,
        self_vouch,
    ]
    .into_iter()
    .map(|value| serde_json::to_string(&value).expect("line"))
    .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-01T00:00:20Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;

    let invalid_events = replay_genesis["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    assert_eq!(invalid_events.len(), 2);
    let invalid_by_event_id = invalid_events
        .iter()
        .filter_map(|item| {
            item["event_id"]
                .as_str()
                .map(|event_id| (event_id.to_string(), item.clone()))
        })
        .collect::<BTreeMap<_, _>>();

    let duplicate_invalid = invalid_by_event_id
        .get(&duplicate_vouch_event_id)
        .expect("duplicate vouch invalid event");
    let duplicate_code = duplicate_invalid["code"].as_str().unwrap_or_default();
    assert!(
        duplicate_code.contains("INVALID_STATE_TRANSITION"),
        "unexpected duplicate-vouch code: {duplicate_code}"
    );
    assert!(
        duplicate_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("active vouch already exists")
    );

    let self_invalid = invalid_by_event_id
        .get(&self_vouch_event_id)
        .expect("self vouch invalid event");
    let self_code = self_invalid["code"].as_str().unwrap_or_default();
    assert!(
        self_code.contains("UNAUTHORIZED_ACTOR") || self_code.contains("INVALID_STATE_TRANSITION"),
        "unexpected self-vouch code: {self_code}"
    );
    assert!(
        self_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("self-vouch")
    );

    let vouches = replay_genesis["data"]["state"]["vouches"]
        .as_array()
        .expect("vouches array");
    assert_eq!(vouches.len(), 1);
    assert_eq!(vouches[0]["voucher_pub_key"], bob_pub_key);
    assert_eq!(vouches[0]["subject_pub_key"], alice_pub_key);
    assert_eq!(vouches[0]["status"], "active");

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
    assert_eq!(
        replay_snapshot["data"]["state"]["vouches"],
        replay_genesis["data"]["state"]["vouches"]
    );
}

#[tokio::test]
async fn api_marketplace_offline_lane_template_mismatch_rejections_are_deterministic() {
    let data_dir = temp_data_dir("marketplace-offline-template-mismatch");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";

    let alice_pub_key = hex::encode(
        signing_key_from_hex(alice_secret)
            .expect("alice signing key")
            .verifying_key()
            .to_bytes(),
    );
    let bob_pub_key = hex::encode(
        signing_key_from_hex(bob_secret)
            .expect("bob signing key")
            .verifying_key()
            .to_bytes(),
    );

    let mut parsed = load_fixture_events("marketplace-accept.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();

    let local_offer = signed_event_value(
        bob_secret,
        "2026-03-01T00:12:00Z",
        EventKind::ServiceOffer,
        "v0-default",
        serde_json::json!({
            "offerId": "mk-local-template-offer",
            "serviceType": "local-resource-exchange",
            "unitDefinition": "local resource handoff",
            "pricePerUnitCredits": 30,
            "deliveryMode": "local-community",
            "offerExpiresAt": "2026-12-01T00:00:00Z",
            "allowedEvidenceFormats": ["local-resource-receipt-v1"]
        }),
        None,
        None,
    );
    let local_offer_event_id = local_offer["eventId"]
        .as_str()
        .expect("local offer event id")
        .to_string();

    let bad_order = signed_event_value(
        alice_secret,
        "2026-03-01T00:12:30Z",
        EventKind::ServiceOrder,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-local-order-bad-template",
            "offerId": "mk-local-template-offer",
            "providerPubKey": bob_pub_key,
            "buyerPubKey": alice_pub_key,
            "orderExpiresAt": "2026-12-01T00:00:00Z",
            "milestones": [{
                "milestoneId": "m1",
                "amountCredits": 30,
                "evidenceFormat": "artifactHash"
            }]
        }),
        Some(BTreeMap::from([("offer".into(), local_offer_event_id.clone())])),
        None,
    );
    let bad_order_event_id = bad_order["eventId"]
        .as_str()
        .expect("bad order event id")
        .to_string();

    let good_order = signed_event_value(
        alice_secret,
        "2026-03-01T00:12:40Z",
        EventKind::ServiceOrder,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-local-order-good-template",
            "offerId": "mk-local-template-offer",
            "providerPubKey": bob_pub_key,
            "buyerPubKey": alice_pub_key,
            "orderExpiresAt": "2026-12-01T00:00:00Z",
            "milestones": [{
                "milestoneId": "m1",
                "amountCredits": 30,
                "evidenceFormat": "local-resource-receipt-v1"
            }]
        }),
        Some(BTreeMap::from([("offer".into(), local_offer_event_id)])),
        None,
    );
    let good_order_event_id = good_order["eventId"]
        .as_str()
        .expect("good order event id")
        .to_string();

    let spend = signed_event_value(
        alice_secret,
        "2026-03-01T00:12:50Z",
        EventKind::SpendCredits,
        "v0-default",
        serde_json::json!({
            "spenderPubKey": alice_pub_key,
            "sinkKind": "ServiceEscrowSink",
            "amount": 30,
            "orderId": "mk-local-order-good-template",
            "milestoneId": "m1"
        }),
        None,
        Some("mk-local-template-spend-1"),
    );

    let bad_delivery = signed_event_value(
        bob_secret,
        "2026-03-01T00:13:00Z",
        EventKind::ServiceDelivery,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-local-order-good-template",
            "milestoneId": "m1",
            "evidenceFormat": "artifactHash",
            "artifactHashes": ["artifact-mismatch"],
            "deliveredAt": "2026-03-01T00:13:00Z"
        }),
        Some(BTreeMap::from([("order".into(), good_order_event_id)])),
        None,
    );
    let bad_delivery_event_id = bad_delivery["eventId"]
        .as_str()
        .expect("bad delivery event id")
        .to_string();

    parsed.push(local_offer);
    parsed.push(bad_order);
    parsed.push(good_order);
    parsed.push(spend);
    parsed.push(bad_delivery);

    let lines = parsed
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-01T00:13:20Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;
    let invalid_events = replay_genesis["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    assert!(
        invalid_events.len() >= 2,
        "expected at least two invalid events, got {}",
        invalid_events.len()
    );
    let invalid_by_event_id = invalid_events
        .iter()
        .filter_map(|item| {
            item["event_id"]
                .as_str()
                .map(|event_id| (event_id.to_string(), item.clone()))
        })
        .collect::<BTreeMap<_, _>>();

    let bad_order_invalid = invalid_by_event_id
        .get(&bad_order_event_id)
        .expect("bad order invalid event");
    let bad_order_code = bad_order_invalid["code"].as_str().unwrap_or_default();
    assert!(
        bad_order_code.contains("POLICY_VIOLATION"),
        "unexpected bad-order code: {bad_order_code}"
    );
    assert!(
        bad_order_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("milestone evidenceFormat is not allowed by offer")
    );

    let bad_delivery_invalid = invalid_by_event_id
        .get(&bad_delivery_event_id)
        .expect("bad delivery invalid event");
    let bad_delivery_code = bad_delivery_invalid["code"].as_str().unwrap_or_default();
    assert!(
        bad_delivery_code.contains("INVALID_PAYLOAD"),
        "unexpected bad-delivery code: {bad_delivery_code}"
    );
    assert!(
        bad_delivery_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("evidenceFormat does not match milestone")
    );

    assert_eq!(
        replay_genesis["data"]["state"]["milestones"]["mk-local-order-good-template:m1"]["status"],
        "Funded"
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
    assert_eq!(
        replay_snapshot["data"]["state"]["milestones"]["mk-local-order-good-template:m1"]["status"],
        "Funded"
    );
}

#[tokio::test]
async fn api_duplicate_nonce_rejected_with_stable_reason_and_snapshot_parity() {
    let data_dir = temp_data_dir("duplicate-nonce-reason");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let parsed = load_fixture_events_from("invalid", "duplicate-nonce.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();
    let lines = parsed
        .iter()
        .map(|value| serde_json::to_string(value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let duplicate_spend_event_id = parsed
        .iter()
        .filter(|event| event["kind"] == "SpendCredits")
        .nth(1)
        .and_then(|event| event["eventId"].as_str())
        .expect("second spend event id")
        .to_string();

    let as_of = "2026-02-01T00:00:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;
    let invalid_events = replay_genesis["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    let invalid_by_event_id = invalid_events
        .iter()
        .filter_map(|entry| {
            entry["event_id"]
                .as_str()
                .map(|event_id| (event_id.to_string(), entry))
        })
        .collect::<BTreeMap<_, _>>();
    let duplicate_invalid = invalid_by_event_id
        .get(&duplicate_spend_event_id)
        .expect("duplicate nonce invalid event");
    let code = duplicate_invalid["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("INVALID_NONCE"),
        "unexpected invalid code: {code}"
    );
    assert!(
        duplicate_invalid["message"]
            .as_str()
            .unwrap_or_default()
            .contains("already been used")
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
}

#[tokio::test]
async fn api_bad_signature_fixture_rejected_with_stable_reason_and_snapshot_parity() {
    let data_dir = temp_data_dir("bad-signature-reason");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let event = load_fixture_events_from("invalid", "bad-signature.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .next()
        .expect("bad signature fixture event");
    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .body(Body::from(event.to_string()))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let reject_body = response_json(response).await;
    let code = reject_body["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("BAD_SIGNATURE"),
        "unexpected reject code: {code}"
    );

    let as_of = "2026-01-01T00:01:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_genesis = response_json(response).await;
    assert_eq!(
        replay_genesis["data"]["invalid_events"]
            .as_array()
            .map_or(0, |items| items.len()),
        0
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from(format!("{{\"as_of\":\"{as_of}\"}}")))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_snapshot = response_json(response).await;
    assert_eq!(replay_snapshot["source"], "snapshot_plus_delta");
    assert_eq!(replay_snapshot["snapshot_id"], snapshot_id);
    assert_eq!(
        replay_snapshot["data"]["invalid_events"],
        replay_genesis["data"]["invalid_events"]
    );
}

#[tokio::test]
async fn api_checked_in_non_software_lane_fixture_bundles_replay_cleanly() {
    let cases = [
        (
            "marketplace-feature-work-accept.jsonl",
            "feature-work",
            "feature-work-accept-offer",
            "feature-work-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-documentation-accept.jsonl",
            "documentation",
            "documentation-accept-offer",
            "documentation-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-translation-accept.jsonl",
            "translation",
            "translation-accept-offer",
            "translation-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-testing-accept.jsonl",
            "testing",
            "testing-accept-offer",
            "testing-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-research-accept.jsonl",
            "research",
            "research-accept-offer",
            "research-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-project-maintenance-accept.jsonl",
            "project-maintenance",
            "project-maintenance-accept-offer",
            "project-maintenance-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-feature-work-dispute.jsonl",
            "feature-work",
            "feature-work-dispute-offer",
            "feature-work-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
        (
            "marketplace-documentation-dispute.jsonl",
            "documentation",
            "documentation-dispute-offer",
            "documentation-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
        (
            "marketplace-translation-dispute.jsonl",
            "translation",
            "translation-dispute-offer",
            "translation-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
        (
            "marketplace-testing-dispute.jsonl",
            "testing",
            "testing-dispute-offer",
            "testing-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
        (
            "marketplace-research-dispute.jsonl",
            "research",
            "research-dispute-offer",
            "research-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
        (
            "marketplace-project-maintenance-dispute.jsonl",
            "project-maintenance",
            "project-maintenance-dispute-offer",
            "project-maintenance-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
        (
            "marketplace-compute-job-accept.jsonl",
            "compute-job",
            "compute-job-accept-offer",
            "compute-job-accept-order",
            "2026-03-05T00:15:00Z",
            "Accepted",
        ),
        (
            "marketplace-compute-job-dispute.jsonl",
            "compute-job",
            "compute-job-dispute-offer",
            "compute-job-dispute-order",
            "2026-04-01T00:00:00Z",
            "AutoRefunded",
        ),
    ];

    for (fixture_name, lane, offer_id, order_id, as_of, milestone_status) in cases {
        let fixture_label = fixture_name.trim_end_matches(".jsonl").replace('-', "_");
        let data_dir = temp_data_dir(&format!("fixture-bundle-{fixture_label}"));
        let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
        let app = build_router(node.clone());
        let events = load_fixture_events(fixture_name);
        let ingest = node.ingest_batch(&events);
        assert_eq!(
            ingest.rejected_count, 0,
            "fixture should ingest cleanly: {fixture_name}"
        );

        let replay_request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/replay?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let replay_response = app
            .clone()
            .oneshot(replay_request)
            .await
            .expect("replay response");
        assert_eq!(replay_response.status(), StatusCode::OK);
        let replay_body = response_json(replay_response).await;
        let invalid_count = replay_body["data"]["invalid_events"]
            .as_array()
            .map_or(0, |items| items.len());
        assert_eq!(
            invalid_count, 0,
            "fixture replay should not report invalid events: {fixture_name}"
        );

        let order_request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/order/{order_id}?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let order_response = app
            .clone()
            .oneshot(order_request)
            .await
            .expect("order response");
        assert_eq!(order_response.status(), StatusCode::OK);
        let order_body = response_json(order_response).await;
        assert_eq!(order_body["data"]["status"], "closed");

        let milestone_request = Request::builder()
            .method(Method::GET)
            .uri(format!("/state/milestone/{order_id}/m1?as_of={as_of}"))
            .body(Body::empty())
            .expect("request");
        let milestone_response = app
            .clone()
            .oneshot(milestone_request)
            .await
            .expect("milestone response");
        assert_eq!(milestone_response.status(), StatusCode::OK);
        let milestone_body = response_json(milestone_response).await;
        assert_eq!(milestone_body["data"]["status"], milestone_status);

        let discovery_request = Request::builder()
            .method(Method::GET)
            .uri(format!(
                "/state/discovery?service_type={lane}&alpha_defaults=0&limit=50&as_of={as_of}"
            ))
            .body(Body::empty())
            .expect("request");
        let discovery_response = app
            .clone()
            .oneshot(discovery_request)
            .await
            .expect("discovery response");
        assert_eq!(discovery_response.status(), StatusCode::OK);
        let discovery_body = response_json(discovery_response).await;
        let offers = discovery_body["data"]["offers"]
            .as_array()
            .expect("discovery offers");
        assert!(
            offers.iter().any(|offer| offer["offer_id"] == offer_id),
            "expected discovery row for fixture offer: {fixture_name}"
        );
    }
}

#[tokio::test]
async fn api_marketplace_compute_job_lane_template_mismatch_rejections_are_deterministic() {
    let data_dir = temp_data_dir("marketplace-compute-template-mismatch");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";

    let alice_pub_key = hex::encode(
        signing_key_from_hex(alice_secret)
            .expect("alice signing key")
            .verifying_key()
            .to_bytes(),
    );
    let bob_pub_key = hex::encode(
        signing_key_from_hex(bob_secret)
            .expect("bob signing key")
            .verifying_key()
            .to_bytes(),
    );

    let mut parsed = load_fixture_events("marketplace-accept.jsonl")
        .into_iter()
        .map(|line| serde_json::from_str::<Value>(&line).expect("fixture json"))
        .collect::<Vec<_>>();

    let compute_offer = signed_event_value(
        bob_secret,
        "2026-03-01T00:14:00Z",
        EventKind::ServiceOffer,
        "v0-default",
        serde_json::json!({
            "offerId": "mk-compute-template-offer",
            "serviceType": "compute-job",
            "unitDefinition": "deterministic compute job",
            "pricePerUnitCredits": 40,
            "deliveryMode": "receipt",
            "offerExpiresAt": "2026-12-01T00:00:00Z",
            "allowedEvidenceFormats": ["job-receipt-v1"]
        }),
        None,
        None,
    );
    let compute_offer_event_id = compute_offer["eventId"]
        .as_str()
        .expect("compute offer event id")
        .to_string();

    let bad_order = signed_event_value(
        alice_secret,
        "2026-03-01T00:14:20Z",
        EventKind::ServiceOrder,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-compute-order-bad-template",
            "offerId": "mk-compute-template-offer",
            "providerPubKey": bob_pub_key,
            "buyerPubKey": alice_pub_key,
            "orderExpiresAt": "2026-12-01T00:00:00Z",
            "milestones": [{
                "milestoneId": "m1",
                "amountCredits": 40,
                "evidenceFormat": "artifactHash"
            }]
        }),
        Some(BTreeMap::from([("offer".into(), compute_offer_event_id.clone())])),
        None,
    );
    let bad_order_event_id = bad_order["eventId"]
        .as_str()
        .expect("bad compute order event id")
        .to_string();

    let good_order = signed_event_value(
        alice_secret,
        "2026-03-01T00:14:30Z",
        EventKind::ServiceOrder,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-compute-order-good-template",
            "offerId": "mk-compute-template-offer",
            "providerPubKey": bob_pub_key,
            "buyerPubKey": alice_pub_key,
            "orderExpiresAt": "2026-12-01T00:00:00Z",
            "milestones": [{
                "milestoneId": "m1",
                "amountCredits": 40,
                "evidenceFormat": "job-receipt-v1"
            }]
        }),
        Some(BTreeMap::from([("offer".into(), compute_offer_event_id)])),
        None,
    );
    let good_order_event_id = good_order["eventId"]
        .as_str()
        .expect("good compute order event id")
        .to_string();

    let spend = signed_event_value(
        alice_secret,
        "2026-03-01T00:14:40Z",
        EventKind::SpendCredits,
        "v0-default",
        serde_json::json!({
            "spenderPubKey": alice_pub_key,
            "sinkKind": "ServiceEscrowSink",
            "amount": 40,
            "orderId": "mk-compute-order-good-template",
            "milestoneId": "m1"
        }),
        None,
        Some("mk-compute-template-spend-1"),
    );

    let bad_delivery = signed_event_value(
        bob_secret,
        "2026-03-01T00:14:50Z",
        EventKind::ServiceDelivery,
        "v0-default",
        serde_json::json!({
            "orderId": "mk-compute-order-good-template",
            "milestoneId": "m1",
            "evidenceFormat": "artifactHash",
            "artifactHashes": ["compute-output-mismatch"],
            "deliveredAt": "2026-03-01T00:14:50Z"
        }),
        Some(BTreeMap::from([("order".into(), good_order_event_id)])),
        None,
    );
    let bad_delivery_event_id = bad_delivery["eventId"]
        .as_str()
        .expect("bad compute delivery event id")
        .to_string();

    parsed.push(compute_offer);
    parsed.push(bad_order);
    parsed.push(good_order);
    parsed.push(spend);
    parsed.push(bad_delivery);

    let lines = parsed
        .into_iter()
        .map(|value| serde_json::to_string(&value).expect("line"))
        .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-01T00:15:20Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay_body = response_json(response).await;
    let invalid_events = replay_body["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    let invalid_by_event_id = invalid_events
        .iter()
        .filter_map(|item| {
            item["event_id"]
                .as_str()
                .map(|event_id| (event_id.to_string(), item.clone()))
        })
        .collect::<BTreeMap<_, _>>();

    assert!(
        invalid_by_event_id.contains_key(&bad_delivery_event_id),
        "expected invalid compute delivery event"
    );
    assert!(
        invalid_by_event_id.contains_key(
            &bad_order_event_id
        ),
        "expected invalid compute order event"
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/milestone/mk-compute-order-good-template/m1?as_of=2026-03-01T00:15:20Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let milestone_body = response_json(response).await;
    assert_eq!(milestone_body["data"]["status"], "Funded");
}

#[tokio::test]
async fn api_discovery_endpoint_applies_alpha_defaults_and_is_deterministic() {
    let data_dir = temp_data_dir("discovery-alpha-defaults");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let events = load_fixture_events("marketplace-dispute-settle.jsonl");
    let ingest = node.ingest_batch(&events);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let local_offer = signed_event_value(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-03-01T00:05:30Z",
        EventKind::ServiceOffer,
        "v0-default",
        serde_json::json!({
            "offerId": "mk-local-offer",
            "serviceType": "local-resource-exchange",
            "unitDefinition": "local handoff",
            "pricePerUnitCredits": 70,
            "deliveryMode": "local-community",
            "offerExpiresAt": "2026-12-01T00:00:00Z",
            "allowedEvidenceFormats": ["local-resource-receipt-v1"]
        }),
        None,
        None,
    );
    let local_offer_lines = vec![serde_json::to_string(&local_offer).expect("line")];
    let local_ingest = node.ingest_batch(&local_offer_lines);
    assert_eq!(local_ingest.rejected_count, 0, "{:?}", local_ingest.results);

    let as_of = "2026-03-01T00:11:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/discovery?as_of={as_of}&limit=50"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let default_body = response_json(response).await;
    assert_eq!(default_body["data"]["alpha_defaults_enabled"], true);
    assert_eq!(
        default_body["data"]["lane_filter"],
        Value::Null,
        "expected no explicit lane filter"
    );
    let default_offers = default_body["data"]["offers"]
        .as_array()
        .expect("default offers");
    assert!(
        default_offers
            .iter()
            .all(|row| row["service_type"] != "local-resource-exchange")
    );
    assert!(
        default_body["data"]["effective_lane_filter"]
            .as_array()
            .expect("effective lane filter")
            .iter()
            .all(|lane| lane != "local-resource-exchange")
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/discovery?as_of={as_of}&limit=50&alpha_defaults=0"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let wide_body = response_json(response).await;
    let wide_offers = wide_body["data"]["offers"].as_array().expect("wide offers");
    assert!(
        wide_offers
            .iter()
            .any(|row| row["offer_id"] == "mk-local-offer"),
        "{wide_offers:?}"
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/discovery?as_of={as_of}&limit=50&alpha_defaults=0"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let wide_body_again = response_json(response).await;
    assert_eq!(wide_body_again, wide_body);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/discovery?as_of={as_of}&service_type=local-resource-exchange"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let explicit_lane_body = response_json(response).await;
    let explicit_offers = explicit_lane_body["data"]["offers"]
        .as_array()
        .expect("explicit offers");
    assert_eq!(explicit_offers.len(), 1);
    assert_eq!(explicit_offers[0]["offer_id"], "mk-local-offer");
}

#[tokio::test]
async fn api_participant_orders_endpoint_filters_roles_and_is_deterministic() {
    let data_dir = temp_data_dir("participant-orders");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let events = load_fixture_events("marketplace-accept.jsonl");
    let ingest = node.ingest_batch(&events);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let buyer_pk = "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737";
    let provider_pk = "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";
    let as_of = "2026-03-01T00:10:00Z";

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/orders?participant={buyer_pk}&role=buyer&as_of={as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let buyer_body = response_json(response).await;
    let buyer_orders = buyer_body["data"]["orders"]
        .as_array()
        .expect("buyer orders");
    assert_eq!(buyer_orders.len(), 1);
    assert_eq!(buyer_orders[0]["order_id"], "mk-accept-order");
    assert_eq!(buyer_orders[0]["participant_role"], "buyer");
    assert_eq!(buyer_orders[0]["service_type"], "software-fixes");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/orders?participant={provider_pk}&role=provider&as_of={as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let provider_body = response_json(response).await;
    let provider_orders = provider_body["data"]["orders"]
        .as_array()
        .expect("provider orders");
    assert_eq!(provider_orders.len(), 1);
    assert_eq!(provider_orders[0]["order_id"], "mk-accept-order");
    assert_eq!(provider_orders[0]["participant_role"], "provider");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/orders?participant={buyer_pk}&role=any&as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let any_body = response_json(response).await;
    assert_eq!(any_body["data"]["total"], 1);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/orders?participant={provider_pk}&role=provider&status=closed&as_of={as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let filtered_body = response_json(response).await;
    assert_eq!(filtered_body["data"]["orders"].as_array().expect("filtered").len(), 1);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/orders?participant={provider_pk}&role=provider&status=open&as_of={as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let empty_body = response_json(response).await;
    assert_eq!(empty_body["data"]["total"], 0);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/orders?participant={provider_pk}&role=provider&as_of={as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let provider_body_again = response_json(response).await;
    assert_eq!(provider_body_again, provider_body);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/orders?participant=not-a-pubkey")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/orders?participant={buyer_pk}&role=seller&as_of={as_of}"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn api_policy_update_unauthorized_rejected_and_timeline_noops() {
    let data_dir = temp_data_dir("policy-unauthorized-noop");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let lines = load_fixture_events_from("invalid", "policy-update-unauthorized.jsonl");
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let as_of = "2026-03-03T00:00:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay = response_json(response).await;
    let invalid_events = replay["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    assert_eq!(invalid_events.len(), 1);
    let code = invalid_events[0]["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("UNAUTHORIZED_ACTOR"),
        "unexpected invalid code: {code}"
    );
    assert!(
        invalid_events[0]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("policy authority")
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/policy?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let policy = response_json(response).await;
    assert_eq!(policy["data"]["effective_version"], "v0-default");

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/policy/updates?as_of={as_of}&limit=10&cursor=0"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let timeline = response_json(response).await;
    assert_eq!(
        timeline["data"]["updates"]
            .as_array()
            .expect("updates array")
            .len(),
        0
    );
}

#[tokio::test]
async fn api_policy_endpoints_return_effective_state_and_timeline() {
    let data_dir = temp_data_dir("policy-read");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let update = signed_policy_update(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
        "2026-03-02T00:00:00Z",
        "v0-policy-1",
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .body(Body::from(update.to_string()))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-03T00:00:00Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/policy?as_of=2026-03-01T12:00:00Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let before_body = response_json(response).await;
    assert_eq!(before_body["data"]["effective_version"], "v0-default");

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/policy?as_of=2026-03-03T00:00:00Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let current_body = response_json(response).await;
    assert_eq!(current_body["source"], "snapshot_plus_delta");
    assert_eq!(current_body["snapshot_id"], snapshot_id);
    assert_eq!(current_body["data"]["effective_version"], "v0-policy-1");

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/policy/updates?as_of=2026-03-03T00:00:00Z&limit=1&cursor=0")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let timeline_body = response_json(response).await;
    assert_eq!(timeline_body["source"], "snapshot_plus_delta");
    assert_eq!(timeline_body["snapshot_id"], snapshot_id);
    assert_eq!(
        timeline_body["data"]["updates"][0]["version"],
        "v0-policy-1"
    );
}

#[tokio::test]
async fn api_policy_version_activation_boundary_rejects_stale_policy_version() {
    let data_dir = temp_data_dir("policy-version-boundary");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let authority_secret =
        "1111111111111111111111111111111111111111111111111111111111111111";
    let before_secret = "2222222222222222222222222222222222222222222222222222222222222222";
    let stale_secret = "3333333333333333333333333333333333333333333333333333333333333333";
    let current_secret =
        "4444444444444444444444444444444444444444444444444444444444444444";

    let identity_event = |secret: &str, created_at: &str, policy_version: &str| {
        let signing_key = signing_key_from_hex(secret).expect("signing key");
        let pub_key = hex::encode(signing_key.verifying_key().to_bytes());
        signed_event_value(
            secret,
            created_at,
            EventKind::IdentityCreate,
            policy_version,
            serde_json::json!({ "identityPubKey": pub_key }),
            None,
            None,
        )
    };

    let policy_update = signed_policy_update(
        authority_secret,
        "2026-03-01T12:00:00Z",
        "2026-03-02T00:00:00Z",
        "v0-policy-boundary",
    );
    let before_identity = identity_event(before_secret, "2026-03-01T23:59:59Z", "v0-default");
    let stale_identity = identity_event(stale_secret, "2026-03-02T00:00:00Z", "v0-default");
    let stale_identity_event_id = stale_identity["eventId"]
        .as_str()
        .expect("stale identity event id")
        .to_string();
    let current_identity =
        identity_event(current_secret, "2026-03-02T00:00:01Z", "v0-policy-boundary");
    let before_identity_pub_key = before_identity["authorPubKey"]
        .as_str()
        .expect("before identity pub key")
        .to_string();
    let stale_identity_pub_key = stale_identity["authorPubKey"]
        .as_str()
        .expect("stale identity pub key")
        .to_string();
    let current_identity_pub_key = current_identity["authorPubKey"]
        .as_str()
        .expect("current identity pub key")
        .to_string();

    let lines = vec![
        policy_update,
        before_identity,
        stale_identity,
        current_identity,
    ]
    .into_iter()
    .map(|value| serde_json::to_string(&value).expect("line"))
    .collect::<Vec<_>>();
    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/policy?as_of=2026-03-01T23:59:59Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let before_policy = response_json(response).await;
    assert_eq!(before_policy["data"]["effective_version"], "v0-default");

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/policy?as_of=2026-03-02T00:00:00Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let boundary_policy = response_json(response).await;
    assert_eq!(boundary_policy["data"]["effective_version"], "v0-policy-boundary");

    let as_of = "2026-03-02T00:05:00Z";
    let request = Request::builder()
        .method(Method::GET)
        .uri(format!("/state/replay?as_of={as_of}"))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let replay = response_json(response).await;
    let invalid_events = replay["data"]["invalid_events"]
        .as_array()
        .expect("invalid events array");
    assert_eq!(invalid_events.len(), 1);
    assert_eq!(invalid_events[0]["event_id"], stale_identity_event_id);
    let code = invalid_events[0]["code"].as_str().unwrap_or_default();
    assert!(
        code.contains("POLICY_VIOLATION"),
        "unexpected invalid code: {code}"
    );
    assert!(
        invalid_events[0]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("does not match effective")
    );
    assert_eq!(
        replay["data"]["state"]["identities"][&stale_identity_pub_key],
        Value::Null
    );
    assert_ne!(
        replay["data"]["state"]["identities"][&before_identity_pub_key],
        Value::Null
    );
    assert_ne!(
        replay["data"]["state"]["identities"][&current_identity_pub_key],
        Value::Null
    );
}

#[tokio::test]
async fn api_reputation_endpoints_return_profile_and_history() {
    let data_dir = temp_data_dir("reputation-read");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node);

    let identity_a = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    let identity_b = signed_identity_create(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-03-01T00:00:01Z",
    );
    let identity_c = signed_identity_create(
        "3333333333333333333333333333333333333333333333333333333333333333",
        "2026-03-01T00:00:02Z",
    );
    let b_pub_key = identity_b["authorPubKey"]
        .as_str()
        .expect("b pub")
        .to_string();

    let vouch_a_to_b = {
        let unsigned = UnsignedEvent {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: identity_a["authorPubKey"].as_str().expect("a").into(),
            created_at: "2026-03-01T00:01:00Z".into(),
            kind: EventKind::Vouch,
            policy_version: "v0-default".into(),
            payload: serde_json::json!({ "subjectPubKey": b_pub_key }),
            references: None,
            nonce: None,
        };
        serde_json::to_value(
            sign_event(
                &unsigned,
                "1111111111111111111111111111111111111111111111111111111111111111",
            )
            .expect("signed")
            .to_raw()
            .expect("raw"),
        )
        .expect("json")
    };
    let vouch_c_to_b = {
        let unsigned = UnsignedEvent {
            version: PROTOCOL_VERSION.into(),
            author_pub_key: identity_c["authorPubKey"].as_str().expect("c").into(),
            created_at: "2026-03-01T00:01:01Z".into(),
            kind: EventKind::Vouch,
            policy_version: "v0-default".into(),
            payload: serde_json::json!({ "subjectPubKey": b_pub_key }),
            references: None,
            nonce: None,
        };
        serde_json::to_value(
            sign_event(
                &unsigned,
                "3333333333333333333333333333333333333333333333333333333333333333",
            )
            .expect("signed")
            .to_raw()
            .expect("raw"),
        )
        .expect("json")
    };

    for event in [
        identity_a,
        identity_b,
        identity_c,
        vouch_a_to_b,
        vouch_c_to_b,
    ] {
        let request = Request::builder()
            .method(Method::POST)
            .uri("/events")
            .header("content-type", "application/json")
            .body(Body::from(event.to_string()))
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/reputation/{}?as_of=2026-03-01T00:01:10Z",
            b_pub_key
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let profile_body = response_json(response).await;
    assert_eq!(profile_body["data"]["identity_pub_key"], b_pub_key);
    assert_eq!(profile_body["data"]["trust_score"], 2);
    assert_eq!(profile_body["data"]["global_score"], 2);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/reputation/{}/history?as_of=2026-03-01T00:01:10Z&limit=1&cursor=0",
            b_pub_key
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let history_body = response_json(response).await;
    assert_eq!(history_body["data"]["total"], 2);
    assert_eq!(history_body["data"]["next_cursor"], 1);
    assert_eq!(history_body["data"]["entries"][0]["reason"], "Vouch");

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-01T00:01:10Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/reputation/{}?as_of=2026-03-01T00:01:10Z",
            b_pub_key
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let profile_snapshot_body = response_json(response).await;
    assert_eq!(profile_snapshot_body["source"], "snapshot_plus_delta");
    assert_eq!(profile_snapshot_body["snapshot_id"], snapshot_id);
}

#[tokio::test]
async fn api_economics_metrics_endpoint_returns_deterministic_metrics() {
    let data_dir = temp_data_dir("economics-metrics");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let events = load_fixture_events("marketplace-dispute-settle.jsonl");
    let ingest = node.ingest_batch(&events);
    assert_eq!(ingest.rejected_count, 0);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/economics/metrics?as_of=2026-03-01T00:11:00Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;

    assert_eq!(body["source"], "genesis_replay");
    assert_eq!(
        body["data"]["lane_completion"][0]["service_type"],
        "software-fixes"
    );
    assert_eq!(
        body["data"]["lane_completion"][0]["completion_rate_bps"],
        10000
    );
    assert_eq!(
        body["data"]["offline_lane_templates"]
            .as_array()
            .expect("offline lane templates should be an array")
            .len(),
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alerts"]
            .as_array()
            .expect("offline lane alerts should be an array")
            .len(),
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["total_alert_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["action_required"],
        false
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["action_level"],
        "none"
    );
    assert!(body["data"]["offline_lane_alert_rollup"]["highest_severity"].is_null());
    assert!(body["data"]["offline_lane_alert_rollup"]["top_alert_code"].is_null());
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["service_summaries"]
            .as_array()
            .expect("service summaries")
            .len(),
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["by_action_level"]
            .as_array()
            .expect("action levels")
            .len(),
        0
    );
    assert!(body["data"]["offline_lane_alert_rollup"]["top_service_type"].is_null());
    assert!(body["data"]["offline_lane_alert_rollup"]["priority_head_service_type"].is_null());
    assert!(body["data"]["offline_lane_alert_rollup"]["priority_head_action_level"].is_null());
    assert!(body["data"]["offline_lane_alert_rollup"]["priority_tail_service_type"].is_null());
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_size"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_health"],
        "empty"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_none_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_within_actionable_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_within_actionable_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_escalation_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_units"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_pressure_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_per_service_milli"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_polarization_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_balance_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_action_polarization_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_dominant_action_level"],
        "empty"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_dominant_action_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_top_service_alert_share_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_alert_share_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_runner_up_alert_share_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_gap_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_top2_service_alert_share_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_service_concentration_hhi_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_concentration_level"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_long_tail_alert_share_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_effective_service_count_milli"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_dominance_level"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_50_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_80_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_95_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_profile"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_risk_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_risk_band"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_response_sla_seconds"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_multiplier_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_effective_response_sla_seconds"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_slippage_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_pressure_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_adjusted_risk_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_risk_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_operational_posture"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_index_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_index_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_inequality_gini_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_evenness_milli"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_distribution_profile"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_critical_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_load_level"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_score_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_delta_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_profile"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["prioritized_services"]
            .as_array()
            .expect("prioritized services")
            .len(),
        0
    );
    assert!(
        body["data"]["offline_lane_alert_rollup"]["deterministic_fingerprint"]
            .as_str()
            .expect("fingerprint")
            .len()
            == 64
    );
    assert!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_fingerprint"]
            .as_str()
            .expect("priority queue fingerprint")
            .len()
            == 64
    );
    assert!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_membership_fingerprint"]
            .as_str()
            .expect("priority queue membership fingerprint")
            .len()
            == 64
    );
    assert!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_order_fingerprint"]
            .as_str()
            .expect("priority queue order fingerprint")
            .len()
            == 64
    );
    assert!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_pressure_fingerprint"]
            .as_str()
            .expect("priority queue pressure fingerprint")
            .len()
            == 64
    );
    assert_eq!(body["data"]["dispute"]["disputed_count"], 1);
    assert_eq!(body["data"]["dispute"]["delivered_flow_count"], 1);
    assert_eq!(body["data"]["dispute"]["dispute_rate_bps"], 10000);
    assert_eq!(body["data"]["dispute"]["resolved_count"], 1);
    assert_eq!(body["data"]["dispute"]["average_resolution_seconds"], 90);
    assert_eq!(body["data"]["issuance_expiry"]["issued_credits"], 200);
    assert_eq!(
        body["data"]["issuance_expiry"]["scheduled_expired_credits"],
        0
    );
    assert_eq!(
        body["data"]["invalid_event_rates"]["total_invalid_events"],
        0
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-01T00:11:00Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/economics/metrics?as_of=2026-03-01T00:11:00Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_metrics_body = response_json(response).await;
    assert_eq!(snapshot_metrics_body["source"], "snapshot_plus_delta");
    assert_eq!(snapshot_metrics_body["snapshot_id"], snapshot_id);
    assert_eq!(snapshot_metrics_body["data"], body["data"]);
}

#[tokio::test]
async fn api_economics_metrics_offline_lane_telemetry_reports_rates() {
    let data_dir = temp_data_dir("economics-offline-telemetry");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let alice_secret = "1111111111111111111111111111111111111111111111111111111111111111";
    let bob_secret = "2222222222222222222222222222222222222222222222222222222222222222";
    let carol_secret = "3333333333333333333333333333333333333333333333333333333333333333";

    let alice_create = signed_identity_create(alice_secret, "2026-06-01T00:00:00Z");
    let bob_create = signed_identity_create(bob_secret, "2026-06-01T00:00:01Z");
    let carol_create = signed_identity_create(carol_secret, "2026-06-01T00:00:02Z");
    let alice_pk = alice_create["authorPubKey"]
        .as_str()
        .expect("alice pubkey")
        .to_string();
    let bob_pk = bob_create["authorPubKey"]
        .as_str()
        .expect("bob pubkey")
        .to_string();
    let carol_pk = carol_create["authorPubKey"]
        .as_str()
        .expect("carol pubkey")
        .to_string();

    let vouch_alice_to_bob = signed_event_value(
        alice_secret,
        "2026-06-01T00:01:00Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": bob_pk }),
        None,
        None,
    );
    let vouch_carol_to_bob = signed_event_value(
        carol_secret,
        "2026-06-01T00:01:01Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": bob_pk }),
        None,
        None,
    );
    let vouch_alice_to_carol = signed_event_value(
        alice_secret,
        "2026-06-01T00:01:02Z",
        EventKind::Vouch,
        "v0-default",
        serde_json::json!({ "subjectPubKey": carol_pk }),
        None,
        None,
    );
    let claim = signed_event_value(
        alice_secret,
        "2026-06-01T00:02:00Z",
        EventKind::ContributionClaim,
        "v0-default",
        serde_json::json!({
            "claimId": "claim-offline-node",
            "claimType": "maintenance",
            "artifactHash": "claim-artifact",
            "summary": "offline lane buyer credit prep",
            "requestedCredits": 200
        }),
        None,
        None,
    );
    let claim_event_id = claim["eventId"]
        .as_str()
        .expect("claim event id")
        .to_string();
    let attest_bob = signed_event_value(
        bob_secret,
        "2026-06-01T00:03:00Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-offline-node", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    );
    let attest_carol = signed_event_value(
        carol_secret,
        "2026-06-01T00:03:01Z",
        EventKind::ContributionAttest,
        "v0-default",
        serde_json::json!({ "claimId": "claim-offline-node", "decision": "approve" }),
        Some(BTreeMap::from([("claim".into(), claim_event_id.clone())])),
        None,
    );
    let mint = signed_event_value(
        alice_secret,
        "2026-06-01T00:04:00Z",
        EventKind::MintCredits,
        "v0-default",
        serde_json::json!({
            "beneficiaryPubKey": alice_pk,
            "amount": 200,
            "expiresAt": "2026-12-01T00:00:00Z",
            "mintReason": "contribution",
            "sourceClaimId": "claim-offline-node"
        }),
        Some(BTreeMap::from([("claim".into(), claim_event_id)])),
        None,
    );
    let offer = signed_event_value(
        bob_secret,
        "2026-06-01T00:05:00Z",
        EventKind::ServiceOffer,
        "v0-default",
        serde_json::json!({
            "offerId": "offer-offline-node",
            "serviceType": "local-resource-exchange",
            "unitDefinition": "local handoff unit",
            "pricePerUnitCredits": 100,
            "deliveryMode": "local-community",
            "offerExpiresAt": "2026-12-01T00:00:00Z",
            "allowedEvidenceFormats": ["local-resource-receipt-v1"]
        }),
        None,
        None,
    );
    let offer_event_id = offer["eventId"]
        .as_str()
        .expect("offer event id")
        .to_string();
    let order = signed_event_value(
        alice_secret,
        "2026-06-01T00:06:00Z",
        EventKind::ServiceOrder,
        "v0-default",
        serde_json::json!({
            "orderId": "order-offline-node",
            "offerId": "offer-offline-node",
            "providerPubKey": bob_pk,
            "buyerPubKey": alice_pk,
            "orderExpiresAt": "2026-12-01T00:00:00Z",
            "milestones": [{
                "milestoneId": "m1",
                "amountCredits": 100,
                "evidenceFormat": "local-resource-receipt-v1"
            }]
        }),
        Some(BTreeMap::from([("offer".into(), offer_event_id)])),
        None,
    );
    let order_event_id = order["eventId"]
        .as_str()
        .expect("order event id")
        .to_string();
    let spend = signed_event_value(
        alice_secret,
        "2026-06-01T00:07:00Z",
        EventKind::SpendCredits,
        "v0-default",
        serde_json::json!({
            "spenderPubKey": alice_pk,
            "sinkKind": "ServiceEscrowSink",
            "amount": 100,
            "orderId": "order-offline-node",
            "milestoneId": "m1"
        }),
        None,
        Some("offline-escrow-1"),
    );
    let delivery = signed_event_value(
        bob_secret,
        "2026-06-01T00:08:00Z",
        EventKind::ServiceDelivery,
        "v0-default",
        serde_json::json!({
            "orderId": "order-offline-node",
            "milestoneId": "m1",
            "evidenceFormat": "local-resource-receipt-v1",
            "artifactHashes": ["receipt-hash-1"],
            "notesHash": "local-receipt-notes",
            "deliveredAt": "2026-06-01T00:08:00Z"
        }),
        Some(BTreeMap::from([("order".into(), order_event_id)])),
        None,
    );
    let delivery_event_id = delivery["eventId"]
        .as_str()
        .expect("delivery event id")
        .to_string();
    let dispute = signed_event_value(
        alice_secret,
        "2026-06-01T00:09:00Z",
        EventKind::ServiceDispute,
        "v0-default",
        serde_json::json!({
            "orderId": "order-offline-node",
            "milestoneId": "m1",
            "reasonCode": "handoff-mismatch",
            "disputedAt": "2026-06-01T00:09:00Z"
        }),
        Some(BTreeMap::from([("delivery".into(), delivery_event_id)])),
        None,
    );

    let lines = vec![
        alice_create,
        bob_create,
        carol_create,
        vouch_alice_to_bob,
        vouch_carol_to_bob,
        vouch_alice_to_carol,
        claim,
        attest_bob,
        attest_carol,
        mint,
        offer,
        order,
        spend,
        delivery,
        dispute,
    ]
    .into_iter()
    .map(|value| serde_json::to_string(&value).expect("line"))
    .collect::<Vec<_>>();

    let ingest = node.ingest_batch(&lines);
    assert_eq!(ingest.rejected_count, 0, "{:?}", ingest.results);

    let request = Request::builder()
        .method(Method::GET)
        .uri("/state/economics/metrics?as_of=2026-07-01T00:00:00Z")
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;

    let offline_rows = body["data"]["offline_lane_templates"]
        .as_array()
        .expect("offline lane templates");
    let lane = offline_rows
        .iter()
        .find(|row| row["service_type"] == "local-resource-exchange")
        .expect("local lane telemetry row");
    assert_eq!(lane["template"], "local_resource_exchange_v1");
    assert_eq!(lane["offer_count"], 1);
    assert_eq!(lane["order_count"], 1);
    assert_eq!(lane["delivered_count"], 1);
    assert_eq!(lane["accepted_count"], 0);
    assert_eq!(lane["disputed_count"], 1);
    assert_eq!(lane["settled_count"], 0);
    assert_eq!(lane["auto_refunded_count"], 1);
    assert_eq!(lane["unresolved_dispute_count"], 0);
    assert_eq!(lane["dispute_rate_bps"], 10000);
    assert_eq!(lane["auto_refund_rate_bps"], 10000);
    assert_eq!(lane["invalid_event_count"], 0);
    let alerts = body["data"]["offline_lane_alerts"]
        .as_array()
        .expect("offline lane alerts");
    assert_eq!(alerts.len(), 0);
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["total_alert_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["action_required"],
        false
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["action_level"],
        "none"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["by_action_level"]
            .as_array()
            .expect("action levels")
            .len(),
        0
    );
    assert!(body["data"]["offline_lane_alert_rollup"]["top_service_type"].is_null());
    assert!(body["data"]["offline_lane_alert_rollup"]["priority_head_service_type"].is_null());
    assert!(body["data"]["offline_lane_alert_rollup"]["priority_head_action_level"].is_null());
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_size"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_health"],
        "empty"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_none_count"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_critical_bps"],
        0
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["priority_queue_load_level"],
        "idle"
    );
    assert_eq!(
        body["data"]["offline_lane_alert_rollup"]["prioritized_services"]
            .as_array()
            .expect("prioritized services")
            .len(),
        0
    );

    let early_request = Request::builder()
        .method(Method::GET)
        .uri("/state/economics/metrics?as_of=2026-06-01T00:10:00Z")
        .body(Body::empty())
        .expect("request");
    let early_response = app.clone().oneshot(early_request).await.expect("response");
    assert_eq!(early_response.status(), StatusCode::OK);
    let early_body = response_json(early_response).await;
    let early_lane = early_body["data"]["offline_lane_templates"]
        .as_array()
        .expect("offline lane templates")
        .iter()
        .find(|row| row["service_type"] == "local-resource-exchange")
        .expect("local lane telemetry row");
    assert_eq!(early_lane["disputed_count"], 1);
    assert_eq!(early_lane["auto_refunded_count"], 0);
    assert_eq!(early_lane["unresolved_dispute_count"], 1);
    let early_alerts = early_body["data"]["offline_lane_alerts"]
        .as_array()
        .expect("offline lane alerts");
    assert_eq!(early_alerts.len(), 1);
    assert_eq!(early_alerts[0]["alert_code"], "OFFLINE_UNRESOLVED_DISPUTES");
    assert_eq!(early_alerts[0]["severity"], "warn");
    assert_eq!(early_alerts[0]["value"], 1);
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["total_alert_count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["action_required"],
        true
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["action_level"],
        "watch"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["highest_severity"],
        "warn"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["top_alert_code"],
        "OFFLINE_UNRESOLVED_DISPUTES"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["by_code"][0]["alert_code"],
        "OFFLINE_UNRESOLVED_DISPUTES"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["by_action_level"][0]["action_level"],
        "watch"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["by_action_level"][0]["count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["top_service_type"],
        "local-resource-exchange"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_head_service_type"],
        "local-resource-exchange"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_head_action_level"],
        "watch"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_tail_service_type"],
        "local-resource-exchange"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_size"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_health"],
        "attention"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_count"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_none_count"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_within_actionable_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_within_actionable_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_escalation_profile"],
        "watch-led"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_units"],
        2
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_pressure_bps"],
        6_666
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_per_service_milli"],
        2_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_profile"],
        "active"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_polarization_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_balance_score_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_polarization_profile"],
        "polarized"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_dominant_action_level"],
        "watch"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_dominant_action_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_top_service_alert_share_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_alert_share_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_runner_up_alert_share_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_gap_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_top2_service_alert_share_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_service_concentration_hhi_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_concentration_level"],
        "concentrated"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_long_tail_alert_share_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_effective_service_count_milli"],
        1_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_dominance_level"],
        "dominant"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_50_count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_80_count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_95_count"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_profile"],
        "single"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_risk_score_bps"],
        6_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_risk_band"],
        "high"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_response_sla_seconds"],
        7_200
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_multiplier_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_effective_response_sla_seconds"],
        7_200
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_slippage_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_pressure_profile"],
        "on-target"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_adjusted_risk_bps"],
        6_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_risk_delta_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_operational_posture"],
        "heightened"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_index_bps"],
        6_333
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_delta_bps"],
        333
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_profile"],
        "strained"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_score_bps"],
        3_501
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_delta_bps"],
        3_501
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_profile"],
        "strained"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_index_bps"],
        3_335
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_delta_bps"],
        166
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_profile"],
        "volatile"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_score_bps"],
        4_445
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_delta_bps"],
        1_110
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_profile"],
        "recovering"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_score_bps"],
        3_760
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_delta_bps"],
        1_110
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_profile"],
        "converging"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_score_bps"],
        7_920
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_delta_bps"],
        4_160
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_profile"],
        "adaptive"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_score_bps"],
        6_825
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_delta_bps"],
        1_095
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_profile"],
        "steady"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_score_bps"],
        5_608
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_delta_bps"],
        1_217
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_profile"],
        "holding"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_score_bps"],
        3_091
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_delta_bps"],
        2_517
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_profile"],
        "depleted"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_score_bps"],
        6_638
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_delta_bps"],
        3_547
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_profile"],
        "renewing"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_score_bps"],
        5_193
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_delta_bps"],
        1_445
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_profile"],
        "repairing"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_score_bps"],
        4_094
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_delta_bps"],
        1_099
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_profile"],
        "guarded"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_score_bps"],
        3_095
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_delta_bps"],
        999
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_profile"],
        "exposed"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_score_bps"],
        5_729
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_delta_bps"],
        2_634
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_profile"],
        "stabilizing"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_score_bps"],
        2_941
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_delta_bps"],
        2_788
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_profile"],
        "lapse"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_score_bps"],
        2_890
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_delta_bps"],
        51
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_profile"],
        "narrow"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_score_bps"],
        2_890
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_delta_bps"],
        51
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_profile"],
        "opaque"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_score_bps"],
        5_260
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_delta_bps"],
        2_370
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_profile"],
        "reviewable"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_score_bps"],
        5_680
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_delta_bps"],
        420
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_profile"],
        "inspectable"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_score_bps"],
        6_980
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_delta_bps"],
        1_300
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_profile"],
        "transparent"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_score_bps"],
        7_553
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_delta_bps"],
        573
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_profile"],
        "legible"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_score_bps"],
        3_684
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_delta_bps"],
        3_869
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_profile"],
        "guided"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_score_bps"],
        6_518
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_delta_bps"],
        2_834
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_profile"],
        "interpretable"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_score_bps"],
        4_690
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_delta_bps"],
        1_828
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_profile"],
        "decipherable"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_score_bps"],
        6_699
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_delta_bps"],
        2_009
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_profile"],
        "clear"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_score_bps"],
        7_018
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_delta_bps"],
        319
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_profile"],
        "comprehensible"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_score_bps"],
        5_794
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_delta_bps"],
        1_224
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_profile"],
        "understandable"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_score_bps"],
        7_604
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_delta_bps"],
        1_810
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_profile"],
        "communicative"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_score_bps"],
        4_466
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_delta_bps"],
        3_138
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_profile"],
        "expressible"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_score_bps"],
        7_356
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_delta_bps"],
        2_890
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_profile"],
        "expressive"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_score_bps"],
        7_163
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_delta_bps"],
        193
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_profile"],
        "fluent"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_score_bps"],
        4_319
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_delta_bps"],
        2_844
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_profile"],
        "legible"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_score_bps"],
        4_988
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_delta_bps"],
        669
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_profile"],
        "visible"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_score_bps"],
        7_272
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_delta_bps"],
        2_284
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_profile"],
        "glowing"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_score_bps"],
        8_292
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_delta_bps"],
        1_020
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_profile"],
        "sonorous"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_score_bps"],
        8_374
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_delta_bps"],
        82
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_profile"],
        "orchestral"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_score_bps"],
        8_090
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_delta_bps"],
        284
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_profile"],
        "symphonic"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_inequality_gini_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_evenness_milli"],
        1_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_distribution_profile"],
        "single"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_bps"],
        10_000
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_critical_bps"],
        0
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_load_level"],
        "light"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["prioritized_services"][0]["rank"],
        1
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["prioritized_services"][0]["service_type"],
        "local-resource-exchange"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["prioritized_services"][0]["action_level"],
        "watch"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["service_summaries"][0]["service_type"],
        "local-resource-exchange"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["service_summaries"][0]["action_required"],
        true
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["service_summaries"][0]["action_level"],
        "watch"
    );
    assert_eq!(
        early_body["data"]["offline_lane_alert_rollup"]["service_summaries"][0]["top_alert_code"],
        "OFFLINE_UNRESOLVED_DISPUTES"
    );
    assert!(
        early_body["data"]["offline_lane_alert_rollup"]["service_summaries"][0]
            ["deterministic_fingerprint"]
            .as_str()
            .expect("service summary fingerprint")
            .len()
            == 64
    );
    assert!(
        early_body["data"]["offline_lane_alert_rollup"]["deterministic_fingerprint"]
            .as_str()
            .expect("fingerprint")
            .len()
            == 64
    );
    assert!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_fingerprint"]
            .as_str()
            .expect("priority queue fingerprint")
            .len()
            == 64
    );
    assert!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_membership_fingerprint"]
            .as_str()
            .expect("priority queue membership fingerprint")
            .len()
            == 64
    );
    assert!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_order_fingerprint"]
            .as_str()
            .expect("priority queue order fingerprint")
            .len()
            == 64
    );
    assert!(
        early_body["data"]["offline_lane_alert_rollup"]["priority_queue_pressure_fingerprint"]
            .as_str()
            .expect("priority queue pressure fingerprint")
            .len()
            == 64
    );

    let policy_update = signed_event_value(
        alice_secret,
        "2026-06-10T00:00:00Z",
        EventKind::PolicyUpdate,
        "v0-default",
        serde_json::json!({
            "nextPolicyVersion": "v0-policy-offline-alerts-1",
            "effectiveAt": "2026-06-11T00:00:00Z",
            "policy": {
                "version": "v0-policy-offline-alerts-1",
                "clockSkewSeconds": 300,
                "creditDefaultExpiryDays": 180,
                "providerRewardExpiryDays": 90,
                "demurrageRateWeeklyBps": 100,
                "claimApprovalThreshold": 2,
                "maxContributionClaimCredits": 1000,
                "allowedServiceTypes": ["software-fixes", "documentation", "local-resource-exchange", "physical-handoff"],
                "maxMilestonesPerOrder": 16,
                "maxMilestoneCredits": 5000,
                "acceptanceWindowSeconds": 7200,
                "disputeTimeoutSeconds": 1209600,
                "providerEligibilityThreshold": 2,
                "attestorEligibilityThreshold": 1,
                "allowedSinkKinds": ["ServiceEscrowSink", "ComputeSink", "AISink", "StorageSink", "BountySink"],
                "policyAuthorityPubKey": alice_pk,
                "offlineAlertUnresolvedDisputeCountThreshold": 2,
                "offlineAlertDisputeRateBpsThreshold": 1000,
                "offlineAlertDisputeRateMinOrders": 1,
                "offlineAlertAutoRefundRateBpsThreshold": 1000,
                "offlineAlertAutoRefundMinDisputes": 1,
                "offlineAlertInvalidPayloadCountThreshold": 3,
                "offlineAlertPolicyViolationCountThreshold": 3,
                "offlineAlertUnresolvedDisputesSeverity": "info",
                "offlineAlertDisputeRateSeverity": "critical",
                "offlineAlertAutoRefundRateSeverity": "info",
                "offlineAlertInvalidPayloadSpikeSeverity": "warn",
                "offlineAlertPolicyViolationSpikeSeverity": "warn",
                "offlineAlertEnabledServiceTypes": ["local-resource-exchange"],
                "offlineAlertLaneOverrides": [{
                    "serviceType": "local-resource-exchange",
                    "disputeRateBpsThreshold": 0,
                    "autoRefundRateBpsThreshold": 7000,
                    "autoRefundMinDisputes": 3
                }]
            }
        }),
        None,
        None,
    );
    let tuned_ingest = node.ingest_batch(&[serde_json::to_string(&policy_update).expect("line")]);
    assert_eq!(tuned_ingest.rejected_count, 0, "{:?}", tuned_ingest.results);

    let tuned_request = Request::builder()
        .method(Method::GET)
        .uri("/state/economics/metrics?as_of=2026-06-12T00:00:00Z")
        .body(Body::empty())
        .expect("request");
    let tuned_response = app.clone().oneshot(tuned_request).await.expect("response");
    assert_eq!(tuned_response.status(), StatusCode::OK);
    let tuned_body = response_json(tuned_response).await;
    let tuned_alerts = tuned_body["data"]["offline_lane_alerts"]
        .as_array()
        .expect("offline lane alerts");
    assert!(tuned_alerts.is_empty());
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["total_alert_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["action_required"],
        false
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["action_level"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["service_summaries"]
            .as_array()
            .expect("service summaries")
            .len(),
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["by_action_level"]
            .as_array()
            .expect("action levels")
            .len(),
        0
    );
    assert!(tuned_body["data"]["offline_lane_alert_rollup"]["top_service_type"].is_null());
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_head_service_type"].is_null()
    );
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_head_action_level"].is_null()
    );
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_tail_service_type"].is_null()
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_size"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_health"],
        "empty"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_none_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_intervene_within_actionable_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_watch_within_actionable_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_escalation_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_units"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_pressure_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_per_service_milli"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_weighted_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_polarization_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_balance_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_action_polarization_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_dominant_action_level"],
        "empty"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_dominant_action_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_top_service_alert_share_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_alert_share_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_runner_up_alert_share_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_gap_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_top2_service_alert_share_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_service_concentration_hhi_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_concentration_level"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_long_tail_alert_share_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_effective_service_count_milli"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_leader_dominance_level"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_50_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_80_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_95_count"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coverage_profile"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_risk_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_risk_band"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_response_sla_seconds"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_multiplier_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_effective_response_sla_seconds"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_slippage_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_pressure_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_adjusted_risk_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sla_risk_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_operational_posture"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_index_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_attention_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_readiness_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_index_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_stability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_resilience_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_coherence_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_adaptability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_sustainability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_continuity_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_recoverability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_regeneration_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_restoration_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_stewardship_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_guardianship_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_assurance_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_vigilance_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_oversight_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_accountability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_verifiability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_auditability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_transparency_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_legibility_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_navigability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_interpretability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_explainability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarity_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_comprehensibility_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_intelligibility_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_communicability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_articulability_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_expressivity_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_eloquence_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_lucidity_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_illumination_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_clarion_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_resonance_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_cadence_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_score_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_delta_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_harmony_profile"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_inequality_gini_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_evenness_milli"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_distribution_profile"],
        "none"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_actionable_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_critical_bps"],
        0
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_load_level"],
        "idle"
    );
    assert_eq!(
        tuned_body["data"]["offline_lane_alert_rollup"]["prioritized_services"]
            .as_array()
            .expect("prioritized services")
            .len(),
        0
    );
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_fingerprint"]
            .as_str()
            .expect("priority queue fingerprint")
            .len()
            == 64
    );
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_membership_fingerprint"]
            .as_str()
            .expect("priority queue membership fingerprint")
            .len()
            == 64
    );
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_order_fingerprint"]
            .as_str()
            .expect("priority queue order fingerprint")
            .len()
            == 64
    );
    assert!(
        tuned_body["data"]["offline_lane_alert_rollup"]["priority_queue_pressure_fingerprint"]
            .as_str()
            .expect("priority queue pressure fingerprint")
            .len()
            == 64
    );
}

#[tokio::test]
async fn api_economics_p2h_endpoints_return_profile_and_history() {
    let data_dir = temp_data_dir("economics-p2h");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    let app = build_router(node.clone());

    let events = load_fixture_events("marketplace-dispute-settle.jsonl");
    let parsed = events
        .iter()
        .map(|line| serde_json::from_str::<Value>(line).expect("json"))
        .collect::<Vec<_>>();
    let buyer = parsed[0]["authorPubKey"]
        .as_str()
        .expect("buyer")
        .to_string();
    let provider = parsed[1]["authorPubKey"]
        .as_str()
        .expect("provider")
        .to_string();

    let ingest = node.ingest_batch(&events);
    assert_eq!(ingest.rejected_count, 0);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/economics/p2h/{provider}?as_of=2026-03-01T00:11:00Z"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let profile_body = response_json(response).await;
    assert_eq!(profile_body["source"], "genesis_replay");
    assert_eq!(profile_body["data"]["identity_pub_key"], provider);
    assert!(
        profile_body["data"]["score"]
            .as_i64()
            .expect("score should be number")
            > 0
    );
    assert_eq!(
        profile_body["data"]["components"]["dispute_settlement_anomaly"],
        15
    );

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/economics/p2h/{provider}/history?as_of=2026-03-01T00:11:00Z&limit=1&cursor=0"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let history_body = response_json(response).await;
    assert_eq!(history_body["source"], "genesis_replay");
    assert!(
        history_body["data"]["total"]
            .as_u64()
            .expect("total should be number")
            >= 1
    );
    assert_eq!(history_body["data"]["entries"][0]["score_after"], 15);

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/economics/p2h/{buyer}?as_of=2026-03-01T00:11:00Z"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let buyer_profile = response_json(response).await;
    assert_eq!(buyer_profile["data"]["identity_pub_key"], buyer);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/snapshots")
        .header("content-type", "application/json")
        .body(Body::from("{\"as_of\":\"2026-03-01T00:11:00Z\"}"))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_body = response_json(response).await;
    let snapshot_id = snapshot_body["snapshot_id"]
        .as_str()
        .expect("snapshot id")
        .to_string();

    let request = Request::builder()
        .method(Method::GET)
        .uri(format!(
            "/state/economics/p2h/{provider}?as_of=2026-03-01T00:11:00Z"
        ))
        .body(Body::empty())
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot_profile = response_json(response).await;
    assert_eq!(snapshot_profile["source"], "snapshot_plus_delta");
    assert_eq!(snapshot_profile["snapshot_id"], snapshot_id);
    assert_eq!(snapshot_profile["data"], profile_body["data"]);
}

#[tokio::test]
async fn api_post_events_rate_limit_rejects_excess_requests_per_client() {
    let data_dir = temp_data_dir("ingest-rate-limit");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    node.set_ingest_rate_limit_config(node::IngestRateLimitConfig {
        max_requests_per_window: 2,
        window_seconds: 60,
    });
    let app = build_router(node);

    let event = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );

    for _ in 0..2 {
        let request = Request::builder()
            .method(Method::POST)
            .uri("/events")
            .header("content-type", "application/json")
            .header("x-forwarded-for", "203.0.113.44")
            .body(Body::from(event.to_string()))
            .expect("request");
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .header("x-forwarded-for", "203.0.113.44")
        .body(Body::from(event.to_string()))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    let body = response_json(response).await;
    assert_eq!(
        body["code"].as_str().unwrap_or_default(),
        "ERR_INGEST_RATE_LIMIT_EXCEEDED"
    );
    assert!(body["retry_after_seconds"].as_u64().unwrap_or(0) >= 1);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events")
        .header("content-type", "application/json")
        .header("x-forwarded-for", "203.0.113.55")
        .body(Body::from(event.to_string()))
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn api_post_events_batch_rate_limit_rejects_excess_requests() {
    let data_dir = temp_data_dir("ingest-rate-limit-batch");
    let node = Arc::new(LocalNode::new(&data_dir).expect("node"));
    node.set_ingest_rate_limit_config(node::IngestRateLimitConfig {
        max_requests_per_window: 1,
        window_seconds: 60,
    });
    let app = build_router(node);

    let event_a = signed_identity_create(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-03-01T00:00:01Z",
    );
    let event_b = signed_identity_create(
        "3333333333333333333333333333333333333333333333333333333333333333",
        "2026-03-01T00:00:02Z",
    );

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events/batch")
        .header("content-type", "application/json")
        .header("x-forwarded-for", "198.51.100.9")
        .body(Body::from(
            serde_json::json!({ "events": [event_a] }).to_string(),
        ))
        .expect("request");
    let response = app.clone().oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .method(Method::POST)
        .uri("/events/batch")
        .header("content-type", "application/json")
        .header("x-forwarded-for", "198.51.100.9")
        .body(Body::from(
            serde_json::json!({ "events": [event_b] }).to_string(),
        ))
        .expect("request");
    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    let body = response_json(response).await;
    assert_eq!(
        body["code"].as_str().unwrap_or_default(),
        "ERR_INGEST_RATE_LIMIT_EXCEEDED"
    );
}
