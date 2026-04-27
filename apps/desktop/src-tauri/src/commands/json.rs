use serde_json::Value;

/// parse_json — Rust-side JSON parsing using serde_json.
///
/// Called from the frontend via `window.__TAURI__.tauri.invoke('parse_json', { raw })`.
/// Returns the parsed JSON value which Tauri serialises back as structured data.
///
/// Benchmark context:
///   serde_json is ~3-5× faster than JS JSON.parse for very large payloads.
///   The round-trip IPC cost is amortised for payloads > ~1MB.
///   For smaller payloads the Web Worker is used instead.
#[tauri::command]
pub fn parse_json(raw: String) -> Result<Value, String> {
    // Strip BOM if present (same as the JS worker)
    let stripped = raw.trim_start_matches('\u{FEFF}').trim();

    // Try standard JSON first
    serde_json::from_str(stripped).or_else(|primary_err| {
        // NDJSON fallback: each line is a separate JSON document
        let lines: Vec<&str> = stripped
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect();

        if lines.len() > 1 {
            let parsed: Result<Vec<Value>, _> = lines
                .iter()
                .map(|l| serde_json::from_str(l))
                .collect();
            parsed
                .map(Value::Array)
                .map_err(|_| primary_err.to_string())
        } else {
            Err(primary_err.to_string())
        }
    })
}
