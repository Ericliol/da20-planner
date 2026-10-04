import type { AppState } from '../state';
import { FT_PER_M, MAX_TAKEOFF_KG } from './afm';
import { isaTempC, pressureAltitudeFt, windComponents } from './atmos';
import { landingFactor, SURFACES, takeoffFactor } from './factors';
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
  /** Runway surface factors (CAA Safety Sense 09). */
  toSurfaceFactor: number;
  ldSurfaceFactor: number;
  extra: number;
  depPaFt: number;
  depHeadwindKt: number;
  /** Wind actually used for the take-off chart (headwind removed when ignored). */
  depWindUsedKt: number;
  headwindIgnored: boolean;
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
  // Optionally take no credit for headwind; a tailwind always counts.
  const headwindIgnored = state.ignoreHeadwind && depHeadwindKt > 0;
  const depWindUsedKt = headwindIgnored ? 0 : depHeadwindKt;
  let to: TakeoffResult | null = null;
  let to50: TakeoffResult | null = null;
  let toError = '';
  try {
    const input = { pressureAltitudeFt: depPaFt, oatC: departure.oatC, massKg: wb.takeoff.massKg, windKt: depWindUsedKt };
    // TODR is always based on the distance to 50 ft (chart top, 15 m).
    to50 = takeoffDistance({ ...input, obstacleM: 15 });
    to = takeoffDistance({ ...input, obstacleM: departure.obstacleFt / FT_PER_M });
  } catch (e) {
    toError = e instanceof OutOfChartError ? e.message : String(e);
  }
  const toSurfaceFactor = SURFACES[departure.surface].takeoff;
  const todr = to50 ? to50.total * toSurfaceFactor * toFactor * extra : 0;
  const toOk = to50 ? todr <= departure.availableM : false;

  // ---- landing ----
  const arrPaFt = pressureAltitudeFt(arrival.elevationFt, arrival.qnhHpa);
  const arrHeadwindKt = windComponents(arrival.runwayHeadingDeg, arrival.windDirDeg, arrival.windKt).headwind;
  const ld = landingDistance(arrPaFt, aircraft.idle1000Rpm);
  const ldSurfaceFactor = SURFACES[arrival.surface].landing;
  const ldr = ld.over50ft * ldSurfaceFactor * ldFactor * extra;
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
    toSurfaceFactor,
    ldSurfaceFactor,
    extra,
    depPaFt,
    depHeadwindKt,
    depWindUsedKt,
    headwindIgnored,
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
