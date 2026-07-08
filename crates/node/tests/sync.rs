use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Path as AxumPath, State as AxumState};
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use node::{
    LocalNode, SnapshotDocument, SyncPullRequest, SyncRuntimeConfig, build_router, hash_value,
};
use protocol_core::{EventKind, PROTOCOL_VERSION, UnsignedEvent, sign_event, signing_key_from_hex};
use rusqlite::Connection;
use tokio::task::JoinHandle;

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
        .join(format!("sync-{label}-{nanos}"));
    fs::create_dir_all(&path).expect("create temp path");
    path
}

fn write_peers_config(data_dir: &Path, json: serde_json::Value) {
    fs::write(data_dir.join("peers.json"), format!("{json}\n")).expect("write peers config");
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

fn load_fixture_events(name: &str) -> Vec<String> {
    let fixture = workspace_root().join("fixtures").join("valid").join(name);
    let content = fs::read_to_string(fixture).expect("fixture");
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn load_claim_fixture_events() -> Vec<String> {
    load_fixture_events("claim-mint-spend.jsonl")
}

async fn spawn_node_server(node: Arc<LocalNode>) -> (String, JoinHandle<()>) {
    let app = build_router(node);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    let handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    (format!("http://{addr}"), handle)
}

async fn spawn_runtime_node_server(
    node: Arc<LocalNode>,
    config: SyncRuntimeConfig,
) -> (String, JoinHandle<()>) {
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
    let addr = std_listener.local_addr().expect("addr");
    drop(std_listener);
    let handle = tokio::spawn(async move {
        let _ = node::serve_node_with_sync_config(node, addr, config).await;
    });
    tokio::time::sleep(Duration::from_millis(200)).await;
    (format!("http://{addr}"), handle)
}

async fn spawn_router_server(router: Router) -> (String, JoinHandle<()>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    let handle = tokio::spawn(async move {
        let _ = axum::serve(listener, router).await;
    });
    (format!("http://{addr}"), handle)
}

#[derive(Clone)]
struct CorruptSnapshotState {
    snapshot: SnapshotDocument,
}

async fn corrupt_latest_snapshot(
    AxumState(state): AxumState<CorruptSnapshotState>,
) -> Json<node::SnapshotMeta> {
    Json(state.snapshot.meta.clone())
}

async fn corrupt_snapshot_by_id(
    AxumPath(_snapshot_id): AxumPath<String>,
    AxumState(state): AxumState<CorruptSnapshotState>,
) -> Json<SnapshotDocument> {
    Json(state.snapshot.clone())
}

async fn empty_events_page() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "events": []
    }))
}

#[test]
fn duplicate_ingest_is_idempotent_and_not_invalid() {
    let data_dir = temp_data_dir("duplicate");
    let node = LocalNode::new(&data_dir).expect("node");
    let event = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    let raw = event.to_string();

    let first = node.ingest_event(&raw);
    assert!(first.accepted);
    assert!(!first.already_present);

    let second = node.ingest_event(&raw);
    assert!(second.accepted);
    assert!(second.already_present);

    let stats = node.db_inspect().expect("stats");
    assert_eq!(stats.event_count, 1);
    assert_eq!(stats.invalid_event_count, 0);
}

#[test]
fn peer_config_validation_and_defaults_work() {
    let valid_dir = temp_data_dir("peer-config-valid");
    write_peers_config(
        &valid_dir,
        serde_json::json!({
            "version": 1,
            "read_token": " read-token ",
            "peers": [{
                "id": "peer-a",
                "base_url": "http://127.0.0.1:7979/"
            }]
        }),
    );
    let node = LocalNode::new(&valid_dir).expect("node");
    let config = node.load_peer_config().expect("config");
    assert_eq!(config.read_token.as_deref(), Some("read-token"));
    assert_eq!(config.peers.len(), 1);
    assert_eq!(config.peers[0].id, "peer-a");
    assert_eq!(config.peers[0].base_url, "http://127.0.0.1:7979");
    assert!(config.peers[0].enabled);

    let invalid_dir = temp_data_dir("peer-config-invalid");
    write_peers_config(
        &invalid_dir,
        serde_json::json!({
            "version": 1,
            "peers": [
                {
                    "id": "dup",
                    "base_url": "http://127.0.0.1:7001"
                },
                {
                    "id": "dup",
                    "base_url": "http://127.0.0.1:7002"
                }
            ]
        }),
    );
    let invalid_node = LocalNode::new(&invalid_dir).expect("node");
    assert!(invalid_node.load_peer_config().is_err());
}

