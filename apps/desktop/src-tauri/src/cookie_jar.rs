//! In-memory cookie jar for REST execution (Tauri): Set-Cookie handling, expiry,
//! Secure flag, localhost / 127.0.0.1 aliasing, port-scoped keys, merge with manual Cookie header.

use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use url::Url;

/// Public map type managed by [`crate::AppCookieJar`].
pub type AppJar = HashMap<String, HostCookieMap>;
pub type HostCookieMap = HashMap<String, StoredCookie>;

#[derive(Debug, Clone)]
pub struct StoredCookie {
    pub value: String,
    /// `None` = session cookie (kept until app exit or overwritten).
    pub expires_at: Option<SystemTime>,
    pub secure: bool,
}

impl StoredCookie {
    pub fn is_expired(&self, now: SystemTime) -> bool {
        if let Some(exp) = self.expires_at {
            now >= exp
        } else {
            false
        }
    }
}

/// Normalize loopback and non-default ports so `localhost:3000` and `127.0.0.1:3000` share a jar bucket.
pub fn cookie_storage_key(url: &Url) -> String {
    let mut host = url.host_str().unwrap_or("").to_lowercase();
    if host == "127.0.0.1" || host == "::1" {
        host = "localhost".to_string();
    }
    let scheme = url.scheme();
    let port = url.port_or_known_default();
    let default = match scheme {
        "https" => Some(443u16),
        "http" => Some(80u16),
        _ => None,
    };
    match (port, default) {
        (Some(p), Some(d)) if p != d => format!("{}:{}", host, p),
        _ => host,
    }
}

/// Lookup keys when sending a request for this URL (`cookie_storage_key` is always loopback-normalized;
/// we also try `127.0.0.1` so manual hosts still hit the same bucket).
pub fn lookup_keys_for_url(url: &Url) -> Vec<String> {
    let primary = cookie_storage_key(url);
    let mut keys = vec![primary.clone()];
    if let Some(rest) = primary.strip_prefix("localhost:") {
        keys.push(format!("127.0.0.1:{}", rest));
    } else if primary == "localhost" {
        keys.push("127.0.0.1".into());
    }
    keys.sort();
    keys.dedup();
    keys
}

/// Host string from UI / `get_cookies` (e.g. `localhost`, `localhost:3000`).
pub fn candidate_keys_from_host_input(host: &str) -> Vec<String> {
    let s = host.trim().to_lowercase();
    let mut keys = vec![s.clone()];
    if let Some((h, p)) = s.rsplit_once(':') {
        if !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()) {
            if h == "127.0.0.1" || h == "::1" {
                keys.push(format!("localhost:{}", p));
            } else if h == "localhost" {
                keys.push(format!("127.0.0.1:{}", p));
            }
        }
    } else {
        match s.as_str() {
            "127.0.0.1" | "::1" => keys.push("localhost".into()),
            "localhost" => keys.push("127.0.0.1".into()),
            _ => {}
        }
    }
    keys.sort();
    keys.dedup();
    keys
}

pub fn purge_expired(jar: &mut AppJar) {
    let now = SystemTime::now();
    jar.retain(|_, host_map| {
        host_map.retain(|_, c| !c.is_expired(now));
        !host_map.is_empty()
    });
}

fn normalize_domain_attr(s: &str) -> String {
    s.trim().trim_start_matches('.').to_lowercase()
}

fn host_aliases(request_host: &str) -> Vec<String> {
    let h = request_host.to_lowercase();
    match h.as_str() {
        "127.0.0.1" | "::1" => vec!["127.0.0.1".into(), "localhost".into()],
        "localhost" => vec!["localhost".into(), "127.0.0.1".into()],
        _ => vec![h],
    }
}

fn domain_matches(domain_attr: &str, request_host: &str) -> bool {
    let d = normalize_domain_attr(domain_attr);
    for h in host_aliases(request_host) {
        if h == d || h.ends_with(&format!(".{}", d)) {
            return true;
        }
    }
    false
}

fn storage_key_for_set_cookie(request_url: &Url, domain_attr: Option<&str>) -> String {
    match domain_attr {
        None => cookie_storage_key(request_url),
        Some(d) => {
            let dn = normalize_domain_attr(d);
            let rh = request_url.host_str().unwrap_or("");
            if !domain_matches(&dn, rh) {
                return cookie_storage_key(request_url);
            }
            let scheme = request_url.scheme();
            let mut synthetic = format!("{}://{}", scheme, dn);
            if let Some(p) = request_url.port() {
                synthetic = format!("{}://{}:{}", scheme, dn, p);
            }
            Url::parse(&synthetic)
                .ok()
                .map(|u| cookie_storage_key(&u))
                .unwrap_or_else(|| cookie_storage_key(request_url))
        }
    }
}

