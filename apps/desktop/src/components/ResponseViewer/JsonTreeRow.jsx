import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

/**
 * Individual JSON tree row component
 * Postman-style JSON tree viewer with line numbers
 */
export default function JsonTreeRow({ 
  row, 
  index,
  style, 
  onToggle,
  isDark
}) {
  const [copied, setCopied] = useState(false);
  const { theme } = useUIStore();
  const isDarkTheme = isDark !== undefined ? isDark : theme === 'dark';

  // Postman-style color scheme
  const colors = {
    key: isDarkTheme ? '#9cdcfe' : '#0451a5',           // Light blue
    string: isDarkTheme ? '#ce9178' : '#a31515',        // Orange/salmon
    number: isDarkTheme ? '#b5cea8' : '#098658',        // Green
    boolean: isDarkTheme ? '#569cd6' : '#0000ff',       // Blue
    null: isDarkTheme ? '#569cd6' : '#0000ff',          // Blue
    punctuation: isDarkTheme ? '#d4d4d4' : '#000000',   // Gray/white
    default: isDarkTheme ? '#d4d4d4' : '#000000',
    bracket: isDarkTheme ? '#d4d4d4' : '#000000',       // Gray brackets
    dim: isDarkTheme ? '#6e7681' : '#757575',
    lineNumber: isDarkTheme ? '#6e7681' : '#999999'     // Muted line numbers
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const indent = row.depth * 16; // 16px per depth level (Postman style)

  // Render toggle button for objects/arrays
  const renderToggle = () => {
    if (row.type !== 'object' && row.type !== 'array') {
      return <span className="w-4 inline-block flex-shrink-0" />;
    }

    const isExpandable = !row.isEmpty;
    if (!isExpandable) {
      return <span className="w-4 inline-block flex-shrink-0" />;
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(row.path);
        }}
        className="w-4 h-4 inline-flex items-center justify-center flex-shrink-0 hover:bg-surface-700/50 rounded transition-colors"
        style={{ color: colors.dim }}
      >
        {row.isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
    );
  };

  // Render row based on type
  const renderContent = () => {
    switch (row.type) {
      case 'object':
        return renderObject();
      case 'array':
        return renderArray();
      case 'value':
        return renderValue();
      case 'max-depth':
        return (
          <span style={{ color: colors.dim, fontStyle: 'italic' }}>
            {row.value}
          </span>
        );
      default:
        return null;
    }
  };

  const renderObject = () => {
    const { isExpanded, isEmpty, keyCount, key } = row;
    
    return (
      <>
        {key !== undefined && (
          <>
            <span className="json-key" style={{ color: colors.key }}>{formatKey(key)}</span>
            <span style={{ color: colors.punctuation }}>: </span>
          </>
        )}
        <span style={{ color: colors.bracket }}>{'{'}</span>
        {!isExpanded && !isEmpty && (
          <span style={{ color: colors.dim, marginLeft: '4px' }}>
            {keyCount} {keyCount === 1 ? 'item' : 'items'}
          </span>
        )}
        {!isExpanded && <span style={{ color: colors.bracket, marginLeft: !isEmpty ? '4px' : 0 }}>{'}'}</span>}
        {isExpanded && !isEmpty && (
          <span style={{ color: colors.bracket }}>{'}'}</span>
        )}
        {isEmpty && <span style={{ color: colors.bracket }}>{'}'}</span>}
      </>
    );
  };

  const renderArray = () => {
    const { isExpanded, isEmpty, length, key } = row;
    
    return (
      <>
        {key !== undefined && (
          <>
            <span className="json-key" style={{ color: colors.key }}>{formatKey(key)}</span>
            <span style={{ color: colors.punctuation }}>: </span>
          </>
        )}
        <span style={{ color: colors.bracket }}>{'['}</span>
        {!isExpanded && !isEmpty && (
          <span style={{ color: colors.dim, marginLeft: '4px' }}>
            {length} {length === 1 ? 'item' : 'items'}
          </span>
        )}
        {!isExpanded && <span style={{ color: colors.bracket, marginLeft: !isEmpty ? '4px' : 0 }}>{']'}</span>}
        {isExpanded && !isEmpty && (
          <span style={{ color: colors.bracket }}>{']'}</span>
        )}
        {isEmpty && <span style={{ color: colors.bracket }}>{']'}</span>}
      </>
    );
  };

  const renderValue = () => {
    const { key, value, valueType } = row;
    
    return (
      <>
        {key !== undefined && (
          <>
            <span className="json-key" style={{ color: colors.key }}>{formatKey(key)}</span>
            <span style={{ color: colors.punctuation }}>: </span>
          </>
        )}
        <span style={{ color: colors[valueType] || colors.default }}>
          {formatValue(value, valueType)}
        </span>
      </>
    );
  };

  const valueToCopy = row.type === 'value' ? row.value : null;

  return (
    <div
      className="group flex items-center font-mono text-xs hover:bg-surface-800/50 transition-colors"
      style={{ 
        ...style, 
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        display: 'flex'
      }}
    >
      {/* Line number */}
      <div 
        className="flex-shrink-0 text-right pr-3 select-none"
        style={{ 
          width: '40px', 
          color: colors.lineNumber,
          borderRight: `1px solid ${isDarkTheme ? '#333' : '#e0e0e0'}`,
          marginRight: '8px'
        }}
      >
        {index + 1}
      </div>
      
      {/* Toggle button */}
      <div style={{ paddingLeft: indent }}>
        {renderToggle()}
      </div>
      
      {/* Content */}
      <span className="flex-1 ml-1">{renderContent()}</span>
      
      {/* Copy button - shows on hover */}
      {valueToCopy !== null && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy(valueToCopy);
          }}
          className="opacity-0 group-hover:opacity-100 ml-2 p-1 rounded hover:bg-surface-700 transition-all flex-shrink-0"
          title="Copy value"
        >
          {copied ? (
            <Check className="w-3 h-3 text-success" />
          ) : (
            <Copy className="w-3 h-3 text-surface-400" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Format key for display
 */
function formatKey(key) {
  // Quote keys that need quoting
  if (typeof key === 'number') return key;
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return key;
  return `"${key}"`;
}

/**
 * Format value for display based on type
 */
function formatValue(value, type) {
  if (value === null) return 'null';
  if (type === 'string') return `"${truncateString(value, 100)}"`;
  if (type === 'boolean') return String(value);
  if (type === 'number') return String(value);
  return String(value);
}

/**
 * Truncate long strings
 */
function truncateString(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