#[tokio::test]
async fn sync_pull_converges_and_is_idempotent_on_repull() {
    let source_dir = temp_data_dir("source-converge");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);

    let (source_url, source_handle) = spawn_node_server(source.clone()).await;

    let sink_dir = temp_data_dir("sink-converge");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");

    let first = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("first pull");
    assert_eq!(first.peers.len(), 1);
    assert!(first.pulled_count > 0);
    assert_eq!(first.rejected_count, 0);
    assert_eq!(first.already_present_count, 0);

    let as_of = Some(Utc::now());
    let source_hash = hash_value(
        &serde_json::to_value(source.replay(as_of).expect("source replay")).expect("json"),
    )
    .expect("source hash");
    let sink_hash =
        hash_value(&serde_json::to_value(sink.replay(as_of).expect("sink replay")).expect("json"))
            .expect("sink hash");
    assert_eq!(source_hash, sink_hash);

    sink.sync_reset(None, true).expect("reset sync state");
    let second = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("second pull");
    assert!(second.already_present_count > 0);
    assert_eq!(second.rejected_count, 0);

    source_handle.abort();
}

#[tokio::test]
async fn sync_pull_reset_reports_mixed_duplicate_and_new_events() {
    let source_dir = temp_data_dir("source-mixed-duplicate-new");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);

    let (source_url, source_handle) = spawn_node_server(source.clone()).await;

    let sink_dir = temp_data_dir("sink-mixed-duplicate-new");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");

    let first = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("first pull");
    assert!(first.accepted_count > 0);
    assert_eq!(first.already_present_count, 0);
    assert_eq!(first.rejected_count, 0);

    let new_identity = signed_identity_create(
        "4444444444444444444444444444444444444444444444444444444444444444",
        "2026-01-02T00:00:00Z",
    );
    let new_identity_raw = serde_json::to_string(&new_identity).expect("new identity raw");
    let ingest_new = source.ingest_event(&new_identity_raw);
    assert!(ingest_new.accepted);
    assert!(!ingest_new.already_present);

    sink.sync_reset(None, true).expect("reset sync state");
    let second = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("second pull");
    assert!(second.accepted_count > 0);
    assert!(second.already_present_count > 0);
    assert_eq!(second.rejected_count, 0);

    let source_stats = source.db_inspect().expect("source stats");
    let sink_stats = sink.db_inspect().expect("sink stats");
    assert_eq!(sink_stats.event_count, source_stats.event_count);
    assert_eq!(sink_stats.invalid_event_count, source_stats.invalid_event_count);

    source_handle.abort();
}

