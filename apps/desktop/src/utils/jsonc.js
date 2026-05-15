import { parse } from 'jsonc-parser';

const PARSE_OPTS = {
  allowTrailingComma: true,
  disallowComments: false,
  allowEmptyContent: true,
};

/**
 * Parse JSON with Comments (line // and block comments), trailing commas — VS Code JSONC rules.
 * @returns {{ ok: boolean, empty: boolean }}
 */
export function validateJsonc(text) {
  const s = String(text ?? '');
  if (!s.trim()) return { ok: true, empty: true };
  const errors = [];
  parse(s, errors, PARSE_OPTS);
  return { ok: errors.length === 0, empty: false };
}

/**
 * Parsed value for key extraction / formatting. Returns `undefined` if empty or invalid.
 * Note: JSON `null` is returned as `null` (valid).
 */
export function tryParseJsoncValue(text) {
  const s = String(text ?? '');
  if (!s.trim()) return undefined;
  const errors = [];
  const value = parse(s, errors, PARSE_OPTS);
  if (errors.length > 0) return undefined;
  return value;
}

/**
 * Strict JSON string for HTTP wire (comments & trailing commas removed).
 * If the text is not valid JSONC, returns the original string unchanged.
 */
export function jsoncToWireString(text) {
  const s = String(text ?? '');
  if (!s.trim()) return '';
  const errors = [];
  const value = parse(s, errors, PARSE_OPTS);
  if (errors.length > 0) return s;
  if (value === undefined) return '';
  return JSON.stringify(value);
}
