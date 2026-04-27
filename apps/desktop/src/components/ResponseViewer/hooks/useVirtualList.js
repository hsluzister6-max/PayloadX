/**
 * useVirtualList.js
 *
 * Zero-dependency virtual list hook.
 *
 * Usage:
 *   const { containerRef, startIdx, endIdx, totalHeight } = useVirtualList({
 *     count: lines.length,
 *     itemHeight: ROW_H,
 *     overscan: 8,
 *   });
 *
 * Then in JSX:
 *   <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {lines.slice(startIdx, endIdx + 1).map((ln, i) => (
 *         <div key={startIdx + i}
 *              style={{ position: 'absolute', top: (startIdx + i) * itemHeight, left: 0, right: 0 }}>
 *           <Row line={ln} />
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 *
 * Performance notes:
 * - Scroll events trigger requestAnimationFrame, NOT setState directly
 * - Range update only fires setState when the slice actually changes
 *   (avoids triggering re-renders on sub-pixel scrolls)
 * - ResizeObserver recalculates on container resize
 */

import { useState, useRef, useLayoutEffect, useCallback } from 'react';

const INITIAL_END = 60; // show up to 60 rows before first scroll event

export function useVirtualList({ count, itemHeight, overscan = 8 }) {
  const containerRef  = useRef(null);
  const rafRef        = useRef(null);

  // Store range as a ref for the compute function, and a state for render
  const rangeRef = useRef({ start: 0, end: Math.min(INITIAL_END, count - 1) });
  const [range, setRange] = useState(rangeRef.current);

  const compute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const height    = el.clientHeight || 600;

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end   = Math.min(count - 1, Math.ceil((scrollTop + height) / itemHeight) + overscan);

    // Skip setState if range hasn't changed — prevents excessive re-renders
    if (start === rangeRef.current.start && end === rangeRef.current.end) return;

    rangeRef.current = { start, end };
    setRange({ start, end });
  }, [count, itemHeight, overscan]);

  // Re-compute whenever count/itemHeight change (e.g. after expand/collapse)
  useLayoutEffect(() => {
    // Clamp end in case count shrank
    const clamped = { start: rangeRef.current.start, end: Math.min(rangeRef.current.end, count - 1) };
    if (clamped.end !== rangeRef.current.end) {
      rangeRef.current = clamped;
      setRange(clamped);
    }
    compute();
  }, [count, compute]);

  // Attach scroll + resize listeners
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    // ResizeObserver handles panel resize (drag splitter, window resize)
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(compute);
      });
      ro.observe(el);
    }

    // Initial compute
    compute();

    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
    };
  }, [compute]);

  return {
    containerRef,
    startIdx:    range.start,
    endIdx:      Math.max(0, range.end),
    totalHeight: count * itemHeight,
  };
}
