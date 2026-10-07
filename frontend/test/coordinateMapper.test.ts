import { describe, expect, it } from 'vitest';
import { CoordinateMapper } from '../src/utils/coordinateMapper.js';

const BOUNDS = { minX: -500, maxX: 500, minY: -250, maxY: 250 };

function mapper(width: number, height: number, padding = 56, rotation = 0) {
  const m = new CoordinateMapper();
  m.setBounds(BOUNDS);
  m.setViewport({ width, height, padding, rotation, flipY: true });
  return m;
}

describe('CoordinateMapper', () => {
  it('is not ready until it has both bounds and a sized viewport', () => {
    const m = new CoordinateMapper();
    expect(m.ready).toBe(false);
    m.setBounds(BOUNDS);
    expect(m.ready).toBe(false);
    m.setViewport({ width: 800, height: 0 });
    expect(m.ready).toBe(false);
    m.setViewport({ width: 800, height: 600 });
    expect(m.ready).toBe(true);
  });

  it('centres the circuit in the viewport', () => {
    const m = mapper(800, 600);
    const [x, y] = m.project(0, 0);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it('fits the circuit inside the padded box', () => {
    const m = mapper(800, 600, 56);
    const corners = [m.project(BOUNDS.minX, BOUNDS.minY), m.project(BOUNDS.maxX, BOUNDS.maxY)];
    for (const [x, y] of corners) {
      expect(x).toBeGreaterThanOrEqual(56 - 1e-6);
      expect(x).toBeLessThanOrEqual(800 - 56 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(56 - 1e-6);
      expect(y).toBeLessThanOrEqual(600 - 56 + 1e-6);
    }
  });

  it('flips the y axis, because screen y grows downwards', () => {
    const m = mapper(800, 600);
    const [, top] = m.project(0, BOUNDS.maxY);
    const [, bottom] = m.project(0, BOUNDS.minY);
    expect(top).toBeLessThan(bottom);
  });

  it('keeps a positive scale when the panel is shorter than twice the padding', () => {
    // A 90 px tall strip with 56 px padding used to produce a negative usable height,
    // which collapsed the circuit to a few pixels or inverted it entirely.
    const m = mapper(400, 90, 56);
    expect(m.pxPerMetre).toBeGreaterThan(0);

    const [, top] = m.project(0, BOUNDS.maxY);
    const [, bottom] = m.project(0, BOUNDS.minY);
    expect(top).toBeLessThan(bottom);
    expect(bottom - top).toBeGreaterThan(1);
  });

  it('still fits a very short panel inside its own height', () => {
    const m = mapper(400, 90, 56);
    for (const y of [m.project(0, BOUNDS.maxY)[1], m.project(0, BOUNDS.minY)[1]]) {
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(90 + 1e-6);
    }
  });

  it('rotates about the centre without moving the centre', () => {
    const m = mapper(800, 600, 56, 90);
    const [x, y] = m.project(0, 0);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it('closes the projected path', () => {
    const d = mapper(800, 600).projectPath([
      [-500, -250],
      [500, -250],
      [500, 250],
    ]);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('returns an empty path for no points', () => {
    expect(mapper(800, 600).projectPath([])).toBe('');
  });
});
