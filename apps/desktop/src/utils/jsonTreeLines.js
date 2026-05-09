/**
 * Flatten JSON / array values into virtualized tree rows.
 * Same algorithm as PayloadX JsonTreeViewer and postman_json_viewer.html.
 */

function esc(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function buildLines(v, path, depth, trail, collapsed) {
  if (v === null) {
    return [
      {
        depth,
        path,
        col: false,
        col2: false,
        raw: `null${trail ? ',' : ''}`,
        parts: [{ t: 'null', s: 'null' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
      },
    ];
  }
  if (v === true || v === false) {
    return [
      {
        depth,
        path,
        col: false,
        col2: false,
        raw: String(v) + (trail ? ',' : ''),
        parts: [{ t: 'bool', s: String(v) }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
      },
    ];
  }
  if (typeof v === 'number') {
    return [
      {
        depth,
        path,
        col: false,
        col2: false,
        raw: String(v) + (trail ? ',' : ''),
        parts: [{ t: 'num', s: String(v) }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
      },
    ];
  }
  if (typeof v === 'string') {
    const i = esc(v);
    const d = `"${i}"` + (trail ? ',' : '');
    return [
      {
        depth,
        path,
        col: false,
        col2: false,
        raw: d,
        parts: [{ t: 'str', s: `"${i}"` }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
      },
    ];
  }

  if (Array.isArray(v)) {
    const isc = collapsed.has(path);
    if (!v.length) {
      return [
        {
          depth,
          path,
          col: false,
          col2: false,
          raw: `[]${trail ? ',' : ''}`,
          parts: [{ t: 'bkt', s: '[]' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
        },
      ];
    }
    if (isc) {
      const sum = `[…${v.length} item${v.length !== 1 ? 's' : ''}]` + (trail ? ',' : '');
      return [
        {
          depth,
          path,
          col: true,
          col2: true,
          raw: sum,
          parts: [
            { t: 'bkt', s: '[' },
            { t: 'dim', s: `…${v.length} item${v.length !== 1 ? 's' : ''}` },
            { t: 'bkt', s: ']' },
            ...(trail ? [{ t: 'pun', s: ',' }] : []),
          ],
        },
      ];
    }
    const ls = [{ depth, path, col: true, col2: false, raw: '[', parts: [{ t: 'bkt', s: '[' }] }];
    v.forEach((item, i) => {
      ls.push(...buildLines(item, `${path}[${i}]`, depth + 1, i < v.length - 1, collapsed));
    });
    ls.push({
      depth,
      path,
      col: true,
      col2: false,
      raw: ']' + (trail ? ',' : ''),
      parts: [{ t: 'bkt', s: ']' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
    });
    return ls;
  }

  if (typeof v === 'object') {
    const isc = collapsed.has(path);
    const keys = Object.keys(v);
    if (!keys.length) {
      return [
        {
          depth,
          path,
          col: false,
          col2: false,
          raw: `{}${trail ? ',' : ''}`,
          parts: [{ t: 'bkt', s: '{}' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
        },
      ];
    }
    if (isc) {
      const prev = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', …' : '');
      const sum = `{${prev}}` + (trail ? ',' : '');
      return [
        {
          depth,
          path,
          col: true,
          col2: true,
          raw: sum,
          parts: [{ t: 'bkt', s: '{' }, { t: 'dim', s: prev }, { t: 'bkt', s: '}' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
        },
      ];
    }
    const ls = [{ depth, path, col: true, col2: false, raw: '{', parts: [{ t: 'bkt', s: '{' }] }];
    keys.forEach((k, i) => {
      const kp = `${path}.${k}`;
      const kl = `"${esc(k)}"`;
      const cl = buildLines(v[k], kp, depth + 1, i < keys.length - 1, collapsed);
      const f = cl[0];
      ls.push({
        ...f,
        depth: depth + 1,
        path: kp,
        raw: `${kl}: ${f.raw}`,
        parts: [{ t: 'key', s: kl }, { t: 'pun', s: ': ' }, ...f.parts],
      });
      for (let j = 1; j < cl.length; j++) ls.push(cl[j]);
    });
    ls.push({
      depth,
      path,
      col: true,
      col2: false,
      raw: '}' + (trail ? ',' : ''),
      parts: [{ t: 'bkt', s: '}' }, ...(trail ? [{ t: 'pun', s: ',' }] : [])],
    });
    return ls;
  }
  return [];
}

export function collectPaths(v, path, out = new Set()) {
  if (v === null || typeof v !== 'object') return out;
  if (Array.isArray(v)) {
    if (v.length) {
      out.add(path);
      v.forEach((x, i) => collectPaths(x, `${path}[${i}]`, out));
    }
  } else {
    const k = Object.keys(v);
    if (k.length) {
      out.add(path);
      k.forEach((key) => collectPaths(v[key], `${path}.${key}`, out));
    }
  }
  return out;
}

/**
 * Postman-style NDJSON / JSON-seq: each record is a full JSON tree (syntax + copy),
 * separated by light dividers — not a single JSON array wrapper.
 */
export function buildNdjsonTreeLines(records, collapsed) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const lines = [];
  const n = records.length;
  records.forEach((rec, i) => {
    if (i > 0) {
      lines.push({
        depth: 0,
        path: `__ndj_div_${i}`,
        col: false,
        col2: false,
        raw: '',
        isDivider: true,
        dividerLabel: n > 1 ? `── record ${i + 1} / ${n} ──` : '',
        parts: [],
      });
    }
    const rootPath = `__r${i}`;
    lines.push(...buildLines(rec, rootPath, 0, false, collapsed));
  });
  return lines;
}

export function collectNdjsonPaths(records) {
  const out = new Set();
  if (!Array.isArray(records)) return out;
  records.forEach((rec, i) => {
    collectPaths(rec, `__r${i}`, out);
  });
  return out;
}
