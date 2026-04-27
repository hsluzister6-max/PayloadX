import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useWorkflowStore } from '@/store/workflowStore';
import { Hourglass, Loader2, Play, ShieldOff, CheckCircle } from 'lucide-react';

function DelayNode({ id, data, selected }) {
  const executingNodeIds = useWorkflowStore(state => state.executingNodeIds);
  const executeSingleNode = useWorkflowStore(state => state.executeSingleNode);
  const isExecuting = executingNodeIds?.has?.(id) ?? false;

  const handleRun = (e) => {
    e.stopPropagation();
    executeSingleNode(id);
  };

  return (
    <div
      className={`group px-4 py-3.5 rounded-2xl border backdrop-blur-md transition-all duration-300 min-w-[200px] ${
        isExecuting 
          ? 'border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.2)] animate-pulse'
          : data.executionStatus === 'success' ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
          : data.executionStatus === 'failed' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
          : data.executionStatus === 'skipped' ? 'border-surface-400/30 opacity-60'
          : selected ? 'border-[var(--accent)] shadow-glass' : 'border-[var(--border-2)]'
      } ${data.skipped ? 'opacity-60 grayscale-[0.5]' : ''}`}
      style={{ background: 'var(--surface-1)' }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-2.5 !h-2.5 !bg-[var(--border-2)] !border-none hover:!bg-[var(--accent)] transition-colors" 
      />

      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 rounded-xl bg-surface-2 border border-[var(--border-2)]">
            {isExecuting ? (
              <Loader2 size={14} className="text-[var(--accent)] animate-spin" />
            ) : data.executionStatus === 'success' ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : data.executionStatus === 'skipped' ? (
              <ShieldOff size={14} className="text-surface-400" />
            ) : (
              <Hourglass size={14} className="text-surface-500" />
            )}
          </div>
          {data.step > 0 && (
            <div className="px-1.5 py-0.5 bg-surface-3 border border-[var(--border-2)] rounded text-[8px] font-black text-surface-500 uppercase">
              Step {data.step}
            </div>
          )}
        </div>
        
        <div className="flex-1 flex justify-between items-start mt-0.5">
          <div>
            <div className="text-[13px] font-bold text-[var(--text-primary)] mb-0.5">{data.name}</div>
            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              {data.timeout || 1000}<span className="lowercase ml-0.5 opacity-50 font-normal">ms</span> Delay
              {data.skipped && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  Skipped
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleRun}
            disabled={isExecuting}
            className="p-1.5 ml-2 rounded-lg bg-surface-2 border border-[var(--border-2)] text-surface-500 hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
            title="Run this node"
          >
            {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
          </button>
        </div>
      </div>

      {/* Output Handle */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <div className="text-[7px] font-black uppercase text-surface-500 tracking-tighter bg-surface-2 px-1 rounded border border-[var(--border-2)]">Always</div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="always"
        className="!w-3 !h-3 !bg-[var(--border-2)] !border-none hover:!scale-150 transition-transform shadow-sm" 
      />
    </div>
  );
}

export default memo(DelayNode);
