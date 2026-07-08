use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Result;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_http::cors::{Any, CorsLayer};

use crate::ingest_rate_limit::resolve_ingest_client_key;
use crate::{LocalNode, parse_as_of, parse_participant_order_role};

#[derive(Debug, Deserialize)]
struct EventsQuery {
    cursor: Option<i64>,
    limit: Option<usize>,
    kind: Option<String>,
    author_pub_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AsOfQuery {
    as_of: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DiscoveryQuery {
    as_of: Option<String>,
    service_type: Option<String>,
    min_score: Option<String>,
    cursor: Option<String>,
    limit: Option<String>,
    alpha_defaults: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ParticipantOrdersQuery {
    participant: String,
    as_of: Option<String>,
    role: Option<String>,
    status: Option<String>,
    cursor: Option<String>,
    limit: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PolicyUpdatesQuery {
    as_of: Option<String>,
    cursor: Option<usize>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct ReputationHistoryQuery {
    as_of: Option<String>,
    cursor: Option<usize>,
    limit: Option<usize>,
    lane: Option<String>,
}

#[derive(Debug, Deserialize)]
struct P2HRiskHistoryQuery {
    as_of: Option<String>,
    cursor: Option<usize>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct BatchIngestRequest {
    events: Vec<Value>,
}

#[derive(Debug, Deserialize)]
struct CreateSnapshotRequest {
    as_of: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SnapshotLatestQuery {
    as_of: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SyncPeersQuery {
    peer: Option<String>,
}

#[derive(Debug, Serialize)]
struct IngestRateLimitError {
    accepted: bool,
    code: &'static str,
    message: String,
    retry_after_seconds: u64,
}

fn ingest_rate_limit_response(
    node: &LocalNode,
    headers: &HeaderMap,
) -> Option<axum::response::Response> {
    let client_key = resolve_ingest_client_key(headers);
    let decision = node.check_ingest_rate_limit(&client_key);
    if decision.allowed {
        return None;
    }
    let body = IngestRateLimitError {
        accepted: false,
        code: "ERR_INGEST_RATE_LIMIT_EXCEEDED",
        message: format!(
            "ingest rate limit exceeded for client `{client_key}`; retry after {} second(s)",
            decision.retry_after_seconds
        ),
        retry_after_seconds: decision.retry_after_seconds,
    };
    Some(
        (
            StatusCode::TOO_MANY_REQUESTS,
            [(header::RETRY_AFTER, decision.retry_after_seconds.to_string())],
            Json(body),
        )
            .into_response(),
    )
}

pub fn build_router(node: Arc<LocalNode>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    Router::new()
        .route("/health", get(get_health))
        .route("/events", post(post_events).get(get_events))
        .route("/events/batch", post(post_events_batch))
        .route("/sync/status", get(get_sync_status))
        .route("/sync/peers", get(get_sync_peers))
        .route("/state/replay", get(get_state_replay))
        .route("/state/discovery", get(get_state_discovery))
        .route("/state/orders", get(get_state_orders))
        .route("/state/identity/{id}", get(get_state_identity))
        .route("/state/balance/{id}", get(get_state_balance))
        .route("/state/policy", get(get_state_policy))
        .route("/state/policy/updates", get(get_state_policy_updates))
        .route("/state/economics/metrics", get(get_state_economics_metrics))
        .route("/state/economics/p2h/{id}", get(get_state_economics_p2h))
        .route(
            "/state/economics/p2h/{id}/history",
            get(get_state_economics_p2h_history),
        )
        .route("/state/reputation/{id}", get(get_state_reputation))
        .route(
            "/state/reputation/{id}/history",
            get(get_state_reputation_history),
        )
        .route("/state/offer/{id}", get(get_state_offer))
        .route("/state/order/{id}", get(get_state_order))
        .route(
            "/state/milestone/{order_id}/{milestone_id}",
            get(get_state_milestone),
        )
        .route("/snapshots", post(post_snapshots))
        .route("/snapshots/latest", get(get_snapshots_latest))
        .route("/snapshots/{id}", get(get_snapshot))
        .layer(cors)
        .with_state(node)
}

pub async fn serve(node: Arc<LocalNode>, bind: SocketAddr) -> Result<()> {
    let app = build_router(node);
    let listener = tokio::net::TcpListener::bind(bind).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn get_health(State(node): State<Arc<LocalNode>>) -> impl IntoResponse {
    match node.health() {
        Ok(health) => (StatusCode::OK, Json(health)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "status": "error", "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn post_events(
    State(node): State<Arc<LocalNode>>,
    headers: HeaderMap,
    Json(value): Json<Value>,
) -> impl IntoResponse {
    if let Some(response) = ingest_rate_limit_response(node.as_ref(), &headers) {
        return response;
    }
    let raw = value.to_string();
    let result = node.ingest_event(&raw);
    if result.accepted {
        (StatusCode::OK, Json(result)).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(result)).into_response()
    }
}

async fn post_events_batch(
    State(node): State<Arc<LocalNode>>,
    headers: HeaderMap,
    Json(request): Json<BatchIngestRequest>,
) -> impl IntoResponse {
    if let Some(response) = ingest_rate_limit_response(node.as_ref(), &headers) {
        return response;
    }
    let raws = request
        .events
        .into_iter()
        .map(|event| event.to_string())
        .collect::<Vec<_>>();
    let result = node.ingest_batch(&raws);
    if result.rejected_count == 0 {
        (StatusCode::OK, Json(result)).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(result)).into_response()
    }
}

async fn get_events(
    State(node): State<Arc<LocalNode>>,
    headers: HeaderMap,
    Query(query): Query<EventsQuery>,
) -> impl IntoResponse {
    if let Some(response) = enforce_read_auth(&node, &headers) {
        return response;
    }

    match node.list_events(
        query.cursor,
        query.limit.unwrap_or(50),
        query.kind.as_deref(),
        query.author_pub_key.as_deref(),
    ) {
        Ok(page) => (StatusCode::OK, Json(page)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_sync_status(State(node): State<Arc<LocalNode>>) -> impl IntoResponse {
    (StatusCode::OK, Json(node.sync_runtime_status_view())).into_response()
}

async fn get_sync_peers(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<SyncPeersQuery>,
) -> impl IntoResponse {
    match node.sync_peers_view(query.peer.as_deref()) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

fn has_matching_bearer_token(headers: &HeaderMap, expected_token: &str) -> bool {
    let header_value = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let provided = header_value.strip_prefix("Bearer ").unwrap_or_default();
    provided == expected_token
}

fn enforce_read_auth(
    node: &Arc<LocalNode>,
    headers: &HeaderMap,
) -> Option<axum::response::Response> {
    match node.get_events_read_token() {
        Ok(Some(expected_token)) => {
            if has_matching_bearer_token(headers, &expected_token) {
                None
            } else {
                Some(
                    (
                        StatusCode::UNAUTHORIZED,
                        Json(serde_json::json!({ "error": "unauthorized" })),
                    )
                        .into_response(),
                )
            }
        }
        Ok(None) => None,
        Err(error) => Some(
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response(),
        ),
    }
}

async fn get_state_replay(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };

    match node.replay_view(as_of) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_discovery(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<DiscoveryQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    let min_score = match parse_optional_i64(query.min_score.as_deref(), "min_score") {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error })),
            )
                .into_response();
        }
    };
    let cursor = match parse_optional_usize(query.cursor.as_deref(), "cursor") {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error })),
            )
                .into_response();
        }
    };
    let limit = match parse_optional_usize(query.limit.as_deref(), "limit") {
        Ok(value) => value.unwrap_or(50),
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error })),
            )
                .into_response();
        }
    };
    let alpha_defaults =
        match parse_optional_bool_flag(query.alpha_defaults.as_deref(), "alpha_defaults") {
            Ok(value) => value.unwrap_or(true),
            Err(error) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": error })),
                )
                    .into_response();
            }
        };
    let service_type = query
        .service_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    match node.discovery_view(as_of, service_type, min_score, cursor, limit, alpha_defaults) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_orders(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<ParticipantOrdersQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    let role = match parse_participant_order_role(query.role.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error })),
            )
                .into_response();
        }
    };
    let cursor = match parse_optional_usize(query.cursor.as_deref(), "cursor") {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error })),
            )
                .into_response();
        }
    };
    let limit = match parse_optional_usize(query.limit.as_deref(), "limit") {
        Ok(value) => value.unwrap_or(50),
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error })),
            )
                .into_response();
        }
    };
    let status = query
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if query.participant.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "participant is required" })),
        )
            .into_response();
    }

    match node.participant_orders_view(
        as_of,
        &query.participant,
        role,
        status,
        cursor,
        limit,
    ) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => {
            let message = error.to_string();
            let status_code = if message.starts_with("participant must be") {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            (status_code, Json(serde_json::json!({ "error": message }))).into_response()
        }
    }
}