#[tokio::test]
async fn sync_pull_alpha_marketplace_fixtures_converge_on_replay_and_discovery_views() {
    let fixtures = [
        "marketplace-accept.jsonl",
        "marketplace-dispute-settle.jsonl",
        "marketplace-timeout-autorefund.jsonl",
    ];
    let as_of = chrono::DateTime::parse_from_rfc3339("2026-03-01T00:15:00Z")
        .expect("alpha fixture as_of")
        .with_timezone(&Utc);

    for fixture_name in fixtures {
        let fixture_label = fixture_name.trim_end_matches(".jsonl").replace('-', "_");
        let source_dir = temp_data_dir(&format!("source-alpha-{fixture_label}"));
        let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
        let fixture_events = load_fixture_events(fixture_name);
        let ingest = source.ingest_batch(&fixture_events);
        assert_eq!(
            ingest.rejected_count, 0,
            "fixture should ingest cleanly: {fixture_name}"
        );

        let (source_url, source_handle) = spawn_node_server(source.clone()).await;

        let sink_dir = temp_data_dir(&format!("sink-alpha-{fixture_label}"));
        write_peers_config(
            &sink_dir,
            serde_json::json!({
                "version": 1,
                "peers": [{
                    "id": "source",
                    "base_url": source_url,
                    "enabled": true
                }]
            }),
        );
        let sink = LocalNode::new(&sink_dir).expect("sink");
        let pull = sink
            .sync_pull(SyncPullRequest {
                peer_id: None,
                all: false,
                limit: 200,
                max_pages: 100,
            })
            .await
            .expect("pull");
        assert_eq!(
            pull.rejected_count, 0,
            "sync pull should not reject events for fixture: {fixture_name}"
        );
        assert!(
            pull.pulled_count > 0,
            "sync pull should copy at least one event for fixture: {fixture_name}"
        );

        let source_replay_hash = hash_value(
            &serde_json::to_value(source.replay(Some(as_of)).expect("source replay"))
                .expect("source replay json"),
        )
        .expect("source replay hash");
        let sink_replay_hash = hash_value(
            &serde_json::to_value(sink.replay(Some(as_of)).expect("sink replay"))
                .expect("sink replay json"),
        )
        .expect("sink replay hash");
        assert_eq!(
            source_replay_hash, sink_replay_hash,
            "source/sink replay hashes should converge for fixture: {fixture_name}"
        );

        let source_discovery_hash = hash_value(
            &serde_json::to_value(
                source
                    .discovery_view(Some(as_of), None, None, None, 50, true)
                    .expect("source discovery"),
            )
            .expect("source discovery json"),
        )
        .expect("source discovery hash");
        let sink_discovery_hash = hash_value(
            &serde_json::to_value(
                sink.discovery_view(Some(as_of), None, None, None, 50, true)
                    .expect("sink discovery"),
            )
            .expect("sink discovery json"),
        )
        .expect("sink discovery hash");
        assert_eq!(
            source_discovery_hash, sink_discovery_hash,
            "source/sink discovery hashes should converge for fixture: {fixture_name}"
        );

        source_handle.abort();
    }
}

