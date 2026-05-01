import { useEffect } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import toast from 'react-hot-toast';

/**
 * Global Keyboard Shortcuts Manager
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Send Request (Cmd/Ctrl + Enter)
      if (cmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('request-send-shortcut'));
        return;
      }

      // 2. Save Request (Cmd/Ctrl + S)
      if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();
        const { currentRequest, saveRequest, isSaving } = useRequestStore.getState();
        if ((currentRequest?._id || currentRequest?.collectionId) && !isSaving) {
          saveRequest().then(r => r?.success && toast.success('Saved'));
        }
        return;
      }

      // 3. New Request (Cmd/Ctrl + N)
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        useRequestStore.getState().newRequest();
        toast.success('New Request');
        return;
      }

      // 4. Close Tab (Cmd/Ctrl + W)
      if (cmdOrCtrl && e.key === 'w') {
        e.preventDefault();
        const { activeTabId, closeTab } = useRequestStore.getState();
        if (activeTabId) closeTab(activeTabId);
        return;
      }

      // 5. Switch Tabs (Cmd/Ctrl + Tab)
      if (cmdOrCtrl && e.key === 'Tab') {
        e.preventDefault();
        useRequestStore.getState().switchTab(e.shiftKey ? -1 : 1);
        return;
      }

      // 6. Reopen closed tab (Cmd/Ctrl + Shift + T)
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        useRequestStore.getState().reopenLastClosedTab();
        return;
      }

      // 7. Duplicate Request (Cmd/Ctrl + D)
      if (cmdOrCtrl && e.key === 'd') {
        e.preventDefault();
        const { currentRequest, duplicateRequest } = useRequestStore.getState();
        if (currentRequest) {
          duplicateRequest(currentRequest).then(() => toast.success('Request duplicated'));
        }
        return;
      }

      // 8. Beautify / Minify (Cmd/Ctrl + B)
      if (cmdOrCtrl && e.key === 'b') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('editor-beautify-shortcut', { 
          detail: { minify: e.shiftKey } 
        }));
        return;
      }

      // 9. Search (Cmd/Ctrl + K or Cmd/Ctrl + Shift + F)
      if (cmdOrCtrl && (e.key === 'k' || (e.shiftKey && e.key === 'f'))) {
        e.preventDefault();
        const searchInput = document.querySelector('.sdbv2-search-input') || document.querySelector('.sidebar-search-input');
        searchInput?.focus();
        return;
      }

      // 10. Panels
      // Console (Cmd/Ctrl + Alt + C)
      if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        useUIStore.getState().openRightSidebarTab('console');
        return;
      }
      // Environments (Cmd/Ctrl + Alt + E)
      if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useUIStore.getState().openRightSidebarTab('environment');
        return;
      }
      // Runner (Cmd/Ctrl + Alt + R)
      if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        toast('Runner feature coming soon!', { icon: '🚀' });
        return;
      }
      // Clear Console (Cmd/Ctrl + Alt + L)
      if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('console-clear-shortcut'));
        toast.success('Console cleared');
        return;
      }
      // History (Cmd/Ctrl + H)
      if (cmdOrCtrl && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        useUIStore.getState().setActiveV2Nav('history');
        return;
      }

      // 11. Navigation (Alt + Arrow Keys)
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        // e.preventDefault(); // Don't prevent default, let browser/tauri handle history
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
