import { useState } from 'react';
import { Search, Copy, Check, ChevronDown } from 'lucide-react';

/**
 * Toolbar for JSON tree viewer
 * Search, expand/collapse, copy full JSON
 */
export default function JsonToolbar({
  searchQuery,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  onExpandToDepth,
  jsonString,
  totalRows,
  visibleCount
}) {
  const [copied, setCopied] = useState(false);
  const [showDepthMenu, setShowDepthMenu] = useState(false);

  const handleCopyFullJson = async () => {
    if (!jsonString) return;
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  const handleExpandToDepth = (depth) => {
    onExpandToDepth(depth);
    setShowDepthMenu(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
        <input
          type="text"
          placeholder="Search keys and values..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 text-xs bg-surface-800 border border-surface-700 rounded-md text-tx-primary placeholder-tx-muted outline-none focus:border-brand-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-tx-primary"
          >
            ×
          </button>
        )}
      </div>

      {/* Row count info */}
      <span className="text-[10px] text-surface-400 whitespace-nowrap">
        {visibleCount.toLocaleString()} / {totalRows.toLocaleString()} rows
      </span>

      <div className="w-px h-4 bg-surface-700 mx-1" />

      {/* Expand/Collapse controls */}
      <button
        onClick={onExpandAll}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-tx-secondary hover:text-tx-primary bg-surface-700 hover:bg-surface-600 rounded transition-colors"
        title="Expand all"
      >
        <ExpandIcon className="w-3 h-3" />
        Expand
      </button>

      <button
        onClick={onCollapseAll}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-tx-secondary hover:text-tx-primary bg-surface-700 hover:bg-surface-600 rounded transition-colors"
        title="Collapse all"
      >
        <CollapseIcon className="w-3 h-3" />
        Collapse
      </button>

      {/* Expand to depth dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDepthMenu(!showDepthMenu)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-tx-secondary hover:text-tx-primary bg-surface-700 hover:bg-surface-600 rounded transition-colors"
        >
          Depth
          <ChevronDown className="w-3 h-3" />
        </button>
        
        {showDepthMenu && (
          <div className="absolute top-full left-0 mt-1 py-1 bg-surface-800 border border-surface-700 rounded-md shadow-lg z-50 min-w-[80px]">
            {[1, 2, 3, 4, 5].map((depth) => (
              <button
                key={depth}
                onClick={() => handleExpandToDepth(depth)}
                className="block w-full text-left px-3 py-1 text-[11px] text-tx-secondary hover:text-tx-primary hover:bg-surface-700 transition-colors"
              >
                {depth} {depth === 1 ? 'level' : 'levels'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-surface-700 mx-1" />

      {/* Copy full JSON */}
      <button
        onClick={handleCopyFullJson}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-tx-secondary hover:text-tx-primary bg-surface-700 hover:bg-surface-600 rounded transition-colors"
        title="Copy full JSON"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-success" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            Copy JSON
          </>
        )}
      </button>

      {/* Click outside to close depth menu */}
      {showDepthMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDepthMenu(false)}
        />
      )}
    </div>
  );
}

// Custom SVG icons for expand/collapse
function ExpandIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CollapseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 9l3 3-3 3M15 9l-3 3 3 3" />
    </svg>
  );
}
