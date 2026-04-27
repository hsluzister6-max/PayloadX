import { useState, useEffect } from 'react';
import { useCookieStore } from '@/store/cookieStore';
import toast from 'react-hot-toast';
import {
  Cookie,
  Plus,
  Trash2,
  ChevronLeft,
  ShieldCheck,
  Globe,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';

export default function SessionPanelContent() {
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

  const [view, setView] = useState('list'); // 'list' | 'cookies' | 'allowlist'
  const [newDomain, setNewDomain] = useState('');
  const [newCookieKey, setNewCookieKey] = useState('');
  const [newCookieValue, setNewCookieValue] = useState('');
  const [showDomainMenu, setShowDomainMenu] = useState(null);

  useEffect(() => { fetchDomains(); }, []);

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
    toast.success('Cookie added');
  };

  const handleSelectDomain = (domain) => {
    fetchCookies(domain);
    setView('cookies');
  };

  const handleDeleteDomain = (domain) => {
    // This would need to be implemented in the store
    toast.info('Domain removal coming soon');
    setShowDomainMenu(null);
  };

  const cookieEntries = selectedDomain ? Object.entries(currentCookies) : [];

  // VIEW: Domain List
  if (view === 'list') {
    return (
      <div className="flex flex-col h-full bg-[color:var(--bg-secondary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
          <div className="flex items-center gap-2">
            <Cookie size={16} className="text-[color:var(--accent)]" />
            <span className="text-xs font-semibold text-[color:var(--text-primary)]">Session Domains</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-muted)]">
              {domains.length}
            </span>
          </div>
          <button
            onClick={() => setView('allowlist')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-2)] transition-colors"
          >
            <ShieldCheck size={12} /> Allowlist
          </button>
        </div>

        {/* Add Domain Form */}
        <div className="p-3 border-b border-[color:var(--border-1)]">
          <form onSubmit={handleAddDomain} className="flex gap-2">
            <input
              type="text"
              placeholder="Add domain (e.g., api.example.com)..."
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="flex-1 input py-1.5 text-xs"
            />
            <button type="submit" className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </form>
        </div>

        {/* Domain List */}
        <div className="flex-1 overflow-y-auto">
          {domains.map((domain) => (
            <div
              key={domain}
              className="group flex items-center gap-3 px-4 py-3 border-b border-[color:var(--border-1)] hover:bg-[color:var(--surface-1)] cursor-pointer transition-colors"
            >
              <Globe size={16} className="text-[color:var(--accent)] flex-shrink-0" />
              <div className="flex-1 min-w-0" onClick={() => handleSelectDomain(domain)}>
                <span className="text-sm font-medium text-[color:var(--text-primary)] truncate">{domain}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDomainMenu(showDomainMenu === domain ? null : domain); }}
                className="p-1.5 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical size={14} />
              </button>

              {/* Dropdown Menu */}
              {showDomainMenu === domain && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDomainMenu(null)} />
                  <div className="absolute right-4 top-10 z-50 w-32 py-1 rounded-lg bg-[color:var(--bg-primary)] border border-[color:var(--border-1)] shadow-lg">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDomain(domain); }}
                      className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-[color:var(--surface-2)] flex items-center gap-2"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {domains.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Cookie size={40} className="text-[color:var(--text-muted)] opacity-20 mb-4" />
              <p className="text-sm text-[color:var(--text-muted)] mb-2">No domains configured</p>
              <p className="text-xs text-[color:var(--text-muted)] opacity-70">
                Add a domain above to start managing cookies
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VIEW: Cookies for Selected Domain
  if (view === 'cookies' && selectedDomain) {
    return (
      <div className="flex flex-col h-full bg-[color:var(--bg-secondary)]">
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
          <button
            onClick={() => setView('list')}
            className="p-1 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <Globe size={16} className="text-[color:var(--accent)] flex-shrink-0" />
          <span className="text-sm font-semibold text-[color:var(--text-primary)] truncate flex-1">{selectedDomain}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-muted)] flex-shrink-0">
            {cookieEntries.length} cookies
          </span>
        </div>

        {/* Cookie List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cookieEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-[color:var(--border-1)] bg-[color:var(--surface-2)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-1">{key}</p>
                  <p className="text-xs text-[color:var(--text-primary)] font-mono break-all">
                    {value || <span className="opacity-30 italic">null</span>}
                  </p>
                </div>
                <button
                  onClick={() => removeCookie(selectedDomain, key)}
                  className="p-1.5 rounded hover:bg-[color:var(--surface-3)] text-[color:var(--text-muted)] hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {cookieEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Cookie size={32} className="text-[color:var(--text-muted)] opacity-20 mb-3" />
              <p className="text-xs text-[color:var(--text-muted)] mb-1">No cookies stored</p>
              <p className="text-[10px] text-[color:var(--text-muted)] opacity-60">
                Add your first cookie below
              </p>
            </div>
          )}
        </div>

        {/* Add Cookie Form */}
        <div className="p-3 border-t border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
          <form onSubmit={handleAddCookie} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Cookie name"
              value={newCookieKey}
              onChange={(e) => setNewCookieKey(e.target.value)}
              required
              className="input py-1.5 text-xs"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Value"
                value={newCookieValue}
                onChange={(e) => setNewCookieValue(e.target.value)}
                className="flex-1 input py-1.5 text-xs"
              />
              <button type="submit" className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // VIEW: Allowlist
  return (
    <div className="flex flex-col h-full bg-[color:var(--bg-secondary)]">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
        <button
          onClick={() => setView('list')}
          className="p-1 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <ShieldCheck size={16} className="text-[color:var(--accent)]" />
        <span className="text-sm font-semibold text-[color:var(--text-primary)]">Allowlist</span>
      </div>

      <div className="p-4">
        <p className="text-xs text-[color:var(--text-muted)] mb-4">
          Domains with explicit permission for cookie access.
        </p>

        <form onSubmit={handleAddDomain} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="domain.tld"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-1 input py-1.5 text-xs"
          />
          <button type="submit" className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </form>

        <div className="space-y-2">
          {domains.map((domain) => (
            <div
              key={domain}
              className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--border-1)] bg-[color:var(--surface-2)]"
            >
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-[color:var(--accent)]" />
                <span className="text-sm font-medium text-[color:var(--text-primary)]">{domain}</span>
              </div>
              <button
                onClick={() => handleDeleteDomain(domain)}
                className="p-1.5 rounded hover:bg-[color:var(--surface-3)] text-[color:var(--text-muted)] hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {domains.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle size={32} className="text-[color:var(--text-muted)] opacity-20 mx-auto mb-3" />
              <p className="text-xs text-[color:var(--text-muted)]">No domains in allowlist</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
