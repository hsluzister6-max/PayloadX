use serde::{Serialize, Deserialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct JsonRow {
    pub key: Option<String>,
    pub value: String,
    pub value_type: String, // "string", "number", "boolean", "null", "object", "array"
    pub depth: usize,
    pub path: String,
    pub is_expandable: bool,
    pub is_empty: bool,
    pub children_count: usize,
}

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
    let stripped = raw.trim_start_matches('\u{FEFF}').trim();
    serde_json::from_str(stripped).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn flatten_json_pro(raw: String) -> Result<Vec<JsonRow>, String> {
    let stripped = raw.trim_start_matches('\u{FEFF}').trim();
    let root: Value = serde_json::from_str(stripped).map_err(|e| e.to_string())?;
    
    let mut rows = Vec::new();
    flatten_recursive(&root, None, 0, "$".to_string(), &mut rows);
    Ok(rows)
}

fn flatten_recursive(
    value: &Value, 
    key: Option<String>, 
    depth: usize, 
    path: String, 
    rows: &mut Vec<JsonRow>
) {
    match value {
        Value::Object(map) => {
            rows.push(JsonRow {
                key: key.clone(),
                value: "".to_string(),
                value_type: "object".to_string(),
                depth,
                path: path.clone(),
                is_expandable: !map.is_empty(),
                is_empty: map.is_empty(),
                children_count: map.len(),
            });
            for (k, v) in map {
                let child_path = format!("{}.{}", path, k);
                flatten_recursive(v, Some(k.clone()), depth + 1, child_path, rows);
            }
        },
        Value::Array(list) => {
            rows.push(JsonRow {
                key: key.clone(),
                value: "".to_string(),
                value_type: "array".to_string(),
                depth,
                path: path.clone(),
                is_expandable: !list.is_empty(),
                is_empty: list.is_empty(),
                children_count: list.len(),
            });
            for (i, v) in list.iter().enumerate() {
                let child_path = format!("{}[{}]", path, i);
                flatten_recursive(v, Some(i.to_string()), depth + 1, child_path, rows);
            }
        },
        _ => {
            let (v_str, v_type) = match value {
                Value::String(s) => (s.clone(), "string"),
                Value::Number(n) => (n.to_string(), "number"),
                Value::Bool(b) => (b.to_string(), "boolean"),
                Value::Null => ("null".to_string(), "null"),
                _ => ("".to_string(), "unknown"),
            };
            rows.push(JsonRow {
                key,
                value: v_str,
                value_type: v_type.to_string(),
                depth,
                path,
                is_expandable: false,
                is_empty: true,
                children_count: 0,
            });
        }
    }
}
