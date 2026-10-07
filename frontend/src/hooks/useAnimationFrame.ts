import { useEffect, useRef } from 'react';

export function useAnimationFrame(callback: (deltaMs: number) => void, active = true): void {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(100, now - last);
      last = now;
      ref.current(delta);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
