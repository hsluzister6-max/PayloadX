/**
 * Static product mock for the login hero — always dark chrome
 * so it reads as the real PayloadX desktop UI in both themes.
 */
export default function AuthAppMockup() {
  return (
    <div className="auth-mock" aria-hidden="true">
      <div className="auth-mock-chrome">
        <div className="auth-mock-traffic">
          <span />
          <span />
          <span />
        </div>
        <div className="auth-mock-title">PayloadX — GET /users</div>
        <div className="auth-mock-win-actions">
          <span /><span /><span />
        </div>
      </div>

      <div className="auth-mock-body">
        <aside className="auth-mock-sidebar">
          <div className="auth-mock-brand">PX</div>
          <div className="auth-mock-nav">
            <div className="auth-mock-nav-item is-active">Collections</div>
            <div className="auth-mock-nav-item">Environments</div>
            <div className="auth-mock-nav-item">History</div>
          </div>
          <div className="auth-mock-folder">
            <div className="auth-mock-folder-label">Users API</div>
            <div className="auth-mock-req">
              <span className="auth-mock-method get">GET</span>
              List users
            </div>
            <div className="auth-mock-req is-active">
              <span className="auth-mock-method get">GET</span>
              Get user
            </div>
            <div className="auth-mock-req">
              <span className="auth-mock-method post">POST</span>
              Create user
            </div>
            <div className="auth-mock-req">
              <span className="auth-mock-method del">DEL</span>
              Delete user
            </div>
          </div>
        </aside>

        <main className="auth-mock-main">
          <div className="auth-mock-urlbar">
            <span className="auth-mock-method get">GET</span>
            <div className="auth-mock-url">
              <span className="auth-mock-url-dim">{'{{baseUrl}}'}</span>/api/users/42
            </div>
            <button type="button" className="auth-mock-send" tabIndex={-1}>
              Send
            </button>
          </div>

          <div className="auth-mock-tabs">
            <span className="is-active">Params</span>
            <span>Headers</span>
            <span>Body</span>
            <span>Auth</span>
          </div>

          <div className="auth-mock-split">
            <div className="auth-mock-panel">
              <div className="auth-mock-panel-label">Request</div>
              <pre>{`{\n  "id": 42,\n  "include": "profile"\n}`}</pre>
            </div>
            <div className="auth-mock-panel auth-mock-response">
              <div className="auth-mock-panel-label">
                Response
                <span className="auth-mock-status">200 OK · 48ms</span>
              </div>
              <pre>{`{\n  "id": 42,\n  "name": "Ada Lovelace",\n  "role": "admin"\n}`}</pre>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
