import { useState, useEffect } from 'react';
import { X, Plus, Trash2, KeyRound, ChevronDown, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const TARGET_OPTIONS = [
  { value: 'header', label: 'Header' },
  { value: 'body', label: 'Body' },
  { value: 'params', label: 'Query Param' },
  { value: 'variable', label: 'Variable' },
];

function TargetSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = TARGET_OPTIONS.find(o => o.value === value) || TARGET_OPTIONS[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-all min-w-[100px] justify-between"
      >
        {current.label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface-1 border border-[var(--border-2)] rounded-xl shadow-glass p-1 min-w-[110px]">
          {TARGET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                value === opt.value
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--text-primary)] hover:bg-surface-3'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shown when an API node with preset manual_inputs reaches execution.
 * User can accept/edit presets or add extra runtime values.
 */
export default function ManualInputModal({ node, onProceed, onCancel }) {
  const inputs = node?.data?.manual_inputs || [];

  const buildInitialRows = () =>
    inputs.map((field) => ({
      id: field.id,
      fieldName: field.fieldName || field.key,
      key: field.key,
      value: field.preset || '',
      target: field.target || 'variable',
      required: !!field.required,
    }));

  const [rows, setRows] = useState(buildInitialRows);
  const [extraRows, setExtraRows] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setRows(buildInitialRows());
    setExtraRows([]);
    setErrors({});
  }, [node?.id]);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
  };

  const updateExtra = (id, field, value) => {
    setExtraRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
  };

  const addExtraRow = () => {
    setExtraRows(prev => [...prev, { id: uuidv4(), key: '', value: '', target: 'variable' }]);
  };

  const removeExtra = (id) => {
    setExtraRows(prev => prev.filter(r => r.id !== id));
  };

  const handleProceed = () => {
    const newErrors = {};

    rows.forEach(r => {
      if (r.required && !r.value.trim()) newErrors[r.id] = 'Required';
    });
    extraRows.forEach(r => {
      if (!r.key.trim()) newErrors[r.id] = 'Key required';
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const runtimeValues = {};
    rows.forEach(r => {
      if (r.key) runtimeValues[r.key] = { value: r.value, target: r.target };
    });
    extraRows.forEach(r => {
      if (r.key.trim()) {
        runtimeValues[r.key.trim()] = { value: r.value, target: r.target };
      }
    });

    onProceed(runtimeValues);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-surface-1 border border-[var(--border-2)] rounded-3xl shadow-glass-heavy w-full max-w-[620px] max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-2)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <KeyRound size={18} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-[var(--text-primary)]">{node?.data?.name || 'Input Required'}</h2>
              <p className="text-[11px] text-surface-500 font-medium mt-0.5">
                Enter values to continue this API step
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-surface-3 text-surface-500 hover:text-[var(--text-primary)] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-hide">
          {rows.length === 0 && extraRows.length === 0 && (
            <div className="text-center py-8 text-[12px] text-surface-500 font-medium">
              No preset fields. Add a runtime value below.
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2.5">
              {rows.map(row => (
                <div key={row.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold text-surface-400 mb-1">
                      {row.fieldName}
                      {row.required && <span className="text-red-400 ml-1">*</span>}
                      <span className="ml-1.5 text-surface-600 font-mono text-[9px]">{`{{${row.key}}}`}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter ${row.fieldName}...`}
                      value={row.value}
                      onChange={e => updateRow(row.id, 'value', e.target.value)}
                      className={`w-full px-3 py-2 bg-surface-2 border rounded-xl text-[12px] font-mono text-[var(--text-primary)] focus:outline-none transition-all placeholder:text-surface-600 ${
                        errors[row.id]
                          ? 'border-red-500/60 focus:border-red-500'
                          : 'border-[var(--border-2)] focus:border-purple-500/60'
                      }`}
                    />
                    {errors[row.id] && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle size={10} className="text-red-400" />
                        <span className="text-[10px] text-red-400 font-bold">{errors[row.id]}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-5 shrink-0">
                    <span className="inline-flex px-2.5 py-1.5 bg-surface-3 border border-[var(--border-2)] rounded-lg text-[10px] font-bold text-surface-400 uppercase">
                      {TARGET_OPTIONS.find(o => o.value === row.target)?.label || 'Variable'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {extraRows.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)]">
                  Additional Values
                </span>
                <div className="flex-1 h-px bg-[var(--accent)]/15" />
              </div>
              <div className="space-y-2.5">
                {extraRows.map(row => (
                  <div key={row.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 flex gap-2">
                      <div className="w-[40%]">
                        <label className="block text-[10px] font-bold text-surface-400 mb-1">Key</label>
                        <input
                          type="text"
                          placeholder="variable_name"
                          value={row.key}
                          onChange={e => updateExtra(row.id, 'key', e.target.value)}
                          className={`w-full px-3 py-2 bg-surface-2 border rounded-xl text-[12px] font-mono text-[var(--text-primary)] focus:outline-none transition-all placeholder:text-surface-600 ${
                            errors[row.id]
                              ? 'border-red-500/60 focus:border-red-500'
                              : 'border-[var(--border-2)] focus:border-[var(--accent)]'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-surface-400 mb-1">Value</label>
                        <input
                          type="text"
                          placeholder="value..."
                          value={row.value}
                          onChange={e => updateExtra(row.id, 'value', e.target.value)}
                          className="w-full px-3 py-2 bg-surface-2 border border-[var(--border-2)] rounded-xl text-[12px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all placeholder:text-surface-600"
                        />
                      </div>
                    </div>
                    <div className="pt-5">
                      <TargetSelect value={row.target} onChange={v => updateExtra(row.id, 'target', v)} />
                    </div>
                    <button
                      onClick={() => removeExtra(row.id)}
                      className="pt-6 text-surface-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={addExtraRow}
            className="w-full py-2.5 border border-dashed border-[var(--border-2)] rounded-xl text-[11px] font-bold text-surface-500 hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all flex items-center justify-center gap-2"
          >
            <Plus size={13} />
            Add Runtime Value
          </button>
        </div>

        <div className="px-6 py-5 border-t border-[var(--border-2)] flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-surface-2 border border-[var(--border-2)] rounded-xl text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] hover:bg-surface-3 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="flex-2 px-8 py-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-[11px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-600/30 transition-all"
          >
            Continue Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
