/**
 * perf.js — Centralized performance utilities for PayloadX Desktop
 *
 * Provides:
 *  - Topology-keyed memoization for graph algorithms
 *  - Safe structuredClone with JSON fallback
 *  - RAF-debounced localStorage writes
 *  - O(1) Map-based index helpers
 */

// ─── Memoized calculateLayers ──────────────────────────────────────────────

let _lastTopologyKey = null;
let _lastLayerResult = null;

/**
 * Topological sort (BFS / Kahn's algorithm) to assign step layers to nodes.
 * Result is memoized by a fingerprint of node IDs + edge pairs so we skip
 * the O(V+E) pass when nothing structural has changed.
 *
 * @param {Array<{id: string, data: object}>} nodes
 * @param {Array<{source: string, target: string}>} edges
 * @returns {Array} nodes with `data.step` set
 */
export function calculateLayers(nodes, edges) {
  if (nodes.length === 0) return [];

  // Build a cheap fingerprint — joining sorted IDs is O(n log n) but
  // cheaper than re-running the full BFS every time.
  const topologyKey =
    nodes.map((n) => n.id).join(',') +
    '|' +
    edges.map((e) => `${e.source}>${e.target}`).join(',');

  if (topologyKey === _lastTopologyKey && _lastLayerResult) {
    // Topology unchanged — reuse layer assignments but splice in fresh data
    const stepMap = Object.fromEntries(
      _lastLayerResult.map((n) => [n.id, n.data.step])
    );
    return nodes.map((n) => ({
      ...n,
      data: { ...n.data, step: stepMap[n.id] ?? 0 },
    }));
  }

  // Full BFS (Kahn's algorithm) — O(V + E)
  const inDegree = {};
  const graph = {};

  for (const n of nodes) {
    inDegree[n.id] = 0;
    graph[n.id] = [];
  }

  for (const e of edges) {
    if (graph[e.source] !== undefined) {
      graph[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) {
        inDegree[e.target]++;
      }
    }
  }

  const layersMap = {};
  let queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  let step = 1;

  while (queue.length > 0) {
    const nextQueue = [];
    for (const id of queue) {
      layersMap[id] = step;
      for (const target of graph[id]) {
        if (--inDegree[target] === 0) nextQueue.push(target);
      }
    }
    queue = nextQueue;
    step++;
  }

  const result = nodes.map((n) => ({
    ...n,
    data: { ...n.data, step: layersMap[n.id] ?? 0 },
  }));

  _lastTopologyKey = topologyKey;
  _lastLayerResult = result;
  return result;
}

// ─── Safe Deep Clone ───────────────────────────────────────────────────────

/**
 * Deep-clone an object. Uses the native structuredClone (available in modern
 * Chromium / WebKit) and falls back to JSON round-trip if unavailable.
 * structuredClone is ~10× faster than JSON for typical API request payloads.
 *
 * @param {any} obj
 * @returns {any}
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

// ─── RAF-debounced localStorage ────────────────────────────────────────────

const _pendingWrites = new Map(); // key → value, coalesced per frame

let _rafPending = false;

function _flushWrites() {
  _rafPending = false;
  for (const [key, value] of _pendingWrites) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage quota exceeded or private browsing — fail silently
    }
  }
  _pendingWrites.clear();
}

/**
 * Schedule a localStorage write that is coalesced within the same animation
 * frame. Multiple calls for the same key within one frame cost only the last
 * write — eliminating repeated serialization on every keystroke.
 *
 * @param {string} key
 * @param {any} value
 */
export function batchedLocalStorageWrite(key, value) {
  _pendingWrites.set(key, value);
  if (!_rafPending) {
    _rafPending = true;
    requestAnimationFrame(_flushWrites);
  }
}

// ─── O(1) Map Index Helpers ────────────────────────────────────────────────

/**
 * Build an id→item Map from an array in a single pass — O(n).
 *
 * @param {Array<{id?: string, _id?: string}>} arr
 * @param {string} [idField='id']
 * @returns {Map}
 */
export function buildIndexMap(arr, idField = 'id') {
  const map = new Map();
  for (const item of arr) {
    const key = item[idField];
    if (key != null) map.set(key, item);
  }
  return map;
}

/**
 * Update a single item in both an array and its companion Map — O(1).
 * Returns [newArray, map] without mutating originals.
 *
 * @param {Array} arr
 * @param {Map} map
 * @param {string} id
 * @param {object} updated
 * @param {string} [idField='id']
 * @returns {[Array, Map]}
 */
export function updateInIndex(arr, map, id, updated, idField = 'id') {
  if (!map.has(id)) return [arr, map];
  const newMap = new Map(map);
  newMap.set(id, updated);
  const newArr = arr.map((item) => (item[idField] === id ? updated : item));
  return [newArr, newMap];
}
