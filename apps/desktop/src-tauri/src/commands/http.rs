use std::collections::HashMap;
use std::str::FromStr;
use std::time::Instant;
use serde::{Deserialize, Serialize};
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    multipart::Form,
    Method,
};
use crate::security::{validate_http_url, SsrfError};
use crate::cookie_jar;

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RequestHeader {
    pub key: String,
    pub value: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RequestParam {
    pub key: String,
    pub value: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BodyConfig {
    pub mode: Option<String>,
    pub raw: Option<String>,
    pub raw_language: Option<String>,
    pub form_data: Option<Vec<RequestParam>>,
    pub urlencoded: Option<Vec<RequestParam>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: Option<String>,
    pub bearer: Option<BearerAuth>,
    pub basic: Option<BasicAuth>,
    pub apikey: Option<ApiKeyAuth>,
}

#[derive(Debug, Deserialize)]
pub struct BearerAuth {
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BasicAuth {
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApiKeyAuth {
    pub key: Option<String>,
    pub value: Option<String>,
    #[serde(rename = "in")]
    pub location: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteRequestPayload {
    pub method: String,
    pub url: String,
    pub headers: Option<Vec<RequestHeader>>,
    pub body: Option<BodyConfig>,
    pub auth: Option<AuthConfig>,
    pub timeout_ms: Option<u64>,
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub response_time_ms: u64,
    pub size_bytes: usize,
}

// ── Command ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn execute_request(
    payload: ExecuteRequestPayload,
    client: tauri::State<'_, reqwest::Client>,
    cookie_jar: tauri::State<'_, crate::AppCookieJar>,
) -> Result<ExecuteResponse, String> {
    // Desktop requests run locally, so we only validate that the URL is a real
    // HTTP(S) target and allow localhost/LAN/private hosts.
    validate_http_url(&payload.url).map_err(|e| match e {
        SsrfError::InvalidUrl(msg) => format!("SSRF_INVALID_URL: {}", msg),
    })?;

    // 2. Build URL and apply query-based auth before sending.
    let mut url = url::Url::parse(&payload.url)
        .map_err(|e| format!("Invalid URL format: {}", e))?;

    // 3. HTTP method
    let method = Method::from_str(&payload.method.to_uppercase())
        .map_err(|_| format!("Invalid HTTP method: {}", payload.method))?;

    // 4. Client timeout
    let timeout_secs = payload.timeout_ms.unwrap_or(30_000) / 1000;

    // 5. Build headers
    let mut header_map = HeaderMap::new();

    // Auth
    if let Some(auth) = &payload.auth {
        match auth.auth_type.as_deref() {
            Some("bearer") => {
                if let Some(bearer) = &auth.bearer {
                    if let Some(token) = &bearer.token {
                        if !token.is_empty() {
                            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                                header_map.insert(
                                    HeaderName::from_static("authorization"),
                                    val,
                                );
                            }
                        }
                    }
                }
            }
            Some("basic") => {
                if let Some(basic) = &auth.basic {
                    let user = basic.username.as_deref().unwrap_or("");
                    let pass = basic.password.as_deref().unwrap_or("");
                    let encoded = base64_encode(&format!("{}:{}", user, pass));
                    if let Ok(val) = HeaderValue::from_str(&format!("Basic {}", encoded)) {
                        header_map.insert(HeaderName::from_static("authorization"), val);
                    }
                }
            }
            Some("apikey") => {
                if let Some(apikey) = &auth.apikey {
                    if let (Some(k), Some(v)) = (&apikey.key, &apikey.value) {
                        if apikey.location.as_deref() == Some("query") {
                            url.query_pairs_mut().append_pair(k, v);
                        } else if let (Ok(name), Ok(val)) = (
                            HeaderName::from_str(k),
                            HeaderValue::from_str(v),
                        ) {
                            header_map.insert(name, val);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Custom headers — defer Cookie so it can be merged with the jar
    let mut user_cookie_raw: Option<String> = None;
    if let Some(headers) = &payload.headers {
        for h in headers.iter().filter(|h| h.enabled.unwrap_or(true) && !h.key.is_empty()) {
            if h.key.eq_ignore_ascii_case("cookie") {
                user_cookie_raw = Some(h.value.clone());
                continue;
            }
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_str(&h.key),
                HeaderValue::from_str(&h.value),
            ) {
                header_map.insert(name, val);
            }
        }
    }

    let url_is_https = url.scheme() == "https";
    let storage_keys = cookie_jar::lookup_keys_for_url(&url);
    let now = std::time::SystemTime::now();

    if let Ok(mut jar) = cookie_jar.0.lock() {
        cookie_jar::purge_expired(&mut jar);
        if let Some(merged) = cookie_jar::build_cookie_header_value(
            &jar,
            &storage_keys,
            user_cookie_raw.as_deref(),
            url_is_https,
            now,
        ) {
            if let Ok(val) = HeaderValue::from_str(&merged) {
                header_map.insert(reqwest::header::COOKIE, val);
            }
        }
    }

    // 6. Build request
    let has_content_type = header_map.contains_key(reqwest::header::CONTENT_TYPE);

    let mut req = client.request(method.clone(), url.as_str())
        .headers(header_map)
        .timeout(std::time::Duration::from_secs(timeout_secs.max(5).min(60)));

    // 7. Body
    if !matches!(method, Method::GET | Method::HEAD) {
        if let Some(body) = &payload.body {
            if body.mode.as_deref() == Some("raw") {
                let raw = body.raw.clone().unwrap_or_default();

                if !has_content_type {
                    let content_type = match body.raw_language.as_deref() {
                        Some("json") => "application/json",
                        Some("xml") => "application/xml",
                        Some("html") => "text/html",
                        _ => "text/plain",
                    };

                    req = req.header("Content-Type", content_type);
                }

                req = req.body(raw);
            } else if body.mode.as_deref() == Some("form-data") {
                let mut form = Form::new();

                if let Some(items) = &body.form_data {
                    for item in items.iter().filter(|item| item.enabled.unwrap_or(true) && !item.key.is_empty()) {
                        form = form.text(item.key.clone(), item.value.clone());
                    }
                }

                req = req.multipart(form);
            } else if body.mode.as_deref() == Some("urlencoded") {
                let mut fields = Vec::new();

                if let Some(items) = &body.urlencoded {
                    for item in items.iter().filter(|item| item.enabled.unwrap_or(true) && !item.key.is_empty()) {
                        fields.push((item.key.clone(), item.value.clone()));
                    }
                }

                req = req.form(&fields);
            }
        }
    }

    // 8. Execute + measure time
    let start = Instant::now();
    let response = req.send().await.map_err(|e| {
        if e.is_timeout()  { "Request timed out".to_string() }
        else if e.is_connect() { format!("Connection failed: {}", e) }
        else { format!("Request failed: {}", e) }
    })?;
    let elapsed = start.elapsed().as_millis() as u64;

    // 9. Parse response
    let status_code = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("Unknown").to_string();

    let mut resp_headers = HashMap::new();

    {
        let set_cookies = response.headers().get_all(reqwest::header::SET_COOKIE);
        let mut new_cookies = Vec::new();
        if let Ok(mut jar) = cookie_jar.0.lock() {
            for cookie in set_cookies.iter() {
                if let Ok(c_str) = cookie.to_str() {
                    new_cookies.push(c_str.to_string());
                    cookie_jar::store_from_set_cookie(&mut jar, c_str, &url);
                }
            }
        } else {
            for cookie in set_cookies.iter() {
                if let Ok(c_str) = cookie.to_str() {
                    new_cookies.push(c_str.to_string());
                }
            }
        }
        if !new_cookies.is_empty() {
            resp_headers.insert("Set-Cookie".to_string(), new_cookies.join("\n"));
        }
    }

    for (k, v) in response.headers().iter() {
        if k != reqwest::header::SET_COOKIE {
            resp_headers.insert(k.to_string(), v.to_str().unwrap_or("").to_string());
        }
    }

    // Read body with timeout to prevent hanging on Linux
    let body_bytes = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        response.bytes()
    ).await
    .map_err(|_| "Body read timed out".to_string())?
    .map_err(|e| format!("Failed to read response body: {}", e))?;
    
    let size_bytes = body_bytes.len();
    let body_str = String::from_utf8_lossy(&body_bytes).to_string();

    Ok(ExecuteResponse {
        status: status_code,
        status_text,
        headers: resp_headers,
        body: body_str,
        response_time_ms: elapsed,
        size_bytes,
    })
}

#[tauri::command]
pub async fn clear_cookies(
    cookie_jar: tauri::State<'_, crate::AppCookieJar>,
) -> Result<(), String> {
    if let Ok(mut jar) = cookie_jar.0.lock() {
        jar.clear();
        Ok(())
    } else {
        Err("Failed to lock cookie jar".to_string())
    }
}

#[tauri::command]
pub async fn get_cookies(
    host: String,
    cookie_jar: tauri::State<'_, crate::AppCookieJar>,
) -> Result<HashMap<String, String>, String> {
    use std::time::SystemTime;
    let now = SystemTime::now();
    if let Ok(jar) = cookie_jar.0.lock() {
        let mut acc: HashMap<String, String> = HashMap::new();
        for storage_key in cookie_jar::candidate_keys_from_host_input(&host) {
            if let Some(host_map) = jar.get(&storage_key) {
                for (name, sc) in host_map {
                    if !sc.is_expired(now) {
                        acc.insert(name.clone(), sc.value.clone());
                    }
                }
            }
        }
        Ok(acc)
    } else {
        Err("Failed to lock cookie jar".to_string())
    }
}

#[tauri::command]
pub async fn set_cookie(
    host: String,
    key: String,
    value: String,
    cookie_jar: tauri::State<'_, crate::AppCookieJar>,
) -> Result<(), String> {
    if let Ok(mut jar) = cookie_jar.0.lock() {
        let host_jar = jar.entry(host).or_default();
        host_jar.insert(
            key,
            cookie_jar::StoredCookie {
                value,
                expires_at: None,
                secure: false,
            },
        );
        Ok(())
    } else {
        Err("Failed to lock cookie jar".to_string())
    }
}

#[tauri::command]
pub async fn delete_cookie(
    host: String,
    key: String,
    cookie_jar: tauri::State<'_, crate::AppCookieJar>,
) -> Result<(), String> {
    if let Ok(mut jar) = cookie_jar.0.lock() {
        for storage_key in cookie_jar::candidate_keys_from_host_input(&host) {
            if let Some(host_jar) = jar.get_mut(&storage_key) {
                host_jar.remove(&key);
            }
        }
        Ok(())
    } else {
        Err("Failed to lock cookie jar".to_string())
    }
}

#[tauri::command]
pub async fn list_cookie_domains(
    cookie_jar: tauri::State<'_, crate::AppCookieJar>,
) -> Result<Vec<String>, String> {
    if let Ok(mut jar) = cookie_jar.0.lock() {
        cookie_jar::purge_expired(&mut jar);
        Ok(jar.keys().cloned().collect())
    } else {
        Err("Failed to lock cookie jar".to_string())
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Base64 encode (RFC 4648) — used for Basic auth header
fn base64_encode(input: &str) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        result.push(CHARS[b0 >> 2] as char);
        result.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        if chunk.len() > 1 { result.push(CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] as char); }
        else { result.push('='); }
        if chunk.len() > 2 { result.push(CHARS[b2 & 0x3f] as char); }
        else { result.push('='); }
    }
    result
}
