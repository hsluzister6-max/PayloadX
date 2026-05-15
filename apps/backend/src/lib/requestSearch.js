/**
 * Builds a MongoDB filter for full-text-style request search (name, URL, route, method, description).
 * Uses anchored project/team filters first; regex conditions narrow results within that scope.
 */

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * When the user pastes a full URL or types a path, add extra matchers on the stored url field.
 */
export function urlSearchVariants(raw) {
  const t = String(raw || '').trim();
  const out = [];
  if (!t) return out;

  if (t.includes('://')) {
    try {
      const u = new URL(t);
      const pathQuery = `${u.pathname}${u.search || ''}`;
      if (pathQuery && pathQuery !== '/') out.push(pathQuery);
      if (u.pathname && u.pathname !== '/') out.push(u.pathname);
      if (u.host) out.push(u.host);
    } catch {
      /* ignore invalid URL */
    }
  }

  if (t.startsWith('/')) {
    out.push(t);
    const noQs = t.split('?')[0];
    if (noQs && noQs !== t) out.push(noQs);
  }

  return [...new Set(out)];
}

function fieldMatchOr(pattern) {
  const p = escapeRegex(pattern);
  if (!p) return [];
  return [
    { name: { $regex: p, $options: 'i' } },
    { url: { $regex: p, $options: 'i' } },
    { description: { $regex: p, $options: 'i' } },
    { method: { $regex: p, $options: 'i' } },
  ];
}

/**
 * @param {string} rawSearch
 * @returns {object|null} — Mongo filter fragment (typically under $and) or null
 */
export function buildRequestSearchFilter(rawSearch) {
  const trimmed = String(rawSearch || '').trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).filter(Boolean);

  // "GET /users" / "post api/v1" — first token is HTTP method
  if (
    parts.length >= 2
    && HTTP_METHODS.has(parts[0].toUpperCase())
  ) {
    const method = parts[0].toUpperCase();
    const rest = parts.slice(1).join(' ');
    const safeRest = escapeRegex(rest);
    if (!safeRest) {
      return { method };
    }
    return {
      $and: [
        { method },
        {
          $or: [
            { name: { $regex: safeRest, $options: 'i' } },
            { url: { $regex: safeRest, $options: 'i' } },
            { description: { $regex: safeRest, $options: 'i' } },
          ],
        },
      ],
    };
  }

  // Multiple tokens: each must match somewhere (name, url, path, method, description)
  if (parts.length > 1) {
    return {
      $and: parts.map((chunk) => ({
        $or: fieldMatchOr(chunk),
      })),
    };
  }

  // Single token: broad match + URL/path variants
  const safe = escapeRegex(trimmed);
  const variantConds = urlSearchVariants(trimmed)
    .map((v) => ({ url: { $regex: escapeRegex(v), $options: 'i' } }));

  const baseOr = fieldMatchOr(trimmed);
  if (variantConds.length) {
    return { $or: [...baseOr, ...variantConds] };
  }
  return { $or: baseOr };
}
