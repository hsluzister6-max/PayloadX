// url_tools.rs — Rust-native URL ↔ Params sync engine
//
// Replaces syncParamsFromUrl / syncUrlFromParams in requestStore.js.
// Uses the `url` crate for zero-allocation query-string parsing.
// Called on every URL bar keypress via IPC — must be sub-millisecond.

use serde::{Deserialize, Serialize};
use url::Url;

// ── Shared Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParam {
    pub id: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Parse a URL's query string into a list of QueryParams.
/// Preserves disabled params passed in from the frontend so the user
/// doesn't lose unchecked rows while editing.
///
/// JS equivalent: syncParamsFromUrl()
#[tauri::command]
pub fn url_parse_params(url: String, disabled_params: Vec<QueryParam>) -> Vec<QueryParam> {
    // Strip query portion to find the base
    let parts: Vec<&str> = url.splitn(2, '?').collect();

    if parts.len() < 2 || parts[1].is_empty() {
        // No query string — return only disabled params (or empty row)
        if disabled_params.is_empty() {
            return vec![empty_param()];
        }
        return disabled_params;
    }

    // Parse the query string via the url crate for correct percent-decoding
    let dummy = format!("http://x?{}", parts[1]);
    let parsed = match Url::parse(&dummy) {
        Ok(u) => u,
        Err(_) => {
            // Malformed query — keep existing disabled params + empty row
            let mut result = disabled_params;
            result.push(empty_param());
            return result;
        }
    };

    let mut params: Vec<QueryParam> = parsed
        .query_pairs()
        .map(|(k, v)| QueryParam {
            id: new_id(),
            key: k.into_owned(),
            value: v.into_owned(),
            enabled: true,
        })
        .collect();

    // Merge in disabled params from the frontend (user unchecked rows)
    for dp in disabled_params {
        if !dp.enabled {
            params.push(dp);
        }
    }

    // Always append an empty row at the end so the user can add more
    let last = params.last();
    if last.map_or(true, |p| !p.key.is_empty() || !p.value.is_empty()) {
        params.push(empty_param());
    }

    params
}

/// Rebuild a URL from a base URL + enabled QueryParams.
/// Disabled or empty params are ignored.
///
/// JS equivalent: syncUrlFromParams()
#[tauri::command]
pub fn url_build_from_params(base_url: String, params: Vec<QueryParam>) -> String {
    let base = base_url.splitn(2, '?').next().unwrap_or(&base_url);

    let active: Vec<(&str, &str)> = params
        .iter()
        .filter(|p| p.enabled && (!p.key.is_empty() || !p.value.is_empty()))
        .map(|p| (p.key.as_str(), p.value.as_str()))
        .collect();

    if active.is_empty() {
        return base.to_string();
    }

    // Build query string — preserve partial pairs (key= or =value)
    let qs: String = active
        .iter()
        .map(|(k, v)| {
            if k.is_empty() {
                format!("={}", v)
            } else if v.is_empty() {
                format!("{}=", k)
            } else {
                format!("{}={}", k, v)
            }
        })
        .collect::<Vec<_>>()
        .join("&");

    format!("{}?{}", base, qs)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn empty_param() -> QueryParam {
    QueryParam {
        id: new_id(),
        key: String::new(),
        value: String::new(),
        enabled: true,
    }
}

/// Generate a short unique ID — avoids pulling in the uuid crate here.
fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    // Combine with a thread-local counter for uniqueness within the same nanosecond
    static COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("{:x}{:04x}", nanos, n & 0xffff)
}
