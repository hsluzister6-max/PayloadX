import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore, isLightTheme } from '@/store/uiStore';
import PayloadX from '@/components/core/logo';

export default function EmptyState({ onShowTeamModal, onShowProjectModal }) {
  const { teams } = useTeamStore();
  const { projects } = useProjectStore();
  const { setActiveV2Nav, theme } = useUIStore();
  const isLight = isLightTheme(theme);

  const hasTeams = teams.length > 0;
  const hasProjects = projects.length > 0;

  const renderContent = () => {
    if (!hasTeams) {
      return {
        title: <>Welcome to <span className="metallic-app-name">PayloadX</span></>,
        subtitle: 'Start by creating your first team to organize your API projects.',
        buttonText: 'Create First Team',
        onClick: onShowTeamModal,
      };
    }
    if (!hasProjects) {
      return {
        title: 'Setup Your Project',
        subtitle: 'Projects house your collections. Create one to begin testing.',
        buttonText: 'Create First Project',
        onClick: onShowProjectModal,
      };
    }
    return {
      title: 'Select a Collection',
      subtitle: 'Choose an API collection from the sidebar to start building.',
      buttonText: 'Go to Dashboard',
      onClick: () => setActiveV2Nav('dashboard'),
    };
  };

  const content = renderContent();

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg-primary overflow-hidden p-4 font-sans">
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center w-full max-w-lg mx-auto">
        <div className="relative w-full max-w-md flex flex-col items-center text-center empty-state-card rounded-2xl p-8 border border-border-1 bg-surface-1/80">
          <div className="mb-4">
            <PayloadX className="w-12 h-12" fontSize="14px" />
          </div>

          <h2 className="text-lg font-bold text-tx-primary tracking-tight mb-1.5">{content.title}</h2>
          <p className="text-[11px] text-tx-secondary max-w-[280px] leading-relaxed mb-5">
            {content.subtitle}
          </p>

          <button
            onClick={content.onClick}
            className="h-9 px-6 bg-[var(--cta-bg)] text-[var(--cta-text)] border border-[var(--cta-border)] rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-105 transition-all active:scale-[0.98] shadow-[var(--cta-shadow)]"
          >
            {content.buttonText}
          </button>

          <div
            className={`mt-8 w-full rounded-xl border overflow-hidden flex flex-col ${
              isLight ? 'border-border-1 bg-surface-1' : 'border-white/10 bg-surface-1/40'
            }`}
          >
            <div className={`h-7 border-b flex items-center px-3 gap-1.5 ${
              isLight ? 'border-border-1 bg-surface-2/80' : 'border-white/5 bg-white/5'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-tx-muted/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-tx-muted/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-tx-muted/30" />
            </div>
            <div className="px-4 py-3 text-[10px] text-tx-muted font-mono truncate">
              payloadx.studio/workspace
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-tx-muted font-bold uppercase tracking-[0.35em] opacity-40 text-center shrink-0 pb-1">
        Engineered by <span className="text-tx-secondary">Sundan Sharma</span>
      </p>
    </div>
  );
}
