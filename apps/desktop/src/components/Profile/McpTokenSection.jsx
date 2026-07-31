import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getServerBaseUrl } from '@/store/serverConfigStore';
import ModalShell from '@/components/Modals/ModalShell';

/** Remote MCP config — works for any user (no local disk path). */
function buildRemoteConfig(token, baseUrl) {
  const root = String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  return JSON.stringify(
    {
      mcpServers: {
        payloadx: {
          url: `${root}/mcp`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2
  );
}

export default function McpTokenSection() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('Cursor MCP');
  const [revoking, setRevoking] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const baseUrl = useMemo(() => getServerBaseUrl(), []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/auth/api-tokens');
      setTokens(data.tokens || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const openTokenDetail = async (tokenMeta) => {
    setDetailLoading(true);
    setDetail({ meta: tokenMeta, token: null, mcpConfigJson: '', error: null });
    try {
      const { data } = await api.get(`/api/auth/api-tokens/${tokenMeta.id}`, {
        params: { baseUrl },
      });
      setDetail({
        meta: data.apiToken || tokenMeta,
        token: data.token,
        // Always build remote URL config in the UI (cloud may still return old stdio paths).
        mcpConfigJson: buildRemoteConfig(data.token, baseUrl),
        error: null,
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load token';
      // Fallback for old tokens: still open modal with guidance
      setDetail({
        meta: tokenMeta,
        token: null,
        mcpConfigJson: '',
        error: msg,
      });
      if (err.response?.status !== 409) {
        toast.error(msg);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/api/auth/api-tokens', {
        name: name.trim() || 'MCP Token',
        baseUrl,
      });
      toast.success('Token saved — opening details');
      await loadTokens();
      setDetail({
        meta: data.apiToken,
        token: data.token,
        mcpConfigJson: buildRemoteConfig(data.token, baseUrl),
        error: null,
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id, e) => {
    e?.stopPropagation?.();
    setRevoking(id);
    try {
      await api.delete(`/api/auth/api-tokens/${id}`);
      toast.success('Token revoked');
      if (detail?.meta?.id === id) setDetail(null);
      await loadTokens();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke');
    } finally {
      setRevoking(null);
    }
  };

  const copy = async (text, label = 'Copied') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="mcp-token-layout profile-mcp-layout">
      <section className="mcp-token-create">
        <h3 className="mcp-token-heading">Create MCP token</h3>
        <p className="mcp-token-hint">
          Tokens are <strong>saved in the database</strong> and stay valid until you revoke them.
          The MCP config uses your <strong>cloud API URL</strong> (no local disk path) — any teammate can paste it into Cursor.
        </p>

        <form onSubmit={handleCreate} className="mcp-token-form">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name (e.g. Cursor MCP)"
            maxLength={100}
          />
          <button type="submit" className="mcp-token-primary-btn" disabled={creating}>
            {creating ? 'Creating…' : 'Generate token'}
          </button>
        </form>
      </section>

      <section className="mcp-token-list-wrap">
        <h3 className="mcp-token-heading">Your tokens</h3>
        {loading ? (
          <p className="mcp-token-hint">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="mcp-token-hint">No active tokens yet.</p>
        ) : (
          <div className="mcp-token-list">
            {tokens.map((t) => (
              <button
                key={t.id}
                type="button"
                className="mcp-token-row mcp-token-row--clickable"
                onClick={() => openTokenDetail(t)}
              >
                <div className="mcp-token-row-main">
                  <div className="mcp-token-name-row">
                    <p className="mcp-token-name">{t.name}</p>
                    <span className="mcp-token-status">
                      {t.neverExpires || !t.expiresAt ? 'Active · never expires' : `Expires ${new Date(t.expiresAt).toLocaleDateString()}`}
                    </span>
                  </div>
                  <p className="mcp-token-meta">
                    {t.tokenPrefix}
                    {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}` : ' · never used'}
                    {t.createdAt ? ` · created ${new Date(t.createdAt).toLocaleDateString()}` : ''}
                    {' · click to view'}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  className="mcp-token-revoke-btn"
                  onClick={(e) => handleRevoke(t.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleRevoke(t.id, e);
                  }}
                  title="Revoke permanently"
                >
                  {revoking === t.id ? '…' : 'Revoke'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mcp-token-server">
          <span>API server</span>
          <code>{baseUrl}</code>
        </div>
      </section>

      {detail && (
        <ModalShell
          onClose={() => setDetail(null)}
          title={detail.meta?.name || 'MCP Token'}
          subtitle="Full token & Cursor config"
          maxWidth="max-w-xl"
          zIndex={10060}
        >
          {detailLoading ? (
            <p className="mcp-token-hint">Loading token…</p>
          ) : detail.error && !detail.token ? (
            <div className="mcp-token-fresh">
              <p className="mcp-token-hint" style={{ marginBottom: 0 }}>{detail.error}</p>
              <p className="mcp-token-meta" style={{ marginTop: 8 }}>
                Prefix: {detail.meta?.tokenPrefix}
              </p>
            </div>
          ) : (
            <>
              <div className="mcp-token-fresh-head">
                <span>Full token</span>
                <button type="button" className="mcp-token-link-btn" onClick={() => copy(detail.token, 'Token copied')}>
                  Copy token
                </button>
              </div>
              <code className="mcp-token-raw">{detail.token}</code>

              <div className="mcp-token-fresh-head" style={{ marginTop: 14 }}>
                <span>MCP config (Cursor)</span>
                <button
                  type="button"
                  className="mcp-token-link-btn"
                  onClick={() => copy(detail.mcpConfigJson, 'Config copied')}
                >
                  Copy config
                </button>
              </div>
              <pre className="mcp-token-config">{detail.mcpConfigJson}</pre>

              <div className="flex gap-2 pt-3">
                <button type="button" className="btn-ghost flex-1" onClick={() => setDetail(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="mcp-token-revoke-btn flex-1"
                  style={{ height: 40 }}
                  disabled={revoking === detail.meta?.id}
                  onClick={(e) => handleRevoke(detail.meta.id, e)}
                >
                  Revoke token
                </button>
              </div>
            </>
          )}
        </ModalShell>
      )}
    </div>
  );
}
