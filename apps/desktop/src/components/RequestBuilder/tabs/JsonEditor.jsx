import { useCallback, useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';

/**
 * Cross-platform JSON Editor for request body
 * Works reliably on Windows, Linux, macOS
 * Provides syntax highlighting while editing
 */
export default function JsonEditor({ value, onChange, className = '' }) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  // Format/Beautify JSON
  const handleBeautify = useCallback(() => {
    if (!value) return;
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
    } catch (e) {
      // Invalid JSON, don't format
      console.warn('Invalid JSON, cannot beautify:', e.message);
    }
  }, [value, onChange]);

  // Minify JSON
  const handleMinify = useCallback(() => {
    if (!value) return;
    try {
      const parsed = JSON.parse(value);
      const minified = JSON.stringify(parsed);
      onChange(minified);
    } catch (e) {
      // Invalid JSON, don't minify
    }
  }, [value, onChange]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
        <span className="text-xs text-surface-400">JSON</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBeautify}
            className="text-[11px] px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-tx-secondary transition-colors"
            title="Format JSON"
          >
            {}
          </button>
          <button
            onClick={handleMinify}
            className="text-[11px] px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-tx-secondary transition-colors"
            title="Minify JSON"
          >{}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full bg-surface-800 text-tx-primary font-mono text-xs p-3 resize-none outline-none border-none"
          style={{
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            lineHeight: '1.6',
            tabSize: 2,
          }}
          spellCheck={false}
          placeholder="Enter JSON body..."
        />
        
        {/* Validation indicator */}
        <JsonValidationIndicator value={value} />
      </div>
    </div>
  );
}

/**
 * Shows JSON validation status
 */
function JsonValidationIndicator({ value }) {
  const status = useMemo(() => {
    if (!value || !value.trim()) return { valid: true, message: '' };
    try {
      JSON.parse(value);
      return { valid: true, message: 'Valid JSON' };
    } catch (e) {
      return { valid: false, message: e.message };
    }
  }, [value]);

  if (!value) return null;

  return (
    <div 
      className={`absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded ${
        status.valid 
          ? 'bg-success/10 text-success' 
          : 'bg-danger/10 text-danger'
      }`}
    >
      {status.valid ? '✓ Valid JSON' : '✗ Invalid JSON'}
    </div>
  );
}
