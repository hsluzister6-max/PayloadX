/** Single-line / large minified body: avoid one giant `<pre>` (freezes WebKit). */
export const RAW_VIRTUAL_MIN_CHARS = 96 * 1024;

/**
 * Above this, use lazy-loaded Monaco for Raw (and nested Raw tab) — virtual DOM for tokens, folding, find.
 * Below: {@link RAW_VIRTUAL_MIN_CHARS} uses row virtualizer; smaller uses `<pre>`.
 */
export const MONACO_RAW_MIN_CHARS = 384 * 1024;