async fn get_state_identity(
    State(node): State<Arc<LocalNode>>,
    Path(identity): Path<String>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.replay_view(as_of) {
        Ok(view) => {
            let identity_value = view.data.state.identities.get(&identity).cloned();
            let response = serde_json::json!({
                "as_of": view.as_of,
                "source": view.source,
                "snapshot_id": view.snapshot_id,
                "data": identity_value
            });
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_balance(
    State(node): State<Arc<LocalNode>>,
    Path(identity): Path<String>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.replay_view(as_of) {
        Ok(view) => {
            let balance_value = view.data.state.balances.get(&identity).cloned();
            let response = serde_json::json!({
                "as_of": view.as_of,
                "source": view.source,
                "snapshot_id": view.snapshot_id,
                "data": balance_value
            });
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_policy(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.policy_current_view(as_of) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_policy_updates(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<PolicyUpdatesQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.policy_timeline_view(as_of, query.cursor, query.limit.unwrap_or(50)) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_economics_metrics(
    State(node): State<Arc<LocalNode>>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.economics_metrics_view(as_of) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_reputation(
    State(node): State<Arc<LocalNode>>,
    Path(identity): Path<String>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.reputation_current_view(&identity, as_of) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_economics_p2h(
    State(node): State<Arc<LocalNode>>,
    Path(identity): Path<String>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.p2h_risk_view(&identity, as_of) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_economics_p2h_history(
    State(node): State<Arc<LocalNode>>,
    Path(identity): Path<String>,
    Query(query): Query<P2HRiskHistoryQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.p2h_risk_history_view(&identity, as_of, query.cursor, query.limit.unwrap_or(50)) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_reputation_history(
    State(node): State<Arc<LocalNode>>,
    Path(identity): Path<String>,
    Query(query): Query<ReputationHistoryQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.reputation_history_view(
        &identity,
        as_of,
        query.cursor,
        query.limit.unwrap_or(50),
        query.lane.as_deref(),
    ) {
        Ok(view) => (StatusCode::OK, Json(view)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_offer(
    State(node): State<Arc<LocalNode>>,
    Path(offer_id): Path<String>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.replay_view(as_of) {
        Ok(view) => {
            let offer_value = view.data.state.offers.get(&offer_id).cloned();
            let response = serde_json::json!({
                "as_of": view.as_of,
                "source": view.source,
                "snapshot_id": view.snapshot_id,
                "data": offer_value
            });
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_order(
    State(node): State<Arc<LocalNode>>,
    Path(order_id): Path<String>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.replay_view(as_of) {
        Ok(view) => {
            let order_value = view.data.state.orders.get(&order_id).cloned();
            let response = serde_json::json!({
                "as_of": view.as_of,
                "source": view.source,
                "snapshot_id": view.snapshot_id,
                "data": order_value
            });
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_state_milestone(
    State(node): State<Arc<LocalNode>>,
    Path((order_id, milestone_id)): Path<(String, String)>,
    Query(query): Query<AsOfQuery>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.replay_view(as_of) {
        Ok(view) => {
            let key = format!("{order_id}:{milestone_id}");
            let milestone_value = view.data.state.milestones.get(&key).cloned();
            let response = serde_json::json!({
                "as_of": view.as_of,
                "source": view.source,
                "snapshot_id": view.snapshot_id,
                "data": milestone_value
            });
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn post_snapshots(
    State(node): State<Arc<LocalNode>>,
    Json(request): Json<CreateSnapshotRequest>,
) -> impl IntoResponse {
    let as_of = match parse_as_of(request.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };
    match node.create_snapshot(as_of) {
        Ok(meta) => (StatusCode::OK, Json(meta)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_snapshot(
    State(node): State<Arc<LocalNode>>,
    headers: HeaderMap,
    Path(snapshot_id): Path<String>,
) -> impl IntoResponse {
    if let Some(response) = enforce_read_auth(&node, &headers) {
        return response;
    }
    match node.get_snapshot(&snapshot_id) {
        Ok(Some(snapshot)) => (StatusCode::OK, Json(snapshot)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "snapshot not found" })),
        )
            .into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn get_snapshots_latest(
    State(node): State<Arc<LocalNode>>,
    headers: HeaderMap,
    Query(query): Query<SnapshotLatestQuery>,
) -> impl IntoResponse {
    if let Some(response) = enforce_read_auth(&node, &headers) {
        return response;
    }
    let as_of = match parse_as_of(query.as_of.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
                .into_response();
        }
    };

    match node.latest_snapshot_meta(as_of) {
        Ok(Some(snapshot)) => (StatusCode::OK, Json(snapshot)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "snapshot not found" })),
        )
            .into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

fn parse_optional_i64(value: Option<&str>, field_name: &str) -> Result<Option<i64>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    trimmed
        .parse::<i64>()
        .map(Some)
        .map_err(|_| format!("invalid {field_name}: expected integer"))
}

fn parse_optional_usize(value: Option<&str>, field_name: &str) -> Result<Option<usize>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    trimmed
        .parse::<usize>()
        .map(Some)
        .map_err(|_| format!("invalid {field_name}: expected integer >= 0"))
}

fn parse_optional_bool_flag(
    value: Option<&str>,
    field_name: &str,
) -> Result<Option<bool>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim().to_ascii_lowercase();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if matches!(trimmed.as_str(), "1" | "true" | "yes" | "on") {
        return Ok(Some(true));
    }
    if matches!(trimmed.as_str(), "0" | "false" | "no" | "off") {
        return Ok(Some(false));
    }
    Err(format!(
        "invalid {field_name}: expected one of 1,true,yes,on,0,false,no,off"
    ))
}
