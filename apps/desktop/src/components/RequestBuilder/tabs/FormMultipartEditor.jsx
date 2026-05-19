import { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Paperclip, Trash2, Layers, Upload } from 'lucide-react';
import {
  parseBulkFormDataLines,
  arrayBufferToBase64,
  formatFileSize,
} from '@/utils/formMultipart.js';

const MAX_FILE_BYTES = 45 * 1024 * 1024;

/** @returns {import('@/utils/formMultipart.js').FormDataRow} */
function normalizeRow(r) {
  if (!r || typeof r !== 'object') return emptyRow();
  return {
    key: r.key || '',
    value: r.value ?? '',
    enabled: r.enabled !== false,
    type: r.type === 'file' ? 'file' : 'text',
    fileName: r.fileName || '',
    mimeType: r.mimeType || '',
    base64: r.base64 || '',
  };
}

function emptyRow() {
  return {
    key: '',
    value: '',
    enabled: true,
    type: 'text',
    fileName: '',
    mimeType: '',
    base64: '',
  };
}

/**
 * @param {{ items: import('@/utils/formMultipart.js').FormDataRow[], onChange: (rows: import('@/utils/formMultipart.js').FormDataRow[]) => void }} props
 */
export default function FormMultipartEditor({ items, onChange }) {
  const rows = (items || []).length ? (items || []).map((r) => normalizeRow(r)) : [emptyRow()];
  const fileInputRef = useRef(null);
  const pickIndexRef = useRef(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const updateRow = useCallback(
    (index, patch) => {
      const next = rows.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
      onChange(next);
    },
    [rows, onChange],
  );

  const deleteRow = useCallback(
    (index) => {
      const next = rows.filter((_, idx) => idx !== index);
      onChange(next.length ? next : [emptyRow()]);
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...rows, emptyRow()]);
  }, [rows, onChange]);

  const applyBulk = useCallback(() => {
    const parsed = parseBulkFormDataLines(bulkText);
    if (!parsed.length) {
      toast.error('No valid lines — use key: value or key=value');
      return;
    }
    onChange([...rows, ...parsed]);
    setBulkText('');
    setBulkOpen(false);
    toast.success(`Added ${parsed.length} field(s)`);
  }, [bulkText, rows, onChange]);

  const attachFileToRow = useCallback(
    async (index, file) => {
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`File too large (max ${formatFileSize(MAX_FILE_BYTES)})`);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);
        updateRow(index, {
          type: 'file',
          base64,
          fileName: file.name || 'upload.bin',
          mimeType: file.type || 'application/octet-stream',
          value: '',
        });
        toast.success(`Attached ${file.name}`);
      } catch (err) {
        toast.error(err?.message || 'Could not read file');
      }
    },
    [updateRow],
  );

  const openFilePicker = (index) => {
    pickIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const onHiddenFileChange = async (e) => {
    const file = e.target.files?.[0];
    const idx = pickIndexRef.current;
    e.target.value = '';
    pickIndexRef.current = null;
    if (file == null || idx == null) return;
    await attachFileToRow(idx, file);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onHiddenFileChange}
      />

      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--border-1)] bg-[var(--surface-1)]">
        <span className="text-xs font-semibold text-surface-400">Multipart form-data</span>
        <button
          type="button"
          onClick={addRow}
          className="text-xs px-2 py-1 rounded-md bg-[var(--surface-3)] text-tx-primary border border-[var(--border-1)] hover:border-[var(--accent)] transition-colors"
        >
          + Row
        </button>
        <button
          type="button"
          onClick={() => setBulkOpen((o) => !o)}
          className="text-xs px-2 py-1 rounded-md flex items-center gap-1 bg-[var(--surface-3)] text-tx-primary border border-[var(--border-1)] hover:border-[var(--accent)] transition-colors"
        >
          <Layers size={12} />
          Bulk add
        </button>
        <span className="text-[10px] text-tx-muted ml-auto max-w-[min(420px,55vw)] leading-snug">
          Files → base64 for transport (desktop). Images, video, PDFs, docs supported. Max ~{formatFileSize(MAX_FILE_BYTES)} each.
        </span>
      </div>

      {bulkOpen && (
        <div className="shrink-0 px-3 py-2 border-b border-[var(--border-1)] space-y-2 bg-[var(--surface-2)]">
          <p className="text-[10px] text-tx-muted">
            One field per line: <code className="font-mono text-tx-secondary">key: value</code> or{' '}
            <code className="font-mono text-tx-secondary">key=value</code>. Lines starting with{' '}
            <code className="font-mono">#</code> are ignored.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`username: alice\nrole=guest`}
            rows={5}
            className="w-full text-[11px] font-mono rounded-md border border-[var(--border-1)] bg-[var(--bg-primary)] text-tx-primary px-2 py-1.5 outline-none focus:border-[var(--accent)] resize-y min-h-[80px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyBulk}
              className="text-xs px-3 py-1 rounded-md bg-[var(--accent)] text-white font-semibold"
            >
              Append fields
            </button>
            <button type="button" onClick={() => setBulkText('')} className="text-xs text-tx-muted hover:text-tx-secondary">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-2">
        {rows.map((item, i) => (
          <FormRow
            key={i}
            item={item}
            onPatch={(patch) => updateRow(i, patch)}
            onDelete={() => deleteRow(i)}
            onPickFile={() => openFilePicker(i)}
            onFileDrop={(file) => attachFileToRow(i, file)}
          />
        ))}
      </div>
    </div>
  );
}

