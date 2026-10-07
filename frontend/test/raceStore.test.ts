import { describe, expect, it } from 'vitest';
import { AnimationEngine } from '../src/utils/animationEngine.js';
import type { ReplayState } from '../src/types/index.js';

const state = (tMs: number, speed = 1): ReplayState => ({
  loaded: true,
  loadingPct: 100,
  playing: true,
  speed,
  tMs,
  durationMs: 7_000_000,
  error: null,
});

/**
 * Mirrors the rule the race store applies to `replay:state`. It lives here rather than
 * in the store so it can be exercised without a React runtime; the store calls the same
 * comparison.
 */
function jumped(prev: ReplayState, next: ReplayState): boolean {
  const drift = Math.abs(next.tMs - prev.tMs);
  return drift > Math.max(2_000, prev.speed * 2_000);
}

describe('replay discontinuity detection', () => {
  it('treats ordinary playback as continuous', () => {
    expect(jumped(state(10_000), state(10_100))).toBe(false);
    expect(jumped(state(10_000), state(11_500))).toBe(false);
  });

  it('allows for a bigger step when the replay is sped up', () => {
    expect(jumped(state(10_000, 8), state(24_000, 8))).toBe(false);
    expect(jumped(state(10_000, 1), state(24_000, 1))).toBe(true);
  });

  it('catches a seek backwards', () => {
    expect(jumped(state(600_000), state(10_000))).toBe(true);
  });

  it('catches a seek forwards, which used to slip through', () => {
    expect(jumped(state(10_000), state(2_400_000))).toBe(true);
  });
});

describe('AnimationEngine generation', () => {
  it('advances on reset so renderers can drop derived state', () => {
    const engine = new AnimationEngine();
    const before = engine.generation;
    engine.reset();
    expect(engine.generation).toBe(before + 1);
    engine.reset();
    expect(engine.generation).toBe(before + 2);
  });

  it('stays put while positions merely stream in', () => {
    const engine = new AnimationEngine();
    const before = engine.generation;
    engine.push([{ n: 1, x: 0, y: 0, h: 0, q: 1 }], 1_000);
    engine.push([{ n: 1, x: 1, y: 1, h: 0, q: 1 }], 1_100);
    expect(engine.generation).toBe(before);
  });
});
