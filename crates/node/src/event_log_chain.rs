use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const GENESIS_LABEL: &[u8] = b"vectis-event-log-chain-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventLogChainEntry {
    pub seq: u64,
    pub event_id: String,
    pub line_hash: String,
    pub chain_hash: String,
}

pub fn genesis_chain_hash() -> String {
    hash_bytes(GENESIS_LABEL)
}

pub fn hash_line(raw_line: &str) -> String {
    hash_bytes(raw_line.trim().as_bytes())
}

pub fn advance_chain(prev_chain_hash: &str, line_hash: &str) -> String {
    hash_bytes(format!("{prev_chain_hash}:{line_hash}").as_bytes())
}

pub fn read_chain_entries(path: &Path) -> Result<Vec<EventLogChainEntry>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)
        .with_context(|| format!("reading event log chain {}", path.display()))?;
    let mut entries = Vec::new();
    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let line_number = index + 1;
        let entry: EventLogChainEntry = serde_json::from_str(trimmed).with_context(|| {
            format!("event log chain fails closed: line {line_number} is malformed JSON")
        })?;
        entries.push(entry);
    }
    Ok(entries)
}

pub fn read_log_lines(path: &Path) -> Result<Vec<String>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)
        .with_context(|| format!("reading events log {}", path.display()))?;
    Ok(content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

pub fn verify_chain_against_log(log_path: &Path, chain_path: &Path) -> Result<String> {
    let lines = read_log_lines(log_path)?;
    let entries = read_chain_entries(chain_path)?;
    if lines.is_empty() && entries.is_empty() {
        return Ok(genesis_chain_hash());
    }
    if lines.len() != entries.len() {
        bail!(
            "event log hash chain mismatch: events.log has {} line(s), events.chain.jsonl has {} entr(y/ies)",
            lines.len(),
            entries.len()
        );
    }
    let mut prev_chain_hash = genesis_chain_hash();
    for (index, (line, entry)) in lines.iter().zip(entries.iter()).enumerate() {
        let seq = (index + 1) as u64;
        if entry.seq != seq {
            bail!("event log hash chain mismatch at seq {seq}: expected seq {seq}, found {}", entry.seq);
        }
        let expected_line_hash = hash_line(line);
        if entry.line_hash != expected_line_hash {
            bail!("event log hash chain mismatch at seq {seq}: line hash does not match events.log");
        }
        let expected_chain_hash = advance_chain(&prev_chain_hash, &expected_line_hash);
        if entry.chain_hash != expected_chain_hash {
            bail!("event log hash chain mismatch at seq {seq}: chain hash does not match recomputed value");
        }
        prev_chain_hash = expected_chain_hash;
    }
    Ok(prev_chain_hash)
}

pub fn append_chain_entry(
    chain_path: &Path,
    seq: u64,
    event_id: &str,
    raw_line: &str,
    prev_chain_hash: &str,
) -> Result<EventLogChainEntry> {
    let line_hash = hash_line(raw_line);
    let entry = EventLogChainEntry {
        seq,
        event_id: event_id.to_string(),
        line_hash: line_hash.clone(),
        chain_hash: advance_chain(prev_chain_hash, &line_hash),
    };
    let mut file = OpenOptions::new()
        .append(true)
        .create(true)
        .open(chain_path)
        .with_context(|| format!("opening event log chain {}", chain_path.display()))?;
    let serialized = serde_json::to_string(&entry).context("serializing chain entry")?;
    writeln!(file, "{serialized}")?;
    Ok(entry)
}

pub fn chain_head_hash(chain_path: &Path) -> Result<String> {
    let entries = read_chain_entries(chain_path)?;
    Ok(entries
        .last()
        .map(|entry| entry.chain_hash.clone())
        .unwrap_or_else(genesis_chain_hash))
}

fn hash_bytes(bytes: impl AsRef<[u8]>) -> String {
    let digest = Sha256::digest(bytes);
    hex::encode(digest)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_paths(label: &str) -> (PathBuf, PathBuf) {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("epoch")
            .as_nanos();
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("target")
            .join("tmp")
            .join(format!("event-log-chain-{label}-{nanos}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        (dir.join("events.log"), dir.join("events.chain.jsonl"))
    }

    #[test]
    fn verify_chain_detects_tampered_event_line() {
        let (log_path, chain_path) = temp_paths("tamper");
        fs::write(&log_path, "{\"eventId\":\"a\"}\n").expect("write log");
        append_chain_entry(&chain_path, 1, "a", "{\"eventId\":\"a\"}", &genesis_chain_hash())
            .expect("append chain");
        let content = fs::read_to_string(&log_path).expect("read log");
        fs::write(&log_path, content.replace("\"a\"", "\"b\"")).expect("tamper log");
        let error = verify_chain_against_log(&log_path, &chain_path).expect_err("tamper");
        assert!(error.to_string().contains("line hash"));
    }
}
