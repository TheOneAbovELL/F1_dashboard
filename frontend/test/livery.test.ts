import { describe, expect, it } from 'vitest';
import { buildLivery, isSecondCar, luminance, shade } from '../src/utils/livery.js';

describe('shade', () => {
  it('lightens towards white and darkens towards black', () => {
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 0)).toBe('#808080');
  });

  it('accepts three-digit hex', () => {
    expect(shade('#fff', 0)).toBe('#ffffff');
  });
});

describe('luminance', () => {
  it('ranks white above black', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 6);
    expect(luminance('#000000')).toBeCloseTo(0, 6);
  });
});

describe('buildLivery', () => {
  it('derives a full livery from a team colour', () => {
    const livery = buildLivery('#3671C6');
    expect(livery.primary).toBe('#3671C6');
    expect(livery.highlight).not.toBe(livery.shadow);
    expect(livery.ink).toBe('#FFFFFF');
  });

  it('uses dark ink on a bright team colour', () => {
    expect(buildLivery('#FFFFFF').ink).toBe('#0A0A11');
  });

  it('falls back to a neutral colour when the input is not a hex triplet', () => {
    expect(buildLivery('not-a-colour').primary).toBe('#9AA0A6');
    expect(buildLivery('').primary).toBe('#9AA0A6');
  });
});

describe('isSecondCar', () => {
  it('treats the higher number of a team pair as the second car', () => {
    expect(isSecondCar(44, [44, 63])).toBe(false);
    expect(isSecondCar(63, [44, 63])).toBe(true);
  });

  it('does not mark a lone car as second', () => {
    expect(isSecondCar(44, [44])).toBe(false);
  });

  it('does not mutate the list it is given', () => {
    const numbers = [63, 44];
    isSecondCar(44, numbers);
    expect(numbers).toEqual([63, 44]);
  });
});
