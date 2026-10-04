import type { AppState } from '../state';
import { FT_PER_M, MAX_TAKEOFF_KG } from './afm';
import { isaTempC, pressureAltitudeFt, windComponents } from './atmos';
import { landingFactor, takeoffFactor } from './factors';
import { OutOfChartError } from './interp';
import { landingDistance, type LandingResult } from './landing';
import { takeoffDistance, type TakeoffResult } from './takeoff';
import type { Aircraft, WBResult } from './wb';

export interface PerformanceResult {
  departure: AppState['departure'];
  /** Arrival aerodrome after applying "same as departure". */
  arrival: AppState['arrival'];
  /** CAO 20.7.4 factors and the extra school / personal margin. */
  toFactor: number;
  ldFactor: number;
  extra: number;
  depPaFt: number;
  depHeadwindKt: number;
  /** Take-off to 50 ft: the TODR basis. */
  to50: TakeoffResult | null;
  /** Take-off to the obstacle height entered. */
  to: TakeoffResult | null;
  toError: string;
  todr: number;
  toOk: boolean;
  arrPaFt: number;
  arrHeadwindKt: number;
  ld: LandingResult;
  ldr: number;
  ldOk: boolean;
  ldNotes: string[];
}

export function computePerformance(state: AppState, aircraft: Aircraft, wb: WBResult): PerformanceResult {
  const departure = state.departure;
  const arrival = state.arrival.sameAsDeparture
    ? { ...state.arrival, ...departure, availableM: state.arrival.availableM, sameAsDeparture: true }
    : state.arrival;
  const extra = state.marginFactor;
  const toFactor = takeoffFactor(MAX_TAKEOFF_KG);
  const ldFactor = landingFactor(MAX_TAKEOFF_KG);

  // ---- take-off ----
  const depPaFt = pressureAltitudeFt(departure.elevationFt, departure.qnhHpa);
  const depHeadwindKt = windComponents(departure.runwayHeadingDeg, departure.windDirDeg, departure.windKt).headwind;
  let to: TakeoffResult | null = null;
  let to50: TakeoffResult | null = null;
  let toError = '';
  try {
    const input = { pressureAltitudeFt: depPaFt, oatC: departure.oatC, massKg: wb.takeoff.massKg, windKt: depHeadwindKt };
    // TODR is always based on the distance to 50 ft (chart top, 15 m).
    to50 = takeoffDistance({ ...input, obstacleM: 15 });
    to = takeoffDistance({ ...input, obstacleM: departure.obstacleFt / FT_PER_M });
  } catch (e) {
    toError = e instanceof OutOfChartError ? e.message : String(e);
  }
  const todr = to50 ? to50.total * toFactor * extra : 0;
  const toOk = to50 ? todr <= departure.availableM : false;

  // ---- landing ----
  const arrPaFt = pressureAltitudeFt(arrival.elevationFt, arrival.qnhHpa);
  const arrHeadwindKt = windComponents(arrival.runwayHeadingDeg, arrival.windDirDeg, arrival.windKt).headwind;
  const ld = landingDistance(arrPaFt, aircraft.idle1000Rpm);
  const ldr = ld.over50ft * ldFactor * extra;
  const ldOk = ldr <= arrival.availableM;
  const ldNotes = [...ld.notes];
  if (arrival.oatC > isaTempC(arrPaFt) + 0.5)
    ldNotes.push(`OAT is ${Math.round(arrival.oatC - isaTempC(arrPaFt))} °C above ISA. The AFM landing table is for standard temperature only, so expect a longer distance.`);
  if (arrHeadwindKt < -0.5) ldNotes.push('Tailwind component: the AFM landing table has no wind correction, so expect a longer distance.');
  if (wb.landing.massKg < 799) ldNotes.push('AFM landing data is for max weight (800 kg), so it is conservative at lower weights.');

  return {
    departure,
    arrival,
    toFactor,
    ldFactor,
    extra,
    depPaFt,
    depHeadwindKt,
    to50,
    to,
    toError,
    todr,
    toOk,
    arrPaFt,
    arrHeadwindKt,
    ld,
    ldr,
    ldOk,
    ldNotes,
  };
}
