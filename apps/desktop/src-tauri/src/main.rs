// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod commands;
mod security;
mod workflow;

use commands::http::{execute_request, get_cookies, set_cookie, delete_cookie, list_cookie_domains, clear_cookies};
use commands::files::{save_local_file, read_local_file, list_local_files};
use commands::json::parse_json;
use commands::workflow::{execute_workflow, execute_single_node, validate_workflow, cancel_workflow_execution};
use commands::url_tools::{url_parse_params, url_build_from_params};
use commands::env_tools::{resolve_env_variables, resolve_env_in_object};
use commands::postman::parse_postman_collection;

use std::sync::Mutex;
use std::collections::HashMap;

#[derive(Default, Clone)]
pub struct AppCookieJar(pub std::sync::Arc<Mutex<HashMap<String, HashMap<String, String>>>>);

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
pub struct WorkflowState {
    pub is_paused: Arc<AtomicBool>,
    pub is_cancelled: Arc<AtomicBool>,
}

impl Default for WorkflowState {
    fn default() -> Self {
        Self {
            is_paused: Arc::new(AtomicBool::new(false)),
            is_cancelled: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Clone for WorkflowState {
    fn clone(&self) -> Self {
        Self {
            is_paused: self.is_paused.clone(),
            is_cancelled: self.is_cancelled.clone(),
        }
    }
}

#[tauri::command]
async fn pause_workflow_execution(state: tauri::State<'_, WorkflowState>) -> Result<(), String> {
    state.is_paused.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
async fn resume_workflow_execution(state: tauri::State<'_, WorkflowState>) -> Result<(), String> {
    state.is_paused.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
async fn system_open(app_handle: tauri::AppHandle, url: String) -> Result<(), String> {
    tauri::api::shell::open(&app_handle.shell_scope(), url, None)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_oauth_flow(window: tauri::Window) -> Result<u16, String> {
    let success_html = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PayloadX | Authentication Success</title>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #060606;
            --surface: #0A0A0A;
            --border: rgba(255, 255, 255, 0.05);
            --text-primary: #FFFFFF;
            --text-secondary: #94A3B8;
            --text-muted: #475569;
            --grad-logo: linear-gradient(145deg, #D6DCE8, #888EA0, #B2B7C1, #D4D8E0);
            --accent: #FFFFFF;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
        }

        .noise {
            position: fixed;
            inset: 0;
            background: transparent;
            opacity: 0.02;
            pointer-events: none;
            z-index: 1;
        }

        .container {
            width: 100%;
            max-width: 440px;
            padding: 48px;
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 24px;
            text-align: left;
            position: relative;
            z-index: 10;
            box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.02);
            animation: containerAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes containerAppear {
            from { opacity: 0; transform: translateY(20px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* PayloadX Logo */
        .logo-container {
            position: relative;
            width: 44px;
            height: 44px;
            margin-bottom: 32px;
        }

        .logo-inner {
            width: 100%;
            height: 100%;
            border-radius: 12px;
            background: var(--grad-logo);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            z-index: 2;
        }

        .logo-text {
            font-family: 'Syne', sans-serif;
            font-weight: 800;
            font-size: 16px;
            color: #0D1017;
            letter-spacing: -1px;
            position: relative;
            z-index: 3;
        }

        .logo-shimmer {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transform: skewX(-20deg) translateX(-150%);
            animation: shimmer 3s infinite;
            z-index: 4;
        }

        @keyframes shimmer {
            0% { transform: skewX(-20deg) translateX(-150%); }
            50%, 100% { transform: skewX(-20deg) translateX(150%); }
        }

        .logo-glow {
            position: absolute;
            inset: -8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 18px;
            z-index: 1;
            animation: pulse 4s infinite ease-in-out;
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.05); }
        }

        h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 12px;
            letter-spacing: -0.03em;
            color: var(--text-primary);
        }

        p {
            font-size: 14px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 99px;
            font-size: 11px;
            font-weight: 600;
            color: var(--text-primary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .status-dot {
            width: 6px;
            height: 6px;
            background-color: #4ADE80;
            border-radius: 50%;
            box-shadow: 0 0 8px #4ADE80;
        }

        .terminal-block {
            font-family: 'JetBrains Mono', monospace;
            background-color: #050505;
            padding: 16px;
            border: 1px solid var(--border);
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 40px;
            border-radius: 8px;
            position: relative;
        }

        .terminal-block::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
        }

        .attribution {
            position: absolute;
            bottom: -60px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.2em;
            font-weight: 600;
        }

        .btn-return {
            display: inline-block;
            margin-top: 24px;
            padding: 10px 20px;
            background: var(--text-primary);
            color: var(--bg);
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            border-radius: 8px;
            transition: all 0.2s ease;
        }

        .btn-return:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
        }
    </style>
</head>
<body>
    <div class="noise"></div>
    <div class="container">
        <div class="logo-container">
            <div class="logo-inner">
                <span class="logo-text">PX</span>
                <div class="logo-shimmer"></div>
            </div>
            <div class="logo-glow"></div>
        </div>

        <h1>Authenticated</h1>
        <p>Handshake complete. Your session has been verified and synced with the workspace. You can safely close this window now.</p>

        <div class="status-badge">
            <div class="status-dot"></div>
            <span>Connected</span>
        </div>

        <div class="terminal-block">
            $> payloadx auth --status verified --id google_v2
        </div>

        <div class="attribution">
            PayloadX Workspace • 2026
        </div>
    </div>
    <script>
        // Automatic cleanup after a delay
        setTimeout(() => {
            // Some browsers might block self-closing if not opened via script
            // but we try anyway for a cleaner experience
            window.close();
        }, 5000);
    </script>
</body>
</html>
"#;

    let config = tauri_plugin_oauth::OauthConfig {
        ports: None,
        response: Some(success_html.into()),
    };

    tauri_plugin_oauth::start_with_config(config, move |url| {
        let _ = window.emit("oauth_callback", url);
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.request_user_attention(Some(tauri::UserAttentionType::Critical));
    })
    .map_err(|e| e.to_string())
}

fn main() {
    // Persistent HTTP client with proper configuration for Linux
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .pool_max_idle_per_host(10)
        .user_agent("PayloadX-API-Studio/1.3.7")
        .build()
        .expect("Failed to build HTTP client");

    tauri::Builder::default()
        .manage(http_client)
        .manage(AppCookieJar::default())
        .manage(WorkflowState::default())
        .plugin(tauri_plugin_oauth::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            execute_request,
            get_cookies,
            set_cookie,
            delete_cookie,
            list_cookie_domains,
            clear_cookies,
            save_local_file,
            read_local_file,
            list_local_files,
            parse_json,
            start_oauth_flow,
            system_open,
            execute_workflow,
            execute_single_node,
            validate_workflow,
            cancel_workflow_execution,
            pause_workflow_execution,
            resume_workflow_execution,
            url_parse_params,
            url_build_from_params,
            resolve_env_variables,
            resolve_env_in_object,
            parse_postman_collection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PayloadX API Studio");
}
