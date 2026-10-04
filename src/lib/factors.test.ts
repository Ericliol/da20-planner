import { describe, expect, it } from 'vitest';
import { MAX_TAKEOFF_KG } from './afm';
import { landingFactor, landingSlopeFactor, SURFACES, takeoffFactor, takeoffSlopeFactor } from './factors';

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

describe('surface factors (CAA Safety Sense 09)', () => {
  it('matches the published table', () => {
    expect(SURFACES['grass-dry']).toMatchObject({ takeoff: 1.2, landing: 1.15 });
    expect(SURFACES['grass-wet']).toMatchObject({ takeoff: 1.3, landing: 1.35 });
    expect(SURFACES['paved-wet']).toMatchObject({ takeoff: 1, landing: 1.15 });
    expect(SURFACES.soft).toMatchObject({ takeoff: 1.25, landing: 1.25 });
    expect(SURFACES['paved-dry']).toMatchObject({ takeoff: 1, landing: 1 });
  });
});

describe('slope factors (CAA Safety Sense 09 p. 13)', () => {
  it('x1.1 per 2% uphill for take-off, no credit downhill', () => {
    expect(takeoffSlopeFactor(2)).toBeCloseTo(1.1);
    expect(takeoffSlopeFactor(4)).toBeCloseTo(1.21);
    expect(takeoffSlopeFactor(1)).toBeCloseTo(1.0488, 3);
    expect(takeoffSlopeFactor(0)).toBe(1);
    expect(takeoffSlopeFactor(-2)).toBe(1);
  });
  it('x1.1 per 2% downhill for landing, no credit uphill', () => {
    expect(landingSlopeFactor(-2)).toBeCloseTo(1.1);
    expect(landingSlopeFactor(-1)).toBeCloseTo(1.0488, 3);
    expect(landingSlopeFactor(2)).toBe(1);
  });
});
