import { describe, expect, it } from 'vitest';
import { OPENF1_UNITS_PER_METRE, toMetres } from '../src/domain/units.js';

describe('toMetres', () => {
  it('treats an OpenF1 location unit as a decimetre', () => {
    expect(OPENF1_UNITS_PER_METRE).toBe(10);
    expect(toMetres(54_729)).toBeCloseTo(5472.9, 6);
  });

  it('is sign preserving', () => {
    expect(toMetres(-250)).toBe(-25);
    expect(toMetres(0)).toBe(0);
  });
});
