use std::fs;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use ed25519_dalek::SigningKey;
use node::{
    LocalNode, SnapshotDocument, SyncPullRequest, SyncRuntimeConfig, hash_value, parse_as_of,
    replay_phase1_from_jsonl,
};
use policy::default_policy;
use protocol_core::{UnsignedEvent, sign_event};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use state_engine::{inspect_identity, replay_jsonl_as_of, replay_jsonl_with_default_now};

#[derive(Debug, Parser)]
#[command(name = "vectis-node", about = "Vectis protocol node and operator CLI", version)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Keys(KeysCommand),
    Event(EventCommand),
    Log(LogCommand),
    State(StateCommand),
    Fixtures(FixturesCommand),
    Node(NodeCommand),
}

#[derive(Debug, Parser)]
struct KeysCommand {
    #[command(subcommand)]
    command: KeysSubcommand,
}

#[derive(Debug, Subcommand)]
enum KeysSubcommand {
    Generate,
    Inspect {
        #[arg(long = "secret-key")]
        secret_key: String,
    },
}

#[derive(Debug, Parser)]
struct EventCommand {
    #[command(subcommand)]
    command: EventSubcommand,
}

#[derive(Debug, Subcommand)]
enum EventSubcommand {
    Sign {
        #[arg(long = "in")]
        input: PathBuf,
        #[arg(long)]
        out: PathBuf,
    },
}

#[derive(Debug, Parser)]
struct LogCommand {
    #[command(subcommand)]
    command: LogSubcommand,
}

#[derive(Debug, Subcommand)]
enum LogSubcommand {
    Validate {
        #[arg(long = "in")]
        input: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
    VerifyChain {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
    },
    Replay {
        #[arg(long = "in")]
        input: PathBuf,
        #[arg(long)]
        out: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
}

#[derive(Debug, Parser)]
struct StateCommand {
    #[command(subcommand)]
    command: StateSubcommand,
}

#[derive(Debug, Subcommand)]
enum StateSubcommand {
    Inspect {
        #[arg(long = "in")]
        input: PathBuf,
        #[arg(long)]
        identity: Option<String>,
    },
}

#[derive(Debug, Parser)]
struct FixturesCommand {
    #[command(subcommand)]
    command: FixturesSubcommand,
}

#[derive(Debug, Subcommand)]
enum FixturesSubcommand {
    Run,
}

#[derive(Debug, Parser)]
struct NodeCommand {
    #[command(subcommand)]
    command: NodeSubcommand,
}

#[derive(Debug, Subcommand)]
enum NodeSubcommand {
    Init {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long = "events-log-hash-chain", default_value_t = false)]
        events_log_hash_chain: bool,
    },
    Serve {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long, default_value = "127.0.0.1:7878")]
        bind: String,
        #[arg(long = "sync-enabled", default_value_t = true)]
        sync_enabled: bool,
        #[arg(long = "sync-interval-seconds", default_value_t = 30)]
        sync_interval_seconds: u64,
        #[arg(long = "sync-max-parallel-peers", default_value_t = 4)]
        sync_max_parallel_peers: usize,
        #[arg(long = "sync-limit", default_value_t = 200)]
        sync_limit: usize,
        #[arg(long = "sync-max-pages", default_value_t = 100)]
        sync_max_pages: usize,
        #[arg(long = "ingest-rate-limit-max", default_value_t = 0)]
        ingest_rate_limit_max: u32,
        #[arg(
            long = "ingest-rate-limit-window-seconds",
            default_value_t = 60
        )]
        ingest_rate_limit_window_seconds: u64,
    },
    Ingest {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long = "in")]
        input: PathBuf,
    },
    Snapshot(NodeSnapshotCommand),
    Policy(NodePolicyCommand),
    Economics(NodeEconomicsCommand),
    Reputation(NodeReputationCommand),
    Sync(NodeSyncCommand),
    Db(NodeDbCommand),
}

#[derive(Debug, Parser)]
struct NodeSnapshotCommand {
    #[command(subcommand)]
    command: NodeSnapshotSubcommand,
}

