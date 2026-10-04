/**
 * Australian take-off / landing distance factors (CAO 20.7.4), applied to the
 * AFM distance to / from 50 ft. The factored distance must not exceed TODA / LDA.
 *
 *   Take-off: 1.15 up to 2000 kg MTOW, linear to 1.25 at 3500 kg, 1.25 above.
 *   Landing:  1.15 up to 2000 kg MTOW, linear to 1.43 at 4500 kg, 1.43 above.
 */
function interp(mtowKg: number, fromKg: number, toKg: number, lo: number, hi: number): number {
  if (mtowKg <= fromKg) return lo;
  if (mtowKg >= toKg) return hi;
  return lo + ((mtowKg - fromKg) / (toKg - fromKg)) * (hi - lo);
}

export const takeoffFactor = (mtowKg: number) => interp(mtowKg, 2000, 3500, 1.15, 1.25);
export const landingFactor = (mtowKg: number) => interp(mtowKg, 2000, 4500, 1.15, 1.43);

export const FACTOR_SOURCE = 'CAO 20.7.4';

/**
 * Runway surface factors from UK CAA Safety Sense 09 "Weight, balance and
 * performance" (August 2024), used because the DA20-C1 AFM gives none. They are
 * applied to the AFM distance before the general factor above.
 */
export const SURFACES = {
  'paved-dry': { label: 'Paved, dry', takeoff: 1, landing: 1 },
  'paved-wet': { label: 'Paved, wet', takeoff: 1, landing: 1.15 },
  'grass-dry': { label: 'Grass, dry (up to 20 cm)', takeoff: 1.2, landing: 1.15 },
  'grass-wet': { label: 'Grass, wet (up to 20 cm)', takeoff: 1.3, landing: 1.35 },
  soft: { label: 'Soft ground or snow', takeoff: 1.25, landing: 1.25 },
} as const;
export type Surface = keyof typeof SURFACES;
export const SURFACE_SOURCE = 'CAA Safety Sense 09';
