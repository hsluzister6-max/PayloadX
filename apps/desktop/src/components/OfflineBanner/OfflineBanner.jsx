import { useState, useEffect } from 'react';
import { syncService } from '@/services/syncService';
import { localStorageService } from '@/services/localStorageService';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((event) => {
      if (event.type === 'online') {
        setIsOnline(true);
      } else if (event.type === 'offline') {
        setIsOnline(false);
      } else if (event.type === 'sync-start') {
        setIsSyncing(true);
      } else if (event.type === 'sync-complete') {
        setIsSyncing(false);
        updateStatus();
      } else if (event.type === 'change-queued') {
        updateStatus();
      }
    });

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const updateStatus = () => {
    const pending = localStorageService.getPendingChanges();
    setPendingCount(pending.length);
    setLastSync(localStorageService.get(localStorageService.KEYS.LAST_SYNC));
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never synced';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return date.toLocaleDateString();
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: isOnline ? '#238636' : '#F85149',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      {!isOnline && (
        <>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.357-1.357m0 0l-2.829-2.829m2.829 2.829L3 21m14.536-14.536A9 9 0 0121 12" />
          </svg>
          <span>You are offline. Changes will sync when connection is restored.</span>
        </>
      )}
      {isOnline && pendingCount > 0 && (
        <>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>
            {isSyncing ? `Syncing ${pendingCount} pending changes...` : `${pendingCount} changes pending sync`}
          </span>
          <button
            onClick={() => syncService.syncPendingChanges()}
            disabled={isSyncing}
            style={{
              marginLeft: '8px',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            Sync Now
          </button>
        </>
      )}
      <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.8 }}>
        Last sync: {formatLastSync()}
      </span>
    </div>
  );
}