#[tokio::test]
async fn sync_pull_non_software_lane_fixture_bundles_converge_on_replay_and_discovery_views() {
    let fixtures = [
        (
            "marketplace-feature-work-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "feature-work",
            false,
        ),
        (
            "marketplace-documentation-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "documentation",
            false,
        ),
        (
            "marketplace-translation-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "translation",
            false,
        ),
        (
            "marketplace-testing-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "testing",
            false,
        ),
        (
            "marketplace-research-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "research",
            false,
        ),
        (
            "marketplace-project-maintenance-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "project-maintenance",
            false,
        ),
        (
            "marketplace-feature-work-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "feature-work",
            false,
        ),
        (
            "marketplace-documentation-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "documentation",
            false,
        ),
        (
            "marketplace-translation-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "translation",
            false,
        ),
        (
            "marketplace-testing-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "testing",
            false,
        ),
        (
            "marketplace-research-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "research",
            false,
        ),
        (
            "marketplace-project-maintenance-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "project-maintenance",
            false,
        ),
        (
            "marketplace-compute-job-accept.jsonl",
            "2026-03-05T00:15:00Z",
            "compute-job",
            false,
        ),
        (
            "marketplace-compute-job-dispute.jsonl",
            "2026-04-01T00:00:00Z",
            "compute-job",
            false,
        ),
    ];

    for (fixture_name, as_of_raw, lane_filter, alpha_defaults) in fixtures {
        let as_of = chrono::DateTime::parse_from_rfc3339(as_of_raw)
            .expect("fixture as_of")
            .with_timezone(&Utc);
        let fixture_label = fixture_name.trim_end_matches(".jsonl").replace('-', "_");
        let source_dir = temp_data_dir(&format!("source-non-software-{fixture_label}"));
        let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
        let fixture_events = load_fixture_events(fixture_name);
        let ingest = source.ingest_batch(&fixture_events);
        assert_eq!(
            ingest.rejected_count, 0,
            "fixture should ingest cleanly: {fixture_name}"
        );

        let (source_url, source_handle) = spawn_node_server(source.clone()).await;

        let sink_dir = temp_data_dir(&format!("sink-non-software-{fixture_label}"));
        write_peers_config(
            &sink_dir,
            serde_json::json!({
                "version": 1,
                "peers": [{
                    "id": "source",
                    "base_url": source_url,
                    "enabled": true
                }]
            }),
        );
        let sink = LocalNode::new(&sink_dir).expect("sink");
        let pull = sink
            .sync_pull(SyncPullRequest {
                peer_id: None,
                all: false,
                limit: 200,
                max_pages: 100,
            })
            .await
            .expect("pull");
        assert_eq!(
            pull.rejected_count, 0,
            "sync pull should not reject events for fixture: {fixture_name}"
        );
        assert!(
            pull.pulled_count > 0,
            "sync pull should copy at least one event for fixture: {fixture_name}"
        );

        let source_replay_hash = hash_value(
            &serde_json::to_value(source.replay(Some(as_of)).expect("source replay"))
                .expect("source replay json"),
        )
        .expect("source replay hash");
        let sink_replay_hash = hash_value(
            &serde_json::to_value(sink.replay(Some(as_of)).expect("sink replay"))
                .expect("sink replay json"),
        )
        .expect("sink replay hash");
        assert_eq!(
            source_replay_hash, sink_replay_hash,
            "source/sink replay hashes should converge for fixture: {fixture_name}"
        );

        let source_discovery_hash = hash_value(
            &serde_json::to_value(
                source
                    .discovery_view(
                        Some(as_of),
                        Some(lane_filter),
                        None,
                        None,
                        50,
                        alpha_defaults,
                    )
                    .expect("source discovery"),
            )
            .expect("source discovery json"),
        )
        .expect("source discovery hash");
        let sink_discovery_hash = hash_value(
            &serde_json::to_value(
                sink.discovery_view(Some(as_of), Some(lane_filter), None, None, 50, alpha_defaults)
                    .expect("sink discovery"),
            )
            .expect("sink discovery json"),
        )
        .expect("sink discovery hash");
        assert_eq!(
            source_discovery_hash, sink_discovery_hash,
            "source/sink discovery hashes should converge for fixture: {fixture_name}"
        );

        source_handle.abort();
    }
}

#[tokio::test]
async fn sync_pull_resumes_from_cursor() {
    let source_dir = temp_data_dir("source-resume");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);

    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-resume");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");

    let first = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 1,
            max_pages: 1,
        })
        .await
        .expect("first pull");
    assert_eq!(first.peers.len(), 1);
    let first_cursor = first.peers[0].last_remote_cursor;
    assert!(first_cursor > 0);

    let second = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 1,
            max_pages: 100,
        })
        .await
        .expect("second pull");
    let second_cursor = second.peers[0].last_remote_cursor;
    assert!(second_cursor >= first_cursor);

    let status = sink.sync_status().expect("status");
    let peer_status = status
        .peers
        .iter()
        .find(|peer| peer.peer_id == "source")
        .expect("peer status");
    assert!(peer_status.last_remote_cursor >= second_cursor);

    source_handle.abort();
}

#[tokio::test]
async fn sync_pull_respects_peer_auth_token() {
    let source_dir = temp_data_dir("source-auth");
    write_peers_config(
        &source_dir,
        serde_json::json!({
            "version": 1,
            "read_token": "source-token",
            "peers": []
        }),
    );
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-auth");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");
    let unauthorized = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("pull result");
    assert!(unauthorized.peers[0].error.is_some());
    assert_eq!(unauthorized.peers[0].last_remote_cursor, 0);

    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "bearer_token": "source-token",
                "enabled": true
            }]
        }),
    );
    let authorized = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("authorized pull");
    assert!(authorized.accepted_count > 0);
    assert_eq!(authorized.rejected_count, 0);

    source_handle.abort();
}

