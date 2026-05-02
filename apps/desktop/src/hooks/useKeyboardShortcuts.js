import { useEffect } from 'react';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { toast } from '@/store/toastStore';

/**
 * Cross-platform modifier key detection.
 * Uses userAgentData (modern) with navigator.userAgent fallback.
 * macOS uses Cmd (metaKey), Windows/Linux use Ctrl (ctrlKey).
 */
const isMac = () => {
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform.toLowerCase().includes('mac');
  }
  return /mac/i.test(navigator.userAgent) && !/iphone|ipad/i.test(navigator.userAgent);
};

const cmdOrCtrl = (e) => (isMac() ? e.metaKey : e.ctrlKey);

/**
 * Global Keyboard Shortcuts
 *
 * Shortcut Map:
 * ─────────────────────────────────────────────
 *  Action                   Mac          Win/Linux
 * ─────────────────────────────────────────────
 *  Send Request             ⌘ + Enter   Ctrl + Enter
 *  Save Request             ⌘ + S       Ctrl + S
 *  New Request              ⌘ + N       Ctrl + N
 *  Close Tab                ⌘ + W       Ctrl + W
 *  Next Tab                 ⌘ + ]       Ctrl + ]
 *  Prev Tab                 ⌘ + [       Ctrl + [
 *  Beautify Body            ⌘ + B       Ctrl + B
 *  Search / Focus Search    ⌘ + K       Ctrl + K
 *  Global Search            ⌘ + ⇧ + F  Ctrl + Shift + F
 *  History                  ⌘ + ⇧ + H  Ctrl + Shift + H
 *  Toggle Console           ⌘ + ⌥ + C  Ctrl + Alt + C
 *  Toggle Env Panel         ⌘ + ⌥ + E  Ctrl + Alt + E
 *  Clear Console            ⌘ + ⌥ + L  Ctrl + Alt + L
 *  Toggle Sidebar           ⌘ + \       Ctrl + \
 *  Escape / Close modal     Esc
 * ─────────────────────────────────────────────
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = cmdOrCtrl(e);

      // ── Guard: skip if typing inside an input/textarea/contenteditable ──
      const tag = document.activeElement?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      // ── 1. Send Request (Cmd/Ctrl + Enter) — works everywhere ──
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('request-send-shortcut'));
        return;
      }

      // ── 2. Save Request (Cmd/Ctrl + S) ──
      if (mod && e.key === 's') {
        e.preventDefault();
        const { currentRequest, saveRequest, isSaving } = useRequestStore.getState();
        if ((currentRequest?._id || currentRequest?.collectionId) && !isSaving) {
          saveRequest().then(r => r?.success && toast.success('Request saved'));
        }
        return;
      }

      // ── Skip remaining shortcuts when inside an input ──
      if (isEditable) return;

      // ── 3. New Request (Cmd/Ctrl + N) ──
      if (mod && e.key === 'n') {
        e.preventDefault();
        useRequestStore.getState().newRequest();
        return;
      }

      // ── 4. Close Active Tab (Cmd/Ctrl + W) ──
      if (mod && e.key === 'w') {
        e.preventDefault();
        const { activeTabId, closeTab } = useRequestStore.getState();
        if (activeTabId) closeTab(activeTabId);
        return;
      }

      // ── 5. Next Tab (Cmd/Ctrl + ]) ──
      if (mod && e.key === ']') {
        e.preventDefault();
        const { openTabs, activeTabId, setActiveTabId } = useRequestStore.getState();
        if (openTabs.length < 2) return;
        const idx = openTabs.findIndex(t => t.id === activeTabId);
        const nextIdx = (idx + 1) % openTabs.length;
        setActiveTabId(openTabs[nextIdx].id);
        return;
      }

      // ── 6. Previous Tab (Cmd/Ctrl + [) ──
      if (mod && e.key === '[') {
        e.preventDefault();
        const { openTabs, activeTabId, setActiveTabId } = useRequestStore.getState();
        if (openTabs.length < 2) return;
        const idx = openTabs.findIndex(t => t.id === activeTabId);
        const prevIdx = (idx - 1 + openTabs.length) % openTabs.length;
        setActiveTabId(openTabs[prevIdx].id);
        return;
      }

      // ── 7. Beautify Body (Cmd/Ctrl + B) ──
      if (mod && e.key === 'b') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('editor-beautify-shortcut', {
          detail: { minify: e.shiftKey }
        }));
        return;
      }

      // ── 8. Focus Global Search (Cmd/Ctrl + K) ──
      // Note: TopBarV2 also listens for this — handled there for focus.
      // We prevent default here to stop browser's address-bar shortcut.
      if (mod && e.key === 'k') {
        e.preventDefault();
        // TopBarV2 handles actual focus via its own listener
        return;
      }

      // ── 9. Global Search (Cmd/Ctrl + Shift + F) ──
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.v2-search-input') ||
          document.querySelector('.sdbv2-search-input');
        searchInput?.focus();
        return;
      }

      // ── 10. History (Cmd/Ctrl + Shift + H) ──
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        useUIStore.getState().setActiveV2Nav('history');
        return;
      }

      // ── 11. Toggle Console (Cmd/Ctrl + Alt + C) ──
      if (mod && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        useUIStore.getState().openRightSidebarTab('console');
        return;
      }

      // ── 12. Toggle Env Panel (Cmd/Ctrl + Alt + E) ──
      if (mod && e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useUIStore.getState().openRightSidebarTab('environment');
        return;
      }

      // ── 13. Clear Console (Cmd/Ctrl + Alt + L) ──
      if (mod && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('console-clear-shortcut'));
        toast.success('Console cleared');
        return;
      }

      // ── 14. Toggle Sidebar (Cmd/Ctrl + \) ──
      if (mod && e.key === '\\') {
        e.preventDefault();
        useUIStore.getState().toggleSidebarV2();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
