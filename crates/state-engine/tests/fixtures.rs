use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use policy::default_policy;
use state_engine::replay_jsonl;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("fixtures")
}

#[test]
fn valid_fixtures_have_no_invalid_events() {
    let dir = fixture_root().join("valid");
    for entry in fs::read_dir(&dir).expect("valid fixture dir") {
        let entry = entry.expect("fixture entry");
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }

        let input = fs::read_to_string(&path).expect("fixture contents");
        let output = replay_jsonl(&input, default_policy(), Utc::now());
        assert!(
            output.invalid_events.is_empty(),
            "fixture {} had invalid events: {:?}",
            path.display(),
            output.invalid_events
        );
    }
}

#[test]
fn invalid_fixtures_produce_invalid_events() {
    let dir = fixture_root().join("invalid");
    for entry in fs::read_dir(&dir).expect("invalid fixture dir") {
        let entry = entry.expect("fixture entry");
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }

        let input = fs::read_to_string(&path).expect("fixture contents");
        let output = replay_jsonl(&input, default_policy(), Utc::now());
        assert!(
            !output.invalid_events.is_empty(),
            "fixture {} unexpectedly validated cleanly",
            path.display()
        );
    }
}
