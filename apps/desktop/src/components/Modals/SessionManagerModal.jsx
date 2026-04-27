import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCookieStore } from '@/store/cookieStore';
import toast from 'react-hot-toast';
import {
  Cookie,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ShieldCheck,
  Globe,
  AlertCircle,
} from 'lucide-react';

export default function SessionManagerModal() {
  const { setShowSessionModal } = useUIStore();
  const {
    domains,
    fetchDomains,
    addDomain,
    selectedDomain,
    fetchCookies,
    currentCookies,
    addCookie,
    removeCookie,
    loading
  } = useCookieStore();

  const [view, setView] = useState('cookies'); // 'cookies' | 'allowlist'
  const [newDomain, setNewDomain] = useState('');
  const [newCookieKey, setNewCookieKey] = useState('');
  const [newCookieValue, setNewCookieValue] = useState('');
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => { fetchDomains(); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => setShowSessionModal(false), 300);
  };

  const handleAddDomain = (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    addDomain(newDomain.trim());
    setNewDomain('');
  };

  const handleAddCookie = (e) => {
    e.preventDefault();
    if (!selectedDomain || !newCookieKey.trim()) return;
    addCookie(selectedDomain, newCookieKey.trim(), newCookieValue.trim());
    setNewCookieKey('');
    setNewCookieValue('');
  };

  const cookieEntries = selectedDomain ? Object.entries(currentCookies) : [];

  return (
    <>
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: visible ? 'rgba(0,0,0,0.4)' : 'transparent',
          transition: 'background 0.3s ease',
          backdropFilter: visible ? 'blur(4px)' : 'none',
        }}
        onClick={handleClose}
      />

      {/* Right-side Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: '600px',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-primary)' }}
        >
          <div className="flex items-center gap-3">
            {view === 'allowlist' && (
              <button
                onClick={() => setView('cookies')}
                style={{ color: 'var(--text-muted)', display: 'flex', cursor: 'pointer' }}
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', border: '1px solid var(--border-1)' }}>
              <Cookie size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {view === 'allowlist' ? 'Domain Allowlist' : 'Session Manager'}
              </h2>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {view === 'allowlist' ? 'Control cookie access per domain' : 'Manage per-domain cookies for requests'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border-1)', cursor: 'pointer' }}
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {view === 'cookies' ? (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-6 px-6 flex-shrink-0"
              style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-1)' }}>
              {['Manage', 'Cloud Sync'].map((tab, i) => (
                <button key={tab}
                  style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                    padding: '12px 0',
                    color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
                    background: 'transparent', cursor: 'pointer',
                  }}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Domain Sidebar */}
              <div className="flex flex-col flex-shrink-0"
                style={{ width: '200px', borderRight: '1px solid var(--border-1)', background: 'var(--bg-primary)' }}>

                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-1)' }}>
                  <form onSubmit={handleAddDomain} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Add domain..."
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      style={{
                        flex: 1, padding: '6px 10px', borderRadius: '6px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-1)',
                        color: 'var(--text-primary)', fontSize: '11px',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <button type="submit"
                      style={{
                        padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                        background: 'var(--surface-2)', border: '1px solid var(--border-1)',
                        color: 'var(--text-primary)', display: 'flex', alignItems: 'center',
                      }}>
                      <Plus size={14} />
                    </button>
                  </form>
                </div>

                <div className="flex-1 overflow-y-auto py-1">
                  {domains.map(domain => {
                    const isSelected = selectedDomain === domain;
                    return (
                      <button
                        key={domain}
                        onClick={() => fetchCookies(domain)}
                        className="w-full text-left transition-all"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '10px 16px',
                          background: isSelected ? 'var(--surface-2)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontSize: '11px', fontWeight: isSelected ? 700 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        <Globe size={11} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {domain}
                        </span>
                      </button>
                    );
                  })}
                  {domains.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                      <Cookie size={24} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No domains defined</p>
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-1)' }}>
                  <button
                    onClick={() => setView('allowlist')}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '7px', borderRadius: '6px', cursor: 'pointer',
                      border: '1px dashed var(--border-2)',
                      color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600,
                      background: 'transparent',
                    }}
                  >
                    <ShieldCheck size={11} />
                    Allowlist
                  </button>
                </div>
              </div>

              {/* Cookie Editor */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                {selectedDomain ? (
                  <>
                    {/* Domain Header */}
                    <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <Globe size={13} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                          {selectedDomain}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 8px', borderRadius: '20px', border: '1px solid var(--border-1)' }}>
                          {cookieEntries.length} entries
                        </span>
                      </div>
                      {cookieEntries.length > 0 && (
                        <button style={{ fontSize: '10px', fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', background: 'none', border: 'none' }}>
                          Purge All
                        </button>
                      )}
                    </div>

                    {/* Cookie List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {cookieEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center gap-3 group"
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border-1)',
                            transition: 'border-color 0.15s',
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '3px' }}>
                              {key}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {value || <span style={{ opacity: 0.3, fontStyle: 'italic' }}>null</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => removeCookie(selectedDomain, key)}
                            className="opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                            style={{
                              padding: '6px', borderRadius: '6px',
                              background: 'var(--surface-3)', border: '1px solid var(--border-1)',
                              color: 'var(--text-muted)', cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} className="hover:text-red-400" />
                          </button>
                        </div>
                      ))}

                      {cookieEntries.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Cookie size={40} style={{ color: 'var(--text-muted)', opacity: 0.12, marginBottom: '14px' }} strokeWidth={1} />
                          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            Registry Empty
                          </h3>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '200px', lineHeight: 1.6 }}>
                            No cookies stored for this domain yet
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Add Cookie Form */}
                    <div className="flex-shrink-0 p-4"
                      style={{ borderTop: '1px solid var(--border-1)', background: 'var(--bg-secondary)' }}>
                      <form onSubmit={handleAddCookie} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Key"
                          value={newCookieKey}
                          onChange={(e) => setNewCookieKey(e.target.value)}
                          required
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: '7px',
                            background: 'var(--bg-primary)', border: '1px solid var(--border-1)',
                            color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={newCookieValue}
                          onChange={(e) => setNewCookieValue(e.target.value)}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: '7px',
                            background: 'var(--bg-primary)', border: '1px solid var(--border-1)',
                            color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                        <button type="submit" className="btn-primary flex items-center gap-1.5">
                          <Plus size={13} /> Store
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <Cookie size={48} style={{ color: 'var(--text-muted)', opacity: 0.1, marginBottom: '20px' }} strokeWidth={1} />
                    <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      No Domain Selected
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '240px', lineHeight: 1.7, marginBottom: '20px' }}>
                      Add a domain from the left panel or configure the allowlist to start managing cookies.
                    </p>
                    <button onClick={() => setView('allowlist')} className="btn-ghost">
                      Configure Allowlist
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Allowlist View */
          <div className="flex-1 flex flex-col overflow-hidden p-8" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Domains Allowlist
              </h3>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.7, maxWidth: '480px' }}>
              Grant explicit permission for scripted access to specific domain cookie-jars.{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Security Protocol ↗</span>
            </p>

            <form onSubmit={handleAddDomain} className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="domain.tld"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: '8px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-1)',
                  color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button type="submit" className="btn-primary flex items-center gap-1.5">
                <Plus size={13} /> Add Entry
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2">
              {domains.map(domain => (
                <div
                  key={domain}
                  className="flex items-center justify-between group"
                  style={{
                    padding: '14px 18px', borderRadius: '10px',
                    background: 'var(--surface-2)', border: '1px solid var(--border-1)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Globe size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                      {domain}
                    </span>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                    style={{
                      padding: '6px 8px', borderRadius: '6px',
                      background: 'var(--surface-3)', border: '1px solid var(--border-1)',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} className="hover:text-red-400" />
                  </button>
                </div>
              ))}

              {domains.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle size={32} style={{ color: 'var(--text-muted)', opacity: 0.15, margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No domains in allowlist</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