#[tokio::test]
async fn sync_pull_tracks_independent_cursor_per_peer() {
    let source_a_dir = temp_data_dir("source-a");
    let source_a = Arc::new(LocalNode::new(&source_a_dir).expect("source a"));
    let event_a = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    assert!(source_a.ingest_event(&event_a.to_string()).accepted);
    let (source_a_url, source_a_handle) = spawn_node_server(source_a).await;

    let source_b_dir = temp_data_dir("source-b");
    let source_b = Arc::new(LocalNode::new(&source_b_dir).expect("source b"));
    let event_b = signed_identity_create(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-03-01T00:00:01Z",
    );
    assert!(source_b.ingest_event(&event_b.to_string()).accepted);
    let (source_b_url, source_b_handle) = spawn_node_server(source_b).await;

    let sink_dir = temp_data_dir("sink-multi");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [
                {
                    "id": "a",
                    "base_url": source_a_url,
                    "enabled": true
                },
                {
                    "id": "b",
                    "base_url": source_b_url,
                    "enabled": true
                }
            ]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");

    let result = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("pull");
    assert_eq!(result.peers.len(), 2);
    assert_eq!(result.rejected_count, 0);

    let status = sink.sync_status().expect("status");
    let peer_a = status
        .peers
        .iter()
        .find(|peer| peer.peer_id == "a")
        .expect("a");
    let peer_b = status
        .peers
        .iter()
        .find(|peer| peer.peer_id == "b")
        .expect("b");
    assert!(peer_a.last_remote_cursor > 0);
    assert!(peer_b.last_remote_cursor > 0);

    source_a_handle.abort();
    source_b_handle.abort();
}

