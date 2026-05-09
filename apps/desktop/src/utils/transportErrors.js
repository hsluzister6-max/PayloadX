/**
 * HTTP client / transport errors (Postman-style copy).
 * Real HTTP responses use numeric status 100–599; everything else is a client/transport failure.
 */

export function isRealHttpStatus(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 100 && n <= 599;
}

/**
 * @param {string} raw
 * @returns {{ code: string, shortTitle: string, headline: string, summary: string, hints: string[], raw: string }}
 */
export function parseTransportError(raw) {
  const text = String(raw ?? '').trim() || 'Request failed';
  const lower = text.toLowerCase();

  const base = {
    code: 'UNKNOWN',
    shortTitle: 'Error',
    headline: 'Could not get a response',
    summary: 'Something went wrong before an HTTP response was received.',
    hints: [
      'Check that the URL is correct and the server is reachable from your machine.',
      'If you are on VPN or a corporate proxy, try the same URL from a terminal (curl).',
    ],
    raw: text,
  };

  if (lower.includes('cancelled')) {
    return {
      code: 'CANCELLED',
      shortTitle: 'Cancelled',
      headline: 'Request cancelled',
      summary: 'You stopped this request before it finished.',
      hints: [],
      raw: text,
    };
  }

  if (lower.includes('quotaexceeded') || (lower.includes('quota') && lower.includes('exceeded'))) {
    return {
      code: 'QUOTA_EXCEEDED',
      shortTitle: 'Storage quota',
      headline: 'Browser storage quota exceeded',
      summary: 'Saving session data to localStorage failed (often after very large responses).',
      hints: [
        'Clear site data for this app or remove old localStorage keys, then try again.',
        'Large response bodies are trimmed when persisting; send again if a tab lost its body.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('econnrefused')
    || lower.includes('connection refused')
    || lower.includes('os error 61')
    || lower.includes('os error 111')
    || (lower.includes('connect') && lower.includes('refused'))
  ) {
    return {
      code: 'ECONNREFUSED',
      shortTitle: 'Connection refused',
      headline: 'Could not connect — connection refused',
      summary:
        'The target machine actively refused the connection. Usually nothing is listening on that host/port yet, or a firewall blocked it.',
      hints: [
        'Start your API server (e.g. npm run dev) and confirm the port matches the URL.',
        'If you see EADDRINUSE in the server terminal, another process already owns that port — stop it or pick another port.',
        'Try: curl -v "<your-url>" in a terminal to confirm connectivity.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('eaddrinuse')
    || lower.includes('address already in use')
  ) {
    return {
      code: 'EADDRINUSE',
      shortTitle: 'Port in use',
      headline: 'Local port already in use',
      summary:
        'Your backend or realtime server failed to bind because another process is using the same port.',
      hints: [
        'Stop the other process or change the port in server config.',
        'macOS/Linux: lsof -i :PORT to see who listens on that port.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('enotfound')
    || lower.includes('failed to resolve')
    || lower.includes('nodename nor servname')
    || lower.includes('name or service not known')
    || (lower.includes('dns') && lower.includes('error'))
  ) {
    return {
      code: 'ENOTFOUND',
      shortTitle: 'DNS error',
      headline: 'Could not resolve host',
      summary: 'DNS lookup failed — the hostname does not exist or cannot be resolved from your network.',
      hints: [
        'Check for typos in the domain; verify VPN/DNS settings.',
        'Try ping or nslookup on the hostname.',
      ],
      raw: text,
    };
  }

  if (
    (lower.includes('chunk') && (lower.includes('eof') || lower.includes('unexpected')))
    || (lower.includes('reading a body') && lower.includes('connection'))
    || lower.includes('unexpected eof during chunk')
    || lower.includes('failed to read response body')
  ) {
    return {
      code: 'CHUNKED_BODY',
      shortTitle: 'Incomplete body',
      headline: 'Response stream ended before the full body arrived',
      summary:
        'The connection closed while reading a chunked or streaming response. The client never received the complete payload — this is a network / server / proxy issue, not the JSON viewer.',
      hints: [
        'Typical with ngrok free tier, reverse proxies, aggressive timeouts, or the server resetting mid-response.',
        'Retry; try the same URL with curl to see if the full body downloads.',
        'For very large responses, ensure nothing in the path (load balancer, tunnel) kills long transfers.',
        'If the API uses chunked encoding, confirm the server finishes the final chunk before closing.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('econnreset')
    || lower.includes('connection reset')
    || lower.includes('os error 10054')
    || lower.includes('broken pipe')
    || lower.includes('unexpected eof')
    || lower.includes('connection reset by peer')
  ) {
    return {
      code: 'ECONNRESET',
      shortTitle: 'Connection reset',
      headline: 'Connection was closed unexpectedly',
      summary:
        'The server or an intermediate proxy closed the TCP connection before the response completed.',
      hints: [
        'Common with free tunnels (ngrok), reverse proxies, or idle timeouts — especially on large or slow responses.',
        'Retry once; if it persists, try without a tunnel or inspect server/proxy logs.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('timeout')
    || lower.includes('timed out')
    || lower.includes('deadline exceeded')
  ) {
    return {
      code: 'ETIMEDOUT',
      shortTitle: 'Timeout',
      headline: 'Request timed out',
      summary: 'No response arrived within the configured time limit.',
      hints: [
        'The server may be slow, offline, or blocked by a firewall.',
        'Increase timeout in the client if the endpoint is legitimately slow.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('network is unreachable')
    || lower.includes('no route to host')
    || lower.includes('enetunreach')
    || lower.includes('ehostunreach')
  ) {
    return {
      code: 'ENETUNREACH',
      shortTitle: 'Network unreachable',
      headline: 'Network unreachable',
      summary: 'Your device could not route packets to the target network.',
      hints: [
        'Check Wi‑Fi/VPN; confirm you are not pointing at a LAN-only IP from outside that network.',
      ],
      raw: text,
    };
  }

  if (
    lower.includes('certificate')
    || lower.includes('cert ')
    || lower.includes('ssl')
    || lower.includes('tls')
    || lower.includes('handshake')
  ) {
    return {
      code: 'CERT_ERROR',
      shortTitle: 'TLS error',
      headline: 'Secure connection failed',
      summary: 'The TLS handshake or certificate validation failed.',
      hints: [
        'Expired/self-signed cert, wrong hostname, or TLS version mismatch.',
        'Corporate proxies may intercept HTTPS — check trusted roots.',
      ],
      raw: text,
    };
  }

  if (lower.includes('ssrf_invalid_url') || lower.includes('invalid url')) {
    return {
      code: 'INVALID_URL',
      shortTitle: 'Invalid URL',
      headline: 'URL is not allowed or malformed',
      summary: text.includes('SSRF_INVALID_URL')
        ? 'This URL failed security validation (SSRF policy or unsupported scheme).'
        : 'The request URL could not be parsed or is not HTTP(S).',
      hints: [
        'Use http:// or https:// with a valid host.',
        'File:// and private metadata URLs are blocked in the native client for safety.',
      ],
      raw: text,
    };
  }

  if (lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('networkerror')) {
    return {
      code: 'FETCH_FAILED',
      shortTitle: 'Network error',
      headline: 'Browser could not complete the request',
      summary: 'The fetch layer reported a failure (CORS, offline, mixed content, or proxy).',
      hints: [
        'Open DevTools → Network; check CORS and that you are online.',
        'In the desktop app, prefer the native bridge (Tauri) instead of browser proxy when possible.',
      ],
      raw: text,
    };
  }

  if (lower.includes('proxy') || lower.includes('502') || lower.includes('bad gateway')) {
    return {
      code: 'PROXY_ERROR',
      shortTitle: 'Proxy error',
      headline: 'Request proxy or gateway error',
      summary: text,
      hints: [
        'If using workspace proxy mode, ensure the PayloadX backend is running and reachable.',
      ],
      raw: text,
    };
  }

  return base;
}

/**
 * Response object stored in requestStore when no HTTP status is available (Postman-like).
 * @param {string} rawMessage
 * @returns {object}
 */
export function buildClientErrorResponse(rawMessage) {
  const parsed = parseTransportError(rawMessage);
  const bodyParts = [
    parsed.headline,
    '',
    parsed.summary,
  ];
  if (parsed.hints.length) {
    bodyParts.push('', 'What to try:', ...parsed.hints.map((h) => `• ${h}`));
  }
  bodyParts.push('', '—', 'Technical detail:', parsed.raw);

  return {
    status: 0,
    statusText: parsed.shortTitle,
    headers: {},
    body: bodyParts.join('\n'),
    responseTimeMs: 0,
    sizeBytes: 0,
    error: parsed.headline,
    clientError: parsed,
  };
}
