/**
 * HTML injected into iframe previews so failed/incomplete SPAs are not a solid black view,
 * and optional in-document hints for dev-server markup.
 */

const MARKER = 'data-payloadx-preview';

/**
 * @param {string} html
 */
export function looksLikeDevServerSpa(html) {
  const s = typeof html === 'string' ? html : '';
  return (
    /\/@vite\//i.test(s)
    || /\/@react-refresh/i.test(s)
    || /<script[^>]*\btype\s*=\s*["']module["']/i.test(s)
  );
}

/**
 * Ensures readable baseline when scripts never run (empty #root, dark UA defaults, etc.).
 * @param {string} html
 */
export function injectPreviewBaseline(html) {
  if (!html || typeof html !== 'string') return html;
  if (html.includes(`<meta name="${MARKER}"`)) return html;

  const headSnippet = `<meta name="${MARKER}" content="1">
<meta name="color-scheme" content="light">
<style id="${MARKER}-base">
  html { background-color: #f8fafc !important; color: #0f172a !important; }
  body { background-color: #f8fafc !important; color: #0f172a !important; margin: 0; min-height: 100vh; }
  #root:empty { min-height: 40vh; }
</style>`;

  let out = html;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${headSnippet}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${headSnippet}</head>`);
  } else {
    out = `<!DOCTYPE html><html lang="en"><head>${headSnippet}</head><body>${out}</body></html>`;
  }

  return out;
}
