import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import PayloadX from '@/components/core/logo';

export default function EmptyState({ onShowTeamModal, onShowProjectModal }) {
  const { teams } = useTeamStore();
  const { projects } = useProjectStore();
  const { setActiveV2Nav } = useUIStore();

  const hasTeams = teams.length > 0;
  const hasProjects = projects.length > 0;

  const renderContent = () => {
    if (!hasTeams) {
      return {
        title: <>Welcome to <span className="metallic-app-name">PayloadX</span></>,
        subtitle: "Start by creating your first team to organize your API projects.",
        buttonText: "Create First Team",
        onClick: onShowTeamModal
      };
    }
    if (!hasProjects) {
      return {
        title: "Setup Your Project",
        subtitle: "Projects house your collections. Create one to begin testing.",
        buttonText: "Create First Project",
        onClick: onShowProjectModal
      };
    }
    return {
      title: "Select a Collection",
      subtitle: "Choose an API collection from the sidebar to start building.",
      buttonText: "Go to Dashboard",
      onClick: () => setActiveV2Nav('dashboard')
    };
  };

  const content = renderContent();

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#060606] overflow-hidden p-8 font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">

        {/* The "Pock up" (Mockup) */}
        <div className="relative w-full h-[340px] mb-12 animate-fade-up">
          <div className="absolute -inset-4 bg-white/[0.01] blur-2xl rounded-[30px]" />

          <div className="relative h-full bg-[#0d0d0d] rounded-2xl border border-white/[0.05] shadow-2xl overflow-hidden flex flex-col">
            {/* Mock Header */}
            <div className="h-10 border-b border-white/[0.03] bg-white/[0.01] flex items-center px-4 justify-between">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-white/[0.05] border border-white/[0.1]"></div>
                <div className="w-2 h-2 rounded-full bg-white/[0.05] border border-white/[0.1]"></div>
                <div className="w-2 h-2 rounded-full bg-white/[0.05] border border-white/[0.1]"></div>
              </div>
              <div className="h-5 px-3 bg-white/[0.03] border border-white/[0.05] rounded-full flex items-center">
                <span className="text-[8px] text-slate-500 font-mono tracking-tighter">payloadx.studio/workspace</span>
              </div>
            </div>

            {/* Mock Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-6">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center relative overflow-hidden">
                  <PayloadX className="w-8 h-8" fontSize="12px" />
                </div>
                <div className="absolute -inset-2 rounded-full bg-white/[0.01] blur-md -z-10 animate-pulse" />
              </div>

              <h3 className="text-lg font-bold text-white tracking-tight mb-2">{content.title}</h3>
              <p className="text-[11px] text-slate-500 max-w-[240px] leading-relaxed mb-8">
                {content.subtitle}
              </p>

              {/* Action Button inside Mockup (User's "Open PayloadX" request) */}
              <button
                onClick={content.onClick}
                className="h-10 px-8 bg-white/[0.04] border border-white/10 rounded-lg text-white text-[11px] font-bold uppercase tracking-widest hover:bg-white/[0.08] hover:border-white/20 transition-all active:scale-95 shadow-lg"
              >
                {content.buttonText}
              </button>
            </div>

            {/* Mock Footer Status */}
            <div className="h-8 border-t border-white/[0.03] bg-black/20 flex items-center px-4 justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Ready to initialize</span>
              </div>
              <span className="text-[8px] text-slate-700 font-mono">v1.2.0</span>
            </div>
          </div>
        </div>

        {/* Minimal Bottom Attribution */}
        <p className="text-[9px] text-slate-700 font-bold uppercase tracking-[0.4em] opacity-40">
          Engineered by <span className="text-slate-500">Sundan Sharma</span>
        </p>
      </div>
    </div>
  );
}
