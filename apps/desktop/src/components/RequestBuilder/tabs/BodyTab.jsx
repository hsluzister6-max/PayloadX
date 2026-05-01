import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import Editor from '@monaco-editor/react';
import JsonEditor from './JsonEditor';

const BODY_MODES = [
  { id: 'none',        label: 'None' },
  { id: 'raw',         label: 'Raw' },
  { id: 'form-data',   label: 'Form Data' },
  { id: 'urlencoded',  label: 'URL Encoded' },
];

const RAW_LANGUAGES = ['json', 'text', 'xml', 'html'];

export default function BodyTab() {
  const { currentRequest, updateBody } = useRequestStore();
  const { theme } = useUIStore();
  const body = currentRequest.body || { mode: 'none', raw: '', rawLanguage: 'json' };

  const setMode = (mode) => updateBody({ mode });
  const setLanguage = (lang) => updateBody({ rawLanguage: lang });
  const setRaw = (raw) => updateBody({ raw });

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="flex items-center gap-1 p-3 border-b border-[var(--border-1)]">
        {BODY_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
              body.mode === m.id
                ? 'bg-[var(--surface-3)] text-tx-primary border border-[var(--border-2)]'
                : 'text-surface-500 hover:text-tx-primary border border-transparent'
            }`}
          >
            {m.label}
          </button>
        ))}

        {body.mode === 'raw' && (
          <div className="ml-auto flex items-center gap-1">
            {RAW_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  body.rawLanguage === lang
                    ? 'bg-surface-700 text-tx-primary'
                    : 'text-surface-500 hover:text-tx-primary'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body content */}
      <div className="flex-1">
        {body.mode === 'none' && (
          <div className="flex items-center justify-center h-full text-tx-muted text-sm">
            No body for this request
          </div>
        )}

        {body.mode === 'raw' && (
          <JsonEditor
            value={body.raw || ''}
            onChange={setRaw}
            language={body.rawLanguage}
            className="h-full border-none"
          />
        )}

        {body.mode === 'form-data' && (
          <FormDataEditor
            items={body.formData || []}
            onChange={(formData) => updateBody({ formData })}
          />
        )}

        {body.mode === 'urlencoded' && (
          <FormDataEditor
            items={body.urlencoded || []}
            onChange={(urlencoded) => updateBody({ urlencoded })}
            label="URL Encoded Parameters"
          />
        )}
      </div>
    </div>
  );
}

function FormDataEditor({ items, onChange, label = 'Form Data' }) {
  const addRow = () => onChange([...items, { key: '', value: '', enabled: true }]);
  const updateRow = (i, updated) => onChange(items.map((item, idx) => (idx === i ? updated : item)));
  const deleteRow = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-surface-400">{label}</span>
        <button onClick={addRow} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">+ Add</button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={item.enabled !== false}
            onChange={(e) => updateRow(i, { ...item, enabled: e.target.checked })}
            className="w-3.5 h-3.5 accent-brand-500"
          />
          <input
            type="text"
            placeholder="Key"
            value={item.key}
            onChange={(e) => updateRow(i, { ...item, key: e.target.value })}
            className="bg-surface-800 border border-transparent hover:border-[var(--border-1)] focus:border-[var(--accent)] outline-none py-1 px-2 rounded-md text-[11px] flex-1 font-mono text-tx-primary transition-all placeholder-tx-muted"
          />
          <input
            type="text"
            placeholder="Value"
            value={item.value}
            onChange={(e) => updateRow(i, { ...item, value: e.target.value })}
            className="bg-surface-800 border border-transparent hover:border-[var(--border-1)] focus:border-[var(--accent)] outline-none py-1 px-2 rounded-md text-[11px] flex-1 font-mono text-tx-primary transition-all placeholder-tx-muted"
          />
          <button onClick={() => deleteRow(i)} className="opacity-0 group-hover:opacity-100 text-tx-muted hover:text-danger transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
