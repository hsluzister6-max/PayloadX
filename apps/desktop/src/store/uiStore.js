import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Themes:
 *   dark | light   — classic solid themes
 *   nebula-dark    — video + glass morphism (dark only)
 */
export const useUIStore = create(
  persist(
    (set) => ({
      sidebarWidth: 260,
      responseHeight: 340,
      isSidebarCollapsed: false,
      showImportModal: false,
      showTeamModal: false,
      showProjectModal: false,
      showCollectionModal: false,
      showFolderModal: false,
      folderModalData: null,
      showEnvironmentPanel: false,
      rightSidebarOpen: false,
      rightSidebarActiveTab: 'environment',
      rightSidebarWidth: 420,
      showInviteModal: false,
      showConfirmDialog: false,
      showEditNameModal: false,
      showSessionModal: false,
      showUnsavedModal: false,
      confirmDialogConfig: null,
      editNameModalConfig: null,
      unsavedModalConfig: null,
      contextMenu: null,
      isLoading: false,
      activeMainTab: 'request',
      theme: 'nebula-dark', // 'dark' | 'light' | 'nebula-dark'
      layoutVersion: 'v2',
      sidebarV2Open: true,
      workspaceOrientation: 'vertical',
      activeV2Nav: 'collections',

      setSidebarWidth: (w) => set({ sidebarWidth: Math.max(200, Math.min(400, w)) }),
      setResponseHeight: (h) => set({ responseHeight: Math.max(150, Math.min(600, h)) }),
      toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
      setShowImportModal: (v) => set({ showImportModal: v }),
      setShowTeamModal: (v) => set({ showTeamModal: v }),
      setShowProjectModal: (v) => set({ showProjectModal: v }),
      setShowCollectionModal: (v) => set({ showCollectionModal: v }),
      setShowFolderModal: (v, data = null) => set({ showFolderModal: v, folderModalData: data }),
      setShowEnvironmentPanel: (v) => set({ showEnvironmentPanel: v }),

      setRightSidebarOpen: (v) => set({ rightSidebarOpen: v }),
      setRightSidebarActiveTab: (v) => set({ rightSidebarActiveTab: v }),
      setRightSidebarWidth: (w) => set({ rightSidebarWidth: Math.max(300, Math.min(800, w)) }),
      toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
      openRightSidebarTab: (tab) => set({ rightSidebarActiveTab: tab, rightSidebarOpen: true }),

      setShowInviteModal: (v) => set({ showInviteModal: v }),
      setShowConfirmDialog: (v, config = null) => set({ showConfirmDialog: v, confirmDialogConfig: config }),
      setShowEditNameModal: (v, config = null) => set({ showEditNameModal: v, editNameModalConfig: config }),
      setShowUnsavedModal: (v, config = null) => set({ showUnsavedModal: v, unsavedModalConfig: config }),
      setShowSessionModal: (v) => set({ showSessionModal: v }),
      setContextMenu: (config) => set({ contextMenu: config }),
      closeContextMenu: () => set({ contextMenu: null }),
      setIsLoading: (v) => set({ isLoading: v }),
      setActiveMainTab: (v) => set({ activeMainTab: v }),
      setActiveV2Nav: (v) => set({ activeV2Nav: v }),
      setLayoutVersion: (v) => set({ layoutVersion: v }),

      setTheme: (theme) => {
        // Nebula is dark-only — coerce any legacy light nebula value
        if (theme === 'nebula-light' || theme === 'nebula') {
          set({ theme: 'nebula-dark' });
          return;
        }
        set({ theme });
      },

      /** Toggle light ↔ dark for classic themes only. Nebula stays dark. */
      toggleTheme: () =>
        set((s) => {
          if (isNebulaTheme(s.theme)) return { theme: 'nebula-dark' };
          return { theme: s.theme === 'dark' ? 'light' : 'dark' };
        }),

      /** Nebula on/off — Nebula is always dark. */
      toggleNebula: () =>
        set((s) => {
          if (isNebulaTheme(s.theme)) {
            return { theme: 'dark' };
          }
          return { theme: 'nebula-dark' };
        }),

      toggleLayout: () =>
        set((s) => ({ layoutVersion: s.layoutVersion === 'v1' ? 'v2' : 'v1' })),

      toggleSidebarV2: () =>
        set((s) => ({ sidebarV2Open: !s.sidebarV2Open })),

      toggleOrientation: () =>
        set((s) => ({
          workspaceOrientation: s.workspaceOrientation === 'vertical' ? 'horizontal' : 'vertical',
        })),

      reset: () => {
        set({
          showImportModal: false,
          showTeamModal: false,
          showProjectModal: false,
          showCollectionModal: false,
          showEnvironmentPanel: false,
          showInviteModal: false,
          showConfirmDialog: false,
          showEditNameModal: false,
          showSessionModal: false,
          showUnsavedModal: false,
          confirmDialogConfig: null,
          editNameModalConfig: null,
          unsavedModalConfig: null,
          contextMenu: null,
          isLoading: false,
          activeMainTab: 'request',
          activeV2Nav: 'dashboard',
        });
      },
    }),
    {
      name: 'syncnest-ui',
      version: 5,
      migrate: (persistedState, version) => {
        const state = persistedState && typeof persistedState === 'object' ? { ...persistedState } : {};
        if (version < 2) {
          state.theme = 'nebula-dark';
        }
        if (version < 3) {
          if (state.theme === 'nebula') state.theme = 'nebula-dark';
        }
        if (version < 4) {
          if (state.theme === 'dark' || state.theme === 'light' || !state.theme) {
            state.theme = 'nebula-dark';
          }
          if (state.theme === 'nebula') state.theme = 'nebula-dark';
        }
        if (version < 5) {
          // Drop Nebula Light — Nebula is dark-only
          if (state.theme === 'nebula-light' || state.theme === 'nebula') {
            state.theme = 'nebula-dark';
          }
        }
        return state;
      },
      partialize: (state) => ({
        theme: state.theme,
        layoutVersion: state.layoutVersion,
        sidebarV2Open: state.sidebarV2Open,
        workspaceOrientation: state.workspaceOrientation,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);

export function isNebulaTheme(theme) {
  return theme === 'nebula' || theme === 'nebula-dark' || theme === 'nebula-light';
}

export function isLightTheme(theme) {
  return theme === 'light';
}

export function isDarkTheme(theme) {
  return theme === 'dark' || theme === 'nebula-dark' || theme === 'nebula' || theme === 'nebula-light';
}

export const THEME_LABELS = {
  dark: 'Dark',
  light: 'Light',
  'nebula-dark': 'Nebula',
  nebula: 'Nebula',
};