#[derive(Debug, Subcommand)]
enum NodeSnapshotSubcommand {
    Create {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
        #[arg(long)]
        out: Option<PathBuf>,
    },
    Replay {
        #[arg(long)]
        snapshot: PathBuf,
        #[arg(long)]
        events: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
}

#[derive(Debug, Parser)]
struct NodePolicyCommand {
    #[command(subcommand)]
    command: NodePolicySubcommand,
}

#[derive(Debug, Subcommand)]
enum NodePolicySubcommand {
    Current {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
    Timeline {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        cursor: Option<usize>,
    },
}

#[derive(Debug, Parser)]
struct NodeEconomicsCommand {
    #[command(subcommand)]
    command: NodeEconomicsSubcommand,
}

#[derive(Debug, Subcommand)]
enum NodeEconomicsSubcommand {
    Metrics {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
    P2h {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        identity: String,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
    P2hHistory {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        identity: String,
        #[arg(long = "as-of")]
        as_of: Option<String>,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        cursor: Option<usize>,
    },
}

#[derive(Debug, Parser)]
struct NodeReputationCommand {
    #[command(subcommand)]
    command: NodeReputationSubcommand,
}

#[derive(Debug, Parser)]
struct NodeSyncCommand {
    #[command(subcommand)]
    command: NodeSyncSubcommand,
}

#[derive(Debug, Subcommand)]
enum NodeSyncSubcommand {
    Bootstrap {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        peer: String,
        #[arg(long = "snapshot-id")]
        snapshot_id: Option<String>,
        #[arg(long, default_value_t = 200)]
        limit: usize,
        #[arg(long = "max-pages", default_value_t = 100)]
        max_pages: usize,
    },
    Pull {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        peer: Option<String>,
        #[arg(long, default_value_t = false)]
        all: bool,
        #[arg(long, default_value_t = 200)]
        limit: usize,
        #[arg(long = "max-pages", default_value_t = 100)]
        max_pages: usize,
    },
    Status {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
    },
    Reset {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        peer: Option<String>,
        #[arg(long, default_value_t = false)]
        all: bool,
    },
    Runtime {
        #[arg(long = "base-url")]
        base_url: String,
    },
    Peers {
        #[arg(long = "base-url")]
        base_url: String,
        #[arg(long)]
        peer: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
enum NodeReputationSubcommand {
    Current {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        identity: String,
        #[arg(long = "as-of")]
        as_of: Option<String>,
    },
    History {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
        #[arg(long)]
        identity: String,
        #[arg(long = "as-of")]
        as_of: Option<String>,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        cursor: Option<usize>,
        #[arg(long)]
        lane: Option<String>,
    },
}

#[derive(Debug, Parser)]
struct NodeDbCommand {
    #[command(subcommand)]
    command: NodeDbSubcommand,
}

#[derive(Debug, Subcommand)]
enum NodeDbSubcommand {
    Inspect {
        #[arg(long = "data-dir")]
        data_dir: PathBuf,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignInput {
    secret_key: String,
    #[serde(flatten)]
    event: UnsignedEvent,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedKeyPair {
    public_key: String,
    secret_key: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Keys(command) => run_keys(command),
        Command::Event(command) => run_event(command),
        Command::Log(command) => run_log(command),
        Command::State(command) => run_state(command),
        Command::Fixtures(command) => run_fixtures(command),
        Command::Node(command) => run_node(command).await,
    }
}

fn run_keys(command: KeysCommand) -> Result<()> {
    match command.command {
        KeysSubcommand::Generate => {
            let signing_key = SigningKey::generate(&mut OsRng);
            let pair = GeneratedKeyPair {
                public_key: hex::encode(signing_key.verifying_key().to_bytes()),
                secret_key: hex::encode(signing_key.to_bytes()),
            };
            println!("{}", serde_json::to_string_pretty(&pair)?);
            Ok(())
        }
        KeysSubcommand::Inspect { secret_key } => {
            let signing_key = protocol_core::signing_key_from_hex(&secret_key)?;
            let pair = GeneratedKeyPair {
                public_key: hex::encode(signing_key.verifying_key().to_bytes()),
                secret_key,
            };
            println!("{}", serde_json::to_string_pretty(&pair)?);
            Ok(())
        }
    }
}

fn run_event(command: EventCommand) -> Result<()> {
    match command.command {
        EventSubcommand::Sign { input, out } => {
            let payload = fs::read_to_string(&input)
                .with_context(|| format!("reading {}", input.display()))?;
            let draft: SignInput = serde_json::from_str(&payload)
                .with_context(|| format!("parsing {}", input.display()))?;
            let signed = sign_event(&draft.event, &draft.secret_key)?;
            fs::write(
                &out,
                format!("{}\n", serde_json::to_string_pretty(&signed.to_raw()?)?),
            )
            .with_context(|| format!("writing {}", out.display()))?;
            Ok(())
        }
    }
}

fn run_log(command: LogCommand) -> Result<()> {
    match command.command {
        LogSubcommand::Validate { input, as_of } => {
            let content = read_file(&input)?;
            let output = replay_log_output(&content, as_of.as_deref())?;
            println!("{}", serde_json::to_string_pretty(&output.invalid_events)?);
            if !output.invalid_events.is_empty() {
                bail!(
                    "validation failed with {} invalid event(s)",
                    output.invalid_events.len()
                );
            }
            Ok(())
        }
        LogSubcommand::VerifyChain { data_dir } => {
            let node = LocalNode::new(data_dir)?;
            let head = node.verify_event_log_hash_chain()?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "verified": true,
                    "chain_head": head,
                }))?
            );
            Ok(())
        }
        LogSubcommand::Replay { input, out, as_of } => {
            let content = read_file(&input)?;
            let output = replay_log_output(&content, as_of.as_deref())?;
            fs::write(
                &out,
                format!("{}\n", serde_json::to_string_pretty(&output)?),
            )
            .with_context(|| format!("writing {}", out.display()))?;
            if !output.invalid_events.is_empty() {
                bail!(
                    "replay completed with invalid events; see {}",
                    out.display()
                );
            }
            Ok(())
        }
    }
}

fn replay_log_output(content: &str, as_of: Option<&str>) -> Result<state_engine::ReplayOutput> {
    let as_of = parse_as_of(as_of).context("parsing --as-of")?;
    Ok(replay_jsonl_as_of(content, default_policy(), as_of))
}

fn run_state(command: StateCommand) -> Result<()> {
    match command.command {
        StateSubcommand::Inspect { input, identity } => {
            let content = read_file(&input)?;
            let output = replay_jsonl_with_default_now(&content, default_policy());
            let view = match identity {
                Some(identity_pub_key) => inspect_identity(&output, &identity_pub_key),
                None => serde_json::to_value(&output.state)?,
            };
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
    }
}

fn run_fixtures(command: FixturesCommand) -> Result<()> {
    match command.command {
        FixturesSubcommand::Run => {
            let valid = run_fixture_dir(Path::new("fixtures/valid"), true)?;
            let invalid = run_fixture_dir(Path::new("fixtures/invalid"), false)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "validFixtures": valid,
                    "invalidFixtures": invalid,
                }))?
            );
            Ok(())
        }
    }
}

async fn run_node(command: NodeCommand) -> Result<()> {
    match command.command {
        NodeSubcommand::Init {
            data_dir,
            events_log_hash_chain,
        } => run_node_init(data_dir, events_log_hash_chain),
        NodeSubcommand::Serve {
            data_dir,
            bind,
            sync_enabled,
            sync_interval_seconds,
            sync_max_parallel_peers,
            sync_limit,
            sync_max_pages,
            ingest_rate_limit_max,
            ingest_rate_limit_window_seconds,
        } => {
            let node = Arc::new(LocalNode::new(data_dir)?);
            let bind_addr: SocketAddr = bind
                .parse()
                .with_context(|| format!("parsing bind address `{bind}`"))?;
            node.set_ingest_rate_limit_config(node::IngestRateLimitConfig {
                max_requests_per_window: ingest_rate_limit_max,
                window_seconds: ingest_rate_limit_window_seconds,
            });
            let sync_config = SyncRuntimeConfig {
                enabled: sync_enabled,
                interval_seconds: sync_interval_seconds,
                max_parallel_peers: sync_max_parallel_peers,
                limit: sync_limit,
                max_pages: sync_max_pages,
            };
            node::serve_node_with_sync_config(node, bind_addr, sync_config).await?;
            Ok(())
        }
        NodeSubcommand::Ingest { data_dir, input } => {
            let node = LocalNode::new(data_dir)?;
            let content = read_file(&input)?;
            let events = content
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            let result = node.ingest_batch(&events);
            println!("{}", serde_json::to_string_pretty(&result)?);
            if result.rejected_count > 0 {
                bail!("ingest completed with rejected events");
            }
            Ok(())
        }
        NodeSubcommand::Snapshot(command) => run_node_snapshot(command),
        NodeSubcommand::Policy(command) => run_node_policy(command),
        NodeSubcommand::Economics(command) => run_node_economics(command),
        NodeSubcommand::Reputation(command) => run_node_reputation(command),
        NodeSubcommand::Sync(command) => run_node_sync(command).await,
        NodeSubcommand::Db(command) => run_node_db(command),
    }
}

fn run_node_init(data_dir: PathBuf, events_log_hash_chain: bool) -> Result<()> {
    let result = LocalNode::initialize_with_options(
        data_dir,
        node::NodeInitOptions {
            event_log_hash_chain_enabled: events_log_hash_chain,
        },
    )?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

fn run_node_snapshot(command: NodeSnapshotCommand) -> Result<()> {
    match command.command {
        NodeSnapshotSubcommand::Create {
            data_dir,
            as_of,
            out,
        } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let snapshot = node.create_snapshot_document(as_of)?;
            if let Some(out) = out {
                fs::write(
                    &out,
                    format!("{}\n", serde_json::to_string_pretty(&snapshot)?),
                )
                .with_context(|| format!("writing {}", out.display()))?;
            }
            println!("{}", serde_json::to_string_pretty(&snapshot.meta)?);
            Ok(())
        }
        NodeSnapshotSubcommand::Replay {
            snapshot,
            events,
            as_of,
        } => {
            let snapshot_content = read_file(&snapshot)?;
            let snapshot_document: SnapshotDocument = serde_json::from_str(&snapshot_content)
                .with_context(|| format!("parsing {}", snapshot.display()))?;
            let events_content = read_file(&events)?;
            let effective_as_of = match as_of.as_deref() {
                Some(value) => parse_as_of(Some(value))?,
                None => parse_as_of(Some(&snapshot_document.meta.as_of))?,
            };
            let replay = replay_phase1_from_jsonl(&events_content, effective_as_of);
            let replay_hash = hash_value(&serde_json::to_value(&replay)?)?;
            let response = serde_json::json!({
                "expectedStateHash": snapshot_document.meta.state_hash,
                "actualStateHash": replay_hash,
                "matches": replay_hash == snapshot_document.meta.state_hash
            });
            println!("{}", serde_json::to_string_pretty(&response)?);
            if replay_hash != snapshot_document.meta.state_hash {
                bail!("snapshot replay hash mismatch");
            }
            Ok(())
        }
    }
}

fn run_node_db(command: NodeDbCommand) -> Result<()> {
    match command.command {
        NodeDbSubcommand::Inspect { data_dir } => {
            let node = LocalNode::new(data_dir)?;
            let stats = node.db_inspect()?;
            let manifest = node.read_manifest()?;
            let response = serde_json::json!({
                "event_count": stats.event_count,
                "invalid_event_count": stats.invalid_event_count,
                "snapshot_count": stats.snapshot_count,
                "latest_seq": stats.latest_seq,
                "kernel": LocalNode::kernel_version_info(),
                "manifest": manifest,
            });
            println!("{}", serde_json::to_string_pretty(&response)?);
            Ok(())
        }
    }
}

fn run_node_policy(command: NodePolicyCommand) -> Result<()> {
    match command.command {
        NodePolicySubcommand::Current { data_dir, as_of } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.policy_current_view(as_of)?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
        NodePolicySubcommand::Timeline {
            data_dir,
            as_of,
            limit,
            cursor,
        } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.policy_timeline_view(as_of, cursor, limit.unwrap_or(50))?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
    }
}

fn run_node_economics(command: NodeEconomicsCommand) -> Result<()> {
    match command.command {
        NodeEconomicsSubcommand::Metrics { data_dir, as_of } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.economics_metrics_view(as_of)?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
        NodeEconomicsSubcommand::P2h {
            data_dir,
            identity,
            as_of,
        } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.p2h_risk_view(&identity, as_of)?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
        NodeEconomicsSubcommand::P2hHistory {
            data_dir,
            identity,
            as_of,
            limit,
            cursor,
        } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.p2h_risk_history_view(&identity, as_of, cursor, limit.unwrap_or(50))?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
    }
}

fn run_node_reputation(command: NodeReputationCommand) -> Result<()> {
    match command.command {
        NodeReputationSubcommand::Current {
            data_dir,
            identity,
            as_of,
        } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.reputation_current_view(&identity, as_of)?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
        NodeReputationSubcommand::History {
            data_dir,
            identity,
            as_of,
            limit,
            cursor,
            lane,
        } => {
            let node = LocalNode::new(data_dir)?;
            let as_of = parse_as_of(as_of.as_deref())?;
            let view = node.reputation_history_view(
                &identity,
                as_of,
                cursor,
                limit.unwrap_or(50),
                lane.as_deref(),
            )?;
            println!("{}", serde_json::to_string_pretty(&view)?);
            Ok(())
        }
    }
}

async fn run_node_sync(command: NodeSyncCommand) -> Result<()> {
    match command.command {
        NodeSyncSubcommand::Bootstrap {
            data_dir,
            peer,
            snapshot_id,
            limit,
            max_pages,
        } => {
            let node = LocalNode::new(data_dir)?;
            let result = node
                .sync_bootstrap_from_peer(&peer, snapshot_id.as_deref(), limit, max_pages)
                .await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
        NodeSyncSubcommand::Pull {
            data_dir,
            peer,
            all,
            limit,
            max_pages,
        } => {
            if peer.is_some() && all {
                bail!("cannot combine --peer and --all");
            }
            let node = LocalNode::new(data_dir)?;
            let result = node
                .sync_pull(SyncPullRequest {
                    peer_id: peer,
                    all,
                    limit,
                    max_pages,
                })
                .await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
        NodeSyncSubcommand::Status { data_dir } => {
            let node = LocalNode::new(data_dir)?;
            let result = node.sync_status()?;
            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
        NodeSyncSubcommand::Reset {
            data_dir,
            peer,
            all,
        } => {
            if peer.is_some() && all {
                bail!("cannot combine --peer and --all");
            }
            let node = LocalNode::new(data_dir)?;
            let result = node.sync_reset(peer.as_deref(), all)?;
            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
        NodeSyncSubcommand::Runtime { base_url } => {
            let endpoint = format!("{}/sync/status", normalize_base_url(&base_url));
            let value = fetch_http_json(&endpoint).await?;
            println!("{}", serde_json::to_string_pretty(&value)?);
            Ok(())
        }
        NodeSyncSubcommand::Peers { base_url, peer } => {
            let mut endpoint = format!("{}/sync/peers", normalize_base_url(&base_url));
            if let Some(peer) = peer {
                endpoint.push_str(&format!("?peer={peer}"));
            }
            let value = fetch_http_json(&endpoint).await?;
            println!("{}", serde_json::to_string_pretty(&value)?);
            Ok(())
        }
    }
}

fn run_fixture_dir(dir: &Path, expect_valid: bool) -> Result<usize> {
    if !dir.exists() {
        return Ok(0);
    }

    let mut passed = 0usize;
    for entry in fs::read_dir(dir).with_context(|| format!("reading {}", dir.display()))? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }

        let content = read_file(&path)?;
        let output = replay_jsonl_with_default_now(&content, default_policy());
        let is_valid = output.invalid_events.is_empty();
        if is_valid != expect_valid {
            bail!(
                "fixture {} expected valid={} but got {} invalid event(s)",
                path.display(),
                expect_valid,
                output.invalid_events.len()
            );
        }
        passed += 1;
    }
    Ok(passed)
}

fn read_file(path: &Path) -> Result<String> {
    fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))
}

fn normalize_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

async fn fetch_http_json(url: &str) -> Result<Value> {
    let response = reqwest::get(url)
        .await
        .with_context(|| format!("requesting {url}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        bail!("request failed: status {status}, body: {body}");
    }
    response
        .json::<Value>()
        .await
        .with_context(|| format!("decoding JSON response from {url}"))
}
