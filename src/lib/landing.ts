import { IDLE_1000RPM_FACTOR, LANDING_TABLE } from './afm';
import { tableLookup } from './interp';

export interface LandingResult {
  over50ft: number;
  groundRoll: number;
  notes: string[];
}

/**
 * AFM 5.3.12 Table 4. The AFM only tabulates by altitude (max weight, standard
 * temperature, no wind), so no weight/temperature/wind corrections are applied.
 */
export function landingDistance(altitudeFt: number, idle1000Rpm: boolean): LandingResult {
  const notes: string[] = [];
  let alt = altitudeFt;
  if (alt < 0) {
    alt = 0;
    notes.push('Altitude below sea level: sea-level value used.');
  }
  if (alt > 7000) notes.push('Above 7000 ft the AFM table is extrapolated.');
  let over50ft = tableLookup(LANDING_TABLE.altitudeFt, LANDING_TABLE.over50ft, alt);
  let groundRoll = tableLookup(LANDING_TABLE.altitudeFt, LANDING_TABLE.groundRoll, alt);
  if (idle1000Rpm) {
    over50ft *= IDLE_1000RPM_FACTOR.over50ft;
    groundRoll *= IDLE_1000RPM_FACTOR.groundRoll;
    notes.push('Ground idle 1000 RPM: +5% landing distance, +7% ground roll (AFM 5.3.12).');
  }
  return { over50ft, groundRoll, notes };
}
