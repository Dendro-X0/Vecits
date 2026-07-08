use std::path::Path;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::SnapshotMeta;
use protocol_core::InvalidReasonCode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventRow {
    pub seq: i64,
    pub event_id: String,
    pub created_at: String,
    pub kind: String,
    pub author_pub_key: String,
    pub policy_version: String,
    pub payload_json: Value,
    pub references_json: Option<Value>,
    pub nonce: Option<String>,
    pub sig: String,
    pub raw_json: Value,
    pub received_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotRow {
    pub meta: SnapshotMeta,
    pub state_json: Value,
    pub checkpoint_json: Option<Value>,
    pub imported_from_peer_id: Option<String>,
    pub imported_at: Option<String>,
    pub integrity_verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayEventLine {
    pub seq: i64,
    pub raw_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbInspectStats {
    pub event_count: i64,
    pub invalid_event_count: i64,
    pub snapshot_count: i64,
    pub latest_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerSyncStateRow {
    pub peer_id: String,
    pub last_remote_cursor: i64,
    pub last_synced_at: Option<String>,
    pub last_error: Option<String>,
    pub consecutive_failures: i64,
    pub next_attempt_at: Option<String>,
    pub last_cycle_started_at: Option<String>,
    pub last_cycle_finished_at: Option<String>,
    pub last_result_json: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct EventListQuery<'a> {
    pub cursor: Option<i64>,
    pub limit: usize,
    pub kind: Option<&'a str>,
    pub author_pub_key: Option<&'a str>,
}

const SCHEMA_VERSION: &str = "7";

pub fn sqlite_schema_version() -> &'static str {
    SCHEMA_VERSION
}

const REPLAY_KINDS: [&str; 15] = [
    "IdentityCreate",
    "IdentityUpdate",
    "Vouch",
    "VouchRevoke",
    "ContributionClaim",
    "ContributionAttest",
    "MintCredits",
    "SpendCredits",
    "ServiceOffer",
    "ServiceOrder",
    "ServiceDelivery",
    "ServiceAccept",
    "ServiceDispute",
    "ServiceSettle",
    "PolicyUpdate",
];

pub fn init_database(db_path: &Path) -> Result<()> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    connection.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS events (
            event_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            kind TEXT NOT NULL,
            author_pub_key TEXT NOT NULL,
            policy_version TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            references_json TEXT,
            nonce TEXT,
            sig TEXT NOT NULL,
            raw_json TEXT NOT NULL,
            received_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS event_order (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS invalid_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT,
            code TEXT NOT NULL,
            message TEXT NOT NULL,
            line_no INTEGER,
            raw_json TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS snapshots (
            snapshot_id TEXT PRIMARY KEY,
            as_of TEXT NOT NULL,
            event_seq INTEGER NOT NULL,
            state_json TEXT NOT NULL,
            state_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS peer_sync_state (
            peer_id TEXT PRIMARY KEY,
            last_remote_cursor INTEGER NOT NULL DEFAULT 0,
            last_synced_at TEXT,
            last_error TEXT
        );
        INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
        "#,
    )?;

    if !table_has_column(&connection, "snapshots", "format_version")? {
        connection.execute(
            "ALTER TABLE snapshots ADD COLUMN format_version INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }

    if !table_has_column(&connection, "snapshots", "checkpoint_json")? {
        connection.execute("ALTER TABLE snapshots ADD COLUMN checkpoint_json TEXT", [])?;
    }
    if !table_has_column(&connection, "snapshots", "imported_from_peer_id")? {
        connection.execute(
            "ALTER TABLE snapshots ADD COLUMN imported_from_peer_id TEXT",
            [],
        )?;
    }
    if !table_has_column(&connection, "snapshots", "imported_at")? {
        connection.execute("ALTER TABLE snapshots ADD COLUMN imported_at TEXT", [])?;
    }
    if !table_has_column(&connection, "snapshots", "integrity_verified")? {
        connection.execute(
            "ALTER TABLE snapshots ADD COLUMN integrity_verified INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }

    if !table_has_column(&connection, "peer_sync_state", "consecutive_failures")? {
        connection.execute(
            "ALTER TABLE peer_sync_state ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !table_has_column(&connection, "peer_sync_state", "next_attempt_at")? {
        connection.execute(
            "ALTER TABLE peer_sync_state ADD COLUMN next_attempt_at TEXT",
            [],
        )?;
    }
    if !table_has_column(&connection, "peer_sync_state", "last_cycle_started_at")? {
        connection.execute(
            "ALTER TABLE peer_sync_state ADD COLUMN last_cycle_started_at TEXT",
            [],
        )?;
    }
    if !table_has_column(&connection, "peer_sync_state", "last_cycle_finished_at")? {
        connection.execute(
            "ALTER TABLE peer_sync_state ADD COLUMN last_cycle_finished_at TEXT",
            [],
        )?;
    }
    if !table_has_column(&connection, "peer_sync_state", "last_result_json")? {
        connection.execute(
            "ALTER TABLE peer_sync_state ADD COLUMN last_result_json TEXT",
            [],
        )?;
    }

    connection.execute_batch(
        r#"
        CREATE INDEX IF NOT EXISTS idx_events_kind_created_at ON events(kind, created_at);
        CREATE INDEX IF NOT EXISTS idx_event_order_event_id ON event_order(event_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_as_of_created_at ON snapshots(as_of, created_at);
        "#,
    )?;

    connection.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?1)",
        params![SCHEMA_VERSION],
    )?;
    Ok(())
}

pub fn insert_event(
    db_path: &Path,
    raw: &protocol_core::RawEnvelopeLoose,
    raw_json: &str,
) -> Result<()> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let payload_json = serde_json::to_string(&raw.payload)?;
    let references_json = raw
        .references
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    let received_at = Utc::now().to_rfc3339();
    connection.execute(
        r#"
        INSERT INTO events (
            event_id, created_at, kind, author_pub_key, policy_version,
            payload_json, references_json, nonce, sig, raw_json, received_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
        params![
            raw.event_id,
            raw.created_at,
            raw.kind,
            raw.author_pub_key,
            raw.policy_version,
            payload_json,
            references_json,
            raw.nonce,
            raw.sig,
            raw_json,
            received_at
        ],
    )?;
    connection.execute(
        "INSERT INTO event_order (event_id) VALUES (?1)",
        params![raw.event_id],
    )?;
    Ok(())
}

pub fn event_exists(db_path: &Path, event_id: &str) -> Result<bool> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let exists: i64 = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM events WHERE event_id = ?1)",
        params![event_id],
        |row| row.get(0),
    )?;
    Ok(exists == 1)
}

pub fn insert_invalid_event(
    db_path: &Path,
    event_id: Option<&str>,
    code: InvalidReasonCode,
    message: &str,
    line_no: Option<usize>,
    raw_json: Option<&str>,
) -> Result<()> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    connection.execute(
        r#"
        INSERT INTO invalid_events (event_id, code, message, line_no, raw_json, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        params![
            event_id,
            code.to_string(),
            message,
            line_no.map(|line| line as i64),
            raw_json,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn list_events(db_path: &Path, query: EventListQuery<'_>) -> Result<Vec<EventRow>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT
            eo.seq,
            e.event_id,
            e.created_at,
            e.kind,
            e.author_pub_key,
            e.policy_version,
            e.payload_json,
            e.references_json,
            e.nonce,
            e.sig,
            e.raw_json,
            e.received_at
        FROM event_order eo
        JOIN events e ON e.event_id = eo.event_id
        WHERE (?1 IS NULL OR eo.seq > ?1)
          AND (?2 IS NULL OR e.kind = ?2)
          AND (?3 IS NULL OR e.author_pub_key = ?3)
        ORDER BY eo.seq ASC
        LIMIT ?4
        "#,
    )?;

    let rows = statement.query_map(
        params![
            query.cursor,
            query.kind,
            query.author_pub_key,
            query.limit as i64
        ],
        |row| {
            let payload_json: String = row.get(6)?;
            let references_json: Option<String> = row.get(7)?;
            let raw_json: String = row.get(10)?;
            Ok(EventRow {
                seq: row.get(0)?,
                event_id: row.get(1)?,
                created_at: row.get(2)?,
                kind: row.get(3)?,
                author_pub_key: row.get(4)?,
                policy_version: row.get(5)?,
                payload_json: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                references_json: references_json
                    .as_deref()
                    .map(serde_json::from_str)
                    .transpose()
                    .unwrap_or(None),
                nonce: row.get(8)?,
                sig: row.get(9)?,
                raw_json: serde_json::from_str(&raw_json).unwrap_or(Value::Null),
                received_at: row.get(11)?,
            })
        },
    )?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn insert_snapshot(db_path: &Path, row: &SnapshotRow) -> Result<()> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    connection.execute(
        r#"
        INSERT INTO snapshots (
            snapshot_id, as_of, event_seq, state_json, state_hash, created_at, format_version, checkpoint_json,
            imported_from_peer_id, imported_at, integrity_verified
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
        params![
            row.meta.snapshot_id,
            row.meta.as_of,
            row.meta.event_seq,
            serde_json::to_string(&row.state_json)?,
            row.meta.state_hash,
            row.meta.created_at,
            row.meta.format_version,
            row.checkpoint_json
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
            row.imported_from_peer_id,
            row.imported_at,
            i64::from(row.integrity_verified),
        ],
    )?;
    Ok(())
}

pub fn get_snapshot(db_path: &Path, snapshot_id: &str) -> Result<Option<SnapshotRow>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT
            snapshot_id, as_of, event_seq, state_json, state_hash, created_at, format_version,
            checkpoint_json, imported_from_peer_id, imported_at, integrity_verified
        FROM snapshots
        WHERE snapshot_id = ?1
        "#,
    )?;
    let mut rows = statement.query(params![snapshot_id])?;
    if let Some(row) = rows.next()? {
        let state_json_raw: String = row.get(3)?;
        let state_json: Value = serde_json::from_str(&state_json_raw)?;
        let checkpoint_raw: Option<String> = row.get(7)?;
        let checkpoint_json = checkpoint_raw
            .as_deref()
            .map(serde_json::from_str)
            .transpose()?;
        Ok(Some(SnapshotRow {
            meta: SnapshotMeta {
                snapshot_id: row.get(0)?,
                as_of: row.get(1)?,
                event_seq: row.get(2)?,
                state_hash: row.get(4)?,
                created_at: row.get(5)?,
                format_version: row.get(6)?,
            },
            state_json,
            checkpoint_json,
            imported_from_peer_id: row.get(8)?,
            imported_at: row.get(9)?,
            integrity_verified: row.get::<_, i64>(10)? == 1,
        }))
    } else {
        Ok(None)
    }
}

pub fn find_latest_snapshot_at_or_before(
    db_path: &Path,
    as_of: DateTime<Utc>,
) -> Result<Option<SnapshotRow>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT
            snapshot_id, as_of, event_seq, state_json, state_hash, created_at, format_version,
            checkpoint_json, imported_from_peer_id, imported_at, integrity_verified
        FROM snapshots
        WHERE as_of <= ?1
        ORDER BY as_of DESC, created_at DESC
        LIMIT 1
        "#,
    )?;
    let mut rows = statement.query(params![as_of.to_rfc3339()])?;
    if let Some(row) = rows.next()? {
        let state_json_raw: String = row.get(3)?;
        let state_json: Value = serde_json::from_str(&state_json_raw)?;
        let checkpoint_raw: Option<String> = row.get(7)?;
        let checkpoint_json = checkpoint_raw
            .as_deref()
            .map(serde_json::from_str)
            .transpose()?;
        Ok(Some(SnapshotRow {
            meta: SnapshotMeta {
                snapshot_id: row.get(0)?,
                as_of: row.get(1)?,
                event_seq: row.get(2)?,
                state_hash: row.get(4)?,
                created_at: row.get(5)?,
                format_version: row.get(6)?,
            },
            state_json,
            checkpoint_json,
            imported_from_peer_id: row.get(8)?,
            imported_at: row.get(9)?,
            integrity_verified: row.get::<_, i64>(10)? == 1,
        }))
    } else {
        Ok(None)
    }
}

pub fn find_latest_snapshot_meta_at_or_before(
    db_path: &Path,
    as_of: DateTime<Utc>,
) -> Result<Option<SnapshotMeta>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT snapshot_id, as_of, event_seq, state_hash, created_at, format_version
        FROM snapshots
        WHERE as_of <= ?1
        ORDER BY as_of DESC, created_at DESC
        LIMIT 1
        "#,
    )?;
    let mut rows = statement.query(params![as_of.to_rfc3339()])?;
    if let Some(row) = rows.next()? {
        Ok(Some(SnapshotMeta {
            snapshot_id: row.get(0)?,
            as_of: row.get(1)?,
            event_seq: row.get(2)?,
            state_hash: row.get(3)?,
            created_at: row.get(4)?,
            format_version: row.get(5)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn latest_replay_event_seq_at_or_before(db_path: &Path, as_of: DateTime<Utc>) -> Result<i64> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let value: i64 = connection.query_row(
        r#"
        SELECT COALESCE(MAX(eo.seq), 0)
        FROM event_order eo
        JOIN events e ON e.event_id = eo.event_id
        WHERE e.kind IN (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
          AND e.created_at <= ?16
        "#,
        params![
            REPLAY_KINDS[0],
            REPLAY_KINDS[1],
            REPLAY_KINDS[2],
            REPLAY_KINDS[3],
            REPLAY_KINDS[4],
            REPLAY_KINDS[5],
            REPLAY_KINDS[6],
            REPLAY_KINDS[7],
            REPLAY_KINDS[8],
            REPLAY_KINDS[9],
            REPLAY_KINDS[10],
            REPLAY_KINDS[11],
            REPLAY_KINDS[12],
            REPLAY_KINDS[13],
            REPLAY_KINDS[14],
            as_of.to_rfc3339()
        ],
        |row| row.get(0),
    )?;
    Ok(value)
}

pub fn has_replay_backfill_since_seq(
    db_path: &Path,
    after_seq: i64,
    snapshot_as_of: DateTime<Utc>,
) -> Result<bool> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let exists: i64 = connection.query_row(
        r#"
        SELECT EXISTS (
            SELECT 1
            FROM event_order eo
            JOIN events e ON e.event_id = eo.event_id
            WHERE eo.seq > ?1
              AND e.kind IN (?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
              AND e.created_at <= ?17
            LIMIT 1
        )
        "#,
        params![
            after_seq,
            REPLAY_KINDS[0],
            REPLAY_KINDS[1],
            REPLAY_KINDS[2],
            REPLAY_KINDS[3],
            REPLAY_KINDS[4],
            REPLAY_KINDS[5],
            REPLAY_KINDS[6],
            REPLAY_KINDS[7],
            REPLAY_KINDS[8],
            REPLAY_KINDS[9],
            REPLAY_KINDS[10],
            REPLAY_KINDS[11],
            REPLAY_KINDS[12],
            REPLAY_KINDS[13],
            REPLAY_KINDS[14],
            snapshot_as_of.to_rfc3339()
        ],
        |row| row.get(0),
    )?;
    Ok(exists == 1)
}

pub fn list_replay_event_lines(
    db_path: &Path,
    as_of: Option<DateTime<Utc>>,
    created_after: Option<DateTime<Utc>>,
    after_seq: Option<i64>,
) -> Result<Vec<ReplayEventLine>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT eo.seq, e.raw_json
        FROM event_order eo
        JOIN events e ON e.event_id = eo.event_id
        WHERE e.kind IN (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
          AND (?16 IS NULL OR e.created_at <= ?16)
          AND (?17 IS NULL OR e.created_at > ?17)
          AND (?18 IS NULL OR eo.seq > ?18)
        ORDER BY eo.seq ASC
        "#,
    )?;

    let rows = statement.query_map(
        params![
            REPLAY_KINDS[0],
            REPLAY_KINDS[1],
            REPLAY_KINDS[2],
            REPLAY_KINDS[3],
            REPLAY_KINDS[4],
            REPLAY_KINDS[5],
            REPLAY_KINDS[6],
            REPLAY_KINDS[7],
            REPLAY_KINDS[8],
            REPLAY_KINDS[9],
            REPLAY_KINDS[10],
            REPLAY_KINDS[11],
            REPLAY_KINDS[12],
            REPLAY_KINDS[13],
            REPLAY_KINDS[14],
            as_of.map(|timestamp| timestamp.to_rfc3339()),
            created_after.map(|timestamp| timestamp.to_rfc3339()),
            after_seq,
        ],
        |row| {
            Ok(ReplayEventLine {
                seq: row.get(0)?,
                raw_json: row.get(1)?,
            })
        },
    )?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn ensure_event_order_sequence_at_least(db_path: &Path, min_seq: i64) -> Result<()> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    connection.execute(
        "INSERT OR IGNORE INTO sqlite_sequence(name, seq) VALUES ('event_order', 0)",
        [],
    )?;
    let current: i64 = connection.query_row(
        "SELECT COALESCE(seq, 0) FROM sqlite_sequence WHERE name = 'event_order'",
        [],
        |row| row.get(0),
    )?;
    if current < min_seq {
        connection.execute(
            "UPDATE sqlite_sequence SET seq = ?1 WHERE name = 'event_order'",
            params![min_seq],
        )?;
    }
    Ok(())
}

pub fn db_inspect(db_path: &Path) -> Result<DbInspectStats> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let event_count: i64 =
        connection.query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))?;
    let invalid_event_count: i64 =
        connection.query_row("SELECT COUNT(*) FROM invalid_events", [], |row| row.get(0))?;
    let snapshot_count: i64 =
        connection.query_row("SELECT COUNT(*) FROM snapshots", [], |row| row.get(0))?;
    let latest_seq: i64 =
        connection.query_row("SELECT COALESCE(MAX(seq), 0) FROM event_order", [], |row| {
            row.get(0)
        })?;

    Ok(DbInspectStats {
        event_count,
        invalid_event_count,
        snapshot_count,
        latest_seq,
    })
}

pub fn get_peer_sync_state(db_path: &Path, peer_id: &str) -> Result<Option<PeerSyncStateRow>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT
            peer_id,
            last_remote_cursor,
            last_synced_at,
            last_error,
            consecutive_failures,
            next_attempt_at,
            last_cycle_started_at,
            last_cycle_finished_at,
            last_result_json
        FROM peer_sync_state
        WHERE peer_id = ?1
        "#,
    )?;
    let mut rows = statement.query(params![peer_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(PeerSyncStateRow {
            peer_id: row.get(0)?,
            last_remote_cursor: row.get(1)?,
            last_synced_at: row.get(2)?,
            last_error: row.get(3)?,
            consecutive_failures: row.get(4)?,
            next_attempt_at: row.get(5)?,
            last_cycle_started_at: row.get(6)?,
            last_cycle_finished_at: row.get(7)?,
            last_result_json: row
                .get::<_, Option<String>>(8)?
                .as_deref()
                .map(serde_json::from_str)
                .transpose()
                .with_context(|| "parsing peer_sync_state.last_result_json".to_string())?,
        }))
    } else {
        Ok(None)
    }
}

pub fn upsert_peer_sync_state(db_path: &Path, row: &PeerSyncStateRow) -> Result<()> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    connection.execute(
        r#"
        INSERT INTO peer_sync_state (
            peer_id,
            last_remote_cursor,
            last_synced_at,
            last_error,
            consecutive_failures,
            next_attempt_at,
            last_cycle_started_at,
            last_cycle_finished_at,
            last_result_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(peer_id) DO UPDATE SET
            last_remote_cursor = excluded.last_remote_cursor,
            last_synced_at = excluded.last_synced_at,
            last_error = excluded.last_error,
            consecutive_failures = excluded.consecutive_failures,
            next_attempt_at = excluded.next_attempt_at,
            last_cycle_started_at = excluded.last_cycle_started_at,
            last_cycle_finished_at = excluded.last_cycle_finished_at,
            last_result_json = excluded.last_result_json
        "#,
        params![
            row.peer_id,
            row.last_remote_cursor,
            row.last_synced_at,
            row.last_error,
            row.consecutive_failures,
            row.next_attempt_at,
            row.last_cycle_started_at,
            row.last_cycle_finished_at,
            row.last_result_json
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
        ],
    )?;
    Ok(())
}

pub fn list_peer_sync_states(db_path: &Path) -> Result<Vec<PeerSyncStateRow>> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let mut statement = connection.prepare(
        r#"
        SELECT
            peer_id,
            last_remote_cursor,
            last_synced_at,
            last_error,
            consecutive_failures,
            next_attempt_at,
            last_cycle_started_at,
            last_cycle_finished_at,
            last_result_json
        FROM peer_sync_state
        ORDER BY peer_id ASC
        "#,
    )?;
    let rows = statement.query_map([], |row| {
        Ok(PeerSyncStateRow {
            peer_id: row.get(0)?,
            last_remote_cursor: row.get(1)?,
            last_synced_at: row.get(2)?,
            last_error: row.get(3)?,
            consecutive_failures: row.get(4)?,
            next_attempt_at: row.get(5)?,
            last_cycle_started_at: row.get(6)?,
            last_cycle_finished_at: row.get(7)?,
            last_result_json: row
                .get::<_, Option<String>>(8)?
                .as_deref()
                .map(serde_json::from_str)
                .transpose()
                .unwrap_or(None),
        })
    })?;

    let mut output = Vec::new();
    for row in rows {
        output.push(row?);
    }
    Ok(output)
}

pub fn reset_peer_sync_state(db_path: &Path, peer_id: &str) -> Result<bool> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let changed = connection.execute(
        "DELETE FROM peer_sync_state WHERE peer_id = ?1",
        params![peer_id],
    )?;
    Ok(changed > 0)
}

pub fn reset_all_peer_sync_state(db_path: &Path) -> Result<usize> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("opening sqlite db {}", db_path.display()))?;
    let changed = connection.execute("DELETE FROM peer_sync_state", [])?;
    Ok(changed)
}

fn table_has_column(connection: &Connection, table: &str, column: &str) -> Result<bool> {
    let pragma = format!("PRAGMA table_info({table})");
    let mut statement = connection.prepare(&pragma)?;
    let mut rows = statement.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}
