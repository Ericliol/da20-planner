// DA20-C1 AFM (DOC # DA202-C1) constants. Internal units: kg, metres, litres.
// Source references are given next to each value.

export const LB_PER_KG = 2.20462;
export const IN_PER_M = 39.3701;
export const FT_PER_M = 3.28084;
export const L_PER_USGAL = 3.78541;

/** Fuel density, AFM Fig 6.6/6.7: 0.72 kg/L (6.01 lb/US gal). */
export const FUEL_KG_PER_L = 0.72;

/** Lever arms (aft of datum = wing root rib leading edge), AFM Fig 6.7. */
export const ARM = {
  seats: 0.143, // pilot & passenger, 5.63 in
  baggage: 0.824, // 32.44 in
  baggageExt: 1.575, // 62.0 in
  fuel: 0.824, // 32.44 in
} as const;

/** AFM 2.7 Weight. */
export const MAX_TAKEOFF_KG = 800; // 1764 lb
export const MAX_RAMP_KG = 803; // 1770 lb
export const MAX_BAGGAGE_KG = 20; // 44 lb, compartment + extension combined, harness required

/** AFM 1.8 / 7 fuel: usable capacity depends on the fuel system type. */
export const USABLE_FUEL_L = { type1: 80.5, type2: 91 } as const;
export type FuelSystem = keyof typeof USABLE_FUEL_L;

/**
 * AFM Fig 6.8 Permissible Center of Gravity Range and Permissible Flight-Weight-Moment,
 * built from the AFM 2.8 points (arm aft of datum):
 *   A 750 kg / 0.202 m   B 800 kg / 0.205 m   C 800 kg / 0.309 m   D 750 kg / 0.317 m
 * Below 750 kg the arm limits are constant (lines through the origin). Between 750 and
 * 800 kg Fig 6.8 joins the corners with straight lines in weight-moment space, so the
 * moment limits are interpolated linearly, exactly as the chart is read.
 * (Measured from the PDF vectors: 9540 / 13141 / 14235 and 14976 / 20629 / 21450 in·lb
 * at 1200 / 1653 / 1764 lb.)
 */
export function momentLimits(massKg: number): { fwd: number; aft: number } {
  if (massKg <= 750) return { fwd: massKg * 0.202, aft: massKg * 0.317 };
  const t = (massKg - 750) / 50;
  const lerp = (a: number, b: number) => a + t * (b - a);
  return { fwd: lerp(750 * 0.202, 800 * 0.205), aft: lerp(750 * 0.317, 800 * 0.309) };
}

/** CG arm limits (m) equivalent to the Fig 6.8 moment limits. */
export function cgLimits(massKg: number): { fwd: number; aft: number } {
  const m = momentLimits(massKg);
  return { fwd: m.fwd / massKg, aft: m.aft / massKg };
}

/** Fig 6.8 envelope as (moment kg·m, mass kg); lower edge at the chart floor (1200 lb). */
export const ENVELOPE_FLOOR_KG = 1200 / LB_PER_KG;
export const ENVELOPE: [number, number][] = [ENVELOPE_FLOOR_KG, 750, 800, 800, 750, ENVELOPE_FLOOR_KG].map((kg, i) => {
  const lim = momentLimits(kg);
  return [i < 3 ? lim.fwd : lim.aft, kg];
});

/**
 * AFM 5.3.12 Table 4 - landing distance at max T/O weight, 55 KIAS, flaps LDG,
 * level paved runway, standard temperature. Metres.
 */
export const LANDING_TABLE = {
  altitudeFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000],
  over50ft: [415, 423, 432, 441, 450, 461, 471, 482],
  groundRoll: [201, 207, 214, 220, 227, 234, 241, 248],
} as const;

/** AFM 5.3.12 note: ground idle set to 1000 RPM. */
export const IDLE_1000RPM_FACTOR = { over50ft: 1.05, groundRoll: 1.07 } as const;
