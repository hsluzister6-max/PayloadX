import React, { useState, useEffect, useRef } from 'react';
import { useSyncQueueStore } from '@/store/syncQueueStore';
import { useSocketStore } from '@/store/socketStore';
import { useConnectivityStore } from '@/store/connectivityStore';

export default function SyncStatusTag() {
  const { queue, isSyncing } = useSyncQueueStore();
  const { isConnected: isSocketConnected } = useSocketStore();
  const { hasInternet, isBackendReachable, startHeartbeat } = useConnectivityStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    startHeartbeat();
  }, [startHeartbeat]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Determine status config
  let statusConfig = {
    color: 'var(--error)',
    bg: 'rgba(var(--error-rgb, 248, 81, 73), 0.1)',
    label: `Offline (${queue.length})`,
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 00-12.728 0M15.536 8.464a5 5 0 00-7.072 0M12 11.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
      </svg>
    )
  };

  // If no internet, show Offline instantly
  if (!hasInternet) {
    statusConfig = {
      color: 'var(--error)',
      bg: 'rgba(var(--error-rgb, 248, 81, 73), 0.1)',
      label: `Offline (${queue.length})`,
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 10-12.728 0" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
        </svg>
      )
    };
  } else if (!isBackendReachable) {
    statusConfig = {
      color: 'var(--error)',
      bg: 'rgba(var(--error-rgb, 248, 81, 73), 0.1)',
      label: `Server Down (${queue.length})`,
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    };
  } else {
    // We have internet AND backend is reachable
    statusConfig = {
      color: 'var(--success)',
      bg: 'rgba(var(--success-rgb, 63, 185, 80), 0.1)',
      label: 'Online',
      icon: (
        <svg className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isSyncing ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          )}
        </svg>
      )
    };
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
        style={{ color: statusConfig.color, backgroundColor: statusConfig.bg, border: `1px solid ${statusConfig.color}40` }}
        title="View Sync Queue"
      >
        {statusConfig.icon}
        {statusConfig.label}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface-1 border border-[var(--border-2)] rounded-lg shadow-glass overflow-hidden z-[9999] flex flex-col">
          <div className="px-3 py-2 bg-surface-2 border-b border-[var(--border-2)] flex justify-between items-center">
            <span className="text-[11px] font-bold text-tx-primary">Sync Queue</span>
            <span className="text-[10px] text-surface-400">{queue.length} pending</span>
          </div>

          <div className="overflow-y-auto max-h-64 p-1 flex flex-col gap-1">
            {queue.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-surface-400">Queue is empty</div>
            ) : (
              queue.map((item) => (
                <div key={item.id} className="p-2 bg-surface-2 rounded border border-[var(--border-1)] flex items-start gap-2">
                  <span className="text-[9px] font-bold uppercase mt-0.5" style={{ color: 'var(--brand-400)' }}>
                    {item.method}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[11px] text-tx-primary truncate">
                      {item.resourceType === 'request' ? 'Request Update' :
                        item.resourceType === 'collection' ? 'Collection Update' :
                          item.resourceType === 'environment' ? 'Environment Update' :
                            item.resourceType === 'project' ? 'Project Update' :
                              item.resourceType === 'team' ? 'Team Update' :
                                item.url}
                    </span>
                    <span className="text-[9px] text-surface-400 truncate opacity-70 font-mono">
                      {new URL(item.url, 'http://localhost').pathname}
                    </span>
                  </div>
                  {item.retries > 0 && (
                    <span className="text-[9px] text-danger mt-1" title="Failed Retries">
                      {item.retries}x
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
