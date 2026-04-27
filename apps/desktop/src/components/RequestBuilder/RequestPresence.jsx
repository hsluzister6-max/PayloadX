import { useState } from 'react';
import { useSocketStore } from '@/store/socketStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Shows avatar bubbles of other users currently viewing the same request.
 * Renders a small tooltip on hover listing all active viewers.
 */
export default function RequestPresence({ requestId }) {
  const { requestViewers } = useSocketStore();
  const { user } = useAuthStore();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!requestId) return null;

  // Unique viewers by ID (one user might have multiple tabs/sockets)
  const uniqueViewers = [];
  const seenIds = new Set();
  
  (requestViewers[requestId] || []).forEach(v => {
    const userId = v._id || v.id;
    if (userId && userId !== user?._id && userId !== user?.id && !seenIds.has(userId)) {
      seenIds.add(userId);
      uniqueViewers.push(v);
    }
  });

  const viewers = uniqueViewers;

  if (viewers.length === 0) return null;

  const MAX_SHOWN = 3;
  const shown = viewers.slice(0, MAX_SHOWN);
  const overflow = viewers.length - MAX_SHOWN;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Avatar stack */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((viewer, i) => (
          <Avatar key={viewer.socketId || viewer._id || i} user={viewer} index={i} />
        ))}
        {overflow > 0 && (
          <div
            title={`+${overflow} more`}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--surface-3)',
              border: '1.5px solid var(--border-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginLeft: -4,
              zIndex: MAX_SHOWN + 1,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-1)',
            borderRadius: '10px',
            padding: '10px 12px',
            minWidth: '160px',
            maxWidth: '220px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Also viewing
          </div>
          {viewers.map((viewer, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: i < viewers.length - 1 ? '6px' : 0 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: stringToColor(viewer.name || '?'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {(viewer.name || '?')[0].toUpperCase()}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {viewer.name || viewer.email || 'Unknown'}
              </span>
              <span style={{ fontSize: '10px', color: '#22c55e', marginLeft: 'auto', flexShrink: 0 }}>● live</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ user, index }) {
  return (
    <div
      title={user.name || user.email || 'Teammate'}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: stringToColor(user.name || '?'),
        border: '1.5px solid var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
        fontWeight: 700,
        color: '#fff',
        marginLeft: index === 0 ? 0 : -4,
        zIndex: 10 - index,
        flexShrink: 0,
        cursor: 'default',
      }}
    >
      {(user.name || '?')[0].toUpperCase()}
    </div>
  );
}

/** Deterministic color from a string */
function stringToColor(str) {
  const PALETTE = [
    '#7c3aed', '#2563eb', '#db2777', '#d97706',
    '#059669', '#dc2626', '#0891b2', '#9333ea',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
