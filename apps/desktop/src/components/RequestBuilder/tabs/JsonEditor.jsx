import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useUIStore } from '@/store/uiStore';
import {
  Braces,
  AlignLeft,
  Copy,
  Check,
  FileJson,
  FileCode,
  FileText,
  Code,
  FoldVertical,
  UnfoldVertical,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Common REST API keys for autocomplete ────────────────────────────────────
const COMMON_REST_KEYS = [
  // Identity
  { label: 'id',           detail: 'Resource identifier',    insert: '"id": ""' },
  { label: '_id',          detail: 'MongoDB ObjectId',        insert: '"_id": ""' },
  { label: 'uuid',         detail: 'UUID field',              insert: '"uuid": ""' },
  // Person
  { label: 'name',         detail: 'Full name',               insert: '"name": ""' },
  { label: 'firstName',    detail: 'First name',              insert: '"firstName": ""' },
  { label: 'lastName',     detail: 'Last name',               insert: '"lastName": ""' },
  { label: 'username',     detail: 'Username / handle',       insert: '"username": ""' },
  { label: 'email',        detail: 'Email address',           insert: '"email": ""' },
  { label: 'phone',        detail: 'Phone number',            insert: '"phone": ""' },
  { label: 'avatar',       detail: 'Avatar URL',              insert: '"avatar": ""' },
  // Auth
  { label: 'password',     detail: 'Password field',          insert: '"password": ""' },
  { label: 'token',        detail: 'Auth token',              insert: '"token": ""' },
  { label: 'accessToken',  detail: 'JWT access token',        insert: '"accessToken": ""' },
  { label: 'refreshToken', detail: 'JWT refresh token',       insert: '"refreshToken": ""' },
  { label: 'apiKey',       detail: 'API key',                 insert: '"apiKey": ""' },
  { label: 'role',         detail: 'User role',               insert: '"role": ""' },
  { label: 'permissions',  detail: 'Permissions array',       insert: '"permissions": []' },
  // Status & control
  { label: 'status',       detail: 'Resource status',         insert: '"status": "active"' },
  { label: 'isActive',     detail: 'Active flag',             insert: '"isActive": true' },
  { label: 'isDeleted',    detail: 'Soft delete flag',        insert: '"isDeleted": false' },
  { label: 'enabled',      detail: 'Enable/disable flag',     insert: '"enabled": true' },
  { label: 'type',         detail: 'Resource type',           insert: '"type": ""' },
  { label: 'category',     detail: 'Category',                insert: '"category": ""' },
  { label: 'tags',         detail: 'Array of tags',           insert: '"tags": []' },
  // Timestamps
  { label: 'createdAt',    detail: 'Creation timestamp',      insert: '"createdAt": ""' },
  { label: 'updatedAt',    detail: 'Update timestamp',        insert: '"updatedAt": ""' },
  { label: 'deletedAt',    detail: 'Deletion timestamp',      insert: '"deletedAt": null' },
  { label: 'timestamp',    detail: 'Unix timestamp',          insert: '"timestamp": 0' },
  // Pagination
  { label: 'page',         detail: 'Page number',             insert: '"page": 1' },
  { label: 'limit',        detail: 'Items per page',          insert: '"limit": 10' },
  { label: 'offset',       detail: 'Pagination offset',       insert: '"offset": 0' },
  { label: 'total',        detail: 'Total count',             insert: '"total": 0' },
  // Data
  { label: 'data',         detail: 'Payload data',            insert: '"data": {}' },
  { label: 'meta',         detail: 'Metadata object',         insert: '"meta": {}' },
  { label: 'message',      detail: 'Response message',        insert: '"message": ""' },
  { label: 'error',        detail: 'Error info',              insert: '"error": null' },
  { label: 'code',         detail: 'Status/error code',       insert: '"code": 0' },
  { label: 'success',      detail: 'Success flag',            insert: '"success": true' },
  { label: 'result',       detail: 'Result payload',          insert: '"result": {}' },
  { label: 'results',      detail: 'Array of results',        insert: '"results": []' },
  { label: 'items',        detail: 'Array of items',          insert: '"items": []' },
  { label: 'count',        detail: 'Item count',              insert: '"count": 0' },
  // Address
  { label: 'address',      detail: 'Address object',          insert: '"address": {\n  "street": "",\n  "city": "",\n  "country": ""\n}' },
  { label: 'city',         detail: 'City name',               insert: '"city": ""' },
  { label: 'country',      detail: 'Country name',            insert: '"country": ""' },
  { label: 'zipCode',      detail: 'Zip / postal code',       insert: '"zipCode": ""' },
  // Numeric
  { label: 'price',        detail: 'Price / amount',          insert: '"price": 0.0' },
  { label: 'amount',       detail: 'Monetary amount',         insert: '"amount": 0.0' },
  { label: 'quantity',     detail: 'Item quantity',           insert: '"quantity": 1' },
  { label: 'weight',       detail: 'Weight value',            insert: '"weight": 0' },
  { label: 'rating',       detail: 'Rating value',            insert: '"rating": 0' },
  { label: 'score',        detail: 'Score value',             insert: '"score": 0' },
  // Media
  { label: 'url',          detail: 'URL string',              insert: '"url": "https://"' },
  { label: 'imageUrl',     detail: 'Image URL',               insert: '"imageUrl": ""' },
  { label: 'thumbnail',    detail: 'Thumbnail URL',           insert: '"thumbnail": ""' },
  { label: 'description',  detail: 'Text description',        insert: '"description": ""' },
  { label: 'title',        detail: 'Title field',             insert: '"title": ""' },
  { label: 'slug',         detail: 'URL slug',                insert: '"slug": ""' },
  { label: 'content',      detail: 'Content body',            insert: '"content": ""' },
  // Relations
  { label: 'userId',       detail: 'User reference ID',       insert: '"userId": ""' },
  { label: 'projectId',    detail: 'Project reference ID',    insert: '"projectId": ""' },
  { label: 'parentId',     detail: 'Parent reference ID',     insert: '"parentId": null' },
];

// ── Value snippet completions ─────────────────────────────────────────────────
const VALUE_SNIPPETS = [
  { label: 'true',         detail: 'Boolean true',            insert: 'true' },
  { label: 'false',        detail: 'Boolean false',           insert: 'false' },
  { label: 'null',         detail: 'Null value',              insert: 'null' },
  { label: '[] (array)',   detail: 'Empty array',             insert: '[]' },
  { label: '{} (object)',  detail: 'Empty object',            insert: '{}' },
  { label: 'pagination',   detail: 'Pagination snippet',      insert: '{\n  "page": 1,\n  "limit": 10,\n  "total": 0\n}' },
  { label: 'user snippet', detail: 'User object template',    insert: '{\n  "id": "",\n  "name": "",\n  "email": "",\n  "role": "user"\n}' },
];

/**
 * Extract all keys from the current JSON for context-aware suggestions
 */
function extractJsonKeys(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    const keys = new Set();
    function walk(o, depth = 0) {
      if (depth > 6 || o === null || typeof o !== 'object') return;
      Object.keys(o).forEach(k => { keys.add(k); walk(o[k], depth + 1); });
      if (Array.isArray(o)) o.forEach(item => walk(item, depth + 1));
    }
    walk(obj);
    return [...keys];
  } catch { return []; }
}

