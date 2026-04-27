// env_tools.rs — Rust-native environment variable resolver
//
// Replaces the JS resolveVariables() loop in environmentStore.js.
// The regex is compiled once at startup (via OnceLock) and reused for
// every invocation — eliminating JS regex construction overhead.

use std::collections::HashMap;
use serde_json::Value;
use std::sync::OnceLock;
use regex::Regex;

// ── Lazy regex (compiled once for the lifetime of the process) ────────────────

static ENV_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_regex() -> &'static Regex {
    ENV_REGEX.get_or_init(|| {
        Regex::new(r"\{\{([^}]+)\}\}").expect("Failed to compile env var regex")
    })
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Resolve all `{{VARIABLE}}` tokens in `template` using the provided
/// environment map.  Unresolved tokens are left as-is (matches JS behaviour).
///
/// JS equivalent: resolveVariables() in environmentStore.js
#[tauri::command]
pub fn resolve_env_variables(
    template: String,
    env: HashMap<String, String>,
) -> String {
    let re = get_regex();
    re.replace_all(&template, |caps: &regex::Captures| {
        let key = caps[1].trim();
        env.get(key).cloned().unwrap_or_else(|| caps[0].to_string())
    })
    .into_owned()
}

/// Batch-resolve env variables across an entire node's fields.
/// Used before workflow execution to pre-process all string fields at once.
#[tauri::command]
pub fn resolve_env_in_object(
    json_value: String,
    env: HashMap<String, String>,
) -> Result<String, String> {
    let mut value: Value = serde_json::from_str(&json_value)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    resolve_in_value(&mut value, &env);

    serde_json::to_string(&value).map_err(|e| e.to_string())
}

// ── Recursive value resolver ──────────────────────────────────────────────────

fn resolve_in_value(value: &mut Value, env: &HashMap<String, String>) {
    let re = get_regex();
    match value {
        Value::String(s) => {
            *s = re.replace_all(s, |caps: &regex::Captures| {
                let key = caps[1].trim();
                env.get(key).cloned().unwrap_or_else(|| caps[0].to_string())
            })
            .into_owned();
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                resolve_in_value(item, env);
            }
        }
        Value::Object(map) => {
            for (_, v) in map.iter_mut() {
                resolve_in_value(v, env);
            }
        }
        // Numbers and booleans are not resolved
        _ => {}
    }
}
