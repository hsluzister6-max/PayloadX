import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useRequestStore } from '@/store/requestStore';
import { Cookie, Variable } from 'lucide-react';
import { isTauri } from '@/lib/executor';
import api from '@/lib/api';
import EnvironmentSelector from '@/components/EnvironmentSelector/EnvironmentSelector';
import SyncStatusTag from '@/components/SyncStatusTag/SyncStatusTag';
import ContextSelector from './ContextSelector';
import TeamPresence from './TeamPresence';


export default function TopBarV2({ onToggleSidebar, sidebarOpen, orientation, onToggleOrientation }) {
  const { theme, toggleTheme, toggleLayout, setActiveV2Nav, rightSidebarOpen, rightSidebarActiveTab, openRightSidebarTab, toggleRightSidebar } = useUIStore();
  const { user } = useAuthStore();
  const { isConnected } = useSocketStore();
  const { currentTeam } = useTeamStore();
  const { currentProject } = useProjectStore();
  const { setCurrentRequest } = useRequestStore();

  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Keyboard shortcut Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowDropdown(true);
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Global search fetcher (scoped to project)
  useEffect(() => {
    if (!globalSearch.trim() || !currentProject) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get(`/api/request?projectId=${currentProject._id}&search=${encodeURIComponent(globalSearch.trim())}`);
        setSearchResults(data.requests || []);
      } catch (err) {
        console.error('Global search failed');
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [globalSearch, currentProject?._id]);

  return (
    <header className="v2-header">
      {/* Left — sidebar toggle & Context Selector */}
      <div className="v2-header-left flex items-center gap-2 relative" style={{ zIndex: 50 }}>
        <button
          onClick={onToggleSidebar}
          className="v2-header-icon-btn flex-shrink-0"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
        <ContextSelector />
      </div>

      {/* Center — Search */}
      <div className="v2-header-search" ref={searchContainerRef} style={{ position: 'relative' }}>
        <div className="v2-search-box" onClick={() => { searchInputRef.current?.focus(); setShowDropdown(true); }}>
          <svg className="v2-search-icon" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            className="v2-search-input"
            placeholder="Search APIs, endpoints..."
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
          />
          <kbd className="v2-search-kbd">{/mac/i.test(navigator.userAgent) && !/iphone|ipad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K'}</kbd>
        </div>

        {/* Global Search Dropdown */}
        {showDropdown && globalSearch.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-[var(--border-2)] rounded-lg shadow-glass overflow-hidden z-[9999] max-h-96 flex flex-col">
            <div className="px-3 py-2 text-[10px] font-bold text-surface-400 uppercase tracking-wider bg-surface-2 border-b border-[var(--border-2)] flex justify-between items-center">
              <span>{currentProject?.name} Search Results</span>
              <span className="text-[9px] opacity-70">Project scope</span>
            </div>

            <div className="overflow-y-auto p-1.5 flex flex-col gap-0.5">
              {isSearching ? (
                <div className="p-4 text-xs text-center text-surface-400">Scanning Project...</div>
              ) : searchResults?.length > 0 ? (
                searchResults.map(req => {
                  const color = req.method === 'GET' ? '#3FB950' : req.method === 'POST' ? '#58A6FF' : req.method === 'PUT' ? '#E3B341' : req.method === 'DELETE' ? '#F85149' : '#A8A8A8';
                  return (
                    <button
                      key={req._id}
                      onClick={() => {
                        setCurrentRequest(req);
                        setActiveV2Nav('collections');
                        setShowDropdown(false);
                        setGlobalSearch('');
                        searchInputRef.current?.blur();
                      }}
                      className="flex items-center gap-3 px-2 py-2 text-left hover:bg-surface-3 rounded-lg cursor-pointer transition-colors"
                    >
                      <span className="text-[10px] uppercase font-bold w-12 text-center rounded px-1 py-0.5 flex-shrink-0" style={{ color, background: `${color}15` }}>
                        {req.method}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-tx-primary truncate leading-tight">{req.name}</span>
                        <span className="text-[10px] text-surface-400 font-mono truncate">{req.url || 'No URL configured'}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-xs text-center text-surface-400">No endpoints found in this project</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right — controls */}
      <div className="v2-header-right">
        {/* Sync Status */}
        <SyncStatusTag />

        {/* Environment selector */}
        <EnvironmentSelector />

        {/* Team Presence */}
        <TeamPresence />

        {/* Connection dot */}
        {currentTeam && (
          <div
            className="v2-conn-dot"
            style={{ background: isConnected ? 'var(--success)' : 'var(--text-muted)' }}
            title={isConnected ? 'Real-time connected' : 'Offline'}
          />
        )}

        {/* Browser mode */}
        {!isTauri() && (
          <div className="v2-browser-badge">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Browser
          </div>
        )}

        {/* Orientation toggle */}
        <button
          onClick={onToggleOrientation}
          className="v2-header-icon-btn v2-orientation-btn"
          title={orientation === 'vertical' ? 'Switch to Horizontal split' : 'Switch to Vertical split'}
        >
          {orientation === 'vertical' ? (
            /* Vertical icon (side by side) */
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M12 3v18" />
            </svg>
          ) : (
            /* Horizontal icon (stacked) */
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 9h18M3 15h18M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
            </svg>
          )}
        </button>

        {/* Right sidebar toggles */}
        <button
          onClick={() => openRightSidebarTab('environment')}
          className={`v2-header-icon-btn ${rightSidebarOpen && rightSidebarActiveTab === 'environment' ? 'text-[color:var(--accent)]' : ''}`}
          title="Environment"
        >
          <Variable size={15} />
        </button>

        <button
          onClick={() => openRightSidebarTab('sessions')}
          className={`v2-header-icon-btn ${rightSidebarOpen && rightSidebarActiveTab === 'sessions' ? 'text-[color:var(--accent)]' : ''}`}
          title="Sessions"
        >
          <Cookie size={15} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="v2-header-icon-btn"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {theme === 'dark' ? (
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 3v1m0 16v1m8.66-10h-1M4.34 12H3m15.07-6.07l-.71.71M6.64 17.36l-.71.71M17.36 17.36l.71.71M6.64 6.64l.71-.71M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>


      </div>
    </header>
  );
}
