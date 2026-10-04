/**
 * Australian take-off / landing distance factors (CAO 20.7.4 para 6.1 and 10.1), applied to the
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
/** CAO 20.7.4 on the Federal Register of Legislation (no longer in force from 2 Dec 2021). */
export const FACTOR_URL = 'https://www.legislation.gov.au/F2005B00786/latest/text';

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
/**
 * Runway slope factors, CAA Safety Sense 09 (Aug 2024) p. 13: for every 2% slope,
 * uphill take-off x1.1 and downhill landing x1.1; the leaflet multiplies factors
 * together, hence 1.1^(slope / 2). No credit for downhill take-off or uphill landing.
 * slopePct: + uphill / - downhill in the direction of travel.
 */
export const takeoffSlopeFactor = (slopePct: number) => (slopePct > 0 ? Math.pow(1.1, slopePct / 2) : 1);
export const landingSlopeFactor = (slopePct: number) => (slopePct < 0 ? Math.pow(1.1, -slopePct / 2) : 1);

export const SURFACE_URL = 'https://www.caa.co.uk/media/wcebqozv/ssl09-caa-safety-sense-weight-balance-and-performance.pdf';