/**
 * Register the PayloadX smart autocomplete provider for JSON
 */
let completionDisposable = null;
function registerJsonAutocomplete(monaco, getValueFn) {
  if (completionDisposable) completionDisposable.dispose();

  completionDisposable = monaco.languages.registerCompletionItemProvider('json', {
    triggerCharacters: ['"', '{', ',', '\n', ':'],
    provideCompletionItems(model, position) {
      const text = model.getValue();
      const lineText = model.getLineContent(position.lineNumber);
      const lineUpToCursor = lineText.substring(0, position.column - 1);

      // Detect if we're typing a key (inside quotes at start of a property)
      const isTypingKey = /^\s*"?[\w]*$/.test(lineUpToCursor) || /,\s*"?[\w]*$/.test(lineUpToCursor);
      // Detect if we're typing a value (after the colon)
      const isTypingValue = /:\s*$/.test(lineUpToCursor) || /:\s*"?[\w]*$/.test(lineUpToCursor);

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column,
      };

      const CK = monaco.languages.CompletionItemKind;
      const suggestions = [];

      // Context-aware: keys already in this JSON
      const existingKeys = extractJsonKeys(getValueFn() || '');

      if (isTypingKey || (!isTypingValue && !isTypingKey)) {
        // 1. Keys from the current document (highest relevance)
        existingKeys.forEach(k => {
          suggestions.push({
            label: k,
            kind: CK.Field,
            detail: '↑ from this document',
            documentation: `Key found in current JSON`,
            insertText: `"${k}": `,
            range,
            sortText: '0' + k, // Sort first
          });
        });

        // 2. Common REST keys
        COMMON_REST_KEYS.forEach(item => {
          if (existingKeys.includes(item.label)) return; // Skip duplicates
          suggestions.push({
            label: item.label,
            kind: CK.Property,
            detail: item.detail,
            documentation: { value: `\`${item.insert}\`` },
            insertText: item.insert,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.None,
            range,
            sortText: '1' + item.label,
          });
        });
      }

      if (isTypingValue) {
        VALUE_SNIPPETS.forEach(item => {
          suggestions.push({
            label: item.label,
            kind: CK.Value,
            detail: item.detail,
            insertText: item.insert,
            range,
            sortText: '0' + item.label,
          });
        });
      }

      return { suggestions };
    },
  });
}

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
    setIsFallback(false);

    // Configure Monaco JSON validation
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        schemas: [],
        enableSchemaRequest: true,
      });

      // Register PayloadX smart autocomplete
      registerJsonAutocomplete(monaco, () => editor.getValue());
    }

    // Register custom keyboard shortcut: Ctrl+Shift+F → Format
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => editor.getAction('editor.action.formatDocument').run()
    );

    // Auto-format on paste if valid JSON
    editor.onDidPaste(() => {
      if (language !== 'json') return;
      setTimeout(() => {
        try {
          const val = editor.getValue();
          JSON.parse(val);
          editor.getAction('editor.action.formatDocument').run();
        } catch (_) {} // Not valid JSON yet, skip
      }, 50);
    });
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
              formatOnPaste: false, // We handle this manually with auto-format
              formatOnType: true,
              wordWrap: 'on',
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              // Autocomplete configuration
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,   // Show suggestions inside strings (keys)
              },
              quickSuggestionsDelay: 80,
              suggest: {
                insertMode: 'replace',
                snippetsPreventQuickSuggestions: false,
                showKeywords: true,
                showSnippets: true,
                showProperties: true,
                showValues: true,
                showWords: false,
                filterGraceful: true,
                localityBonus: true,
              },
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
