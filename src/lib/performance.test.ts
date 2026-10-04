import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, VH_XTN } from '../state';
import { computePerformance } from './performance';
import { computeWB } from './wb';

describe('TODR / LDR with surface factors', () => {
  const wb = computeWB(VH_XTN, DEFAULT_STATE.loading);
  const paved = computePerformance(DEFAULT_STATE, VH_XTN, wb);

  it('paved dry: AFM distance x 1.15', () => {
    expect(paved.todr).toBeCloseTo(paved.to50!.total * 1.15);
    expect(paved.ldr).toBeCloseTo(paved.ld.over50ft * 1.15);
  });

  it('dry grass: AFM x 1.2 x 1.15 take-off, x 1.15 x 1.15 landing', () => {
    const s = { ...DEFAULT_STATE, departure: { ...DEFAULT_STATE.departure, surface: 'grass-dry' as const } };
    const p = computePerformance(s, VH_XTN, wb);
    expect(p.todr).toBeCloseTo(paved.to50!.total * 1.2 * 1.15);
    // Arrival is "same as departure", so it inherits the grass surface.
    expect(p.ldr).toBeCloseTo(paved.ld.over50ft * 1.15 * 1.15);
  });

  it('wet grass arrival: landing x 1.35 x 1.15', () => {
    const s = {
      ...DEFAULT_STATE,
      arrival: { ...DEFAULT_STATE.arrival, sameAsDeparture: false, surface: 'grass-wet' as const },
    };
    const p = computePerformance(s, VH_XTN, wb);
    expect(p.ldr).toBeCloseTo(paved.ld.over50ft * 1.35 * 1.15);
    expect(p.todr).toBeCloseTo(paved.todr);
  });
});

describe('ignore headwind component', () => {
  const wb = computeWB(VH_XTN, DEFAULT_STATE.loading);
  const withWind = (dir: number, ignore: boolean) =>
    computePerformance(
      { ...DEFAULT_STATE, ignoreHeadwind: ignore, departure: { ...DEFAULT_STATE.departure, windDirDeg: dir, windKt: 10 } },
      VH_XTN,
      wb,
    );
  const calm = computePerformance(DEFAULT_STATE, VH_XTN, wb);

  it('is on by default', () => expect(DEFAULT_STATE.ignoreHeadwind).toBe(true));

  it('gives no credit for a headwind when ticked', () => {
    const p = withWind(0, true); // runway 000, wind 000 at 10 kt = 10 kt headwind
    expect(p.headwindIgnored).toBe(true);
    expect(p.depWindUsedKt).toBe(0);
    expect(p.todr).toBeCloseTo(calm.todr);
  });

  it('credits the headwind when unticked', () => {
    expect(withWind(0, false).todr).toBeLessThan(calm.todr);
  });

  it('always applies a tailwind', () => {
    const p = withWind(180, true); // 10 kt tailwind... beyond the chart's 5 kt
    expect(p.toError).not.toBe('');
    const tw = computePerformance(
      { ...DEFAULT_STATE, ignoreHeadwind: true, departure: { ...DEFAULT_STATE.departure, windDirDeg: 180, windKt: 4 } },
      VH_XTN,
      wb,
    );
    expect(tw.headwindIgnored).toBe(false);
    expect(tw.todr).toBeGreaterThan(calm.todr);
  });
});
