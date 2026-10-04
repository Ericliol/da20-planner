import { describe, expect, it } from 'vitest';
import { MAX_TAKEOFF_KG } from './afm';
import { landingFactor, takeoffFactor } from './factors';

describe('CAO 20.7.4 distance factors', () => {
  it('is 1.15 for the DA20-C1 (800 kg MTOW)', () => {
    expect(takeoffFactor(MAX_TAKEOFF_KG)).toBe(1.15);
    expect(landingFactor(MAX_TAKEOFF_KG)).toBe(1.15);
  });

  it('interpolates take-off between 2000 and 3500 kg', () => {
    expect(takeoffFactor(2000)).toBe(1.15);
    expect(takeoffFactor(2750)).toBeCloseTo(1.2);
    expect(takeoffFactor(3500)).toBeCloseTo(1.25);
    expect(takeoffFactor(5700)).toBe(1.25);
  });

  it('interpolates landing between 2000 and 4500 kg', () => {
    expect(landingFactor(2000)).toBe(1.15);
    expect(landingFactor(3250)).toBeCloseTo(1.29);
    expect(landingFactor(4500)).toBeCloseTo(1.43);
    expect(landingFactor(5700)).toBe(1.43);
  });
});