function FormRow({ item, onPatch, onDelete, onPickFile, onFileDrop }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && onFileDrop(files[0]),
    noClick: true,
    multiple: false,
    disabled: item.type !== 'file',
  });

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-2 group">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.enabled !== false}
          onChange={(e) => onPatch({ enabled: e.target.checked })}
          className="w-3.5 h-3.5 accent-brand-500 shrink-0"
          title="Include when sending"
        />
        <input
          type="text"
          placeholder="Field name"
          value={item.key}
          onChange={(e) => onPatch({ key: e.target.value })}
          className="bg-surface-800 border border-transparent hover:border-[var(--border-1)] focus:border-[var(--accent)] outline-none py-1 px-2 rounded-md text-[11px] flex-1 min-w-[80px] font-mono text-tx-primary"
        />
        <div className="flex rounded-md border border-[var(--border-1)] overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => onPatch({ type: 'text', base64: '', fileName: '', mimeType: '' })}
            className={`text-[10px] px-2 py-1 font-bold uppercase ${item.type !== 'file' ? 'bg-[var(--surface-3)] text-[var(--accent)]' : 'text-tx-muted hover:text-tx-secondary'}`}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => onPatch({ type: 'file', value: '' })}
            className={`text-[10px] px-2 py-1 font-bold uppercase ${item.type === 'file' ? 'bg-[var(--surface-3)] text-[var(--accent)]' : 'text-tx-muted hover:text-tx-secondary'}`}
          >
            File
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded text-tx-muted hover:text-danger hover:bg-[var(--surface-2)] opacity-70 group-hover:opacity-100 transition-all shrink-0"
          title="Remove row"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {item.type === 'file' ? (
        <div
          {...getRootProps()}
          className={`flex flex-wrap items-center gap-2 rounded-md border border-dashed px-2 py-2 transition-colors ${
            isDragActive ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border-1)] bg-[var(--bg-primary)]'
          }`}
        >
          <input {...getInputProps()} />
          <button
            type="button"
            onClick={onPickFile}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[var(--surface-3)] border border-[var(--border-1)] text-tx-primary hover:border-[var(--accent)]"
          >
            <Paperclip size={12} />
            Choose file
          </button>
          <button
            type="button"
            onClick={onPickFile}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-tx-muted hover:text-tx-secondary"
          >
            <Upload size={12} />
            Drop files here when row type is File
          </button>
          {item.base64 ? (
            <span className="text-[11px] font-mono text-tx-secondary truncate flex-1 min-w-0">
              {item.fileName || 'attachment'}{' '}
              <span className="text-tx-muted">({item.mimeType || 'octet-stream'})</span>
            </span>
          ) : (
            <span className="text-[11px] text-tx-muted italic">No file attached</span>
          )}
          {item.base64 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPatch({ base64: '', fileName: '', mimeType: '' });
              }}
              className="text-[10px] text-danger hover:underline shrink-0"
            >
              Clear file
            </button>
          ) : null}
        </div>
      ) : (
        <input
          type="text"
          placeholder="Value"
          value={item.value}
          onChange={(e) => onPatch({ value: e.target.value })}
          className="bg-surface-800 border border-transparent hover:border-[var(--border-1)] focus:border-[var(--accent)] outline-none py-1 px-2 rounded-md text-[11px] w-full font-mono text-tx-primary"
        />
      )}
    </div>
  );
}
