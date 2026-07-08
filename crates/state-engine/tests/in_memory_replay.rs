use std::fs;
use std::path::PathBuf;

use chrono::{TimeZone, Utc};
use policy::default_policy;
use state_engine::{replay_jsonl_as_of, replay_raw_events, replay_raw_events_with_checkpoint};

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("fixtures")
}

fn load_fixture(name: &str) -> Vec<String> {
    let path = fixture_root().join("valid").join(name);
    let content = fs::read_to_string(&path).expect("fixture");
    content.lines().map(str::to_string).collect()
}

#[test]
fn in_memory_replay_matches_jsonl_fixture_replay() {
    let fixture = "marketplace-accept.jsonl";
    let lines = load_fixture(fixture);
    let joined = lines.join("\n");
    let as_of = Utc.with_ymd_and_hms(2026, 3, 1, 0, 15, 0).unwrap();
    let policy = default_policy();

    let file_output = replay_jsonl_as_of(&joined, policy, Some(as_of));
    let memory_output = replay_raw_events(&lines, policy, Some(as_of));

    assert_eq!(file_output.state, memory_output.state);
    assert_eq!(file_output.applied_event_ids, memory_output.applied_event_ids);
    assert_eq!(file_output.invalid_events, memory_output.invalid_events);
}

#[test]
fn in_memory_replay_resume_wrapper_returns_run_output() {
    let lines = load_fixture("marketplace-accept.jsonl");
    let as_of = Utc.with_ymd_and_hms(2026, 3, 1, 0, 15, 0).unwrap();
    let policy = default_policy();

    let run = replay_raw_events_with_checkpoint(&lines, policy, Some(as_of), None);
    assert!(run.replay.invalid_events.is_empty());
    assert!(!run.replay.applied_event_ids.is_empty());
    assert!(!run.checkpoint.applied_event_ids.is_empty());
}

#[test]
fn in_memory_replay_accepts_str_slices_without_filesystem() {
    let lines = load_fixture("marketplace-accept.jsonl");
    let slices = lines
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>();
    let as_of = Utc.with_ymd_and_hms(2026, 3, 1, 0, 15, 0).unwrap();
    let policy = default_policy();

    let from_vec = replay_raw_events(&lines, policy, Some(as_of));
    let from_slices = replay_raw_events(&slices, policy, Some(as_of));

    assert_eq!(from_vec.state, from_slices.state);
    assert_eq!(from_vec.applied_event_ids, from_slices.applied_event_ids);
}
