/**
 * Configure Monaco workers for Vite (ESM) + Tauri WebView. Import this module once before any Editor mounts.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

// eslint-disable-next-line no-undef
globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  },
};

loader.config({ monaco });

export { monaco };
