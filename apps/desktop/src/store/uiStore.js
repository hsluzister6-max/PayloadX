import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      folderModalData: null, // { collectionId, folderId (for edit), name (for edit) }
      showEnvironmentPanel: false,
      rightSidebarOpen: false,
      rightSidebarActiveTab: 'environment', // 'environment' | 'cookies'
      rightSidebarWidth: 420,
      showInviteModal: false,
      showConfirmDialog: false,
      showEditNameModal: false,
      showSessionModal: false,
      confirmDialogConfig: null,
      editNameModalConfig: null,
      contextMenu: null,
      isLoading: false,
      activeMainTab: 'request',         // 'request' | 'history'
      theme: 'dark',                    // 'dark' | 'light'
      layoutVersion: 'v2',              // 'v1' | 'v2'
      sidebarV2Open: true,              // V2 left sidebar open/closed
      workspaceOrientation: 'vertical', // 'vertical' | 'horizontal'
      activeV2Nav: 'collections',       // 'collections', 'docs', 'environments', etc.

      setSidebarWidth: (w) => set({ sidebarWidth: Math.max(200, Math.min(400, w)) }),
      setResponseHeight: (h) => set({ responseHeight: Math.max(150, Math.min(600, h)) }),
      toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
      setShowImportModal: (v) => set({ showImportModal: v }),
      setShowTeamModal: (v) => set({ showTeamModal: v }),
      setShowProjectModal: (v) => set({ showProjectModal: v }),
      setShowCollectionModal: (v) => set({ showCollectionModal: v }),
      setShowFolderModal: (v, data = null) => set({ showFolderModal: v, folderModalData: data }),
      setShowEnvironmentPanel: (v) => set({ showEnvironmentPanel: v }),

      // Right sidebar actions
      setRightSidebarOpen: (v) => set({ rightSidebarOpen: v }),
      setRightSidebarActiveTab: (v) => set({ rightSidebarActiveTab: v }),
      setRightSidebarWidth: (w) => set({ rightSidebarWidth: Math.max(300, Math.min(800, w)) }),
      toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
      openRightSidebarTab: (tab) => set({ rightSidebarActiveTab: tab, rightSidebarOpen: true }),

      setShowInviteModal: (v) => set({ showInviteModal: v }),
      setShowConfirmDialog: (v, config = null) => set({ showConfirmDialog: v, confirmDialogConfig: config }),
      setShowEditNameModal: (v, config = null) => set({ showEditNameModal: v, editNameModalConfig: config }),
      setShowSessionModal: (v) => set({ showSessionModal: v }),
      setContextMenu: (config) => set({ contextMenu: config }),
      closeContextMenu: () => set({ contextMenu: null }),
      setIsLoading: (v) => set({ isLoading: v }),
      setActiveMainTab: (v) => set({ activeMainTab: v }),
      setActiveV2Nav: (v) => set({ activeV2Nav: v }),
      setLayoutVersion: (v) => set({ layoutVersion: v }),

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
          showConfirmDialog: false,
          showEditNameModal: false,
          showSessionModal: false,
          confirmDialogConfig: null,
          editNameModalConfig: null,
          contextMenu: null,
          isLoading: false,
          activeMainTab: 'request',
          activeV2Nav: 'dashboard' // Default starting point after fresh login
        });
      }
    }),
    {
      name: 'syncnest-ui',
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
