import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationEngine } from '../src/utils/animationEngine.js';
import type { CarPosition } from '../src/types/index.js';

const car = (n: number, x: number, y: number, h = 0, q = 1): CarPosition => ({ n, x, y, h, q });

/** The engine samples against performance.now(), so the clock is driven by hand. */
let now = 0;

beforeEach(() => {
  now = 10_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AnimationEngine', () => {
  it('reports nothing before any snapshot arrives', () => {
    expect(new AnimationEngine().sample().size).toBe(0);
  });

  it('renders a snapshot once the render delay has elapsed', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 100, 200)], 5_000);

    // The engine renders 120 ms in the past, so time has to move on a little.
    now += 200;
    const out = engine.sample();
    expect(out.get(1)).toMatchObject({ n: 1, x: 100, y: 200 });
  });

  it('interpolates between two snapshots', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 0, 0)], 5_000);
    // Snapshots arrive as fast as replay time passes; drifting far from that would make
    // the engine re-anchor instead of interpolating.
    now += 900;
    engine.push([car(1, 100, 50)], 6_000);

    const rendered = engine.sample().get(1)!;
    expect(rendered.x).toBeGreaterThan(10);
    expect(rendered.x).toBeLessThan(90);
    expect(rendered.y).toBeCloseTo(rendered.x / 2, 6);
  });

  it('takes the shortest way round when heading wraps past pi', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 0, 0, Math.PI - 0.1)], 5_000);
    now += 900;
    engine.push([car(1, 0, 0, -Math.PI + 0.1)], 6_000);

    const h = engine.sample().get(1)!.h;
    // Interpolating the long way would land near 0; the short way stays near pi.
    expect(Math.abs(h)).toBeGreaterThan(Math.PI - 0.2);
  });

  it('carries a driver forward when the next snapshot omits them', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 10, 10), car(2, 20, 20)], 5_000);
    now += 900;
    engine.push([car(1, 30, 30)], 6_000);

    expect(engine.sample().get(2)).toMatchObject({ x: 20, y: 20 });
  });

  it('reuses its output objects so the render loop does not allocate per frame', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 0, 0)], 5_000);
    now += 200;
    const first = engine.sample().get(1);

    engine.push([car(1, 10, 10)], 6_000);
    now += 1_000;
    expect(engine.sample().get(1)).toBe(first);
  });

  it('drops everything on reset', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 10, 10)], 5_000);
    now += 200;
    expect(engine.sample().size).toBe(1);

    engine.reset();
    expect(engine.sample().size).toBe(0);
  });

  it('re-anchors after a seek instead of racing to catch up', () => {
    const engine = new AnimationEngine();
    engine.push([car(1, 0, 0)], 5_000);
    now += 200;
    engine.sample();

    // A seek jumps the replay clock far from where the engine was anchored.
    engine.push([car(1, 500, 500)], 2_400_000);
    now += 200;
    const out = engine.sample().get(1)!;
    expect(out.x).toBeCloseTo(500, 6);
    expect(out.y).toBeCloseTo(500, 6);
  });

  it('keeps the buffer bounded under a long run', () => {
    const engine = new AnimationEngine();
    for (let i = 0; i < 500; i++) {
      engine.push([car(1, i, i)], 5_000 + i * 100);
      now += 100;
    }
    // Still answers, and from recent data rather than the start of the session.
    expect(engine.sample().get(1)!.x).toBeGreaterThan(400);
  });
});
