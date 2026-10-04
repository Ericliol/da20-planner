/** Pressure altitude: elevation + (1013 - QNH) x 30 ft per hPa (pilot rule of thumb). */
export function pressureAltitudeFt(elevationFt: number, qnhHpa: number): number {
  return elevationFt + (1013 - qnhHpa) * 30;
}

/** ISA temperature used here: 15 °C, without the 2 °C / 1000 ft lapse rate (simplification). */
export const ISA_TEMP_C = 15;

/** Density altitude: PA + 120 ft per °C above ISA (15 °C). */
export function densityAltitudeFt(paFt: number, oatC: number): number {
  return paFt + 120 * (oatC - ISA_TEMP_C);
}

/**
 * Wind components relative to a runway.
 * headwind > 0 is a headwind, < 0 a tailwind; crosswind > 0 from the right.
 */
export function windComponents(runwayHeadingDeg: number, windDirDeg: number, windKt: number) {
  const a = ((windDirDeg - runwayHeadingDeg) * Math.PI) / 180;
  return { headwind: windKt * Math.cos(a), crosswind: windKt * Math.sin(a) };
}
