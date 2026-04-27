import { useState, useCallback, useEffect, useRef } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import RequestPresence from './RequestPresence';
import { useUIStore } from '@/store/uiStore';
import { useSocketStore } from '@/store/socketStore';
import { Cookie } from 'lucide-react';

// Specialized Builders
import RESTRequestBuilder from './RESTRequestBuilder';
import WSRequestBuilder from './WSRequestBuilder';
import SIORequestBuilder from './SIORequestBuilder';

export default function RequestBuilder() {
  const {
    currentRequest,
    updateField,
    saveRequest,
    noActiveRequest,
    newRequest,
    isSaving
  } = useRequestStore();

  const { currentTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { emitOpenRequest, emitCloseRequest } = useSocketStore();

  const [showProtocolDropdown, setShowProtocolDropdown] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const PROTOCOLS = [
    { id: 'http', label: 'HTTP (REST)', icon: '🌐' },
    { id: 'ws', label: 'WebSocket (Raw)', icon: '⚡' },
    { id: 'socketio', label: 'Socket.IO', icon: '⬢' },
  ];

  // ── Presence Logic ──
  const prevRequestIdRef = useRef(null);
  useEffect(() => {
    const requestId = currentRequest?._id;
    const teamId = currentTeam?._id;
    if (!requestId || !teamId || !user) return;

    if (prevRequestIdRef.current && prevRequestIdRef.current !== requestId) {
      emitCloseRequest(teamId, prevRequestIdRef.current, user._id || user.id);
    }

    emitOpenRequest(teamId, requestId, user);
    prevRequestIdRef.current = requestId;

    return () => {
      if (requestId && teamId && user) {
        emitCloseRequest(teamId, requestId, user._id || user.id);
      }
    };
  }, [currentRequest?._id, currentTeam?._id]);

  const handleKeyDown = useCallback(async (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (isSaving) return;

      try {
        const r = await saveRequest();
        if (r?.success) toast.success('Request saved');
        else if (r?.error) toast.error(r.error);
      } catch (err) {
        console.error('Save failed:', err);
      }
    }
  }, [saveRequest, isSaving]);

  if (noActiveRequest || !currentRequest) {
    return <EmptyState onNewRequest={newRequest} />;
  }

  // Determine which builder to show
  const renderBuilder = () => {
    switch (currentRequest.protocol) {
      case 'ws':
        return <WSRequestBuilder />;
      case 'socketio':
        return <SIORequestBuilder />;
      case 'http':
      default:
        return <RESTRequestBuilder />;
    }
  };

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Shared Header: Protocol, Name, and Actions */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 min-h-[42px]">
        <div className="flex items-center flex-1 min-w-0 pr-4 gap-3">
          {/* Protocol Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowProtocolDropdown(!showProtocolDropdown)}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold bg-[color:var(--surface-2)] border border-[color:var(--border-1)] rounded-md hover:border-[color:var(--accent)] transition-all text-[color:var(--text-primary)]"
            >
              {currentRequest.protocol === 'http' ? 'HTTP' : currentRequest.protocol === 'ws' ? 'RAW WS' : 'SOCKET.IO'}
              <svg className={`w-3 h-3 opacity-60 transition-transform ${showProtocolDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showProtocolDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[color:var(--surface-1)] border border-[color:var(--border-1)] rounded-lg shadow-glass z-[100] py-1 min-w-[140px]">
                {PROTOCOLS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      updateField('protocol', p.id);
                      // If switching to ws/sio, ensure method is cleared so it doesn't show in sidebars inadvertently
                      if (p.id !== 'http') {
                        updateField('method', undefined);
                        // Bonus: auto-prefix url if empty or http
                        if (!currentRequest.url || currentRequest.url === 'http://localhost:3000') {
                          if (p.id === 'ws') updateField('url', 'wss://echo.websocket.org');
                          if (p.id === 'socketio') updateField('url', 'http://localhost:3000');
                        }
                      } else {
                        updateField('method', 'GET');
                      }
                      setShowProtocolDropdown(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-medium hover:bg-surface-700 transition-colors ${currentRequest.protocol === p.id ? 'text-[color:var(--accent)] bg-surface-800' : 'text-[color:var(--text-muted)]'}`}
                  >
                    <span>{p.label}</span>
                    <span className="text-[10px]">{p.icon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name Editor */}
          <div className="flex flex-col min-w-0">
            {isEditingName ? (
              <input
                autoFocus
                className="input text-[13px] font-semibold h-7 w-full max-w-sm"
                value={currentRequest.name}
                onChange={(e) => updateField('name', e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false); }}
              />
            ) : (
              <span
                onClick={() => setIsEditingName(true)}
                className="text-[13px] font-semibold text-[color:var(--text-primary)] cursor-text hover:bg-[color:var(--surface-3)] px-1.5 py-0.5 rounded transition-colors truncate"
              >
                {currentRequest.name || 'Untitled Request'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <RequestPresence requestId={currentRequest?._id} />

          {currentRequest.creatorId?.name && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border-1)]">
              <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-[9px] font-bold text-white">
                {currentRequest.creatorId.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{currentRequest.creatorId.name}</span>
            </div>
          )}

          <button
            title="Manage Cookies"
            onClick={() => useUIStore.getState().openRightSidebarTab('cookies')}
            className="btn-ghost flex items-center justify-center p-1.5 opacity-70 hover:opacity-100 hover:bg-[color:var(--surface-3)] hover:text-[color:var(--accent)] transition-all rounded-md w-[27px] h-[27px]"
          >
            <Cookie size={16} />
          </button>

          <button
            title="Save Request"
            disabled={isSaving}
            onClick={async () => {
              if (isSaving) return;
              const r = await saveRequest();
              if (r?.success) toast.success('Saved');
              else toast.error(r?.error || 'Failed');
            }}
            className="btn-ghost flex items-center justify-center p-1.5 opacity-70 hover:opacity-100 hover:bg-[color:var(--surface-3)] transition-all rounded-md disabled:opacity-50 disabled:cursor-not-allowed w-[27px] h-[27px]"
          >
            {isSaving ? (
              <svg className="w-[15px] h-[15px] animate-spin text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Builder View */}
      <div className="flex-1 overflow-hidden">
        {renderBuilder()}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 bg-[var(--bg-primary)] p-10 text-center">
      <div className="w-16 h-16 rounded-[18px] bg-[var(--surface-2)] border border-[var(--border-1)] flex items-center justify-center">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[var(--text-muted)]">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">No request selected</h3>
        <p className="text-xs text-[color:var(--text-muted)] max-w-[240px]">Select a request from the sidebar to begin testing.</p>
      </div>
    </div>
  );
}

function SendButton({ onSend }) {
  const { isExecuting, cancelCurrentRequest } = useRequestStore();

  if (isExecuting) {
    return (
      <button
        onClick={() => cancelCurrentRequest && cancelCurrentRequest()}
        className="btn-primary relative flex items-center gap-1.5 px-3 h-8 rounded-md font-medium transition-all duration-150 active:scale-95 group min-w-[80px] justify-center !bg-danger/90 hover:!bg-danger border-none text-xs"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Cancel
      </button>
    );
  }

  return (
    <button
      onClick={onSend}
      className="btn-primary relative flex items-center gap-1.5 px-4 h-8 rounded-md font-medium transition-all duration-150 active:scale-95 group min-w-[80px] justify-center text-xs"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
      <span className="text-xs">Send</span>
      <span className="absolute -bottom-6 right-0 text-[10px] text-tx-muted hidden group-hover:block whitespace-nowrap">⌘ + Enter</span>
    </button>
  );
}
