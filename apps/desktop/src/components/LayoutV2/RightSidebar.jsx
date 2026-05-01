import { useUIStore } from '@/store/uiStore';
import { Cookie, Variable, X, PanelRight, Terminal } from 'lucide-react';
import EnvironmentPanelContent from '@/components/EnvironmentPanel/EnvironmentPanelContent';
import SessionPanelContent from '@/components/Modals/SessionPanelContent';
import ConsolePanelContent from './ConsolePanelContent';

const TABS = [
  { id: 'environment', label: 'Env', icon: Variable },
  { id: 'sessions', label: 'Sessions', icon: Cookie },
  { id: 'console', label: 'Console', icon: Terminal },
];

export default function RightSidebar() {
  const {
    rightSidebarOpen,
    rightSidebarActiveTab,
    rightSidebarWidth,
    setRightSidebarWidth,
    setRightSidebarOpen,
    setRightSidebarActiveTab,
    toggleRightSidebar,
  } = useUIStore();

  if (!rightSidebarOpen) {
    return (
      <button
        onClick={() => toggleRightSidebar()}
        className="flex-shrink-0 h-full w-8 flex items-center justify-center border-l border-[color:var(--border-1)] bg-[color:var(--bg-secondary)] hover:bg-[color:var(--surface-2)] transition-colors"
        title="Open sidebar"
      >
        <PanelRight size={16} className="text-[color:var(--text-muted)]" />
      </button>
    );
  }

  const ActiveIcon = TABS.find(t => t.id === rightSidebarActiveTab)?.icon || Variable;

  return (
    <>
      {/* Collapse button */}
      <button
        onClick={() => setRightSidebarOpen(false)}
        className="flex-shrink-0 h-full w-6 flex items-center justify-center border-l border-r border-[color:var(--border-1)] bg-[color:var(--bg-secondary)] hover:bg-[color:var(--surface-2)] transition-colors"
        title="Close sidebar"
      >
        <PanelRight size={14} className="text-[color:var(--text-muted)] rotate-180" />
      </button>

      {/* Sidebar */}
      <div
        className="flex-shrink-0 flex flex-col h-full bg-[color:var(--bg-secondary)] border-l border-[color:var(--border-1)]"
        style={{ width: rightSidebarWidth }}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = rightSidebarActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRightSidebarActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[color:var(--surface-2)] text-[color:var(--text-primary)]'
                      : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-1)]'
                  }`}
                  title={tab.label}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setRightSidebarOpen(false)}
            className="p-1 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {rightSidebarActiveTab === 'environment' && <EnvironmentPanelContent />}
          {rightSidebarActiveTab === 'sessions' && <SessionPanelContent />}
          {rightSidebarActiveTab === 'console' && <ConsolePanelContent />}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="flex-shrink-0 w-1 h-full cursor-col-resize hover:bg-[color:var(--accent)] transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = rightSidebarWidth;
          const onMove = (e) => {
            // Moving left decreases width (since it's on the right side)
            const newWidth = startW - (e.clientX - startX);
            setRightSidebarWidth(newWidth);
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
    </>
  );
}
