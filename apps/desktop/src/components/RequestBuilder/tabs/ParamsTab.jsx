import { useRequestStore } from '@/store/requestStore';
import { v4 as uuidv4 } from 'uuid';

function KeyValueRow({ item, onChange, onDelete, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) {
  return (
    <div className="flex items-center gap-2 group">
      <input
        type="checkbox"
        checked={item.enabled !== false}
        onChange={(e) => onChange({ ...item, enabled: e.target.checked })}
        className="w-3.5 h-3.5 accent-brand-500 flex-shrink-0"
      />
      <input
        type="text"
        placeholder={keyPlaceholder}
        value={item.key}
        onChange={(e) => onChange({ ...item, key: e.target.value })}
        className="bg-surface-800 border border-transparent hover:border-[var(--border-1)] focus:border-[var(--accent)] outline-none py-1 px-2 rounded-md text-[11px] flex-1 font-mono text-tx-primary transition-all placeholder-tx-muted"
      />
      <input
        type="text"
        placeholder={valuePlaceholder}
        value={item.value}
        onChange={(e) => onChange({ ...item, value: e.target.value })}
        className="bg-surface-800 border border-transparent hover:border-[var(--border-1)] focus:border-[var(--accent)] outline-none py-1 px-2 rounded-md text-[11px] flex-1 font-mono text-tx-primary transition-all placeholder-tx-muted"
      />
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-tx-muted hover:text-danger transition-all flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

export default function ParamsTab() {
  const { currentRequest, updateField } = useRequestStore();
  const params = currentRequest.params || [];

  const setParams = (newParams) => updateField('params', newParams);

  const addRow = () => setParams([...params, { id: uuidv4(), key: '', value: '', enabled: true }]);
  const updateRow = (id, updated) => setParams(params.map((p) => ((p.id || p._id) === id ? updated : p)));
  const deleteRow = (id) => setParams(params.filter((p) => (p.id || p._id) !== id));

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-surface-400">Query Parameters</span>
        <button onClick={addRow} className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Add
        </button>
      </div>
      {params.map((p, index) => {
        const rowId = p.id || p._id;
        return (
          <KeyValueRow
            key={rowId || index}
            item={p}
            onChange={(updated) => updateRow(rowId, updated)}
            onDelete={() => deleteRow(rowId)}
            keyPlaceholder="param_key"
            valuePlaceholder="value"
          />
        );
      })}
      {params.length === 0 && (
        <p className="text-tx-muted text-xs text-center py-4">No query parameters. Click Add to create one.</p>
      )}
    </div>
  );
}
