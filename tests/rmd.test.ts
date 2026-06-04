import { describe, it, expect } from 'vitest';
import { calculateRMD } from '../src/retirement/savings';

describe('RMD calculations (Table III)', () => {
  it('uses Table III denominator for given age (72)', () => {
    const rmd = calculateRMD(1954, 72, 100_000); // age provided
    // 100000 / 27.4 = 3649.635...
    expect(rmd).toBeCloseTo(100_000 / 27.4, 2);
  });

  it('clamps ages below 72 to 72', () => {
    const rmd = calculateRMD(1990, 60, 50_000);
    expect(rmd).toBeCloseTo(50_000 / 27.4, 2);
  });

  it('clamps ages above 120 to 120 (denominator 2.0)', () => {
    const rmd = calculateRMD(1800, 130, 200_000);
    expect(rmd).toBeCloseTo(200_000 / 2.0, 2);
  });

  it('returns 0 for negative balance (treated as zero)', () => {
    const rmd = calculateRMD(1950, 75, -1000);
    expect(rmd).toBe(0);
  });
});
