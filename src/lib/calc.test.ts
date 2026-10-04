import { describe, expect, it } from 'vitest';
import { ENVELOPE, IN_PER_M, LB_PER_KG } from './afm';
import { densityAltitudeFt, pressureAltitudeFt, windComponents } from './atmos';
import { OutOfChartError } from './interp';
import { landingDistance } from './landing';
import { takeoffDistance } from './takeoff';
import { mergeBuiltInAircraft, VH_HUU, VH_XTN } from '../state';
import { type Aircraft, computeWB } from './wb';

const noFuel = { fuelL: 0, taxiFuelL: 0, tripFuelL: 0, baggageExtKg: 0 };

describe('weight & balance', () => {
  it('envelope matches AFM Fig 6.8 corners (measured from the PDF vectors)', () => {
    const k = LB_PER_KG * IN_PER_M;
    const fig68 = [[9540, 1200], [13141, 1653], [14235, 1764], [21450, 1764], [20629, 1653], [14976, 1200]];
    ENVELOPE.forEach(([kgm, kg], i) => {
      expect(Math.abs(kgm * k - fig68[i][0])).toBeLessThan(25); // < 0.25% (metric vs inch rounding in AFM 2.8)
      expect(Math.abs(kg * LB_PER_KG - fig68[i][1])).toBeLessThan(1);
    });
  });

  it('matches the AFM Fig 6.7 example (1605 lb / 17600 in.lb)', () => {
    const ac: Aircraft = { ...VH_XTN, emptyMassKg: 1153 / LB_PER_KG, emptyArmM: 12562 / 1153 / IN_PER_M };
    const r = computeWB(ac, { ...noFuel, seatsKg: 359 / LB_PER_KG, baggageKg: 0, fuelL: 93 / LB_PER_KG / 0.72 });
    expect(r.zeroFuel.massKg * LB_PER_KG).toBeCloseTo(1512, 0);
    expect(r.zeroFuel.momentKgM * LB_PER_KG * IN_PER_M).toBeCloseTo(14583, -1);
    expect(r.takeoff.massKg * LB_PER_KG).toBeCloseTo(1605, 0);
    expect(r.takeoff.momentKgM * LB_PER_KG * IN_PER_M).toBeCloseTo(17600, -1);
    expect(r.ok).toBe(true);
  });

  // VH-XTN load data sheet (WB-6071, 30-Nov-15), page 8 "Loading check".
  it.each([
    { plot: 1, seats: 180, fuelKg: 44, mass: 800.0, armMm: 282.8 },
    { plot: 2, seats: 120, fuelKg: 65, mass: 761.0, armMm: 308.7 },
    { plot: 3, seats: 84, fuelKg: 65, mass: 725.0, armMm: 317.0 },
  ])('matches VH-XTN load sheet plot $plot', ({ seats, fuelKg, mass, armMm }) => {
    const r = computeWB(VH_XTN, { ...noFuel, seatsKg: seats, baggageKg: 20, fuelL: fuelKg / 0.72 });
    expect(r.takeoff.massKg).toBeCloseTo(mass, 1);
    expect(r.takeoff.armM * 1000).toBeCloseTo(armMm, 0);
    expect(r.ok).toBe(true);
  });

  it('VH-XTN empty weight matches its load data sheet (556.0 kg, 147753 kg·mm)', () => {
    const r = computeWB(VH_XTN, { ...noFuel, seatsKg: 0, baggageKg: 0 });
    expect(r.zeroFuel.massKg).toBeCloseTo(556.0);
    expect(r.zeroFuel.momentKgM * 1000).toBeCloseTo(147753, 0);
    expect(r.zeroFuel.armM * 1000).toBeCloseTo(265.7, 1);
  });

  it('updates saved built-in aircraft with older data, keeps others', () => {
    const oldXtn = { ...VH_XTN, emptyArmM: 0.2657, dataRev: undefined };
    const custom = { ...VH_XTN, id: 'ac-1', registration: 'VH-ABC' };
    const merged = mergeBuiltInAircraft([oldXtn, custom]);
    expect(merged.find((a) => a.id === 'vh-xtn')?.emptyArmM).toBeCloseTo(147.753 / 556);
    expect(merged.find((a) => a.id === 'ac-1')).toBe(custom);
    expect(merged.some((a) => a.id === 'vh-huu')).toBe(true);
  });

  it('VH-HUU empty weight matches its load data sheet (548.5 kg, 130578 kg·mm)', () => {
    const r = computeWB(VH_HUU, { ...noFuel, seatsKg: 0, baggageKg: 0 });
    expect(r.zeroFuel.massKg).toBeCloseTo(548.5);
    expect(r.zeroFuel.momentKgM * 1000).toBeCloseTo(130578, 0);
    expect(r.zeroFuel.armM * 1000).toBeCloseTo(238, 0);
  });

  it('flags aft CG with a light pilot, max baggage and full fuel', () => {
    const r = computeWB(VH_XTN, { ...noFuel, seatsKg: 60, baggageKg: 10, baggageExtKg: 10, fuelL: 91 });
    expect(r.takeoff.withinCg).toBe(false);
    expect(r.ok).toBe(false);
  });

  it('flags overweight and excess baggage', () => {
    const r = computeWB(VH_XTN, { ...noFuel, seatsKg: 200, baggageKg: 25, fuelL: 91 });
    expect(r.takeoff.withinMass).toBe(false);
    expect(r.errors.some((e) => e.includes('Baggage'))).toBe(true);
  });
});

