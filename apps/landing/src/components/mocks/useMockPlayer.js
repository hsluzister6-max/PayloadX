import { useEffect, useState } from "react";

/**
 * Cycles through animation steps on a fixed timeline.
 * steps: [{ at: msFromStart, ...payload }] — last step should cover full loop length via `loopMs`.
 */
export function useMockPlayer(steps, loopMs = 9000, enabled = true) {
  const [stepIndex, setStepIndex] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !steps?.length) return undefined;

    let raf = 0;
    let start = performance.now();
    let alive = true;

    const frame = (now) => {
      if (!alive) return;
      const t = (now - start) % loopMs;
      let idx = 0;
      for (let i = 0; i < steps.length; i++) {
        if (t >= steps[i].at) idx = i;
      }
      setStepIndex(idx);
      setTick(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [steps, loopMs, enabled]);

  return { step: steps[stepIndex] || steps[0], stepIndex, tick, loopMs };
}
