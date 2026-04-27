use url::Url;

#[derive(Debug)]
pub enum SsrfError {
    InvalidUrl(String),
}

pub fn validate_http_url(url_str: &str) -> Result<(), SsrfError> {
    let url = Url::parse(url_str)
        .map_err(|e| SsrfError::InvalidUrl(format!("Could not parse URL: {}", e)))?;

    match url.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(SsrfError::InvalidUrl(format!(
                "Scheme '{}' is not allowed. Only http/https are permitted.",
                scheme
            )));
        }
    }

    if url.host_str().is_none() {
        return Err(SsrfError::InvalidUrl("URL has no host".into()));
    }

    Ok(())
}
