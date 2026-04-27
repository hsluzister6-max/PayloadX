/**
 * rust.js — Tauri IPC bridge for Rust-native core functions
 *
 * Each function:
 *  1. Tries to call the Rust command via Tauri IPC
 *  2. Falls back to a pure-JS implementation if Tauri is not available
 *     (e.g., running in a plain browser or test environment)
 *
 * Usage:
 *   import { rustUrlParseParams, rustUrlBuild, rustResolveEnv, rustParsePostman } from '@/lib/rust';
 */

import { isTauriRuntime } from '@/lib/runtime';

// ── Lazy Tauri invoke ─────────────────────────────────────────────────────────

let _invoke = null;

async function invoke(cmd, args) {
  if (!isTauriRuntime()) return null;
  if (!_invoke) {
    _invoke = (await import('@tauri-apps/api/tauri')).invoke;
  }
  return _invoke(cmd, args);
}

// ── URL ↔ Params Sync ─────────────────────────────────────────────────────────

/**
 * Parse a URL's query string into an array of { id, key, value, enabled } params.
 * Uses Rust for correctness and speed; falls back to JS on non-Tauri environments.
 *
 * @param {string} url
 * @param {Array}  disabledParams — existing disabled rows to preserve
 * @returns {Promise<Array>}
 */
export async function rustUrlParseParams(url, disabledParams = []) {
  try {
    const result = await invoke('url_parse_params', {
      url,
      disabledParams: disabledParams.filter(p => p.enabled === false),
    });
    if (result) return result;
  } catch (_) {
    // Rust call failed — use JS fallback
  }
  return jsParseParams(url, disabledParams);
}

/**
 * Rebuild a URL from a base URL and enabled params.
 * Uses Rust; falls back to JS.
 *
 * @param {string} baseUrl
 * @param {Array}  params
 * @returns {Promise<string>}
 */
export async function rustUrlBuild(baseUrl, params = []) {
  try {
    const result = await invoke('url_build_from_params', { baseUrl, params });
    if (result !== null) return result;
  } catch (_) {
    // fallthrough
  }
  return jsBuildUrl(baseUrl, params);
}

// ── Environment Variable Resolution ──────────────────────────────────────────

/**
 * Resolve {{VARIABLE}} tokens in a template string against an env map.
 * Uses Rust (single compiled regex, ~3-4× faster); falls back to JS.
 *
 * @param {string} template
 * @param {Object} env   — { KEY: 'value', ... }
 * @returns {Promise<string>}
 */
export async function rustResolveEnv(template, env = {}) {
  if (!template || typeof template !== 'string') return template;
  try {
    const result = await invoke('resolve_env_variables', { template, env });
    if (result !== null) return result;
  } catch (_) {
    // fallthrough
  }
  return _jsResolveEnv(template, env);
}

/**
 * Batch-resolve env variables across an entire JSON-serializable object.
 * Useful for pre-processing workflow nodes before execution.
 *
 * @param {object} obj
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function rustResolveEnvInObject(obj, env = {}) {
  try {
    const jsonStr = JSON.stringify(obj);
    const result = await invoke('resolve_env_in_object', { jsonValue: jsonStr, env });
    if (result) return JSON.parse(result);
  } catch (_) {
    // fallthrough
  }
  return _jsResolveEnvInObject(obj, env);
}

// ── Postman Collection Parser ─────────────────────────────────────────────────

/**
 * Parse a Postman Collection JSON string (v2.0 or v2.1) into PayloadX schema.
 * Uses Rust's strongly-typed serde parser; falls back to JS postmanParser.
 *
 * @param {string} json
 * @returns {Promise<ParsedCollection>}
 */
export async function rustParsePostman(json) {
  try {
    const result = await invoke('parse_postman_collection', { json });
    if (result) return result;
  } catch (_) {
    // fallthrough to JS
  }
  // Dynamic import to avoid pulling in the JS parser unless needed
  const { parsePostmanCollection } = await import('@/utils/postmanParser');
  return parsePostmanCollection(JSON.parse(json));
}

// ── JS Fallback Implementations ───────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';

export function jsParseParams(url = '', currentParams = []) {
  const parts = (url || '').split('?');
  if (parts.length < 2) {
    const disabled = currentParams.filter(p => p.enabled === false);
    return disabled.length ? disabled : [{ id: uuidv4(), key: '', value: '', enabled: true }];
  }
  const qStr = parts.slice(1).join('?');
  const pairs = qStr ? qStr.split('&') : [];
  let newParams = pairs.map(pair => {
    const [key, ...valParts] = pair.split('=');
    return { id: uuidv4(), key: key || '', value: valParts.join('=') || '', enabled: true };
  });
  const disabledParams = currentParams.filter(p => p.enabled === false);
  newParams = [...newParams, ...disabledParams];
  if (newParams.length === 0 || newParams[newParams.length - 1].key || newParams[newParams.length - 1].value) {
    newParams.push({ id: uuidv4(), key: '', value: '', enabled: true });
  }
  return newParams;
}

export function jsBuildUrl(url = '', currentParams = []) {
  const baseUrl = (url || '').split('?')[0];
  const activeParams = currentParams.filter(p => p.enabled !== false && (p.key || p.value));
  if (activeParams.length === 0) return baseUrl;
  const qs = activeParams.map(p => {
    if (!p.key && p.value) return `=${p.value}`;
    if (p.key && !p.value) return `${p.key}=`;
    return `${p.key}=${p.value}`;
  }).join('&');
  return `${baseUrl}?${qs}`;
}

const _envRegex = /\{\{([^}]+)\}\}/g;

function _jsResolveEnv(template, env) {
  return template.replace(_envRegex, (match, key) => {
    return env[key.trim()] ?? match;
  });
}

function _jsResolveEnvInObject(obj, env) {
  const str = JSON.stringify(obj);
  const resolved = str.replace(_envRegex, (match, key) => {
    const val = env[key.trim()];
    return val != null ? val : match;
  });
  try {
    return JSON.parse(resolved);
  } catch {
    return obj;
  }
}