#[tokio::test]
async fn background_sync_runtime_converges_without_manual_pull() {
    let source_dir = temp_data_dir("source-runtime-converge");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    let (source_url, source_handle) = spawn_node_server(source.clone()).await;

    let sink_dir = temp_data_dir("sink-runtime-converge");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = Arc::new(LocalNode::new(&sink_dir).expect("sink"));
    let (_sink_url, sink_handle) = spawn_runtime_node_server(
        sink.clone(),
        SyncRuntimeConfig {
            enabled: true,
            interval_seconds: 1,
            max_parallel_peers: 2,
            limit: 200,
            max_pages: 100,
        },
    )
    .await;

    let as_of = Some(Utc::now());
    let source_hash = hash_value(
        &serde_json::to_value(source.replay(as_of).expect("source replay")).expect("json"),
    )
    .expect("source hash");

    let mut converged = false;
    for _ in 0..40 {
        let sink_hash = hash_value(
            &serde_json::to_value(sink.replay(as_of).expect("sink replay")).expect("json"),
        )
        .expect("sink hash");
        if sink_hash == source_hash {
            converged = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    assert!(
        converged,
        "sink should converge from background sync runtime"
    );

    let runtime_status = sink.sync_runtime_status_view();
    assert!(runtime_status.started_at.is_some());
    assert!(runtime_status.last_cycle_started_at.is_some());

    sink_handle.abort();
    source_handle.abort();
}

#[tokio::test]
async fn background_sync_runtime_hot_reload_and_auth_recovery() {
    let source_dir = temp_data_dir("source-runtime-auth");
    write_peers_config(
        &source_dir,
        serde_json::json!({
            "version": 1,
            "read_token": "source-token",
            "peers": []
        }),
    );
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-runtime-auth");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "bearer_token": "wrong-token",
                "enabled": true
            }]
        }),
    );
    let sink = Arc::new(LocalNode::new(&sink_dir).expect("sink"));
    let (_sink_url, sink_handle) = spawn_runtime_node_server(
        sink.clone(),
        SyncRuntimeConfig {
            enabled: true,
            interval_seconds: 1,
            max_parallel_peers: 2,
            limit: 200,
            max_pages: 100,
        },
    )
    .await;

    let mut saw_failure = false;
    for _ in 0..30 {
        let peers = sink.sync_peers_view(Some("source")).expect("peers");
        if let Some(peer) = peers.peers.first() {
            if peer.consecutive_failures > 0 && peer.last_error.is_some() {
                saw_failure = true;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    assert!(saw_failure, "runtime should record auth failure");

    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "bearer_token": "source-token",
                "enabled": true
            }]
        }),
    );

    let mut recovered = false;
    for _ in 0..50 {
        let peers = sink.sync_peers_view(Some("source")).expect("peers");
        if let Some(peer) = peers.peers.first() {
            if peer.last_error.is_none()
                && peer.consecutive_failures == 0
                && peer.last_remote_cursor > 0
                && peer.last_synced_at.is_some()
            {
                recovered = true;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    assert!(recovered, "runtime should recover after token hot-reload");

    sink_handle.abort();
    source_handle.abort();
}

#[tokio::test]
async fn background_sync_runtime_respects_enabled_toggle_hot_reload() {
    let source_dir = temp_data_dir("source-runtime-toggle");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let initial_event = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-03-01T00:00:00Z",
    );
    assert!(source.ingest_event(&initial_event.to_string()).accepted);
    let (source_url, source_handle) = spawn_node_server(source.clone()).await;

    let sink_dir = temp_data_dir("sink-runtime-toggle");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = Arc::new(LocalNode::new(&sink_dir).expect("sink"));
    let (_sink_url, sink_handle) = spawn_runtime_node_server(
        sink.clone(),
        SyncRuntimeConfig {
            enabled: true,
            interval_seconds: 1,
            max_parallel_peers: 2,
            limit: 200,
            max_pages: 100,
        },
    )
    .await;

    let mut initial_cursor = 0i64;
    for _ in 0..30 {
        let peers = sink.sync_peers_view(Some("source")).expect("peers");
        if let Some(peer) = peers.peers.first() {
            if peer.last_remote_cursor > 0 {
                initial_cursor = peer.last_remote_cursor;
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    assert!(initial_cursor > 0, "initial sync should complete");

    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": false
            }]
        }),
    );

    let second_event = signed_identity_create(
        "7777777777777777777777777777777777777777777777777777777777777777",
        "2026-03-01T00:00:10Z",
    );
    assert!(source.ingest_event(&second_event.to_string()).accepted);

    tokio::time::sleep(Duration::from_secs(3)).await;
    let disabled_state = sink.sync_peers_view(Some("source")).expect("peers");
    let cursor_while_disabled = disabled_state.peers[0].last_remote_cursor;
    assert_eq!(
        cursor_while_disabled, initial_cursor,
        "cursor should not advance while peer is disabled"
    );

    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );

    let mut resumed = false;
    for _ in 0..30 {
        let peers = sink.sync_peers_view(Some("source")).expect("peers");
        if peers.peers[0].last_remote_cursor > cursor_while_disabled {
            resumed = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    assert!(resumed, "cursor should resume after peer is re-enabled");

    sink_handle.abort();
    source_handle.abort();
}

#[tokio::test]
async fn sync_bootstrap_from_peer_converges_with_delta_pull() {
    let source_dir = temp_data_dir("source-bootstrap-converge");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let first = signed_identity_create(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2026-01-01T00:00:00Z",
    );
    assert!(source.ingest_event(&first.to_string()).accepted);
    let snapshot_as_of = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:04:00Z")
        .expect("snapshot as_of")
        .with_timezone(&Utc);
    let _snapshot_meta = source
        .create_snapshot(Some(snapshot_as_of))
        .expect("snapshot created");
    let second = signed_identity_create(
        "2222222222222222222222222222222222222222222222222222222222222222",
        "2026-01-01T00:05:00Z",
    );
    assert!(source.ingest_event(&second.to_string()).accepted);

    let (source_url, source_handle) = spawn_node_server(source.clone()).await;

    let sink_dir = temp_data_dir("sink-bootstrap-converge");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");

    let bootstrap = sink
        .sync_bootstrap_from_peer("source", None, 200, 100)
        .await
        .expect("bootstrap");
    assert!(bootstrap.error.is_none());
    assert!(!bootstrap.snapshot_id.is_empty());
    assert!(bootstrap.pulled_count >= 1);

    let as_of = Some(Utc::now());
    let source_hash = hash_value(
        &serde_json::to_value(source.replay(as_of).expect("source replay")).expect("json"),
    )
    .expect("source hash");
    let sink_hash =
        hash_value(&serde_json::to_value(sink.replay(as_of).expect("sink replay")).expect("json"))
            .expect("sink hash");
    assert_eq!(source_hash, sink_hash);

    let latest = sink
        .latest_snapshot_meta(Some(Utc::now()))
        .expect("latest snapshot")
        .expect("snapshot exists");
    assert_eq!(latest.snapshot_id, bootstrap.snapshot_id);

    source_handle.abort();
}

#[tokio::test]
async fn sync_bootstrap_is_idempotent_on_repeat() {
    let source_dir = temp_data_dir("source-bootstrap-idempotent");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    let snapshot_meta = source
        .create_snapshot(Some(Utc::now()))
        .expect("snapshot created");
    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-bootstrap-idempotent");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");

    let first = sink
        .sync_bootstrap_from_peer("source", Some(&snapshot_meta.snapshot_id), 200, 100)
        .await
        .expect("first bootstrap");
    assert!(first.error.is_none());
    let second = sink
        .sync_bootstrap_from_peer("source", Some(&snapshot_meta.snapshot_id), 200, 100)
        .await
        .expect("second bootstrap");
    assert!(second.error.is_none());
    assert_eq!(second.snapshot_id, first.snapshot_id);
    assert!(second.cursor_seeded_to >= second.cursor_before);
    assert!(second.already_present_count >= first.already_present_count);

    source_handle.abort();
}

