import { describe, expect, it } from 'vitest';
import {
  clock,
  compoundColour,
  compoundLetter,
  gap,
  lapTime,
  sectorTime,
} from '../src/utils/format.js';

describe('lapTime', () => {
  it('renders minutes, seconds and milliseconds', () => {
    expect(lapTime(92.456)).toBe('1:32.456');
    expect(lapTime(60)).toBe('1:00.000');
    expect(lapTime(5.5)).toBe('0:05.500');
  });

  it('shows placeholders for missing or non-finite values', () => {
    expect(lapTime(null)).toBe('--:--.---');
    expect(lapTime(Number.NaN)).toBe('--:--.---');
    expect(lapTime(Number.POSITIVE_INFINITY)).toBe('--:--.---');
  });
});

describe('sectorTime', () => {
  it('renders three decimals, or a placeholder', () => {
    expect(sectorTime(28.1)).toBe('28.100');
    expect(sectorTime(null)).toBe('--.---');
  });
});

describe('gap', () => {
  it('prefixes a plus sign and keeps millisecond precision', () => {
    expect(gap(1.234)).toBe('+1.234');
  });

  it('switches to minutes past a minute', () => {
    expect(gap(61.5)).toBe('+1:01.5');
  });

  it('prefers laps down when a car has been lapped', () => {
    expect(gap(12.3, 1)).toBe('+1 LAP');
    expect(gap(12.3, 2)).toBe('+2 LAPS');
  });

  it('shows a dash when there is no gap to report', () => {
    expect(gap(null)).toBe('—');
  });
});

describe('clock', () => {
  it('formats elapsed milliseconds as hh:mm:ss', () => {
    expect(clock(0)).toBe('00:00:00');
    expect(clock(3_661_000)).toBe('01:01:01');
  });

  it('never goes negative', () => {
    expect(clock(-5_000)).toBe('00:00:00');
  });
});

describe('tyre compounds', () => {
  it('maps known compounds to their letter and colour', () => {
    expect(compoundLetter('SOFT')).toBe('S');
    expect(compoundLetter('intermediate')).toBe('I');
    expect(compoundColour('SOFT')).toBe('#E8002D');
  });

  it('falls back for unknown or missing compounds', () => {
    expect(compoundLetter(null)).toBe('?');
    expect(compoundLetter('UNOBTAINIUM')).toBe('?');
    expect(compoundColour(null)).toBe('#4B4B63');
  });
});
