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
