import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useWorkflowStore } from '@/store/workflowStore';
import { Globe, CheckCircle, XCircle, Clock, Zap, Loader2, ShieldCheck, Play, ShieldOff } from 'lucide-react';

function ApiNode({ id, data, selected }) {
  const executingNodeIds = useWorkflowStore(state => state.executingNodeIds);
  const executeSingleNode = useWorkflowStore(state => state.executeSingleNode);
  const isExecuting = executingNodeIds?.has?.(id) ?? false;

  const handleRun = (e) => {
    e.stopPropagation();
    executeSingleNode(id);
  };

  const getStatusBorder = () => {
    if (isExecuting) return 'border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.2)] animate-pulse';
    if (data.executionStatus === 'success') return 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]';
    if (data.executionStatus === 'failed') return 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
    if (data.executionStatus === 'skipped') return 'border-surface-400/30 opacity-60';
    return selected ? 'border-[var(--accent)] shadow-glass' : 'border-[var(--border-2)]';
  };

  const getStatusIcon = () => {
    if (isExecuting) return <Loader2 size={14} className="text-[var(--accent)] animate-spin" />;
    if (data.executionStatus === 'success') return <CheckCircle size={14} className="text-green-500" />;
    if (data.executionStatus === 'failed') return <XCircle size={14} className="text-red-500" />;
    if (data.executionStatus === 'skipped') return <ShieldOff size={14} className="text-surface-400" />;
    return <Zap size={14} className="text-[var(--accent)]" />;
  };

  const getMethodStyle = () => {
    const method = data.method;
    const colors = {
      GET: 'text-green-500 bg-green-500/10',
      POST: 'text-blue-500 bg-blue-500/10',
      PUT: 'text-yellow-500 bg-yellow-500/10',
      DELETE: 'text-red-500 bg-red-500/10',
      PATCH: 'text-purple-500 bg-purple-500/10',
    };
    return colors[method] || 'text-surface-400 bg-surface-2';
  };

  return (
    <div
      className={`group px-4 py-3.5 rounded-2xl border backdrop-blur-md transition-all duration-300 min-w-[240px] max-w-[320px] ${getStatusBorder()} ${data.skipped ? 'opacity-60 grayscale-[0.5]' : ''}`}
      style={{ background: 'var(--surface-1)' }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-2.5 !h-2.5 !bg-[var(--border-2)] !border-none hover:!bg-[var(--accent)] transition-colors" 
      />

      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="mt-1 p-2 rounded-xl bg-surface-2 border border-[var(--border-2)]">
            {getStatusIcon()}
          </div>
          {data.step > 0 && (
            <div className="px-1.5 py-0.5 bg-surface-3 border border-[var(--border-2)] rounded text-[8px] font-black text-surface-500 uppercase">
              Step {data.step}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-[13px] font-bold text-[var(--text-primary)] truncate mb-1">{data.name}</div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${getMethodStyle()}`}>
                {data.method}
              </span>
              {data.skipped && (
                <span className="flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  Skipped
                </span>
              )}
              {data.save_session && (
                <span className="flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter bg-green-500/10 text-green-500 border border-green-500/20">
                  <ShieldCheck size={10} />
                  Session
                </span>
              )}
              <span className="text-[10px] text-surface-500 font-mono truncate">{data.url || 'No endpoint'}</span>
            </div>
          </div>
          
          <button
            onClick={handleRun}
            disabled={isExecuting}
            className="p-1.5 rounded-lg bg-surface-2 border border-[var(--border-2)] text-surface-500 hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
            title="Run this node"
          >
            {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
          </button>
        </div>
      </div>

      {data.executionDuration !== undefined && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-2)]/50">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500 uppercase tracking-wider">
            <Clock size={12} className="opacity-50" />
            Latency
          </div>
          <div className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
            {data.executionDuration}<span className="text-[9px] ml-0.5 opacity-50 font-sans">ms</span>
          </div>
        </div>
      )}

      {/* Branching Output Handles */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          <div className="text-[7px] font-black uppercase text-green-500 tracking-tighter bg-green-500/10 px-1 rounded border border-green-500/20">Success</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[7px] font-black uppercase text-surface-500 tracking-tighter bg-surface-2 px-1 rounded border border-[var(--border-2)]">Always</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[7px] font-black uppercase text-red-500 tracking-tighter bg-red-500/10 px-1 rounded border border-red-500/20">Failure</div>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="success"
        style={{ left: '15%', background: '#10b981' }}
        className="!w-3 !h-3 !border-none hover:!scale-150 transition-transform shadow-sm" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="always"
        style={{ left: '50%', background: 'var(--border-2)' }}
        className="!w-3 !h-3 !border-none hover:!scale-150 transition-transform shadow-sm" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="failure"
        style={{ left: '85%', background: '#ef4444' }}
        className="!w-3 !h-3 !border-none hover:!scale-150 transition-transform shadow-sm" 
      />
    </div>
  );
}

export default memo(ApiNode);
