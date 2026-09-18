import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { trackSectionView } from '@/services/analyticsService';

const SECTION_MAP = {
  dashboard: 'dashboard',
  collections: 'collections',
  workflow: 'workflow',
  history: 'history',
  environments: 'environments',
  docs: 'docs',
  profile: 'profile',
  admin: 'admin',
};

/**
 * Tracks section views + keeps platform presence warm for live-user counts.
 */
export default function useAnalyticsTracker() {
  const activeV2Nav = useUIStore((s) => s.activeV2Nav);
  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const isConnected = useSocketStore((s) => s.isConnected);
  const lastEmitted = useRef('');

  useEffect(() => {
    const section = SECTION_MAP[activeV2Nav] || activeV2Nav || 'app';
    trackSectionView(section);

    if (socket && isConnected && user) {
      const key = `${user._id || user.id}:${section}`;
      if (key !== lastEmitted.current) {
        lastEmitted.current = key;
        socket.emit('platform_presence', {
          user: {
            id: user._id || user.id,
            email: user.email,
            name: user.name,
          },
          section,
        });
      } else {
        socket.emit('platform_section', { section });
      }
    }
  }, [activeV2Nav, socket, isConnected, user]);

  // Heartbeat presence every 60s while connected
  useEffect(() => {
    if (!socket || !isConnected || !user) return undefined;
    const tick = () => {
      const section = SECTION_MAP[useUIStore.getState().activeV2Nav] || 'app';
      socket.emit('platform_presence', {
        user: {
          id: user._id || user.id,
          email: user.email,
          name: user.name,
        },
        section,
      });
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [socket, isConnected, user]);
}
