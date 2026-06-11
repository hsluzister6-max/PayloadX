/** Auto-pair delimiters for JSON editors (cross-platform textarea). */
export const JSON_AUTO_PAIRS = { '{': '}', '[': ']', '"': '"' };

/**
 * Resolve the typed character for auto-pairing.
 * Uses e.key; never maps single quote (') to double quote (").
 */
export function autoPairCharFromKey(e) {
  const key = e.key;
  if (key.length !== 1) return null;
  if (key === "'") return null;
  return JSON_AUTO_PAIRS[key] ? key : null;
}

/**
 * Handle auto-pair keydown for JSON. Returns true when the event was handled.
 */
export function handleJsonAutoPairKeyDown(e, { readOnly, getValue, applyEdit }) {
  if (readOnly) return false;

  const open = autoPairCharFromKey(e);
  if (!open) return false;

  const close = JSON_AUTO_PAIRS[open];
  const ta = e.target;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const value = getValue();

  // Overtype an existing closing delimiter.
  if (start === end && value[start] === close) {
    e.preventDefault();
    applyEdit({ text: value, selStart: start + 1, selEnd: start + 1 });
    return true;
  }

  e.preventDefault();

  if (start !== end) {
    const text = value.slice(0, start) + open + value.slice(start, end) + close + value.slice(end);
    applyEdit({ text, selStart: start + 1, selEnd: end + 1 });
    return true;
  }

  const text = value.slice(0, start) + open + close + value.slice(start);
  applyEdit({ text, selStart: start + 1, selEnd: start + 1 });
  return true;
}

/**
 * Delete empty auto-paired delimiters on Backspace. Returns true when handled.
 */
export function handleJsonAutoPairBackspace(e, { readOnly, getValue, applyEdit }) {
  if (readOnly) return false;

  const ta = e.target;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  if (start !== end || start <= 0) return false;

  const value = getValue();
  const open = value[start - 1];
  const close = JSON_AUTO_PAIRS[open];
  if (!close || value[start] !== close) return false;

  e.preventDefault();
  const text = value.slice(0, start - 1) + value.slice(start + 1);
  applyEdit({ text, selStart: start - 1, selEnd: start - 1 });
  return true;
}
