import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
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

export default function McpTokenSection({ embedded = false }) {
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
        mcpConfigJson: buildRemoteConfig(data.token, baseUrl),
        error: null,
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load token';
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
      toast.success('Token created');
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
    <div className={`mcp-token-layout${embedded ? ' mcp-token-layout--embedded' : ''}`}>
      <div className="mcp-token-toolbar">
        <form onSubmit={handleCreate} className="mcp-token-form">
          <div className="mcp-token-input-wrap">
            <KeyRound size={14} className="mcp-token-input-icon" />
            <input
              className="mcp-token-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Token name (e.g. Cursor MCP)"
              maxLength={100}
            />
          </div>
          <button type="submit" className="mcp-token-primary-btn" disabled={creating}>
            <Plus size={14} strokeWidth={2.5} />
            {creating ? 'Creating…' : 'Generate'}
          </button>
        </form>
        <p className="mcp-token-hint">
          Paste the config into <code>~/.cursor/mcp.json</code>. Uses your API URL — no local disk path.
        </p>
      </div>

      <div className="mcp-token-list-wrap">
        <div className="mcp-token-list-head">
          <h4>Active tokens</h4>
          <span>{loading ? '…' : `${tokens.length}`}</span>
        </div>

        {loading ? (
          <div className="mcp-token-empty">Loading tokens…</div>
        ) : tokens.length === 0 ? (
          <div className="mcp-token-empty">
            No tokens yet. Generate one to connect Cursor or Claude.
          </div>
        ) : (
          <div className="mcp-token-list">
            {tokens.map((t) => (
              <div key={t.id} className="mcp-token-row">
                <button
                  type="button"
                  className="mcp-token-row-main"
                  onClick={() => openTokenDetail(t)}
                >
                  <div className="mcp-token-name-row">
                    <p className="mcp-token-name">{t.name}</p>
                    <span className="mcp-token-status">
                      {t.neverExpires || !t.expiresAt
                        ? 'Never expires'
                        : `Expires ${new Date(t.expiresAt).toLocaleDateString()}`}
                    </span>
                  </div>
                  <p className="mcp-token-meta">
                    <code>{t.tokenPrefix}…</code>
                    {t.lastUsedAt
                      ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}`
                      : ' · never used'}
                    {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleDateString()}` : ''}
                  </p>
                </button>
                <button
                  type="button"
                  className="mcp-token-revoke-btn"
                  onClick={(e) => handleRevoke(t.id, e)}
                  disabled={revoking === t.id}
                  title="Revoke permanently"
                >
                  <Trash2 size={13} />
                  {revoking === t.id ? '…' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mcp-token-server">
          <span>API server</span>
          <code>{baseUrl}</code>
        </div>
      </div>

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
