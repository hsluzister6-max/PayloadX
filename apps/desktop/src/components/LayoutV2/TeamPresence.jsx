import { useState } from 'react';
import { useSocketStore } from '@/store/socketStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Shows avatar bubbles of team members currently online in the team room.
 * Renders a small tooltip on hover listing all online members.
 */
export default function TeamPresence() {
  const { roomMembers } = useSocketStore();
  const { user } = useAuthStore();
  const [showTooltip, setShowTooltip] = useState(false);

  // Filter out the current user and unique by ID (one user might have multiple tabs/sockets)
  const uniqueMembers = [];
  const seenIds = new Set();
  
  roomMembers.forEach(m => {
    const userId = m._id || m.id;
    if (userId && userId !== user?._id && userId !== user?.id && !seenIds.has(userId)) {
      seenIds.add(userId);
      uniqueMembers.push(m);
    }
  });

  const onlineTeammates = uniqueMembers;

  if (onlineTeammates.length === 0) return null;

  const MAX_SHOWN = 4;
  const shown = onlineTeammates.slice(0, MAX_SHOWN);
  const overflow = onlineTeammates.length - MAX_SHOWN;

  return (
    <div
      className="flex items-center gap-1 relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center -space-x-1.5">
        {shown.map((member, i) => (
          <div
            key={member.socketId || i}
            title={`${member.name || member.email} (Online)`}
            className="w-5 h-5 rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center text-[8px] font-bold text-white shadow-sm transition-transform hover:scale-110 hover:z-20"
            style={{ 
              background: stringToColor(member.name || member.email || '?'),
              zIndex: 10 - i 
            }}
          >
            {(member.name || member.email || '?')[0].toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="w-5 h-5 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--surface-3)] flex items-center justify-center text-[8px] font-bold text-[var(--text-muted)] shadow-sm z-0"
          >
            +{overflow}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-xl shadow-glass z-[100] min-w-[160px] animate-in fade-in slide-in-from-top-1">
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Online now</span>
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          </div>
          <div className="flex flex-col gap-2">
            {onlineTeammates.map((member, i) => (
              <div key={member.socketId || i} className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: stringToColor(member.name || member.email || '?') }}
                >
                  {(member.name || member.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {member.name || 'Unknown'}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] truncate">
                    {member.email}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
