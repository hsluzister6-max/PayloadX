import { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { FileBox, Trash2, Upload } from 'lucide-react';
import { arrayBufferToBase64, formatFileSize } from '@/utils/formMultipart.js';

const MAX_FILE_BYTES = 45 * 1024 * 1024;

/**
 * @typedef {{ fileName?: string, mimeType?: string, base64?: string, size?: number }} BinaryBody
 * @param {{ value: BinaryBody | null | undefined, onChange: (next: BinaryBody | null) => void }} props
 */
export default function BinaryBodyEditor({ value, onChange }) {
  const fileInputRef = useRef(null);
  const hasFile = Boolean(value?.base64 && value?.fileName);

  const attachFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`File too large (max ${formatFileSize(MAX_FILE_BYTES)})`);
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        onChange({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: arrayBufferToBase64(buffer),
          size: file.size,
        });
      } catch (err) {
        toast.error(err?.message || 'Could not read file');
      }
    },
    [onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && attachFile(files[0]),
    multiple: false,
    noClick: true,
  });

  const onHiddenFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await attachFile(file);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onHiddenFileChange}
      />

      <p className="text-[11px] text-tx-muted leading-snug">
        Send the selected file as the raw request body. Content-Type defaults to the file MIME type
        (or <code className="font-mono text-tx-secondary">application/octet-stream</code>). Max{' '}
        {formatFileSize(MAX_FILE_BYTES)}.
      </p>

      <div
        {...getRootProps()}
        className={`flex-1 min-h-[160px] rounded-xl border border-dashed transition-colors flex flex-col items-center justify-center gap-3 px-4 ${
          isDragActive
            ? 'border-[var(--accent)] bg-[var(--surface-2)]'
            : 'border-[var(--border-2)] bg-[var(--surface-1)]'
        }`}
      >
        <input {...getInputProps()} />

        {hasFile ? (
          <div className="w-full max-w-md flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] p-3">
              <div className="shrink-0 w-9 h-9 rounded-md bg-[var(--surface-3)] flex items-center justify-center text-tx-secondary">
                <FileBox size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-tx-primary truncate" title={value.fileName}>
                  {value.fileName}
                </p>
                <p className="text-[10px] text-tx-muted font-mono mt-0.5">
                  {value.mimeType || 'application/octet-stream'}
                  {value.size != null ? ` · ${formatFileSize(value.size)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="shrink-0 p-1.5 rounded-md text-tx-muted hover:text-danger hover:bg-[var(--surface-3)] transition-colors"
                title="Remove file"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-md bg-[var(--surface-3)] text-tx-primary border border-[var(--border-1)] hover:border-[var(--accent)] transition-colors inline-flex items-center gap-1.5"
              >
                <Upload size={12} />
                Replace file
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-11 h-11 rounded-full bg-[var(--surface-3)] flex items-center justify-center text-tx-muted">
              <Upload size={20} />
            </div>
            <p className="text-[12px] text-tx-secondary text-center">
              {isDragActive ? 'Drop file to attach' : 'Drag & drop a file here, or select one'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent)] text-white font-semibold"
            >
              Select file
            </button>
          </>
        )}
      </div>
    </div>
  );
}
