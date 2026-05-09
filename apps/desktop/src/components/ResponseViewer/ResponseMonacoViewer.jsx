import { useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import '@/lib/monacoEnvironment';
import Editor from '@monaco-editor/react';

function MonacoFallback() {
  return (
    <div className="h-full min-h-[200px] flex items-center justify-center text-tx-muted text-xs font-medium bg-[var(--surface-1)]">
      Loading editor…
    </div>
  );
}

/**
 * Read-only Monaco view for very large response bodies (virtualized tokenization; no full-DOM per line).
 * Bundle loads on first use only (`React.lazy`).
 */
export default function ResponseMonacoViewer({
  value = '',
  language = 'json',
  /** Above this size, use plaintext to reduce tokenizer cost (still scrollable). */
  heavyTokenizationThresholdChars = 2_000_000,
}) {
  const { theme } = useUIStore();
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  const effectiveLang = useMemo(() => {
    if (!value || value.length >= heavyTokenizationThresholdChars) return 'plaintext';
    return language;
  }, [value, language, heavyTokenizationThresholdChars]);

  const options = useMemo(
    () => ({
      readOnly: true,
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      folding: true,
      automaticLayout: true,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      renderWhitespace: 'selection',
      largeFileOptimizations: true,
      bracketPairColorization: { enabled: effectiveLang === 'json' },
      smoothScrolling: false,
      cursorBlinking: 'solid',
    }),
    [effectiveLang],
  );

  return (
    <div className="h-full min-h-0 flex flex-col response-mouse-select border border-[var(--border-1)] rounded-md overflow-hidden bg-[var(--surface-1)]">
      <Editor
        height="100%"
        language={effectiveLang}
        theme={monacoTheme}
        value={typeof value === 'string' ? value : String(value ?? '')}
        options={options}
        loading={<MonacoFallback />}
      />
    </div>
  );
}
