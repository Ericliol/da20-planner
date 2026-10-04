import chart from '../data/takeoff.json';
import { MAX_TAKEOFF_KG } from './afm';
import { type Curve, curveAt, followGuides, OutOfChartError } from './interp';

/** AFM Fig 5.4 curves extracted from the vector PDF by tools/extract_takeoff.py. */
export const TAKEOFF_CHART = chart as Record<
  'pressureAltitude' | 'weight' | 'headwind' | 'tailwind' | 'obstacle',
  Curve[]
>;
export const PA_CURVES_FT = [0, 2000, 4000, 6000, 8000, 10000];

export interface TakeoffInput {
  pressureAltitudeFt: number;
  oatC: number;
  massKg: number;
  /** Positive = headwind, negative = tailwind (kt). */
  windKt: number;
  obstacleM: number;
}

export interface TakeoffResult {
  /** Distances (m) after each chart stage. */
  base: number;
  afterWeight: number;
  afterWind: number;
  /** Lift-off distance (0 m obstacle). */
  groundRoll: number;
  /** Distance to clear the obstacle. */
  total: number;
  notes: string[];
  /** Values actually used to enter the chart (after any conservative clamping). */
  used: TakeoffInput;
}

export function takeoffDistance(input: TakeoffInput): TakeoffResult {
  const notes: string[] = [];
  const used = { ...input };

  if (used.pressureAltitudeFt < 0) {
    used.pressureAltitudeFt = 0;
    notes.push('Pressure altitude below sea level: sea-level curve used (conservative).');
  }
  if (used.pressureAltitudeFt > 10000) throw new OutOfChartError('Pressure altitude above 10,000 ft is outside the chart.');
  if (used.oatC < -20 || used.oatC > 55) throw new OutOfChartError('OAT must be between -20 °C and 55 °C for the chart.');
  if (used.massKg > MAX_TAKEOFF_KG + 0.5) throw new OutOfChartError('Weight exceeds maximum take-off weight (800 kg / 1764 lb).');
  if (used.massKg < 600) {
    used.massKg = 600;
    notes.push('Weight below chart minimum (600 kg / 1323 lb): 600 kg used (conservative).');
  }
  if (used.windKt > 20) {
    used.windKt = 20;
    notes.push('Headwind above 20 kt: 20 kt used (conservative).');
  }
  if (used.windKt < -5) throw new OutOfChartError('Tailwind above 5 kt is outside the chart.');
  if (used.obstacleM < 0) used.obstacleM = 0;
  if (used.obstacleM > 15) {
    if (used.obstacleM > 15.3) throw new OutOfChartError('Obstacle height above 15 m (49 ft) is outside the chart.');
    used.obstacleM = 15; // 50 ft = 15.24 m: chart top is 15 m / 49 ft
  }

  const base = baseDistance(used.pressureAltitudeFt, used.oatC);
  const afterWeight = followGuides(TAKEOFF_CHART.weight, MAX_TAKEOFF_KG, used.massKg, base);
  // Headwind: from the 0 kt reference follow the solid lines up to the headwind.
  // Tailwind: enter at the tailwind value and follow the dashed lines up to the 0 kt line.
  const afterWind =
    used.windKt >= 0
      ? followGuides(TAKEOFF_CHART.headwind, 0, used.windKt, afterWeight)
      : followGuides(TAKEOFF_CHART.tailwind, used.windKt, 0, afterWeight);
  const total = followGuides(TAKEOFF_CHART.obstacle, 0, used.obstacleM, afterWind);

  return { base, afterWeight, afterWind, groundRoll: afterWind, total, notes, used };
}

/** Panel 1: interpolate between pressure-altitude curves at the given OAT. */
export function baseDistance(paFt: number, oatC: number): number {
  let i = 0;
  while (i < PA_CURVES_FT.length - 2 && paFt > PA_CURVES_FT[i + 1]) i++;
  const lo = curveAt(TAKEOFF_CHART.pressureAltitude[i], oatC);
  const hi = curveAt(TAKEOFF_CHART.pressureAltitude[i + 1], oatC);
  if (lo === undefined || hi === undefined) {
    throw new OutOfChartError('Take-off distance is off the top of the chart (over 1000 m) for this altitude/temperature.');
  }
  const f = (paFt - PA_CURVES_FT[i]) / (PA_CURVES_FT[i + 1] - PA_CURVES_FT[i]);
  return lo + f * (hi - lo);
}
