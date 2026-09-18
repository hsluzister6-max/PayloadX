use serde::Serialize;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Window, WindowBuilder, WindowUrl};

static LAST_NEW_WINDOW: Mutex<Option<Instant>> = Mutex::new(None);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedWorkspaceWindow {
    pub label: String,
    pub session_name: String,
}

fn next_workspace_index(app: &AppHandle) -> u32 {
    let existing: HashSet<u32> = app
        .windows()
        .keys()
        .filter_map(|label| label.strip_prefix("workspace-")?.parse().ok())
        .collect();
    let mut n = 2u32;
    while existing.contains(&n) {
        n += 1;
    }
    n
}

fn window_offset(window: &Window) -> Option<(f64, f64)> {
    let pos = window.outer_position().ok()?;
    let scale = window.scale_factor().ok()?;
    if scale <= 0.0 {
        return None;
    }
    Some((pos.x as f64 / scale + 36.0, pos.y as f64 / scale + 36.0))
}
fn sanitize_request_id(open_request_id: Option<String>) -> Option<String> {
    open_request_id.and_then(|id| {
        let trimmed = id.trim();
        if trimmed.is_empty() || trimmed.len() > 80 {
            return None;
        }
        if trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            Some(trimmed.to_string())
        } else {
            None
        }
    })
}

/// Open another PayloadX window. Platform login stays shared; API cookie sessions stay isolated.
pub fn open_workspace_window(
    app: &AppHandle,
    source: Option<&Window>,
    open_request_id: Option<String>,
) -> Result<CreatedWorkspaceWindow, String> {
    {
        let mut last = LAST_NEW_WINDOW.lock().map_err(|e| e.to_string())?;
        if let Some(at) = *last {
            if at.elapsed() < Duration::from_millis(500) {
                return Err("NEW_WINDOW_BUSY".into());
            }
        }
        *last = Some(Instant::now());
    }
    let index = next_workspace_index(app);
    let label = format!("workspace-{index}");
    let session_name = format!("Window {index}");
    let open_request_id = sanitize_request_id(open_request_id);

    let boot = serde_json::json!({
        "label": label,
        "sessionName": session_name,
        "openRequestId": open_request_id,
        "isolatedSession": true,
    });
    let script = format!("window.__PAYLOADX_WORKSPACE__ = Object.freeze({boot});");

    let mut builder = WindowBuilder::new(app, &label, WindowUrl::App("index.html".into()))
        .title("PayloadX API Studio")
        .inner_size(1400.0, 900.0)
        .min_inner_size(1000.0, 600.0)
        .resizable(true)
        .initialization_script(&script);

    let offset = source
        .and_then(window_offset)
        .or_else(|| app.get_focused_window().as_ref().and_then(window_offset))
        .or_else(|| app.get_window("main").as_ref().and_then(window_offset));

    if let Some((x, y)) = offset {
        builder = builder.position(x, y);
    } else {
        builder = builder.center();
    }

    builder.build().map_err(|e| e.to_string())?;

    Ok(CreatedWorkspaceWindow {
        label,
        session_name,
    })
}

#[tauri::command]
pub async fn create_workspace_window(
    app: AppHandle,
    window: Window,
    open_request_id: Option<String>,
) -> Result<CreatedWorkspaceWindow, String> {
    open_workspace_window(&app, Some(&window), open_request_id)
}