describe('take-off distance (AFM Fig 5.4)', () => {
  // The AFM states 341 m. Its hand-drawn example line jumps onto the "300 m"
  // guide in the obstacle panel rather than running parallel to it; following
  // the guides properly gives ~350 m. Accept 341 m +5% / -1%.
  it('matches the AFM example: 1000 ft, 72 °F, 1600 lb, 4 kt HW, 16 ft obstacle -> 341 m', () => {
    const r = takeoffDistance({
      pressureAltitudeFt: 1000,
      oatC: ((72 - 32) * 5) / 9,
      massKg: 1600 / LB_PER_KG,
      windKt: 4,
      obstacleM: 16 / 3.28084,
    });
    expect(r.total).toBeGreaterThan(341 * 0.99);
    expect(r.total).toBeLessThan(341 * 1.05);
    // Intermediate stages vs the example line drawn in the AFM (read from the PDF).
    expect(r.afterWeight).toBeGreaterThan(360);
    expect(r.afterWeight).toBeLessThan(375);
    expect(r.afterWind).toBeGreaterThan(314);
    expect(r.afterWind).toBeLessThan(328);
  });

  it('increases with altitude, temperature, weight and tailwind', () => {
    const base = { pressureAltitudeFt: 2000, oatC: 15, massKg: 750, windKt: 0, obstacleM: 15 };
    const d = takeoffDistance(base).total;
    expect(takeoffDistance({ ...base, pressureAltitudeFt: 4000 }).total).toBeGreaterThan(d);
    expect(takeoffDistance({ ...base, oatC: 30 }).total).toBeGreaterThan(d);
    expect(takeoffDistance({ ...base, massKg: 800 }).total).toBeGreaterThan(d);
    expect(takeoffDistance({ ...base, windKt: -5 }).total).toBeGreaterThan(d);
    expect(takeoffDistance({ ...base, windKt: 10 }).total).toBeLessThan(d);
    expect(takeoffDistance({ ...base, obstacleM: 0 }).total).toBeLessThan(d);
  });

  it('is continuous across a pressure-altitude curve', () => {
    const at = (pa: number) =>
      takeoffDistance({ pressureAltitudeFt: pa, oatC: 20, massKg: 800, windKt: 0, obstacleM: 15 }).total;
    expect(Math.abs(at(1999.9) - at(2000.1))).toBeLessThan(1);
  });

  it('rejects conditions outside the chart', () => {
    const base = { pressureAltitudeFt: 0, oatC: 15, massKg: 800, windKt: 0, obstacleM: 15 };
    expect(() => takeoffDistance({ ...base, windKt: -8 })).toThrow(OutOfChartError);
    expect(() => takeoffDistance({ ...base, massKg: 820 })).toThrow(OutOfChartError);
    expect(() => takeoffDistance({ ...base, pressureAltitudeFt: 10000, oatC: 40 })).toThrow(OutOfChartError);
  });
});

describe('landing distance (AFM Table 4)', () => {
  it('reads the table and interpolates', () => {
    expect(landingDistance(0, false).over50ft).toBe(415);
    expect(landingDistance(3000, false).groundRoll).toBe(220);
    expect(landingDistance(1500, false).over50ft).toBeCloseTo(427.5);
  });
  it('applies the 1000 RPM idle factor', () => {
    const r = landingDistance(0, true);
    expect(r.over50ft).toBeCloseTo(415 * 1.05);
    expect(r.groundRoll).toBeCloseTo(201 * 1.07);
  });
});

describe('wind components', () => {
  it('matches the AFM Fig 5.3 example (11 kt at 30° -> 9.5 HW, 5.5 XW)', () => {
    const w = windComponents(0, 30, 11);
    expect(w.headwind).toBeCloseTo(9.5, 0);
    expect(w.crosswind).toBeCloseTo(5.5, 0);
  });
});

describe('pressure / density altitude (simplified)', () => {
  it('PA = elevation + (1013 − QNH) × 30', () => {
    expect(pressureAltitudeFt(0, 1013)).toBe(0);
    expect(pressureAltitudeFt(65, 1003)).toBe(365);
    expect(pressureAltitudeFt(1000, 1023)).toBe(700);
  });
  it('DA = PA + 120 × (OAT − 15)', () => {
    expect(densityAltitudeFt(0, 15)).toBe(0);
    expect(densityAltitudeFt(72, 22)).toBe(912);
  });
});
