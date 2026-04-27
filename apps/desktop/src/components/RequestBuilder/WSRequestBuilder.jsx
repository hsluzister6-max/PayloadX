import { useState, useEffect, useRef, useCallback } from 'react';
import { useWSStore } from '@/store/wsStore';
import { useRequestStore } from '@/store/requestStore';
import { useEnvironmentStore } from '@/store/environmentStore';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  idle: { label: 'Idle', color: 'var(--text-muted)', bg: 'transparent' },
  connecting: { label: 'Connecting…', color: '#f0883e', bg: 'rgba(240,136,62,0.1)' },
  connected: { label: 'Connected', color: '#3fb950', bg: 'rgba(63,185,80,0.1)' },
  disconnected: { label: 'Disconnected', color: 'var(--text-muted)', bg: 'transparent' },
  error: { label: 'Error', color: '#f85149', bg: 'rgba(248,81,73,0.1)' },
};

const LOG_ICON = {
  sent: '↑',
  received: '↓',
  system: '●',
  error: '✕',
};

const LOG_COLOR = {
  sent: '#38bdf8',
  received: '#3fb950',
  system: 'var(--text-muted)',
  error: '#f85149',
};

export default function WSRequestBuilder() {
  const { currentRequest, updateField, saveRequest, noActiveRequest, newRequest } = useRequestStore();
  const { resolveVariables } = useEnvironmentStore();
  const { connect, disconnect, sendMessage, clearLogs, getStatus, getLogs, connectionStatus, logs } = useWSStore();

  const message = currentRequest.body?.raw || '';
  const [isEditingName, setIsEditingName] = useState(false);
  const [showProtocolDropdown, setShowProtocolDropdown] = useState(false);
  const logEndRef = useRef(null);
  const textareaRef = useRef(null);

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

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentLogs.length]);

  const handleConnect = useCallback(() => {
    const url = currentRequest.url?.trim();
    if (!url) {
      toast.error('Enter a WebSocket URL first');
      return;
    }
    const resolvedUrl = resolveVariables(url);
    // Ensure ws:// or wss:// prefix
    let wsUrl = resolvedUrl;
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      if (wsUrl.startsWith('https://')) {
        wsUrl = wsUrl.replace('https://', 'wss://');
      } else if (wsUrl.startsWith('http://')) {
        wsUrl = wsUrl.replace('http://', 'ws://');
      } else {
        wsUrl = 'wss://' + wsUrl;
      }
    }
    connect(requestId, wsUrl);
  }, [currentRequest.url, requestId, resolveVariables, connect]);

  const handleDisconnect = useCallback(() => {
    disconnect(requestId);
  }, [requestId, disconnect]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    const success = sendMessage(requestId, message);
    if (success) {
      // Clear message after sending if needed, or keep it for reuse. 
      // Most users prefer keeping it for repeated sends in WS.
      // But we'll follow the previous local state behavior of clearing if it was there.
      // Since it's bound to store, clearing it will delete it from store.
      // We'll keep it so it stays persistent.
      textareaRef.current?.focus();
    }
  }, [message, requestId, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    // Ctrl/Cmd + S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveRequest().then((r) => {
        if (r?.success) toast.success('Saved');
        else if (r?.error) toast.error(r.error);
      });
    }
  }, [handleSend, saveRequest]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  // ── Empty State ──

  return (
    <div className="ws-builder" onKeyDown={handleKeyDown}>

      {/* ── URL Bar ── */}
      <div className="ws-url-bar px-3 py-2 bg-[color:var(--surface-1)] border-b border-[color:var(--border-1)] flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 p-1">
          <span className="text-[10px] font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-1.5 py-0.5 rounded">WS</span>
          <input
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-[color:var(--text-primary)]"
            placeholder="wss://echo.websocket.org"
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

        {isConnected || isConnecting ? (
          <button className="ws-disconnect-btn flex items-center gap-1.5 !rounded-md px-4 py-1.5 text-[11px] font-bold transition-all bg-surface-3 hover:bg-surface-4" onClick={handleDisconnect} disabled={!isConnected && !isConnecting}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            Disconnect
          </button>
        ) : (
          <button className="ws-connect-btn flex items-center gap-1.5 !rounded-md px-4 py-1.5 text-[11px] font-bold transition-all bg-[color:var(--accent)] hover:brightness-110 text-white" onClick={handleConnect}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Connect
          </button>
        )}
      </div>

      {isConnected && (
        <div className="bg-[#3fb950]/5 border-b border-[#3fb950]/10 px-4 py-1 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-pulse" />
          <span className="text-[10px] font-medium text-[#3fb950] uppercase tracking-widest">Active WebSocket Session</span>
        </div>
      )}

      {/* ── Main Area: Split between Composer & Log ── */}
      <div className="ws-main flex-1 flex flex-col overflow-hidden">
        {/* ── Message Composer ── */}
        <div className="ws-composer">
          <textarea
            ref={textareaRef}
            className="ws-message-input"
            placeholder={isConnected ? '{"action":"ping","data":"hello"}' : 'Connect first to send messages…'}
            value={message}
            onChange={(e) => updateField('body', { ...currentRequest.body, raw: e.target.value })}
            disabled={!isConnected}
          />
          <div className="ws-composer-footer">
            <button
              className="ws-send-btn"
              onClick={handleSend}
              disabled={!isConnected || !message.trim()}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>
              Send
            </button>
          </div>
        </div>

        {/* ── Event Log ── */}
        <div className="ws-log-panel">
          <div className="ws-log-header">
            <span className="ws-section-label">
              Event Log
              {currentLogs.length > 0 && <span className="ws-log-count">{currentLogs.length}</span>}
            </span>
            <button className="ws-clear-btn" onClick={() => clearLogs(requestId)} title="Clear log">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
          <div className="ws-log-body">
            {currentLogs.length === 0 ? (
              <div className="ws-log-empty">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Events will appear here once connected</span>
              </div>
            ) : (
              currentLogs.map((log) => (
                <div key={log.id} className={`ws-log-entry ws-log-entry--${log.type}`}>
                  <span className="ws-log-icon" style={{ color: LOG_COLOR[log.type] }}>
                    {LOG_ICON[log.type]}
                  </span>
                  <span className="ws-log-time">{formatTime(log.timestamp)}</span>
                  <pre className="ws-log-data" style={{ color: log.type === 'error' ? '#f85149' : undefined }}>
                    {log.data}
                  </pre>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
