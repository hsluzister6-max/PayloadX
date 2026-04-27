import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useJsonTree } from './hooks/useJsonTree';
import JsonTreeRow from './JsonTreeRow';
import JsonToolbar from './JsonToolbar';

/**
 * Simple Virtualized List Component
 * Lightweight alternative to react-window
 */
function VirtualizedList({ items, renderItem, itemHeight, overscan = 5 }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, idx) => ({
      ...item,
      index: startIndex + idx
    }));
  }, [items, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ overflow: 'auto', height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item) => (
          <div
            key={item.index}
            style={{
              position: 'absolute',
              top: item.index * itemHeight,
              height: itemHeight,
              left: 0,
              right: 0
            }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Virtualized JSON Tree Viewer
 * Postman-style tree view with:
 * - Expand/collapse objects and arrays
 * - Copy any value
 * - Search/filter
 * - Handle large JSON (100k+ lines)
 * - Cross-platform (Windows, Linux, macOS)
 */
export default function JsonTreeViewer({ 
  value, 
  className = '',
  defaultExpanded = false,
  rowHeight = 22
}) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const listRef = useRef(null);

  // Use the JSON tree hook
  const {
    rows,
    searchQuery,
    setSearchQuery,
    togglePath,
    expandAll,
    collapseAll,
    expandToDepth,
    isValid,
    totalRows
  } = useJsonTree(value, { defaultExpanded });

  // Filter visible rows based on search
  const visibleRows = searchQuery 
    ? rows.filter(row => row.matchesSearch)
    : rows;

  // Scroll to top when search changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [searchQuery]);

  // Render a single row
  const renderRow = useCallback((item) => {
    const { index, ...row } = item;
    return (
      <JsonTreeRow
        index={index}
        row={row}
        style={{ height: rowHeight }}
        onToggle={togglePath}
        isDark={isDark}
      />
    );
  }, [togglePath, isDark, rowHeight]);

  if (!isValid) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
          Invalid JSON
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
          No response body
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <JsonToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onExpandToDepth={expandToDepth}
        jsonString={value}
        totalRows={totalRows}
        visibleCount={visibleRows.length}
      />

      {/* Virtualized Tree */}
      <div ref={listRef} className="flex-1 overflow-hidden">
        <VirtualizedList
          items={visibleRows}
          renderItem={renderRow}
          itemHeight={rowHeight}
          overscan={5}
        />
      </div>
    </div>
  );
}
