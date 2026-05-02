import { useCallback, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useUIStore } from '@/store/uiStore';
import {
  Braces,
  AlignLeft,
  Copy,
  Check,
  Sparkles,
  FileJson,
  FileCode,
  FileText,
  Code,
  Maximize2,
  FoldVertical,
  UnfoldVertical,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Production-level Monaco-based Editor
 */
export default function JsonEditor({ 
  value, 
  onChange, 
  language = 'json', 
  readOnly = false, 
  className = '',
  hideHeader = false 
}) {
  const { theme } = useUIStore();
  const editorRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  // Fallback timer: If Monaco hasn't mounted in 4s, use standard textarea
  useState(() => {
    const timer = setTimeout(() => {
      if (!editorRef.current) {
        setIsFallback(true);
        console.warn('Monaco failed to load in time, using fallback editor.');
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Map common names to Monaco language IDs
  const monacoLanguage = useMemo(() => {
    const map = {
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'text': 'plaintext',
    };
    return map[language] || language;
  }, [language]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    setIsFallback(false); // Explicitly disable fallback if it mounted

    // Configure Monaco for JSON with comments support
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        schemas: [],
        enableSchemaRequest: true,
      });
    }
  };

  const handleBeautify = useCallback(() => {
    if (!value) return;
    try {
      if (isFallback) {
         if (language === 'json') onChange(JSON.stringify(JSON.parse(value), null, 2));
      } else {
        editorRef.current?.getAction('editor.action.formatDocument').run();
      }
      toast.success(`${language.toUpperCase()} Formatted`);
    } catch (e) {
      toast.error(`Invalid ${language.toUpperCase()} structure`);
    }
  }, [value, language, isFallback, onChange]);

  const handleMinify = useCallback(() => {
    if (!value) return;
    try {
      let minified = value;
      if (language === 'json') {
        minified = JSON.stringify(JSON.parse(value));
      } else {
        minified = value.replace(/\s+/g, ' '); // Basic minification for others
      }
      onChange(minified);
      toast.success(`${language.toUpperCase()} Minified`);
    } catch (e) {
      toast.error('Could not minify: check syntax');
    }
  }, [value, onChange, language]);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  }, [value]);

  const handleFoldAll = useCallback(() => {
    editorRef.current?.trigger('fold', 'editor.foldAll');
  }, []);

  const handleUnfoldAll = useCallback(() => {
    editorRef.current?.trigger('unfold', 'editor.unfoldAll');
  }, []);

  const handleSearch = useCallback(() => {
    if (isFallback) {
       toast.info('Use Ctrl+F to search in fallback mode');
    } else {
      editorRef.current?.getAction('actions.find').run();
    }
  }, [isFallback]);

  const getLangLabel = () => {
    if (readOnly) return isFallback ? 'Response (Standard)' : 'Response';
    const map = {
      'json': 'JSON Editor',
      'xml': 'XML Editor',
      'html': 'HTML Editor',
      'text': 'Plain Text',
    };
    return (map[language] || `${language} Editor`) + (isFallback ? ' (Lite)' : '');
  };

  const getLangIcon = () => {
    switch (language) {
      case 'json': return <FileJson size={14} className="text-[#F7DF1E]" />;
      case 'xml': return <FileCode size={14} className="text-[#FF5733]" />;
      case 'html': return <Code size={14} className="text-[#E34F26]" />;
      default: return <FileText size={14} className="text-surface-400" />;
    }
  };

  return (
    <div className={`flex flex-col h-full bg-surface-1 rounded-xl overflow-hidden border border-[var(--border-2)] ${className}`}>
      {/* Premium Toolbar */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-2)] bg-surface-2/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-surface-3">
              {getLangIcon()}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-surface-500">
              {getLangLabel()}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSearch}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-surface-500 hover:text-[var(--accent)] transition-all flex items-center gap-1.5"
              title="Search (Ctrl+F)"
            >
              <Search size={14} />
              {readOnly && <span className="text-[10px] font-bold">Search</span>}
            </button>

            {!isFallback && <div className="w-px h-4 bg-[var(--border-2)] mx-1" />}

            {!isFallback && (
              <>
                <button
                  onClick={handleFoldAll}
                  className="p-1.5 rounded-lg hover:bg-surface-3 text-surface-500 hover:text-[var(--accent)] transition-all"
                  title="Fold All"
                >
                  <FoldVertical size={14} />
                </button>

                <button
                  onClick={handleUnfoldAll}
                  className="p-1.5 rounded-lg hover:bg-surface-3 text-surface-500 hover:text-[var(--accent)] transition-all"
                  title="Unfold All"
                >
                  <UnfoldVertical size={14} />
                </button>
              </>
            )}

            <div className="w-px h-4 bg-[var(--border-2)] mx-1" />

            {!readOnly && (
              <>
                <button
                  onClick={handleBeautify}
                  className="p-1.5 rounded-lg hover:bg-surface-3 text-surface-500 hover:text-[var(--accent)] transition-all flex items-center gap-1.5"
                  title="Beautify (Ctrl+Shift+F)"
                >
                  <Braces size={14} />
                  <span className="text-[10px] font-bold">Format</span>
                </button>

                <button
                  onClick={handleMinify}
                  className="p-1.5 rounded-lg hover:bg-surface-3 text-surface-500 hover:text-[var(--accent)] transition-all flex items-center gap-1.5"
                  title="Minify"
                >
                  <AlignLeft size={14} />
                  <span className="text-[10px] font-bold">Minify</span>
                </button>

                <div className="w-px h-4 bg-[var(--border-2)] mx-1" />
              </>
            )}

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-surface-500 hover:text-[var(--accent)] transition-all"
              title="Copy all"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 relative group">
        {isFallback ? (
          <textarea
            className="w-full h-full p-4 bg-[#07090d] text-tx-secondary font-mono text-xs outline-none resize-none selection:bg-[var(--accent)]/30"
            value={value || ''}
            readOnly={readOnly}
            onChange={(e) => onChange && onChange(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <Editor
            height="100%"
            language={monacoLanguage}
            value={value || ''}
            onChange={(val) => onChange && onChange(val || '')}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            onMount={handleEditorDidMount}
            loading={
              <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#07090d]">
                <div className="w-8 h-8 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-500 animate-pulse">Initializing Editor...</p>
              </div>
            }
            options={{
              readOnly,
              domReadOnly: readOnly,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              folding: true,
              formatOnPaste: true,
              formatOnType: true,
              wordWrap: 'on',
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              tabSize: 2,
              backgroundColor: 'transparent',
            }}
          />
        )}

        {/* Validation Status Overlay */}
        {language === 'json' && <JsonValidationStatus value={value} />}
      </div>
    </div>
  );
}


/**
 * Dynamic Validation Status with Visual Feedback
 */
function JsonValidationStatus({ value }) {
  const status = useMemo(() => {
    if (!value || !value.trim()) return null;
    try {
      JSON.parse(value.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''));
      return { valid: true, message: 'Valid JSON' };
    } catch (e) {
      return { valid: false, message: e.message };
    }
  }, [value]);

  if (!status) return null;

  return (
    <div
      className={`absolute bottom-4 right-6 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-lg backdrop-blur-md border animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none z-10 ${status.valid
          ? 'bg-green-500/10 text-green-500 border-green-500/20'
          : 'bg-red-500/10 text-red-500 border-red-500/20'
        }`}
    >
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${status.valid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`} />
        {status.valid ? 'JSON Valid' : 'Syntax Error'}
      </div>
    </div>
  );
}