#[tokio::test]
async fn sync_bootstrap_rejects_snapshot_id_hash_conflict() {
    let source_dir = temp_data_dir("source-bootstrap-conflict");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    let snapshot_meta = source
        .create_snapshot(Some(Utc::now()))
        .expect("snapshot created");
    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-bootstrap-conflict");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");
    let db = Connection::open(sink.db_path()).expect("open sink db");
    db.execute(
        r#"
        INSERT INTO snapshots (
            snapshot_id, as_of, event_seq, state_json, state_hash, created_at, format_version, checkpoint_json,
            imported_from_peer_id, imported_at, integrity_verified
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
        rusqlite::params![
            snapshot_meta.snapshot_id,
            snapshot_meta.as_of,
            snapshot_meta.event_seq,
            "{}",
            "conflict-hash",
            snapshot_meta.created_at,
            4i64,
            "{}",
            Option::<String>::None,
            Option::<String>::None,
            1i64,
        ],
    )
    .expect("insert conflicting snapshot");

    let bootstrap = sink
        .sync_bootstrap_from_peer("source", Some(&snapshot_meta.snapshot_id), 200, 100)
        .await;
    assert!(bootstrap.is_err());

    source_handle.abort();
}

#[tokio::test]
async fn sync_bootstrap_respects_snapshot_read_auth_boundary() {
    let source_dir = temp_data_dir("source-bootstrap-auth");
    write_peers_config(
        &source_dir,
        serde_json::json!({
            "version": 1,
            "read_token": "source-token",
            "peers": []
        }),
    );
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    source
        .create_snapshot(Some(Utc::now()))
        .expect("snapshot created");
    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-bootstrap-auth");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");
    let unauthorized = sink
        .sync_bootstrap_from_peer("source", None, 200, 100)
        .await;
    assert!(unauthorized.is_err());

    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "bearer_token": "source-token",
                "enabled": true
            }]
        }),
    );
    let authorized = sink
        .sync_bootstrap_from_peer("source", None, 200, 100)
        .await
        .expect("authorized bootstrap");
    assert!(authorized.error.is_none());

    source_handle.abort();
}

