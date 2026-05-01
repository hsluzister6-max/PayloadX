import { useEffect, useState, useRef } from 'react';
import { Terminal, Trash2, ShieldCheck, Info, AlertTriangle, XCircle } from 'lucide-react';

export default function ConsolePanelContent() {
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    // Basic mock console data for now
    const initialLogs = [
      { id: 1, type: 'info', message: 'PayloadX Beta Console initialized', timestamp: Date.now() },
      { id: 2, type: 'success', message: 'Connected to local environment: Development', timestamp: Date.now() + 100 },
    ];
    setLogs(initialLogs);

    // Listen for global clear event
    const handleClear = () => setLogs([]);
    window.addEventListener('console-clear-shortcut', handleClear);
    
    return () => window.removeEventListener('console-clear-shortcut', handleClear);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <ShieldCheck size={12} className="text-green-500" />;
      case 'error': return <XCircle size={12} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={12} className="text-yellow-500" />;
      default: return <Info size={12} className="text-blue-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[color:var(--bg-primary)]">
      <div className="px-4 py-2 border-b border-[color:var(--border-1)] flex items-center justify-between bg-[color:var(--surface-1)]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-muted)] flex items-center gap-2">
          <Terminal size={12} />
          Terminal Output
        </span>
        <button 
          onClick={() => setLogs([])}
          className="p-1 hover:bg-[color:var(--surface-3)] rounded text-[color:var(--text-muted)] transition-all"
          title="Clear Console (Ctrl+Alt+L)"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono space-y-2">
        {logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 text-[11px] group animate-in fade-in slide-in-from-left-1">
              <div className="mt-0.5">{getIcon(log.type)}</div>
              <div className="flex-1">
                <span className="text-[color:var(--text-muted)] mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={log.type === 'error' ? 'text-red-400' : 'text-[color:var(--text-primary)]'}>
                  {log.message}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[color:var(--text-muted)] opacity-30">
            <Terminal size={32} strokeWidth={1} />
            <span className="text-[10px] mt-2 uppercase tracking-widest">Console is empty</span>
          </div>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
