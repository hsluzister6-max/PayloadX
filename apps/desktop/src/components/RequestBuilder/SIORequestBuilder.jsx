import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSIOStore } from '@/store/sioStore';
import { useRequestStore } from '@/store/requestStore';
import { useEnvironmentStore } from '@/store/environmentStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

import ParamsTab from './tabs/ParamsTab';
import HeadersTab from './tabs/HeadersTab';
import AuthTab from './tabs/AuthTab';
import JsonEditor from './tabs/JsonEditor';

const STATUS_CONFIG = {
  idle: { label: 'Idle', color: 'var(--text-muted)', bg: 'transparent' },
  connecting: { label: 'Connecting…', color: '#f0883e', bg: 'rgba(240,136,62,0.1)' },
  connected: { label: 'Connected', color: '#3fb950', bg: 'rgba(63,185,80,0.1)' },
  disconnected: { label: 'Disconnected', color: 'var(--text-muted)', bg: 'transparent' },
  error: { label: 'Error', color: '#f85149', bg: 'rgba(248,81,73,0.1)' },
};

const LOG_COLOR = {
  sent: '#38bdf8',
  received: '#3fb950',
  system: 'var(--text-muted)',
  error: '#f85149',
};

export default function SIORequestBuilder() {
  const { currentRequest, updateField, saveRequest, noActiveRequest } = useRequestStore();
  const { resolveVariables } = useEnvironmentStore();
  const { connect, disconnect, emit, clearLogs, connectionStatus, logs } = useSIOStore();
  const eventName = currentRequest.sioEvent || 'message';
  const message = currentRequest.body?.raw || '';

  const [isEditingName, setIsEditingName] = useState(false);
  const [showProtocolDropdown, setShowProtocolDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('query');
  const logEndRef = useRef(null);

  const PROTOCOLS = [
    { id: 'http', label: 'HTTP (REST)', icon: '🌐' },
    { id: 'ws', label: 'WebSocket (Raw)', icon: '⚡' },
    { id: 'socketio', label: 'Socket.IO', icon: '⬢' },
  ];

  const requestId = currentRequest?._id || 'unsaved';
  const status = connectionStatus[requestId] || 'idle';
  const currentLogs = logs[requestId] || [];
  const statusConfig = STATUS_CONFIG[status];
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentLogs.length]);

  const handleConnect = useCallback(() => {
    const url = currentRequest.url?.trim();
    if (!url) {
      toast.error('Enter a Socket.IO URL first');
      return;
    }

    // Resolve environment variables
    const resolvedUrl = resolveVariables(url);

    // Map Headers to extraHeaders
    const extraHeaders = {};
    (currentRequest.headers || []).forEach(h => {
      if (h.enabled && h.key) {
        extraHeaders[h.key] = resolveVariables(h.value);
      }
    });

    // Map Params to Query
    const query = {};
    (currentRequest.params || []).forEach(p => {
      if (p.enabled && p.key) {
        query[p.key] = resolveVariables(p.value);
      }
    });

    // Handle Auth
    let auth = {};
    const { type, bearer, basic, apikey } = currentRequest.auth || {};
    if (type === 'bearer' && bearer?.token) {
      auth = { token: resolveVariables(bearer.token) };
    } else if (type === 'basic' && basic?.username) {
      auth = { username: resolveVariables(basic.username), password: resolveVariables(basic.password) };
    } else if (type === 'apikey' && apikey?.key) {
      auth = { [apikey.key]: resolveVariables(apikey.value) };
    }

    connect(requestId, resolvedUrl, {
      extraHeaders,
      query,
      auth
    });
  }, [currentRequest, requestId, resolveVariables, connect]);

  const handleDisconnect = useCallback(() => {
    disconnect(requestId);
  }, [requestId, disconnect]);

  const handleEmit = useCallback(() => {
    if (!eventName.trim()) {
      toast.error('Event name is required');
      return;
    }
    const success = emit(requestId, eventName, message);
    if (!success) {
      toast.error('Failed to emit. Check your JSON format for multi-args.');
    }
  }, [message, eventName, requestId, emit]);

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleEmit();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const TABS = [
    { id: 'query', label: 'Query Params' },
    { id: 'headers', label: 'Headers' },
    { id: 'auth', label: 'Auth' },
  ];

  if (noActiveRequest) {
    return (
      <div className="ws-empty-state">
        <div className="ws-empty-icon">⬢</div>
        <h2 className="ws-empty-title">Socket.IO Explorer</h2>
        <p className="ws-empty-sub">Select a Socket.IO request from the sidebar or create a new one to start testing.</p>
      </div>
    );
  }

  return (
    <div className="ws-builder" onKeyDown={handleKeyDown}>

      {/* URL Bar */}
      <div className="ws-url-bar px-3 py-2 bg-[color:var(--surface-1)] border-b border-[color:var(--border-1)] flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 p-1">
          <span className="text-[10px] font-bold text-[#f0883e] bg-[#f0883e]/10 px-1.5 py-0.5 rounded">SIO</span>
          <input
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-[color:var(--text-primary)]"
            placeholder="http://localhost:3000"
            value={currentRequest.url}
            onChange={(e) => updateField('url', e.target.value)}
            disabled={isConnected || isConnecting}
          />
        </div>

        {/* Status Indicator */}
        {(isConnected || isConnecting || status === 'error') && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[color:var(--surface-2)] border border-[color:var(--border-1)] mr-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.5)] animate-pulse' : isConnecting ? 'bg-[#f0883e] animate-pulse' : 'bg-[#f85149]'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80" style={{ color: statusConfig.color }}>
              {statusConfig.label}
            </span>
          </div>
        )}

        <button
          className={`${isConnected || isConnecting ? 'bg-surface-3 hover:bg-surface-4' : 'bg-[color:var(--accent)] hover:brightness-110'} text-white text-[11px] font-bold px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5`}
          onClick={isConnected || isConnecting ? handleDisconnect : handleConnect}
        >
          {isConnected || isConnecting ? (
            <><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> Disconnect</>
          ) : (
            <><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Connect</>
          )}
        </button>
      </div>

      <div className="ws-main flex-1 flex flex-col overflow-hidden">
        {/* Connection Tabs */}
        <div className="border-b border-[color:var(--border-1)] bg-[color:var(--surface-1)]">
          <div className="flex px-3">
            <button
              onClick={() => setActiveTab('query')}
              className={`px-4 py-2 text-[11px] font-medium border-b-2 transition-all ${['query', 'headers', 'auth'].includes(activeTab) ? 'border-[color:var(--accent)] text-[color:var(--text-primary)]' : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'}`}
            >
              Handshake
            </button>
            {isConnected && (
              <button
                className="px-4 py-2 text-[11px] font-medium border-b-2 border-transparent text-[#3fb950] flex items-center gap-1.5"
              >
                <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-pulse" />
                Active Session
              </button>
            )}
          </div>
        </div>

        {/* Handshake Config (Query, Headers, Auth) */}
        {!isConnected && !isConnecting && (
          <div className="border-b border-[color:var(--border-1)]">
            <div className="flex px-3 pt-1 bg-[color:var(--surface-2)]">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-[10px] font-medium border-b-2 transition-all ${activeTab === tab.id ? 'border-[color:var(--accent)] text-[color:var(--text-primary)]' : 'border-transparent text-[color:var(--text-muted)] hover:text-tx-secondary'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="max-h-[180px] overflow-y-auto bg-[color:var(--surface-2)]">
              {activeTab === 'query' && <ParamsTab />}
              {activeTab === 'headers' && <HeadersTab />}
              {activeTab === 'auth' && <AuthTab />}
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Emitter Side */}
          <div className="w-[40%] border-r border-[color:var(--border-1)] flex flex-col pt-3">
            <div className="px-3 mb-3">
              <div className="text-[10px] font-bold text-[color:var(--text-muted)] uppercase mb-2">Emit Event</div>
              <input
                className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-1)] rounded px-2 py-1.5 text-[12px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent)]"
                placeholder="event name (e.g. chat)"
                value={eventName}
                onChange={(e) => updateField('sioEvent', e.target.value)}
                disabled={!isConnected}
              />
            </div>
            <div className="flex-1 px-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] font-bold text-[color:var(--text-muted)] uppercase">Arguments</div>
                <span className="text-[9px] text-[color:var(--text-muted)] opacity-60">Use JSON array for multiple args</span>
              </div>
              <div className="flex-1 overflow-hidden border border-[color:var(--border-1)] rounded-lg">
                <JsonEditor
                  value={message}
                  onChange={(val) => updateField('body', { ...currentRequest.body, raw: val })}
                  className="h-full border-none"
                />
              </div>
              <div className="py-3">
                <button
                  disabled={!isConnected}
                  onClick={handleEmit}
                  className="w-full bg-[color:var(--surface-3)] hover:bg-[color:var(--accent)] hover:text-white text-[color:var(--text-primary)] font-bold py-2 rounded transition-all disabled:opacity-50"
                >
                  Send Event
                </button>
              </div>
            </div>
          </div>

          {/* Log Side */}
          <div className="flex-1 flex flex-col bg-[color:var(--surface-2)]">
            <div className="px-3 py-2 border-b border-[color:var(--border-1)] flex justify-between items-center">
              <span className="text-[10px] font-bold text-[color:var(--text-muted)] uppercase">Live Event Stream</span>
              <button className="ws-clear-btn" onClick={() => clearLogs(requestId)}>Clear Logs</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono scrollbar-custom">
              {currentLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[11px] mt-2">Waiting for events...</span>
                </div>
              ) : (
                currentLogs.map(log => (
                  <div key={log.id} className="mb-2 text-[11px] border-l-2 pl-2" style={{ borderColor: LOG_COLOR[log.type] }}>
                    <div className="flex justify-between opacity-60 mb-1">
                      <span className="uppercase font-bold text-[9px] tracking-wider">
                        {log.type} {log.event && `• [${log.event}]`}
                      </span>
                      <span>{formatTime(log.timestamp)}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all opacity-90 leading-relaxed">{log.data}</pre>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
