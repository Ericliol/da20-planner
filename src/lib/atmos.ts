/** Pressure altitude from field elevation and QNH (hPa), ISA formula. */
export function pressureAltitudeFt(elevationFt: number, qnhHpa: number): number {
  return elevationFt + 145366.45 * (1 - Math.pow(qnhHpa / 1013.25, 0.190284));
}

/** ISA temperature (°C) at a pressure altitude. */
export function isaTempC(paFt: number): number {
  return 15 - (1.98 * paFt) / 1000;
}

/** Density altitude, standard approximation. */
export function densityAltitudeFt(paFt: number, oatC: number): number {
  return paFt + 120 * (oatC - isaTempC(paFt));
}

/**
 * Wind components relative to a runway.
 * headwind > 0 is a headwind, < 0 a tailwind; crosswind > 0 from the right.
 */
export function windComponents(runwayHeadingDeg: number, windDirDeg: number, windKt: number) {
  const a = ((windDirDeg - runwayHeadingDeg) * Math.PI) / 180;
  return { headwind: windKt * Math.cos(a), crosswind: windKt * Math.sin(a) };
}
