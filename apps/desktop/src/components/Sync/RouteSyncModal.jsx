import React from 'react';

export default function RouteSyncModal({ diff, onClose, onSync }) {
  if (!diff) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[color:var(--surface-1)] border border-[color:var(--surface-3)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-[color:var(--surface-3)] flex justify-between items-center bg-[color:var(--surface-2)]">
          <h2 className="text-lg font-black text-[color:var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[color:var(--accent)]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AST Scanner: Routes Detected
          </h2>
          <button onClick={onClose} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
           <p className="text-sm text-[color:var(--text-secondary)]">
             The PayloadX CLI has detected route changes in your backend codebase. 
             Would you like to import these structures?
           </p>

           {diff.newRoutes?.length > 0 && (
             <div>
               <h3 className="text-xs uppercase tracking-widest font-black text-green-500 mb-3">New Routes</h3>
               <div className="flex flex-col gap-2">
                 {diff.newRoutes.map(r => (
                   <div key={r.id} className="flex items-center justify-between p-3 bg-[color:var(--surface-2)] border border-[color:var(--surface-3)] rounded-lg">
                     <div className="flex items-center gap-4">
                       <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20 w-14 text-center">{r.method}</span>
                       <span className="text-sm text-[color:var(--text-primary)] font-mono">{r.path}</span>
                     </div>
                     <span className="text-xs text-[color:var(--text-muted)] font-mono">{r.handler}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {diff.updatedRoutes?.length > 0 && (
             <div>
               <h3 className="text-xs uppercase tracking-widest font-black text-yellow-500 mb-3">Modified Routes</h3>
               <div className="flex flex-col gap-2">
                 {diff.updatedRoutes.map(r => (
                   <div key={r.id} className="flex items-center justify-between p-3 bg-[color:var(--surface-2)] border border-[color:var(--surface-3)] rounded-lg">
                     <div className="flex items-center gap-4">
                       <span className="text-[10px] font-bold px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 w-14 text-center">{r.method}</span>
                       <span className="text-sm text-[color:var(--text-primary)] font-mono">{r.path}</span>
                     </div>
                     <span className="text-xs text-[color:var(--text-muted)] font-mono">{r.handler}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}
        </div>
        <div className="p-4 border-t border-[color:var(--surface-3)] flex justify-end gap-3 bg-[color:var(--surface-2)]">
          <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors uppercase tracking-widest">Dismiss</button>
          <button onClick={() => onSync(diff)} className="px-6 py-2 text-xs font-bold bg-[color:var(--accent)] text-white rounded-lg hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-[color:var(--accent)]/20">Sync to Workspace</button>
        </div>
      </div>
    </div>
  );
}
