import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Themes: dark | light
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
      showMcpTokenModal: false,
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
      theme: 'dark', // 'dark' | 'light'
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
      setShowMcpTokenModal: (v) => set({ showMcpTokenModal: v }),
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

      setTheme: (theme) => set({ theme: theme === 'light' ? 'light' : 'dark' }),

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

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
          showMcpTokenModal: false,
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
      version: 7,
      migrate: (persistedState, version) => {
        const state = persistedState && typeof persistedState === 'object' ? { ...persistedState } : {};
        // Only dark | light are supported — coerce any other legacy value to dark
        if (state.theme !== 'light' && state.theme !== 'dark') {
          state.theme = 'dark';
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

export function isLightTheme(theme) {
  return theme === 'light';
}

export function isDarkTheme(theme) {
  return theme !== 'light';
}

export const THEME_LABELS = {
  dark: 'Dark',
  light: 'Light',
};
