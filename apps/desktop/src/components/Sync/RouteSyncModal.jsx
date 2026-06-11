import React from 'react';
import ModalShell from '@/components/Modals/ModalShell';

export default function RouteSyncModal({ diff, onClose, onSync }) {
  if (!diff) return null;

  const syncIcon = (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[color:var(--accent)]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  return (
    <ModalShell
      onClose={onClose}
      title="AST Scanner: Routes Detected"
      subtitle="Backend route sync"
      maxWidth="max-w-2xl"
      icon={syncIcon}
      zIndex={100}
      className="max-h-[80vh]"
      bodyClassName="!p-0 flex flex-col max-h-[calc(80vh-80px)]"
    >
      <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
        <p className="text-sm text-tx-secondary">
          The PayloadX CLI has detected route changes in your backend codebase.
          Would you like to import these structures?
        </p>

        {diff.newRoutes?.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest font-black text-green-500 mb-3">New Routes</h3>
            <div className="flex flex-col gap-2">
              {diff.newRoutes.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-[var(--surface-2)] border border-[var(--border-1)] rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20 w-14 text-center">{r.method}</span>
                    <span className="text-sm text-tx-primary font-mono">{r.path}</span>
                  </div>
                  <span className="text-xs text-tx-muted font-mono">{r.handler}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {diff.updatedRoutes?.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest font-black text-yellow-500 mb-3">Modified Routes</h3>
            <div className="flex flex-col gap-2">
              {diff.updatedRoutes.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-[var(--surface-2)] border border-[var(--border-1)] rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 w-14 text-center">{r.method}</span>
                    <span className="text-sm text-tx-primary font-mono">{r.path}</span>
                  </div>
                  <span className="text-xs text-tx-muted font-mono">{r.handler}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border-1)] flex justify-end gap-3 bg-[var(--modal-header-bg)] flex-shrink-0">
        <button type="button" onClick={onClose} className="btn-ghost !py-2 !px-4 !text-xs uppercase tracking-widest">
          Dismiss
        </button>
        <button type="button" onClick={() => onSync(diff)} className="btn-primary !py-2 !px-6 !text-xs uppercase tracking-widest">
          Sync to Workspace
        </button>
      </div>
    </ModalShell>
  );
}