#[tokio::test]
async fn sync_bootstrap_uses_max_cursor_seed_for_peer() {
    let source_dir = temp_data_dir("source-bootstrap-cursor-max");
    let source = Arc::new(LocalNode::new(&source_dir).expect("source"));
    let fixture_events = load_claim_fixture_events();

    let first_slice = fixture_events.iter().take(2).cloned().collect::<Vec<_>>();
    let second_slice = fixture_events.iter().skip(2).cloned().collect::<Vec<_>>();
    assert_eq!(source.ingest_batch(&first_slice).rejected_count, 0);
    let old_snapshot = source
        .create_snapshot(Some(Utc::now()))
        .expect("old snapshot created");
    assert_eq!(source.ingest_batch(&second_slice).rejected_count, 0);
    let (source_url, source_handle) = spawn_node_server(source).await;

    let sink_dir = temp_data_dir("sink-bootstrap-cursor-max");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "source",
                "base_url": source_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");
    let pull = sink
        .sync_pull(SyncPullRequest {
            peer_id: None,
            all: false,
            limit: 200,
            max_pages: 100,
        })
        .await
        .expect("initial pull");
    let existing_cursor = pull.peers[0].last_remote_cursor;
    assert!(existing_cursor > old_snapshot.event_seq);

    let bootstrap = sink
        .sync_bootstrap_from_peer("source", Some(&old_snapshot.snapshot_id), 200, 100)
        .await
        .expect("bootstrap");
    assert_eq!(bootstrap.cursor_before, existing_cursor);
    assert_eq!(bootstrap.cursor_seeded_to, existing_cursor);

    source_handle.abort();
}

#[tokio::test]
async fn sync_bootstrap_rejects_corrupted_remote_snapshot() {
    let source_dir = temp_data_dir("source-bootstrap-corrupt");
    let source = LocalNode::new(&source_dir).expect("source");
    let fixture_events = load_claim_fixture_events();
    let ingest = source.ingest_batch(&fixture_events);
    assert_eq!(ingest.rejected_count, 0);
    let mut snapshot = source
        .create_snapshot_document(Some(Utc::now()))
        .expect("snapshot doc");
    snapshot.meta.state_hash = "deadbeef".to_string();

    let router = Router::new()
        .route("/snapshots/latest", get(corrupt_latest_snapshot))
        .route("/snapshots/{id}", get(corrupt_snapshot_by_id))
        .route("/events", get(empty_events_page))
        .with_state(CorruptSnapshotState {
            snapshot: snapshot.clone(),
        });
    let (bad_url, bad_handle) = spawn_router_server(router).await;

    let sink_dir = temp_data_dir("sink-bootstrap-corrupt");
    write_peers_config(
        &sink_dir,
        serde_json::json!({
            "version": 1,
            "peers": [{
                "id": "bad",
                "base_url": bad_url,
                "enabled": true
            }]
        }),
    );
    let sink = LocalNode::new(&sink_dir).expect("sink");
    let result = sink.sync_bootstrap_from_peer("bad", None, 200, 100).await;
    let error = result.expect_err("bootstrap should fail on corrupted remote snapshot");
    let error_text = format!("{error:#}");
    assert!(
        error_text.contains("snapshot state hash mismatch"),
        "unexpected bootstrap error contract: {error_text}"
    );

    let status = sink.sync_status().expect("sync status");
    let peer = status
        .peers
        .iter()
        .find(|entry| entry.peer_id == "bad")
        .expect("peer");
    assert_eq!(peer.last_remote_cursor, 0);
    assert!(
        sink.latest_snapshot_meta(Some(Utc::now()))
            .expect("latest snapshot")
            .is_none()
    );

    bad_handle.abort();
}
