use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::http::HeaderMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IngestRateLimitConfig {
    pub max_requests_per_window: u32,
    pub window_seconds: u64,
}

impl Default for IngestRateLimitConfig {
    fn default() -> Self {
        Self {
            max_requests_per_window: 0,
            window_seconds: 60,
        }
    }
}

impl IngestRateLimitConfig {
    pub fn is_enabled(&self) -> bool {
        self.max_requests_per_window > 0 && self.window_seconds > 0
    }

    pub fn normalized(self) -> Self {
        Self {
            max_requests_per_window: self.max_requests_per_window,
            window_seconds: self.window_seconds.max(1),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IngestRateLimitView {
    pub enabled: bool,
    pub max_requests_per_window: u32,
    pub window_seconds: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IngestRateLimitDecision {
    pub allowed: bool,
    pub retry_after_seconds: u64,
}

#[derive(Debug)]
pub struct IngestRateLimiter {
    config: Mutex<IngestRateLimitConfig>,
    buckets: Mutex<HashMap<String, Vec<Instant>>>,
}

impl IngestRateLimiter {
    pub fn new(config: IngestRateLimitConfig) -> Self {
        Self {
            config: Mutex::new(config.normalized()),
            buckets: Mutex::new(HashMap::new()),
        }
    }

    pub fn set_config(&self, config: IngestRateLimitConfig) {
        let mut guard = self.config.lock().expect("ingest rate limit config lock poisoned");
        *guard = config.normalized();
    }

    pub fn view(&self) -> IngestRateLimitView {
        let config = self
            .config
            .lock()
            .expect("ingest rate limit config lock poisoned")
            .clone();
        IngestRateLimitView {
            enabled: config.is_enabled(),
            max_requests_per_window: config.max_requests_per_window,
            window_seconds: config.window_seconds,
        }
    }

    pub fn check(&self, client_key: &str) -> IngestRateLimitDecision {
        let config = self
            .config
            .lock()
            .expect("ingest rate limit config lock poisoned")
            .clone();
        if !config.is_enabled() {
            return IngestRateLimitDecision {
                allowed: true,
                retry_after_seconds: 0,
            };
        }

        let window = Duration::from_secs(config.window_seconds);
        let now = Instant::now();
        let mut buckets = self.buckets.lock().expect("ingest rate limit buckets lock poisoned");
        let entry = buckets
            .entry(client_key.to_string())
            .or_insert_with(Vec::new);
        entry.retain(|timestamp| now.duration_since(*timestamp) < window);

        if entry.len() >= config.max_requests_per_window as usize {
            let retry_after_seconds = entry
                .first()
                .map(|oldest| {
                    window
                        .saturating_sub(now.duration_since(*oldest))
                        .as_secs()
                        .max(1)
                })
                .unwrap_or(1);
            return IngestRateLimitDecision {
                allowed: false,
                retry_after_seconds,
            };
        }

        entry.push(now);
        IngestRateLimitDecision {
            allowed: true,
            retry_after_seconds: 0,
        }
    }
}

pub fn resolve_ingest_client_key(headers: &HeaderMap) -> String {
    if let Some(value) = headers.get("x-real-ip").and_then(|header| header.to_str().ok()) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Some(value) = headers
        .get("x-forwarded-for")
        .and_then(|header| header.to_str().ok())
    {
        if let Some(first) = value.split(',').next() {
            let trimmed = first.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    "local".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limiter_allows_burst_then_blocks_until_window_moves() {
        let limiter = IngestRateLimiter::new(IngestRateLimitConfig {
            max_requests_per_window: 2,
            window_seconds: 60,
        });
        assert!(limiter.check("client-a").allowed);
        assert!(limiter.check("client-a").allowed);
        let blocked = limiter.check("client-a");
        assert!(!blocked.allowed);
        assert!(blocked.retry_after_seconds >= 1);
        assert!(limiter.check("client-b").allowed);
    }

    #[test]
    fn disabled_rate_limiter_always_allows() {
        let limiter = IngestRateLimiter::new(IngestRateLimitConfig::default());
        for _ in 0..10 {
            assert!(limiter.check("client-a").allowed);
        }
    }

    #[test]
    fn resolve_client_key_prefers_forwarded_headers() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            "203.0.113.10, 198.51.100.2".parse().expect("header"),
        );
        assert_eq!(resolve_ingest_client_key(&headers), "203.0.113.10");
    }
}
