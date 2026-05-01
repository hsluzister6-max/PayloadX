import { useRequestStore } from '@/store/requestStore';
import { Clock, Trash2, ArrowUpRight, Search } from 'lucide-react';
import { useState } from 'react';

export default function HistoryPanel() {
  const { history, clearHistory, setCurrentRequest } = useRequestStore();
  const [search, setSearch] = useState('');

  const filteredHistory = (history || []).filter(item => 
    (item.request?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.request?.url || '').toLowerCase().includes(search.toLowerCase())
  ).reverse(); // Most recent first

  const formatTime = (ts) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Request History</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Track and reuse your past API requests</p>
        </div>
        <button 
          onClick={() => {
            if (window.confirm('Clear all history?')) clearHistory();
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
        <input 
          className="w-full bg-[var(--surface-1)] border border-[var(--border-1)] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] transition-all"
          placeholder="Search history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item) => (
            <div 
              key={item.id}
              onClick={() => setCurrentRequest(item.request)}
              className="group flex flex-col p-4 bg-[var(--surface-1)] border border-[var(--border-1)] rounded-xl hover:border-[var(--accent)] cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                    item.request?.method === 'GET' ? 'bg-green-500/10 text-green-500' :
                    item.request?.method === 'POST' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {item.request?.method || 'GET'}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[300px]">
                    {item.request?.name || 'Untitled Request'}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] opacity-60 flex items-center gap-1">
                  <Clock size={10} />
                  {formatTime(item.timestamp)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-xs text-[var(--text-muted)] truncate flex-1 mr-4">
                  {item.request?.url || 'No URL'}
                </code>
                <ArrowUpRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-40">
            <Clock size={48} strokeWidth={1} />
            <p className="mt-4 text-sm font-medium">No history found</p>
          </div>
        )}
      </div>
    </div>
  );
}
