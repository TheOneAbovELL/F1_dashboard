import { describe, expect, it } from 'vitest';
import {
  cumulativeLengths,
  detectCorners,
  median,
  resampleByArcLength,
  smoothClosed,
} from '../src/infrastructure/track/trackBuilder.js';

/** A closed circle of radius `r`, in metres, sampled `n` times. */
const circle = (r: number, n: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
  });

describe('median', () => {
  it('returns 0 for an empty sample', () => {
    expect(median([])).toBe(0);
  });

  it('ignores input order', () => {
    expect(median([9, 1, 5, 3, 7])).toBe(5);
  });
});

describe('cumulativeLengths', () => {
  it('measures the closed loop, so the last entry is the full perimeter', () => {
    const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const cum = cumulativeLengths(square);
    expect(cum).toHaveLength(square.length + 1);
    expect(cum[0]).toBe(0);
    expect(cum.at(-1)).toBeCloseTo(40, 9);
  });

  it('is monotonically increasing', () => {
    const cum = cumulativeLengths(circle(100, 64));
    for (let i = 1; i < cum.length; i++) expect(cum[i]!).toBeGreaterThan(cum[i - 1]!);
  });
});

describe('resampleByArcLength', () => {
  it('produces the requested count with near-uniform spacing', () => {
    const out = resampleByArcLength(circle(500, 37), 400);
    expect(out).toHaveLength(400);

    const steps: number[] = [];
    for (let i = 1; i < out.length; i++) {
      steps.push(Math.hypot(out[i]![0] - out[i - 1]![0], out[i]![1] - out[i - 1]![1]));
    }
    const min = Math.min(...steps);
    const max = Math.max(...steps);
    expect(max - min).toBeLessThan(max * 0.05);
  });

  it('preserves the overall perimeter within a percent', () => {
    const resampled = resampleByArcLength(circle(500, 180), 900);
    const perimeter = cumulativeLengths(resampled).at(-1)!;
    expect(perimeter).toBeCloseTo(2 * Math.PI * 500, -1);
  });
});

describe('smoothClosed', () => {
  it('pulls a single spike back towards its neighbours without moving them far', () => {
    const pts = circle(500, 200);
    const spiked = pts.map((p, i) => (i === 40 ? ([p[0] + 300, p[1]] as [number, number]) : p));
    const smoothed = smoothClosed(spiked, 5);

    const before = Math.hypot(spiked[40]![0] - pts[40]![0], spiked[40]![1] - pts[40]![1]);
    const after = Math.hypot(smoothed[40]![0] - pts[40]![0], smoothed[40]![1] - pts[40]![1]);
    expect(after).toBeLessThan(before);
  });

  it('wraps around the seam rather than clamping at the ends', () => {
    const pts = circle(500, 120);
    const smoothed = smoothClosed(pts, 5);
    const radius = (p: [number, number]) => Math.hypot(p[0], p[1]);
    expect(radius(smoothed[0]!)).toBeCloseTo(radius(smoothed[60]!), 6);
  });
});

describe('detectCorners', () => {
  it('finds no corners on a circuit that is one long sweeping curve', () => {
    // Radius 900 m is far wider than any real corner; nothing should be flagged.
    const pts = resampleByArcLength(circle(900, 400), 1400);
    expect(detectCorners(pts, cumulativeLengths(pts))).toHaveLength(0);
  });

  it('flags the tight corners of a stadium circuit but not its straights', () => {
    // Two 60 m hairpins joined by two 1 km straights.
    const pts: [number, number][] = [];
    const straight = 1000;
    const radius = 60;
    for (let i = 0; i < 300; i++) pts.push([(i / 300) * straight, -radius]);
    for (let i = 0; i < 120; i++) {
      const a = -Math.PI / 2 + (i / 120) * Math.PI;
      pts.push([straight + radius * Math.cos(a), radius * Math.sin(a)]);
    }
    for (let i = 0; i < 300; i++) pts.push([straight - (i / 300) * straight, radius]);
    for (let i = 0; i < 120; i++) {
      const a = Math.PI / 2 + (i / 120) * Math.PI;
      pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }

    const resampled = resampleByArcLength(pts, 1400);
    const corners = detectCorners(resampled, cumulativeLengths(resampled));
    expect(corners).toHaveLength(2);
  });
});
