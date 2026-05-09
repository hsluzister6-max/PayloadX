import { v4 as uuidv4 } from 'uuid';

function rowIsBlank(row) {
  return (
    !String(row?.key ?? '').trim()
    && !String(row?.value ?? '').trim()
    && !String(row?.description ?? '').trim()
  );
}

/** Keep one trailing empty row like Postman (editable placeholders). */
export function ensureTrailingEmptyRow(items) {
  let list = Array.isArray(items) ? [...items] : [];
  while (list.length > 1 && rowIsBlank(list[list.length - 1]) && rowIsBlank(list[list.length - 2])) {
    list.pop();
  }
  if (list.length === 0) {
    return [{ id: uuidv4(), key: '', value: '', description: '', enabled: true }];
  }
  if (!rowIsBlank(list[list.length - 1])) {
    list.push({ id: uuidv4(), key: '', value: '', description: '', enabled: true });
  }
  return list;
}

/**
 * Postman-style key / value / description table for headers & query params.
 */
export default function KeyValueDescriptionTable({
  title,
  items,
  onItemsChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  descriptionPlaceholder = 'Description',
  datalistId,
}) {
  const rows = ensureTrailingEmptyRow(items);

  const rowId = (row, index) => row.id || row._id || `idx-${index}`;

  const updateAt = (index, patch) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onItemsChange(ensureTrailingEmptyRow(next));
  };

  const deleteAt = (index) => {
    const next = rows.filter((_, i) => i !== index);
    onItemsChange(ensureTrailingEmptyRow(next.length ? next : []));
  };

  const inputClass =
    'w-full min-w-0 bg-transparent border-0 outline-none text-[12px] leading-snug py-2.5 px-2 '
    + 'text-tx-primary placeholder:text-tx-muted/55 font-sans '
    + 'focus:ring-0 focus:bg-[var(--surface-2)]/50 rounded-none shadow-none';

  const checkClass =
    'h-3.5 w-3.5 shrink-0 cursor-pointer rounded border '
    + 'border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--accent)] '
    + 'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 '
    + 'accent-[var(--accent)] checked:bg-[var(--surface-3)] checked:border-[var(--accent)] '
    + 'disabled:opacity-40';

  return (
    <div className="flex flex-col h-full min-h-0">
      {title ? (
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[var(--border-1)]">
          <h3 className="text-[13px] font-semibold text-tx-primary tracking-tight">{title}</h3>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto px-0">
        {/* Column headers — horizontal dividers only (avoids light vertical strips / checkbox halo) */}
        <div
          className="grid items-stretch border-b border-[var(--border-1)] bg-[var(--surface-1)] sticky top-0 z-[1]"
          style={{ gridTemplateColumns: '36px minmax(140px,1fr) minmax(140px,1fr) minmax(160px,1.15fr) 32px' }}
        >
          <div className="flex items-center justify-center" aria-hidden />
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-tx-muted py-2 px-2">
            Key
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-tx-muted py-2 px-2">
            Value
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-tx-muted py-2 px-2">
            Description
          </div>
          <div className="py-2" aria-hidden />
        </div>

        {rows.map((row, index) => {
          const id = rowId(row, index);
          const enabled = row.enabled !== false;

          return (
            <div
              key={id}
              className="group grid items-stretch border-b border-[var(--border-1)] hover:bg-[var(--surface-2)]/35 transition-colors"
              style={{ gridTemplateColumns: '36px minmax(140px,1fr) minmax(140px,1fr) minmax(160px,1.15fr) 32px' }}
            >
              <div className="flex items-center justify-center py-1 pl-1 pr-0.5">
                <input
                  type="checkbox"
                  className={checkClass}
                  checked={enabled}
                  onChange={(e) => updateAt(index, { enabled: e.target.checked })}
                  title="Enable"
                />
              </div>
              <div className="min-w-0">
                <input
                  type="text"
                  className={inputClass}
                  placeholder={keyPlaceholder}
                  value={row.key ?? ''}
                  onChange={(e) => updateAt(index, { key: e.target.value })}
                  disabled={!enabled}
                  list={datalistId || undefined}
                  spellCheck={false}
                />
              </div>
              <div className="min-w-0">
                <input
                  type="text"
                  className={inputClass}
                  placeholder={valuePlaceholder}
                  value={row.value ?? ''}
                  onChange={(e) => updateAt(index, { value: e.target.value })}
                  disabled={!enabled}
                  spellCheck={false}
                />
              </div>
              <div className="min-w-0">
                <input
                  type="text"
                  className={`${inputClass} text-tx-secondary`}
                  placeholder={descriptionPlaceholder}
                  value={row.description ?? ''}
                  onChange={(e) => updateAt(index, { description: e.target.value })}
                  disabled={!enabled}
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => deleteAt(index)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-tx-muted hover:text-danger transition-opacity"
                  title="Remove row"
                  disabled={rows.length <= 1 && rowIsBlank(row)}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
