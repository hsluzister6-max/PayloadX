/**
 * useJsonWorker.js
 *
 * Manages a JsonWorker instance per raw-string change.
 * Terminates the previous worker before spawning a new one — no stale results.
 *
 * When running inside Tauri (window.__TAURI__ exists), the hook first tries
 * the native Rust `parse_json` command (serde_json — significantly faster for
 * large payloads). If the command is unavailable or errors, it falls back to
 * the Web Worker automatically.
 *
 * Returns:
 *   status  : 'idle' | 'parsing' | 'done' | 'error'
 *   parsed  : any | null
 *   error   : string | null
 *   parseMs : number   (shown in the toolbar badge)
 */

import { useState, useEffect, useRef } from 'react';

const EMPTY = { status: 'idle', parsed: null, error: null, parseMs: 0 };

export function useJsonWorker(raw) {
  const [state, setState] = useState(EMPTY);

  // Auto-incrementing message id — lets us discard responses from stale workers
  const idRef      = useRef(0);
  const workerRef  = useRef(null);
  const timerRef   = useRef(null);

  useEffect(() => {
    // Terminate any in-flight worker immediately
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    clearTimeout(timerRef.current);

    if (!raw) {
      setState(EMPTY);
      return;
    }

    const currentId = ++idRef.current;
    setState(prev => ({ ...prev, status: 'parsing' }));

    // ── Option A: Tauri native Rust command ──────────────────────────────────
    // Tauri v1: invoke lives on window.__TAURI__ directly
    // Tauri v2: invoke lives on window.__TAURI__.core
    // We probe safely so a browser dev session never crashes here.
    const tauriInvoke =
      typeof window !== 'undefined' &&
      (window.__TAURI__?.invoke ??           // Tauri v1
       window.__TAURI__?.core?.invoke ??     // Tauri v2
       null);

    if (tauriInvoke) {
      const t0 = performance.now();
      tauriInvoke('parse_json', { raw })
        .then(parsed => {
          if (idRef.current !== currentId) return; // stale
          setState({ status: 'done', parsed, error: null, parseMs: performance.now() - t0 });
        })
        .catch(() => {
          // Rust command unavailable or errored → fall back to Web Worker
          if (idRef.current !== currentId) return;
          spawnWorker(currentId, raw);
        });
      return;
    }

    // ── Option B: Web Worker ───────────────────────────────────────────────
    spawnWorker(currentId, raw);

    return () => {
      // Cleanup: terminate worker when `raw` changes or component unmounts
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      clearTimeout(timerRef.current);
    };

    function spawnWorker(id, rawStr) {
      let worker;
      try {
        worker = new Worker(
          new URL('../workers/JsonWorker.js', import.meta.url),
          { type: 'module' }
        );
      } catch (e) {
        // Worker creation failed (e.g. CSP restriction) — parse inline as last resort
        parseInline(id, rawStr);
        return;
      }

      workerRef.current = worker;

      worker.onmessage = ({ data }) => {
        if (data.id !== id) return; // discard stale response

        if (data.type === 'RESULT') {
          setState({ status: 'done', parsed: data.parsed, error: null, parseMs: data.parseMs });
        } else if (data.type === 'ERROR') {
          setState({ status: 'error', parsed: null, error: data.message, parseMs: data.parseMs });
        }

        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };

      worker.onerror = err => {
        if (idRef.current !== id) return;
        setState({ status: 'error', parsed: null, error: err.message, parseMs: 0 });
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };

      worker.postMessage({ type: 'PARSE', id, raw: rawStr });
    }

    /**
     * Absolute fallback: parse synchronously on the main thread.
     * Only used when Workers are unavailable (rare in modern Tauri/Vite).
     */
    function parseInline(id, rawStr) {
      const t0 = performance.now();
      timerRef.current = setTimeout(() => {
        if (idRef.current !== id) return;
        try {
          const cleaned = rawStr.replace(/^\uFEFF/, '').trim();
          let parsed;
          try {
            parsed = JSON.parse(cleaned);
          } catch (e) {
            const lines = cleaned.split('\n').filter(l => l.trim());
            if (lines.length > 1) {
              parsed = lines.map(l => JSON.parse(l));
            } else {
              throw e;
            }
          }
          setState({ status: 'done', parsed, error: null, parseMs: performance.now() - t0 });
        } catch (e) {
          setState({ status: 'error', parsed: null, error: e.message, parseMs: performance.now() - t0 });
        }
      }, 0);
    }
  }, [raw]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