fn parse_expires_seconds(s: &str) -> Option<SystemTime> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    // HTTP-date (RFC 1123)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(s) {
        let utc = dt.with_timezone(&chrono::Utc);
        let secs = utc.timestamp();
        let nsec = utc.timestamp_subsec_nanos();
        return Some(UNIX_EPOCH + Duration::new(secs as u64, nsec));
    }
    None
}

/// Apply one `Set-Cookie` header value into the jar.
pub fn store_from_set_cookie(jar: &mut AppJar, set_cookie_header: &str, request_url: &Url) {
    let parts: Vec<&str> = set_cookie_header
        .split(';')
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return;
    }

    let first = parts[0];
    let kv: Vec<&str> = first.splitn(2, '=').collect();
    let name = kv[0].trim();
    if name.is_empty() {
        return;
    }
    let value = kv.get(1).map(|s| s.trim()).unwrap_or("").to_string();

    let mut max_age: Option<i64> = None;
    let mut expires_at_attr: Option<SystemTime> = None;
    let mut domain_attr: Option<String> = None;
    let mut secure = false;

    for part in parts.iter().skip(1) {
        let seg: Vec<&str> = part.splitn(2, '=').map(str::trim).collect();
        let aname = seg[0].to_lowercase();
        let aval = seg.get(1).copied().unwrap_or("");
        match aname.as_str() {
            "secure" => secure = true,
            "httponly" | "samesite" | "priority" | "partitioned" => {}
            "max-age" => {
                if let Ok(s) = aval.parse::<i64>() {
                    max_age = Some(s);
                }
            }
            "expires" => {
                if let Some(t) = parse_expires_seconds(aval) {
                    expires_at_attr = Some(t);
                }
            }
            "domain" => {
                if !aval.is_empty() {
                    domain_attr = Some(aval.to_string());
                }
            }
            _ => {}
        }
    }

    let now = SystemTime::now();
    let store_key = storage_key_for_set_cookie(
        request_url,
        domain_attr.as_deref(),
    );
    let host_bucket = jar.entry(store_key).or_default();

    if let Some(age) = max_age {
        if age <= 0 {
            host_bucket.remove(name);
            return;
        }
        let expires_at = now.checked_add(Duration::from_secs(age as u64));
        host_bucket.insert(
            name.to_string(),
            StoredCookie {
                value,
                expires_at,
                secure,
            },
        );
        return;
    }

    if let Some(exp) = expires_at_attr {
        if now >= exp {
            host_bucket.remove(name);
            return;
        }
        host_bucket.insert(
            name.to_string(),
            StoredCookie {
                value,
                expires_at: Some(exp),
                secure,
            },
        );
        return;
    }

    host_bucket.insert(
        name.to_string(),
        StoredCookie {
            value,
            expires_at: None,
            secure,
        },
    );
}

/// Build merged `Cookie` header: jar cookies for `lookup_keys`, then override with manual `Cookie` pairs.
pub fn build_cookie_header_value(
    jar: &AppJar,
    storage_keys: &[String],
    user_cookie_header: Option<&str>,
    url_is_https: bool,
    now: SystemTime,
) -> Option<String> {
    let mut pairs: HashMap<String, String> = HashMap::new();

    for key in storage_keys {
        if let Some(host_map) = jar.get(key) {
            for (k, sc) in host_map {
                if sc.is_expired(now) {
                    continue;
                }
                if sc.secure && !url_is_https {
                    continue;
                }
                pairs.entry(k.clone()).or_insert_with(|| sc.value.clone());
            }
        }
    }

    if let Some(uc) = user_cookie_header {
        for part in uc.split(';') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            let kv: Vec<&str> = part.splitn(2, '=').collect();
            let n = kv[0].trim();
            if n.is_empty() {
                continue;
            }
            let v = kv.get(1).map(|s| s.trim()).unwrap_or("");
            pairs.insert(n.to_string(), v.to_string());
        }
    }

    if pairs.is_empty() {
        return None;
    }

    let mut names: Vec<_> = pairs.keys().cloned().collect();
    names.sort();
    Some(
        names
            .into_iter()
            .map(|k| {
                let v = pairs.get(&k).cloned().unwrap_or_default();
                if v.is_empty() {
                    k
                } else {
                    format!("{}={}", k, v)
                }
            })
            .collect::<Vec<_>>()
            .join("; "),
    )
}
